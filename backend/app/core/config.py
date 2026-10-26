import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TableTell API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    
    # Base directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_LAKE_DIR: Path = BASE_DIR / "data_lake"
    RAW_DIR: Path = DATA_LAKE_DIR / "raw"
    PROCESSED_DIR: Path = DATA_LAKE_DIR / "processed"
    METADATA_DIR: Path = DATA_LAKE_DIR / "metadata"
    METADATA_DB_PATH: Path = METADATA_DIR / "tabletell_metadata.db"
    
    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 100
    
    # Quality weights (Default: Completeness 25%, Validity 25%, Consistency 20%, Uniqueness 15%, Anomaly Review 15%)
    QUALITY_WEIGHTS: dict[str, float] = {
        "completeness": 0.25,
        "validity": 0.25,
        "consistency": 0.20,
        "uniqueness": 0.15,
        "anomaly": 0.15,
    }
    
    # Gemini / AI Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_MODEL: str = "gemini-3.5-flash"
    
    # Clerk Authentication Configuration
    CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "")
    CLERK_PUBLISHABLE_KEY: str = os.getenv("CLERK_PUBLISHABLE_KEY", "") or os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "")
    CLERK_JWKS_URL: str = os.getenv("CLERK_JWKS_URL", "")
    
    # CORS Origins (allow React Vite dev, Next.js, and Streamlit)
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8501", # Streamlit dev compatibility
    ]

    class Config:
        env_file = [
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent.parent / "backend" / ".env"),
            ".env"
        ]
        extra = "allow"

settings = Settings()

# Ensure data lake directories exist
settings.DATA_LAKE_DIR.mkdir(parents=True, exist_ok=True)
settings.RAW_DIR.mkdir(parents=True, exist_ok=True)
settings.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
settings.METADATA_DIR.mkdir(parents=True, exist_ok=True)
