"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent_reliability"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    groq_pro_model: str = "openai/gpt-oss-120b"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
