import os
import time
import logging
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import engine, Base, SessionLocal
from app.config import settings
from app.api import auth, files, analysis, history, admin, advanced

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("excel_ai_analyzer")

app = FastAPI(
    title="Excel AI Analyzer API",
    description="AI-powered Excel data analysis platform",
    version="1.0.0",
    docs_url="/api/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url="/api/redoc" if os.getenv("ENVIRONMENT") != "production" else None,
)

# CORS - use FRONTEND_URL from environment
origins = [settings.FRONTEND_URL]
if "localhost" in settings.FRONTEND_URL:
    origins.append("http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    if response.status_code >= 400:
        logger.warning(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration:.3f}s)"
        )
    return response


app.include_router(auth.router)
app.include_router(files.router)
app.include_router(analysis.router)
app.include_router(history.router)
app.include_router(admin.router)
app.include_router(advanced.router)


@app.on_event("startup")
def on_startup():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "versions"), exist_ok=True)
    Base.metadata.create_all(bind=engine)
    logger.info("Application started")


@app.get("/api/health")
def health_check():
    db_ok = False
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.error(f"Health check DB error: {e}")
    finally:
        db.close()

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": "1.0.0",
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled error: {request.method} {request.url.path} - {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
