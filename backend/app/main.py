from fastapi import FastAPI
from app.core.db import connect_to_mongo, close_mongo_connection
from app.routers.health import router as health_router

app = FastAPI(title="SkillTree API", version="0.1.0")

@app.on_event("startup")
async def on_startup():
    await connect_to_mongo()

@app.on_event("shutdown")
async def on_shutdown():
    await close_mongo_connection()

app.include_router(health_router, tags=["health"])

