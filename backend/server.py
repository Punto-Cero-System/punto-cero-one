"""Punto Cero System API — server entry.
Structure:
- /api/          → public content status
- /api/auth/     → authentication (login, me, logout)
- /api/investor-requests/  → public investor access request submission
- /api/admin/investor-requests/  → admin CRUD & workflow
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import hash_password, verify_password
from routes.auth_routes import router as auth_router
from routes.investor_routes import (
    public_router as investor_public_router,
    admin_router as investor_admin_router,
    admin_extra_router as investor_admin_extra_router,
    investor_router,
    public_auth_router as investor_public_auth_router,
)
from routes.pitch_deck_routes import public_router as pitch_public_router
from routes.pitch_deck_routes import admin_router as pitch_admin_router
from routes.community_auth_routes import router as community_auth_router
from routes.document_routes import router as document_router
from routes.feed_routes import router as feed_router
from routes.category_routes import router as category_router
from routes.company_routes import router as company_router
from routes.job_routes import router as job_router
from routes.event_routes import router as event_router
from routes.profile_routes import router as profile_router
from routes.analytics_routes import router as analytics_router
from models_category import DEFAULT_CATEGORIES


# -------------------- Logging --------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("punto-cero-api")


# -------------------- App --------------------
app = FastAPI(title="Punto Cero System API", version="1.0.0")


# -------------------- Mongo --------------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]
app.state.mongo_client = mongo_client
app.state.db = db


# -------------------- Health & meta --------------------
meta_router = APIRouter(prefix="/api", tags=["meta"])


@meta_router.get("/")
async def root():
    return {
        "service": "Punto Cero System API",
        "status": "ok",
        "version": app.version,
    }


@meta_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "degraded", "db": "unreachable", "error": str(e)}


# -------------------- Routers --------------------
app.include_router(meta_router)
app.include_router(auth_router)
app.include_router(investor_public_auth_router)
app.include_router(investor_public_router)
app.include_router(investor_admin_router)
app.include_router(investor_admin_extra_router)
app.include_router(investor_router)
app.include_router(pitch_public_router)
app.include_router(pitch_admin_router)
app.include_router(community_auth_router)
app.include_router(document_router)
app.include_router(feed_router)
app.include_router(category_router)
app.include_router(company_router)
app.include_router(job_router)
app.include_router(event_router)
app.include_router(profile_router)
app.include_router(analytics_router)


# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- Startup: indexes + admin seed --------------------
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.investor_requests.create_index("id", unique=True)
    await db.investor_requests.create_index("email")
    await db.investor_requests.create_index("status")
    await db.investor_requests.create_index("submitted_at")
    await db.login_attempts.create_index("identifier", unique=True)
    await db.pitch_deck_events.create_index("session_id")
    await db.pitch_deck_events.create_index("slide_number")
    await db.pitch_deck_events.create_index("created_at")
    await db.investor_access_log.create_index("user_id")
    await db.investor_access_log.create_index("created_at")
    # Community auth
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at")
    # Ensure the invitation_token can be queried quickly and is unique when present.
    await db.users.create_index(
        "invitation_token", unique=True, partialFilterExpression={"invitation_token": {"$type": "string"}}
    )
    # Categories
    await db.categories.create_index("key", unique=True)
    await db.categories.create_index("group")
    # Documents signed links
    await db.document_signed_links.create_index("token", unique=True)
    await db.document_signed_links.create_index("expires_at")
    # Feed
    await db.posts.create_index("id", unique=True)
    await db.posts.create_index("created_at")
    await db.posts.create_index("hashtags")
    await db.posts.create_index("category_key")
    await db.posts.create_index("status")
    await db.post_comments.create_index("post_id")
    await db.post_reactions.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.post_saves.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.post_views.create_index([("post_id", 1), ("session_id", 1)], unique=True)
    await db.hashtags.create_index("tag", unique=True)
    # Business core
    await db.companies.create_index("id", unique=True)
    await db.companies.create_index("slug", unique=True)
    await db.companies.create_index("vertical")
    await db.companies.create_index("owner_id")
    await db.companies.create_index("created_at")
    await db.company_follows.create_index([("company_id", 1), ("user_id", 1)], unique=True)
    await db.jobs.create_index("id", unique=True)
    await db.jobs.create_index("company_id")
    await db.jobs.create_index("created_at")
    await db.jobs.create_index("is_active")
    await db.job_saves.create_index([("job_id", 1), ("user_id", 1)], unique=True)
    await db.job_applications.create_index("id", unique=True)
    await db.job_applications.create_index("job_id")
    await db.job_applications.create_index("applicant_id")
    await db.events.create_index("id", unique=True)
    await db.events.create_index("company_id")
    await db.events.create_index("starts_at")
    await db.event_rsvps.create_index([("event_id", 1), ("user_id", 1)], unique=True)
    # Analytics
    await db.analytics_events.create_index("name")
    await db.analytics_events.create_index("created_at")
    await db.analytics_events.create_index("day")
    await db.analytics_counters.create_index([("name", 1), ("day", 1)])


async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin_name = os.environ.get("ADMIN_NAME", "Admin")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": admin_name,
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        logger.info(f"Admin seeded: {admin_email}")
        return

    # Refresh hash if the .env password changed
    if not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password), "name": admin_name}},
        )
        logger.info(f"Admin password refreshed: {admin_email}")


async def seed_default_categories():
    """Idempotent taxonomy seed. New keys are inserted, existing ones untouched."""
    now = datetime.now(timezone.utc).isoformat()
    for cat in DEFAULT_CATEGORIES:
        existing = await db.categories.find_one({"key": cat["key"]}, {"_id": 0})
        if existing:
            continue
        doc = {
            "key": cat["key"],
            "label": cat["label"],
            "group": cat.get("group", "vertical"),
            "icon": cat.get("icon"),
            "color": cat.get("color"),
            "order": cat.get("order", 100),
            "active": True,
            "parent_key": cat.get("parent_key"),
            "created_at": now,
            "updated_at": now,
        }
        await db.categories.insert_one(doc)


@app.on_event("startup")
async def _startup():
    await ensure_indexes()
    await seed_admin()
    await seed_default_categories()
    # Initialize object storage lazily on first use — no crash if backend unavailable.
    try:
        from services.object_storage import get_storage
        s = get_storage()
        logger.info(f"Storage backend ready: {s.backend_name}")
    except Exception as e:
        logger.warning(f"Storage backend init warning (non-fatal): {e}")
    logger.info("Punto Cero System API ready.")


@app.on_event("shutdown")
async def _shutdown():
    mongo_client.close()
