"""Jobs API — vacancies belong to a Company.

Endpoints
---------
POST   /api/jobs                            — create job (company owner/team)
GET    /api/jobs                            — list (public) with filters
GET    /api/jobs/{id}                       — single
PATCH  /api/jobs/{id}                       — update (company owner or admin)
DELETE /api/jobs/{id}                       — soft delete (owner or admin)
POST   /api/jobs/{id}/apply                 — submit application
POST   /api/jobs/{id}/save                  — toggle save (candidate)
GET    /api/jobs/{id}/applications          — list applications (owner/admin)
PATCH  /api/applications/{id}/status        — company recruiter updates status
GET    /api/me/applications                 — my applications
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth import require_admin
from services.community_deps import current_user_or_none, require_current_user
from services.analytics import record_event
from services.notifications import dispatch as dispatch_notif
from models_business import (
    JobCreate, JobUpdate, JobPublic, JobListResponse,
    ApplicationCreate, ApplicationPublic, ApplicationStatusUpdate,
    new_job_id, new_application_id,
)


logger = logging.getLogger("punto-cero-api.jobs")

router = APIRouter(prefix="/api", tags=["jobs"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _company_or_404(db, company_id: str) -> dict:
    c = await db.companies.find_one(
        {"id": company_id, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return c


async def _can_manage_company(company: dict, user: dict) -> bool:
    if user.get("role") == "admin":
        return True
    if company.get("owner_id") == user["id"]:
        return True
    for tm in (company.get("team") or []):
        if tm.get("user_id") == user["id"]:
            return True
    return False


async def _job_to_public(db, job: dict, viewer: Optional[dict]) -> JobPublic:
    company_id = job.get("company_id")
    company = None
    if company_id:
        company = await db.companies.find_one({"id": company_id},
                                              {"_id": 0, "name": 1, "logo_url": 1, "slug": 1})
    my_applied = my_saved = False
    if viewer:
        a = await db.job_applications.find_one(
            {"job_id": job["id"], "applicant_id": viewer["id"], "is_deleted": {"$ne": True}},
            {"_id": 0, "id": 1},
        )
        my_applied = bool(a)
        s = await db.job_saves.find_one(
            {"job_id": job["id"], "user_id": viewer["id"]}, {"_id": 0, "id": 1}
        )
        my_saved = bool(s)
    return JobPublic(
        id=job["id"],
        company_id=company_id,
        company_name=(company or {}).get("name") or job.get("company_name"),
        company_logo=(company or {}).get("logo_url") or job.get("company_logo"),
        company_slug=(company or {}).get("slug"),
        title=job["title"],
        description=job.get("description") or "",
        modality=job.get("modality") or ("remote" if job.get("remote") else "unspecified"),
        employment=job.get("employment") or job.get("job_type") or "full_time",
        location=job.get("location"),
        country=job.get("country"),
        salary_range=job.get("salary_range"),
        tags=job.get("tags", []),
        is_active=bool(job.get("is_active", True)),
        applications_count=int(job.get("applications_count", 0)),
        my_applied=my_applied, my_saved=my_saved,
        created_at=job["created_at"], updated_at=job["updated_at"],
    )


# ---------------------------------------------------------------------------
# JOB CRUD
# ---------------------------------------------------------------------------
@router.post("/jobs", response_model=JobPublic)
async def create_job(
    payload: JobCreate,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    company = await _company_or_404(db, payload.company_id)
    if not await _can_manage_company(company, user):
        raise HTTPException(status_code=403, detail="No puedes publicar empleos para esta empresa")
    now = _now()
    doc = {
        **payload.model_dump(),
        "id": new_job_id(),
        "applications_count": 0,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.jobs.insert_one(doc)
    await db.companies.update_one({"id": company["id"]}, {"$inc": {"jobs_count": 1}})
    await record_event(db, "job.posted",
                       actor_id=user["id"], subject_type="job", subject_id=doc["id"],
                       country=payload.country, vertical=company.get("vertical"))
    return await _job_to_public(db, doc, user)


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    company_id: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    modality: Optional[str] = Query(default=None),
    employment: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    saved_by_me: bool = Query(default=False),
    active_only: bool = Query(default=True),
):
    viewer = await current_user_or_none(request)
    db = request.app.state.db
    query: dict = {"is_deleted": {"$ne": True}}
    if active_only:
        query["is_active"] = True
    if company_id: query["company_id"] = company_id
    if country: query["country"] = country
    if modality: query["modality"] = modality
    if employment: query["employment"] = employment
    if tag: query["tags"] = tag
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if saved_by_me:
        if not viewer:
            raise HTTPException(status_code=401, detail="Debes iniciar sesión")
        saved_ids = [s["job_id"] async for s in db.job_saves.find({"user_id": viewer["id"]}, {"_id": 0, "job_id": 1})]
        query["id"] = {"$in": saved_ids}
    if cursor:
        query["created_at"] = {"$lt": cursor}
    cur = db.jobs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1)
    docs = [d async for d in cur]
    has_more = len(docs) > limit
    docs = docs[:limit]
    items = [await _job_to_public(db, d, viewer) for d in docs]
    return JobListResponse(
        items=items,
        total=len(items),
        next_cursor=(docs[-1]["created_at"] if has_more and docs else None),
    )


@router.get("/jobs/{job_id}", response_model=JobPublic)
async def get_job(job_id: str, request: Request):
    viewer = await current_user_or_none(request)
    db = request.app.state.db
    doc = await db.jobs.find_one({"id": job_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Empleo no encontrado")
    return await _job_to_public(db, doc, viewer)


@router.patch("/jobs/{job_id}", response_model=JobPublic)
async def update_job(
    job_id: str,
    payload: JobUpdate,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    doc = await db.jobs.find_one({"id": job_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Empleo no encontrado")
    company = await _company_or_404(db, doc["company_id"])
    if not await _can_manage_company(company, user):
        raise HTTPException(status_code=403, detail="No puedes editar este empleo")
    diff = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    diff["updated_at"] = _now()
    await db.jobs.update_one({"id": job_id}, {"$set": diff})
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return await _job_to_public(db, fresh, user)


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    doc = await db.jobs.find_one({"id": job_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Empleo no encontrado")
    company = await _company_or_404(db, doc["company_id"])
    if not await _can_manage_company(company, user):
        raise HTTPException(status_code=403, detail="No puedes borrar este empleo")
    await db.jobs.update_one({"id": job_id}, {"$set": {"is_deleted": True, "updated_at": _now()}})
    await db.companies.update_one({"id": company["id"]}, {"$inc": {"jobs_count": -1}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# SAVE / APPLY
# ---------------------------------------------------------------------------
@router.post("/jobs/{job_id}/save")
async def toggle_job_save(
    job_id: str, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    existing = await db.job_saves.find_one({"job_id": job_id, "user_id": user["id"]}, {"_id": 0})
    if existing:
        await db.job_saves.delete_one({"job_id": job_id, "user_id": user["id"]})
        return {"saved": False}
    await db.job_saves.insert_one({
        "job_id": job_id, "user_id": user["id"], "created_at": _now(),
    })
    return {"saved": True}


@router.post("/jobs/{job_id}/apply", response_model=ApplicationPublic)
async def apply_to_job(
    job_id: str, payload: ApplicationCreate,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    job = await db.jobs.find_one({"id": job_id, "is_deleted": {"$ne": True}, "is_active": True}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Empleo no encontrado o cerrado")
    existing = await db.job_applications.find_one(
        {"job_id": job_id, "applicant_id": user["id"], "is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1},
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya aplicaste a este empleo")
    now = _now()
    doc = {
        "id": new_application_id(),
        "job_id": job_id,
        "company_id": job["company_id"],
        "applicant_id": user["id"],
        "applicant_name": user.get("name"),
        "applicant_email": payload.contact_email or user.get("email"),
        "applicant_picture": user.get("picture"),
        "cover_letter": payload.cover_letter,
        "cv_document_id": payload.cv_document_id,
        "status": "submitted",
        "is_deleted": False,
        "created_at": now, "updated_at": now,
    }
    await db.job_applications.insert_one(doc)
    await db.jobs.update_one({"id": job_id}, {"$inc": {"applications_count": 1}})
    await record_event(db, "job.applied",
                       actor_id=user["id"], subject_type="job", subject_id=job_id,
                       country=job.get("country"))
    # Notify company owner
    company = await db.companies.find_one({"id": job["company_id"]}, {"_id": 0, "owner_id": 1, "name": 1, "slug": 1})
    if company:
        await dispatch_notif(
            db, recipient_id=company.get("owner_id"), kind="application",
            title=f"Nueva postulación a {job['title']}",
            body=f"{user.get('name','Un candidato')} aplicó al empleo",
            actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
            subject_type="application", subject_id=doc["id"],
            subject_url=f"/admin/platform?tab=jobs&job={job_id}",
        )
    return ApplicationPublic(**doc, job_title=job["title"])


@router.get("/jobs/{job_id}/applications", response_model=list[ApplicationPublic])
async def list_job_applications(
    job_id: str, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    job = await db.jobs.find_one({"id": job_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Empleo no encontrado")
    company = await _company_or_404(db, job["company_id"])
    if not await _can_manage_company(company, user):
        raise HTTPException(status_code=403, detail="Sin acceso a las aplicaciones")
    cur = db.job_applications.find(
        {"job_id": job_id, "is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1)
    return [ApplicationPublic(**a, job_title=job["title"]) async for a in cur]


@router.patch("/applications/{application_id}/status", response_model=ApplicationPublic)
async def update_application_status(
    application_id: str,
    payload: ApplicationStatusUpdate,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    app_doc = await db.job_applications.find_one({"id": application_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Aplicación no encontrada")
    company = await _company_or_404(db, app_doc["company_id"])
    if not await _can_manage_company(company, user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    await db.job_applications.update_one(
        {"id": application_id},
        {"$set": {"status": payload.status, "updated_at": _now()}},
    )
    fresh = await db.job_applications.find_one({"id": application_id}, {"_id": 0})
    job = await db.jobs.find_one({"id": app_doc["job_id"]}, {"_id": 0, "title": 1})
    await record_event(db, "job.status_changed",
                       actor_id=user["id"], subject_type="application", subject_id=application_id,
                       payload={"status": payload.status})
    return ApplicationPublic(**fresh, job_title=(job or {}).get("title"))


@router.get("/me/applications", response_model=list[ApplicationPublic])
async def my_applications(
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    cur = db.job_applications.find(
        {"applicant_id": user["id"], "is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1)
    items = []
    async for a in cur:
        job = await db.jobs.find_one({"id": a["job_id"]}, {"_id": 0, "title": 1})
        company = await db.companies.find_one({"id": a["company_id"]}, {"_id": 0, "name": 1})
        items.append(ApplicationPublic(
            **a,
            job_title=(job or {}).get("title"),
            company_name=(company or {}).get("name"),
        ))
    return items
