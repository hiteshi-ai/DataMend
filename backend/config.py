"""
Application configuration.
Loads settings from environment variables / .env file with graceful defaults.
"""
from __future__ import annotations

import json
import os
from typing import List

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    USE_PYDANTIC_SETTINGS = True
except ImportError:
    from pydantic import BaseModel
    USE_PYDANTIC_SETTINGS = False

from pydantic import field_validator


if USE_PYDANTIC_SETTINGS:
    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=False,
            extra="ignore",
        )

        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://placeholder-ref.supabase.co")
        SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "placeholder-anon-key")
        SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "placeholder-service-key")
        JWT_SECRET: str = os.getenv("JWT_SECRET", "placeholder-jwt-secret")
        OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
        MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
        BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
        ALLOW_ADMIN_INIT: bool = os.getenv("ALLOW_ADMIN_INIT", "true").lower() == "true"
        ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

        @field_validator("BACKEND_CORS_ORIGINS", mode="before")
        @classmethod
        def parse_cors_origins(cls, v):
            if isinstance(v, str):
                v = v.strip()
                if v.startswith("["):
                    return json.loads(v)
                return [origin.strip() for origin in v.split(",") if origin.strip()]
            return v

        @property
        def max_file_size_bytes(self) -> int:
            return self.MAX_FILE_SIZE_MB * 1024 * 1024

        @property
        def is_production(self) -> bool:
            return self.ENVIRONMENT.lower() == "production"

else:
    class Settings(BaseModel):
        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://placeholder-ref.supabase.co")
        SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "placeholder-anon-key")
        SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "placeholder-service-key")
        JWT_SECRET: str = os.getenv("JWT_SECRET", "placeholder-jwt-secret")
        OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
        MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
        BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
        ALLOW_ADMIN_INIT: bool = os.getenv("ALLOW_ADMIN_INIT", "true").lower() == "true"
        ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

        @property
        def max_file_size_bytes(self) -> int:
            return self.MAX_FILE_SIZE_MB * 1024 * 1024

        @property
        def is_production(self) -> bool:
            return self.ENVIRONMENT.lower() == "production"


settings = Settings()
