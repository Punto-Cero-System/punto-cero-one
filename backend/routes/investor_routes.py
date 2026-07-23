"""Investor Access Request routes.
- Public:  POST /api/investor-requests   → submit a new request
- Admin:   GET  /api/admin/investor-requests           (list + filter)
           GET  /api/admin/investor-requests/stats     (dashboard KPIs)
           GET  /api/admin/investor-requests/{id}      (detail)
           PATCH /api/admin/investor-requests/{id}     (update status/notes)
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pymongo import ReturnDocument

from auth import require_admin
from models import (
    InvestorRequest,
    InvestorRequestCreate,
    InvestorRequestPublicResponse,
    InvestorRequestStats,
    InvestorRequestStatusUpdate,
    VALID_STATUSES,
)

public_router = APIRouter(prefix="/api/investor-requests", tags=["investor-requests"])
admin_router = APIRouter(prefix="/api/admin/investor-requests", tags=["admin"])


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
