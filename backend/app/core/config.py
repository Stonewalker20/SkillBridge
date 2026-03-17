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
    def user_avatar_upload_path(self) -> Path:
        return Path(self.user_avatar_upload_dir).expanduser()

    def validate_runtime_settings(self) -> list[str]:
        issues: list[str] = []

        if not self.allowed_origins_list:
            issues.append("ALLOWED_ORIGINS must include at least one frontend origin.")

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
