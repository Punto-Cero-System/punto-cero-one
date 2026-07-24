"""Investor Access Request routes + Investor Portal (FASE 5).
- Public:  POST /api/investor-requests          → submit a new request
- Admin:   GET  /api/admin/investor-requests    (list + filter)
           GET  /api/admin/investor-requests/stats
           GET  /api/admin/investor-requests/{id}
           PATCH /api/admin/investor-requests/{id}
           POST /api/admin/investor-requests/{id}/invite  → generate investor invitation
           GET  /api/admin/investors
           GET  /api/admin/access-log
- Public:  POST /api/auth/accept-invitation     → set password, activate investor
- Investor: GET  /api/investor/room             → curated document catalog
           POST /api/investor/access-log        → log a view/download event
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import secrets
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pymongo import ReturnDocument

from auth import require_admin, get_current_user, hash_password
from models import (
    AcceptInvitationInput,
    InvestorInvitationResponse,
    InvestorRequest,
    InvestorRequestCreate,
    InvestorRequestPublicResponse,
    InvestorRequestStats,
    InvestorRequestStatusUpdate,
    UserPublic,
    VALID_STATUSES,
)

public_router = APIRouter(prefix="/api/investor-requests", tags=["investor-requests"])
admin_router = APIRouter(prefix="/api/admin/investor-requests", tags=["admin"])
admin_extra_router = APIRouter(prefix="/api/admin", tags=["admin"])
investor_router = APIRouter(prefix="/api/investor", tags=["investor"])
public_auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


INVITATION_TTL_HOURS = 168  # 7 days


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _strip_mongo_id(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ------------- PUBLIC -------------
@public_router.post("", response_model=InvestorRequestPublicResponse, status_code=201)
async def submit_investor_request(payload: InvestorRequestCreate, request: Request):
    db = request.app.state.db

    obj = InvestorRequest(**payload.model_dump())
    doc = obj.model_dump()
    await db.investor_requests.insert_one(doc)

    return InvestorRequestPublicResponse(
        id=obj.id,
        status=obj.status,
        submitted_at=obj.submitted_at,
    )


# ------------- ADMIN -------------
@admin_router.get("/stats", response_model=InvestorRequestStats)
async def stats(request: Request, _: dict = Depends(require_admin)):
    db = request.app.state.db
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    counts = {s: 0 for s in VALID_STATUSES}
    async for row in db.investor_requests.aggregate(pipeline):
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    total = sum(counts.values())
    return InvestorRequestStats(total=total, **counts)


@admin_router.get("")
async def list_requests(
    request: Request,
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    _: dict = Depends(require_admin),
):
    db = request.app.state.db
    query: dict = {}
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Estado inválido")
        query["status"] = status
    if search:
        # case-insensitive search on name, email, company, country
        rx = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"fullName": rx},
            {"email": rx},
            {"company": rx},
            {"country": rx},
        ]

    cursor = (
        db.investor_requests
        .find(query, {"_id": 0})
        .sort("submitted_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [doc async for doc in cursor]
    total = await db.investor_requests.count_documents(query)
    return {"items": items, "total": total, "limit": limit, "skip": skip}


@admin_router.get("/{req_id}", response_model=InvestorRequest)
async def get_request(req_id: str, request: Request, _: dict = Depends(require_admin)):
    db = request.app.state.db
    doc = await db.investor_requests.find_one({"id": req_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return InvestorRequest(**doc)


@admin_router.patch("/{req_id}", response_model=InvestorRequest)
async def update_request(
    req_id: str,
    payload: InvestorRequestStatusUpdate,
    request: Request,
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    update: dict = {
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": admin["id"],
    }
    if payload.admin_notes is not None:
        update["admin_notes"] = payload.admin_notes

    result = await db.investor_requests.find_one_and_update(
        {"id": req_id},
        {"$set": update},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return InvestorRequest(**result)


# ==================================================================
# FASE 5 · INVESTOR INVITATION FLOW
# ==================================================================
def _public_base_url() -> str:
    # Frontend origin. Falls back to backend URL if not defined.
    return os.environ.get("PUBLIC_APP_URL") or ""


@admin_router.post("/{req_id}/invite", response_model=InvestorInvitationResponse)
async def invite_investor(
    req_id: str,
    request: Request,
    admin: dict = Depends(require_admin),
):
    """Approve a request (if not already) and generate an investor user + invitation token."""
    db = request.app.state.db
    req = await db.investor_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    email = (req.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="La solicitud no tiene email")

    # Idempotent: reuse existing investor if already created
    existing = await db.users.find_one({"email": email})
    if existing and existing.get("role") == "admin":
        raise HTTPException(status_code=409, detail="Ese email pertenece a un administrador")

    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    expires = now + timedelta(hours=INVITATION_TTL_HOURS)

    if existing:
        user_id = existing["id"]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "invitation_token": token,
                "invitation_expires_at": _iso(expires),
                "invited_by": admin["id"],
                "invited_at": _iso(now),
                "role": "investor",
                "must_change_password": True,
            }},
        )
    else:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": email,
            "name": req.get("fullName") or email,
            "role": "investor",
            "password_hash": hash_password(secrets.token_urlsafe(24)),  # random until accepted
            "created_at": _iso(now),
            "invitation_token": token,
            "invitation_expires_at": _iso(expires),
            "invited_by": admin["id"],
            "invited_at": _iso(now),
            "must_change_password": True,
            "source_request_id": req_id,
        })

    # Set request status to approved + linked user
    await db.investor_requests.update_one(
        {"id": req_id},
        {"$set": {
            "status": "approved",
            "updated_at": _iso(now),
            "reviewed_by": admin["id"],
            "investor_user_id": user_id,
            "invited_at": _iso(now),
        }},
    )

    base = _public_base_url()
    invitation_url = f"{base}/investor/setup?token={token}" if base else f"/investor/setup?token={token}"

    return InvestorInvitationResponse(
        request_id=req_id,
        user_id=user_id,
        email=email,
        name=req.get("fullName") or email,
        invitation_token=token,
        invitation_url=invitation_url,
        expires_at=_iso(expires),
    )


@public_auth_router.post("/accept-invitation")
async def accept_invitation(payload: AcceptInvitationInput, request: Request):
    """Public endpoint. Consumes an invitation token and sets the investor's password."""
    db = request.app.state.db
    user = await db.users.find_one({"invitation_token": payload.token})
    if not user:
        raise HTTPException(status_code=404, detail="Invitación no encontrada o ya utilizada")
    if user.get("role") != "investor":
        raise HTTPException(status_code=400, detail="Invitación inválida")
    exp = user.get("invitation_expires_at")
    if exp:
        try:
            exp_dt = datetime.fromisoformat(exp)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(status_code=410, detail="La invitación ha expirado")
        except HTTPException:
            raise
        except Exception:
            pass

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.password),
                "must_change_password": False,
                "accepted_invitation_at": _iso(datetime.now(timezone.utc)),
            },
            "$unset": {"invitation_token": "", "invitation_expires_at": ""},
        },
    )
    return {"ok": True, "email": user["email"], "name": user["name"]}


# ==================================================================
# INVESTOR PORTAL (role=investor)
# ==================================================================
async def require_investor(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "investor":
        raise HTTPException(status_code=403, detail="Se requiere rol inversionista")
    return user


DOCUMENT_CATALOG = [
    {"id": "executive-summary", "title": "Executive Summary", "kind": "experience",
     "description": "13 secciones — origen, visión, ecosistema, conversación estratégica.", "path": "/executive-summary"},
    {"id": "pitch-deck", "title": "Investor Pitch Deck (12 slides)", "kind": "experience",
     "description": "Recorrido cinematográfico + analítica de engagement.", "path": "/investor-pitch-deck"},
    {"id": "pitch-deck-pdf", "title": "Investor Pitch Deck · PDF", "kind": "document",
     "description": "PDF institucional generado en tiempo real (13 páginas).", "path": "/api/pitch-deck/download", "external": True},
    {"id": "capital-strategy", "title": "Capital Strategy · Financial Model", "kind": "experience",
     "description": "Escenarios, uso de capital, cash flow simulator con motor 36m.", "path": "/capital-strategy"},
    {"id": "punto-cero-legal", "title": "Punto Cero Legal", "kind": "product",
     "description": "Primer vertical comercial · LIVE en producción.", "path": "https://puntocerolegal.com", "external": True},
]


@investor_router.get("/room")
async def investor_room(request: Request, user: dict = Depends(require_investor)):
    db = request.app.state.db
    # Log entry
    await db.investor_access_log.insert_one({
        "user_id": user["id"],
        "email": user["email"],
        "action": "room_visit",
        "resource": "investor_room",
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    return {
        "user": UserPublic(
            id=user["id"], email=user["email"], name=user["name"],
            role=user["role"], created_at=user["created_at"],
            must_change_password=user.get("must_change_password", False),
        ),
        "documents": DOCUMENT_CATALOG,
    }


@investor_router.post("/access-log")
async def log_access(
    request: Request,
    user: dict = Depends(require_investor),
):
    body = await request.json()
    doc_id = str(body.get("document_id") or "")[:80]
    action = str(body.get("action") or "view")[:40]
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id requerido")
    db = request.app.state.db
    await db.investor_access_log.insert_one({
        "user_id": user["id"],
        "email": user["email"],
        "action": action,
        "resource": doc_id,
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    return {"ok": True}


# ==================================================================
# ADMIN · investors + access log
# ==================================================================
@admin_extra_router.get("/investors")
async def list_investors(request: Request, _: dict = Depends(require_admin)):
    db = request.app.state.db
    cursor = db.users.find(
        {"role": "investor"},
        {"_id": 0, "password_hash": 0, "invitation_token": 0},
    ).sort("created_at", -1)
    items = [doc async for doc in cursor]
    total = await db.users.count_documents({"role": "investor"})
    active = await db.users.count_documents({"role": "investor", "must_change_password": {"$ne": True}})
    pending = total - active
    return {"items": items, "total": total, "active": active, "pending": pending}


@admin_extra_router.get("/access-log")
async def access_log(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    user_id: Optional[str] = Query(default=None),
    _: dict = Depends(require_admin),
):
    db = request.app.state.db
    q = {}
    if user_id:
        q["user_id"] = user_id
    cursor = db.investor_access_log.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = [doc async for doc in cursor]
    total = await db.investor_access_log.count_documents(q)
    return {"items": items, "total": total}
