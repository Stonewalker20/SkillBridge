from app.core.config import Settings


def test_allowed_origins_list_parses_csv() -> None:
    settings = Settings(
        allowed_origins="https://skillbridge.app, https://staging.skillbridge.app ,http://localhost:5173"
    )

    assert settings.allowed_origins_list == [
        "https://skillbridge.app",
        "https://staging.skillbridge.app",
        "http://localhost:5173",
    ]


def test_runtime_validation_blocks_localhost_in_production() -> None:
    settings = Settings(
        app_env="production",
        allowed_origins="https://skillbridge.app,http://localhost:5173",
        mongo_uri="mongodb://localhost:27017",
        public_app_url="https://skillbridge.app",
        public_api_url="http://localhost:8000",
    )

    issues = settings.validate_runtime_settings()

    assert "MONGO_URI cannot point to localhost outside development." in issues
    assert "ALLOWED_ORIGINS cannot use localhost outside development." in issues
    assert "PUBLIC_API_URL cannot use localhost outside development." in issues


def test_runtime_validation_allows_cloud_staging_values() -> None:
    settings = Settings(
        app_env="staging",
        allowed_origins="https://staging.skillbridge.app",
        mongo_uri="mongodb+srv://cluster.example.mongodb.net",
        public_app_url="https://staging.skillbridge.app",
        public_api_url="https://api-staging.skillbridge.app",
    )

    assert settings.validate_runtime_settings() == []


def test_runtime_validation_requires_s3_media_settings() -> None:
    settings = Settings(
        app_env="production",
        allowed_origins="https://skillbridge.app",
        mongo_uri="mongodb+srv://cluster.example.mongodb.net",
        public_app_url="https://skillbridge.app",
        public_api_url="https://api.skillbridge.app",
        media_storage_mode="s3",
    )

    issues = settings.validate_runtime_settings()

    assert "MEDIA_S3_ENDPOINT_URL is required when MEDIA_STORAGE_MODE=s3." in issues
    assert "MEDIA_S3_BUCKET is required when MEDIA_STORAGE_MODE=s3." in issues
    assert "MEDIA_S3_REGION is required when MEDIA_STORAGE_MODE=s3." in issues
    assert "MEDIA_S3_ACCESS_KEY_ID is required when MEDIA_STORAGE_MODE=s3." in issues
    assert "MEDIA_S3_SECRET_ACCESS_KEY is required when MEDIA_STORAGE_MODE=s3." in issues


def test_runtime_validation_rejects_invalid_media_mode() -> None:
    settings = Settings(
        allowed_origins="https://skillbridge.app",
        media_storage_mode="not-a-real-mode",
    )

    issues = settings.validate_runtime_settings()

    assert "MEDIA_STORAGE_MODE must be either local or s3." in issues
