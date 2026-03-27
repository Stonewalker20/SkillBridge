"""Avatar/media storage provider abstractions for local filesystem and S3-compatible backends."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import hmac
import secrets
from pathlib import Path
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import Request, urlopen

from app.core.config import settings


@dataclass(frozen=True)
class StoredMedia:
    storage_key: str
    url: str


class AvatarStorageProvider(Protocol):
    async def upload_avatar(
        self,
        *,
        user_id: str,
        filename: str,
        content: bytes,
        content_type: str | None = None,
    ) -> StoredMedia:
        ...

    async def delete_avatar(self, storage_key: str | None) -> None:
        ...


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _safe_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix if suffix in {".png", ".jpg", ".jpeg", ".webp"} else ""


def _avatar_filename(user_id: str, filename: str) -> str:
    suffix = _safe_suffix(filename)
    return f"{user_id}-{int(now_utc().timestamp() * 1000)}-{secrets.token_hex(4)}{suffix}"


def _join_url(base: str, path: str) -> str:
    return urljoin(base.rstrip("/") + "/", path.lstrip("/"))


def _normalize_public_base(url: str) -> str:
    return url.rstrip("/")


def _bucket_object_url(endpoint_url: str, bucket: str, key: str) -> str:
    endpoint = endpoint_url.rstrip("/")
    return f"{endpoint}/{bucket}/{quote(key.lstrip('/'), safe='/~')}"


def _aws_signing_key(secret_access_key: str, date_stamp: str, region: str) -> bytes:
    def _sign(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), sha256).digest()

    k_date = _sign(("AWS4" + secret_access_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, "s3")
    return _sign(k_service, "aws4_request")


class LocalAvatarStorage:
    def __init__(self, upload_dir: Path):
        self.upload_dir = upload_dir
        self.public_prefix = "/media/avatars"

    async def upload_avatar(
        self,
        *,
        user_id: str,
        filename: str,
        content: bytes,
        content_type: str | None = None,
    ) -> StoredMedia:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        storage_key = _avatar_filename(user_id, filename)
        (self.upload_dir / storage_key).write_bytes(content)
        return StoredMedia(storage_key=storage_key, url=f"{self.public_prefix}/{storage_key}")

    async def delete_avatar(self, storage_key: str | None) -> None:
        key = str(storage_key or "").strip()
        if not key:
            return
        target = self.upload_dir / Path(key).name
        if target.exists():
            target.unlink()


class S3CompatibleAvatarStorage:
    def __init__(
        self,
        *,
        endpoint_url: str,
        bucket: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
        public_base_url: str | None = None,
        key_prefix: str = "avatars",
    ):
        self.endpoint_url = endpoint_url.rstrip("/")
        self.bucket = bucket.strip()
        self.region = region.strip()
        self.access_key_id = access_key_id.strip()
        self.secret_access_key = secret_access_key.strip()
        self.public_base_url = _normalize_public_base(public_base_url) if public_base_url else ""
        self.key_prefix = key_prefix.strip("/")

    def _object_key(self, user_id: str, filename: str) -> str:
        stem = _avatar_filename(user_id, filename)
        if self.key_prefix:
            return f"{self.key_prefix}/{stem}"
        return stem

    def _public_url(self, key: str) -> str:
        if self.public_base_url:
            return _join_url(self.public_base_url, key)
        return _bucket_object_url(self.endpoint_url, self.bucket, key)

    def _signed_request(self, method: str, key: str, payload: bytes, content_type: str | None = None) -> Request:
        request_url = _bucket_object_url(self.endpoint_url, self.bucket, key)
        parsed = urlsplit(request_url)
        payload_hash = sha256(payload).hexdigest()
        amz_date = now_utc().strftime("%Y%m%dT%H%M%SZ")
        date_stamp = amz_date[:8]
        canonical_uri = parsed.path or "/"
        canonical_headers = [
            f"host:{parsed.netloc}",
            f"x-amz-content-sha256:{payload_hash}",
            f"x-amz-date:{amz_date}",
        ]
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        canonical_request = "\n".join(
            [
                method,
                canonical_uri,
                "",
                "\n".join(canonical_headers) + "\n",
                signed_headers,
                payload_hash,
            ]
        )
        credential_scope = f"{date_stamp}/{self.region}/s3/aws4_request"
        string_to_sign = "\n".join(
            [
                "AWS4-HMAC-SHA256",
                amz_date,
                credential_scope,
                sha256(canonical_request.encode("utf-8")).hexdigest(),
            ]
        )
        signing_key = _aws_signing_key(self.secret_access_key, date_stamp, self.region)
        signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), sha256).hexdigest()
        authorization = (
            "AWS4-HMAC-SHA256 "
            f"Credential={self.access_key_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        headers = {
            "Authorization": authorization,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
            "Content-Length": str(len(payload)),
        }
        if content_type:
            headers["Content-Type"] = content_type
        return Request(request_url, data=payload if method == "PUT" else None, headers=headers, method=method)

    async def upload_avatar(
        self,
        *,
        user_id: str,
        filename: str,
        content: bytes,
        content_type: str | None = None,
    ) -> StoredMedia:
        key = self._object_key(user_id, filename)
        request = self._signed_request("PUT", key, content, content_type=content_type)
        try:
            with urlopen(request, timeout=30) as response:
                if getattr(response, "status", 200) >= 300:
                    raise RuntimeError(f"Avatar upload failed with HTTP {getattr(response, 'status', 'unknown')}")
        except HTTPError as exc:
            raise RuntimeError(f"Avatar upload failed with HTTP {exc.code}") from exc
        except URLError as exc:
            raise RuntimeError(f"Avatar upload failed: {exc.reason}") from exc
        return StoredMedia(storage_key=key, url=self._public_url(key))

    async def delete_avatar(self, storage_key: str | None) -> None:
        key = str(storage_key or "").strip()
        if not key:
            return
        request = self._signed_request("DELETE", key, b"")
        try:
            with urlopen(request, timeout=30) as response:
                if getattr(response, "status", 200) >= 300:
                    raise RuntimeError(f"Avatar delete failed with HTTP {getattr(response, 'status', 'unknown')}")
        except HTTPError as exc:
            if exc.code != 404:
                raise RuntimeError(f"Avatar delete failed with HTTP {exc.code}") from exc
        except URLError as exc:
            raise RuntimeError(f"Avatar delete failed: {exc.reason}") from exc


def get_avatar_storage_provider() -> AvatarStorageProvider:
    mode = settings.media_storage_mode_normalized
    if mode == "s3":
        return S3CompatibleAvatarStorage(
            endpoint_url=settings.media_s3_endpoint_url,
            bucket=settings.media_s3_bucket,
            region=settings.media_s3_region,
            access_key_id=settings.media_s3_access_key_id,
            secret_access_key=settings.media_s3_secret_access_key,
            public_base_url=settings.media_s3_public_base_url or None,
            key_prefix=settings.media_s3_key_prefix,
        )
    return LocalAvatarStorage(settings.user_avatar_upload_path)


def avatar_storage_key_from_user(user: dict) -> str | None:
    key = str(user.get("avatar_storage_key") or "").strip()
    if key:
        return key

    avatar_url = str(user.get("avatar_url") or "").strip()
    if not avatar_url:
        return None

    if avatar_url.startswith("/media/avatars/"):
        return Path(avatar_url).name

    parsed = urlsplit(avatar_url)
    if not parsed.path:
        return None

    path = parsed.path.lstrip("/")
    if settings.media_storage_mode_normalized == "s3":
        bucket_prefix = f"{settings.media_s3_bucket.strip()}/"
        if path.startswith(bucket_prefix):
            return path[len(bucket_prefix) :]
    return path
