"""Centralized application settings loaded from environment variables for database, auth, and local ML behavior."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "skillbridge"
    public_app_url: str = "http://localhost:5173"
    public_api_url: str = "http://localhost:8000"
    openai_api_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""
    stripe_price_id_starter: str = ""
    stripe_price_id_pro: str = ""
    stripe_price_id_elite: str = ""
    stripe_currency: str = "usd"
    stripe_success_url: str = ""
    stripe_cancel_url: str = ""
    stripe_billing_portal_return_url: str = ""
    password_reset_token_ttl_minutes: int = 60
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "SkillBridge"
    smtp_reply_to: str = ""
    smtp_use_starttls: bool = True
    smtp_use_ssl: bool = False
    openai_embed_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    local_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_zero_shot_model: str = "MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"
    local_rewrite_model: str = "google/flan-t5-small"
    local_embedding_model_options: str = "sentence-transformers/all-MiniLM-L6-v2,sentence-transformers/all-MiniLM-L12-v2"
    local_zero_shot_model_options: str = "MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33,facebook/bart-large-mnli"
    local_rewrite_model_options: str = "google/flan-t5-small,google/flan-t5-base"
    local_model_device: int = -1
    local_model_prewarm: bool  = True
    admin_owner_emails: str = ""
    admin_team_emails: str = ""
    media_storage_mode: str = "local"
    media_s3_endpoint_url: str = ""
    media_s3_bucket: str = ""
    media_s3_region: str = ""
    media_s3_access_key_id: str = ""
    media_s3_secret_access_key: str = ""
    media_s3_public_base_url: str = ""
    media_s3_key_prefix: str = "avatars"
    user_avatar_upload_dir: str = "backend/data/uploads/avatars"

    @property
    def admin_owner_emails_set(self) -> set[str]:
        return {email.strip().lower() for email in self.admin_owner_emails.split(",") if email.strip()}

    @property
    def admin_team_emails_set(self) -> set[str]:
        return {email.strip().lower() for email in self.admin_team_emails.split(",") if email.strip()}

    @property
    def app_env_normalized(self) -> str:
        value = self.app_env.strip().lower()
        return value if value in {"development", "staging", "production"} else "development"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def stripe_configured(self) -> bool:
        return bool(self.stripe_secret_key.strip() and self.stripe_price_ids)

    @property
    def stripe_price_ids(self) -> dict[str, str]:
        price_ids = {
            "starter": self.stripe_price_id_starter.strip(),
            "pro": (self.stripe_price_id_pro or self.stripe_price_id).strip(),
            "elite": self.stripe_price_id_elite.strip(),
        }
        return {plan: price_id for plan, price_id in price_ids.items() if price_id}

    @property
    def stripe_billing_enabled(self) -> bool:
        return self.stripe_configured

    @property
    def local_embedding_model_options_list(self) -> list[str]:
        options = [value.strip() for value in self.local_embedding_model_options.split(",") if value.strip()]
        if self.local_embedding_model not in options:
            options.insert(0, self.local_embedding_model)
        return list(dict.fromkeys(options))

    @property
    def local_zero_shot_model_options_list(self) -> list[str]:
        options = [value.strip() for value in self.local_zero_shot_model_options.split(",") if value.strip()]
        if self.local_zero_shot_model not in options:
            options.insert(0, self.local_zero_shot_model)
        return list(dict.fromkeys(options))

    @property
    def local_rewrite_model_options_list(self) -> list[str]:
        options = [value.strip() for value in self.local_rewrite_model_options.split(",") if value.strip()]
        if self.local_rewrite_model not in options:
            options.insert(0, self.local_rewrite_model)
        return list(dict.fromkeys(options))

    @property
    def media_storage_mode_normalized(self) -> str:
        value = self.media_storage_mode.strip().lower()
        return value if value in {"local", "s3"} else "local"

    @property
    def user_avatar_upload_path(self) -> Path:
        return Path(self.user_avatar_upload_dir).expanduser()

    def validate_runtime_settings(self) -> list[str]:
        issues: list[str] = []
        media_mode = self.media_storage_mode.strip().lower()

        if not self.allowed_origins_list:
            issues.append("ALLOWED_ORIGINS must include at least one frontend origin.")

        if media_mode not in {"local", "s3"}:
            issues.append("MEDIA_STORAGE_MODE must be either local or s3.")

        if media_mode == "s3":
            if not self.media_s3_endpoint_url.strip():
                issues.append("MEDIA_S3_ENDPOINT_URL is required when MEDIA_STORAGE_MODE=s3.")
            if not self.media_s3_bucket.strip():
                issues.append("MEDIA_S3_BUCKET is required when MEDIA_STORAGE_MODE=s3.")
            if not self.media_s3_region.strip():
                issues.append("MEDIA_S3_REGION is required when MEDIA_STORAGE_MODE=s3.")
            if not self.media_s3_access_key_id.strip():
                issues.append("MEDIA_S3_ACCESS_KEY_ID is required when MEDIA_STORAGE_MODE=s3.")
            if not self.media_s3_secret_access_key.strip():
                issues.append("MEDIA_S3_SECRET_ACCESS_KEY is required when MEDIA_STORAGE_MODE=s3.")

        if self.app_env_normalized in {"staging", "production"}:
            if "localhost" in self.mongo_uri or "127.0.0.1" in self.mongo_uri:
                issues.append("MONGO_URI cannot point to localhost outside development.")
            if any("localhost" in origin or "127.0.0.1" in origin for origin in self.allowed_origins_list):
                issues.append("ALLOWED_ORIGINS cannot use localhost outside development.")
            if "localhost" in self.public_app_url or "127.0.0.1" in self.public_app_url:
                issues.append("PUBLIC_APP_URL cannot use localhost outside development.")
            if "localhost" in self.public_api_url or "127.0.0.1" in self.public_api_url:
                issues.append("PUBLIC_API_URL cannot use localhost outside development.")

        return issues

settings = Settings()
