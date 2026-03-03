from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "skillbridge"
    openai_api_key: str = ""
    openai_embed_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    local_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_zero_shot_model: str = "MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"
    local_model_device: int = -1
    local_model_prewarm: bool  = True

settings = Settings()
