import os

class Settings:
    PROJECT_NAME: str = "LocalHealth Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "SUPER_SECRET_LOCAL_KEY_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30 # 30 days
    DATABASE_URL: str = "sqlite:///./health_pro.db"
    OLLAMA_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "llama3.1"

settings = Settings()
