"""MongoDB connection helpers that expose a shared client and database handle to the rest of the backend."""

import logging
from urllib.parse import urlsplit, urlunsplit

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError
from app.core.config import settings

_client: AsyncIOMotorClient | None = None
logger = logging.getLogger(__name__)


def _normalize_local_mongo_uri(uri: str) -> str:
    """
    Avoid localhost/IPv6 resolution issues in local development by preferring
    the IPv4 loopback address when the URI points at localhost.
    """
    parsed = urlsplit(str(uri or "").strip())
    hostname = parsed.hostname or ""
    if hostname not in {"localhost", "::1"}:
        return uri

    auth = ""
    if parsed.username:
        auth = parsed.username
        if parsed.password:
            auth += f":{parsed.password}"
        auth += "@"

    port = f":{parsed.port}" if parsed.port else ""
    netloc = f"{auth}127.0.0.1{port}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))

async def connect_to_mongo() -> None:
    global _client
    mongo_uri = _normalize_local_mongo_uri(settings.mongo_uri)
    _client = AsyncIOMotorClient(
        mongo_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )
    try:
        await _client.admin.command("ping")
    except PyMongoError as exc:
        if _client is not None:
            _client.close()
            _client = None
        logger.error("MongoDB connection failed for db=%s: %s", settings.mongo_db, exc)
        raise RuntimeError(
            "MongoDB connection failed. Verify MONGO_URI and that the MongoDB server is reachable."
        ) from exc
    logger.info("[Mongo] Connected db=%s", settings.mongo_db)


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None

def get_db() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("Mongo client is not initialized. Did startup run?")
    return _client[settings.mongo_db]


