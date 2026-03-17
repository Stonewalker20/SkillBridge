"""Centralized application settings loaded from environment variables for database, auth, and local ML behavior."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "skillbridge"
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

settings = Settings()
