"""Application entrypoint that assembles the FastAPI app, lifecycle hooks, middleware, router registration, and database indexes."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.db import connect_to_mongo, close_mongo_connection, get_db
from app.routers.health import router as health_router
from app.routers.skills import router as skills_router
from app.routers.confirmations import router as confirmations_router
from app.routers.jobs import router as jobs_router
from app.routers.evidence import router as evidence_router
from app.routers.resumes import router as resumes_router
from app.routers.projects import router as projects_router
from app.routers.dashboard import router as dashboard_router
from app.routers.roles import router as roles_router
from app.routers.taxonomy import router as taxonomy_router
from app.routers.tailor import router as tailor_router
from app.routers.portfolio import router as portfolio_router
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router
from app.core.config import settings
from app.utils.ai import get_inference_status, release_local_models, warm_local_models
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

async def ensure_indexes():
    # These indexes support the hot paths we exercise on every authenticated session:
    # login/session lookup, saved analyses, tailored resumes, and the derived RAG index.
    db = get_db()
    await db["users"].create_index("email", unique=True)
    await db["sessions"].create_index("token", unique=True)
    await db["sessions"].create_index("expires_at", expireAfterSeconds=0)
    await db["job_match_runs"].create_index([("user_id", 1), ("created_at", -1)])
    await db["tailored_resumes"].create_index([("user_id", 1), ("created_at", -1)])
    await db["rag_chunks"].create_index([("user_id", 1), ("source_type", 1), ("source_id", 1), ("chunk_index", 1)])

def ensure_local_media_dirs():
    # User-uploaded avatars are served as local static files. The directory must
    # exist before requests arrive so uploads and static serving share one path.
    settings.user_avatar_upload_path.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # FastAPI lifespan keeps startup/shutdown work in one place and avoids the
    # deprecated on_event hooks. This is the right place to connect the database,
    # materialize indexes, and optionally prewarm local ML models.
    issues = settings.validate_runtime_settings()
    if issues:
        raise RuntimeError("Invalid runtime settings:\n- " + "\n- ".join(issues))
    ensure_local_media_dirs()
    await connect_to_mongo()
    await ensure_indexes()
    if settings.local_model_prewarm:
        await warm_local_models()
    status = get_inference_status()
    print(
        "SkillBridge AI mode:",
        status["provider_mode"],
        f"(embeddings={status['embeddings_provider']}, model={status['embedding_model']})",
    )
    try:
        yield
    finally:
        release_local_models()
        await close_mongo_connection()


app = FastAPI(title="SkillBridge API", version="0.5.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.user_avatar_upload_path.parent.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(settings.user_avatar_upload_path.parent)), name="media")

app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(skills_router, prefix="/skills", tags=["skills"])
app.include_router(confirmations_router, prefix="/skills/confirmations", tags=["confirmations"])
app.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
app.include_router(evidence_router, prefix="/evidence", tags=["evidence"])
app.include_router(resumes_router, prefix="/ingest/resume", tags=["resume"])
app.include_router(projects_router, prefix="/projects", tags=["projects"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
app.include_router(roles_router, prefix="/roles", tags=["roles"])
app.include_router(taxonomy_router, prefix="/taxonomy", tags=["taxonomy"])
app.include_router(tailor_router, prefix="/tailor", tags=["tailor"])
app.include_router(portfolio_router, prefix="/portfolio", tags=["portfolio"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
