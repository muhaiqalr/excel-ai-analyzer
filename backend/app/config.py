from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "excel_ai_analyzer"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DATABASE_URL: str = ""

    # JWT
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 72

    # AI
    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-2.0-flash"

    # Frontend/Backend URLs
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # File Upload
    UPLOAD_DIR: str = str(Path(__file__).resolve().parent.parent / "storage" / "uploads")
    MAX_FILE_SIZE: int = 50 * 1024 * 1024

    @property
    def DATABASE_URL_RESOLVED(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.DB_HOST and self.DB_HOST != "localhost":
            return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        db_path = Path(__file__).resolve().parent.parent / "db.sqlite3"
        return f"sqlite:///{db_path}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
