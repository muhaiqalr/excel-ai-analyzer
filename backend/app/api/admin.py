import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.models import (
    User, File as FileModel, AnalysisSession, AnalysisMessage,
    AnalysisHistory, SystemLog, AIUsage,
)
from app.schemas.schemas import (
    AdminDashboardResponse, AdminUserResponse, AdminDatasetResponse,
    AdminAnalysisResponse, AdminAIUsageResponse, AdminSystemLogResponse,
    AdminUserUpdateRequest,
)
from app.utils.security import get_admin_user
from app.config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
def admin_dashboard(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    total_datasets = db.query(func.count(FileModel.id)).scalar()
    total_analyses = db.query(func.count(AnalysisHistory.id)).scalar()
    ai_requests = db.query(func.count(AIUsage.id)).scalar()

    storage_bytes = 0
    try:
        upload_dir = settings.UPLOAD_DIR
        if os.path.exists(upload_dir):
            for root, dirs, files in os.walk(upload_dir):
                for f in files:
                    storage_bytes += os.path.getsize(os.path.join(root, f))
    except Exception:
        pass

    db_status = "ok"
    db_session = SessionLocal()
    try:
        db_session.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    finally:
        db_session.close()

    ai_configured = bool(settings.AI_API_KEY)

    return AdminDashboardResponse(
        total_users=total_users,
        active_users=active_users,
        total_datasets=total_datasets,
        total_analyses=total_analyses,
        ai_requests=ai_requests,
        storage_bytes=storage_bytes,
        system_status="ok" if db_status == "ok" else "degraded",
        db_status=db_status,
        ai_configured=ai_configured,
    )


@router.get("/users")
def admin_list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for u in users:
        dataset_count = db.query(func.count(FileModel.id)).filter(FileModel.user_id == u.id).scalar()
        analysis_count = db.query(func.count(AnalysisHistory.id)).filter(AnalysisHistory.user_id == u.id).scalar()
        result.append(AdminUserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            last_login_at=u.last_login_at,
            created_at=u.created_at,
            dataset_count=dataset_count,
            analysis_count=analysis_count,
        ))

    return {"users": [r.model_dump() for r in result], "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
def admin_get_user(
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    dataset_count = db.query(func.count(FileModel.id)).filter(FileModel.user_id == user.id).scalar()
    analysis_count = db.query(func.count(AnalysisHistory.id)).filter(AnalysisHistory.user_id == user.id).scalar()

    return AdminUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        dataset_count=dataset_count,
        analysis_count=analysis_count,
    ).model_dump()


@router.patch("/users/{user_id}")
def admin_update_user(
    user_id: str,
    body: AdminUserUpdateRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id and body.role is not None and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot remove your own admin role")

    if body.role is not None:
        if body.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = body.role

    if body.is_active is not None:
        if user.id == admin.id and not body.is_active:
            raise HTTPException(status_code=400, detail="Cannot disable your own account")
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)

    log = SystemLog(
        event_type="admin",
        user_id=admin.id,
        status="success",
        message=f"Admin updated user {user.username}",
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": "User updated"}


@router.get("/datasets")
def admin_list_datasets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(FileModel)
    if search:
        query = query.filter(FileModel.original_filename.ilike(f"%{search}%"))

    total = query.count()
    files = query.order_by(FileModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for f in files:
        owner = db.query(User).filter(User.id == f.user_id).first()
        analysis_count = db.query(func.count(AnalysisHistory.id)).filter(AnalysisHistory.file_id == f.id).scalar()
        result.append(AdminDatasetResponse(
            id=f.id,
            filename=f.filename,
            original_filename=f.original_filename,
            owner_username=owner.username if owner else "Unknown",
            file_size=f.file_size,
            total_sheets=f.total_sheets,
            total_rows=f.total_rows,
            dataset_version=f.dataset_version,
            analysis_count=analysis_count,
            created_at=f.created_at,
            updated_at=f.updated_at,
        ))

    return {"datasets": [r.model_dump() for r in result], "total": total, "page": page, "page_size": page_size}


@router.get("/analyses")
def admin_list_analyses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(AnalysisHistory.id)).scalar()
    histories = (
        db.query(AnalysisHistory)
        .order_by(AnalysisHistory.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for h in histories:
        user = db.query(User).filter(User.id == h.user_id).first()
        result.append(AdminAnalysisResponse(
            id=h.id,
            username=user.username if user else "Unknown",
            filename=h.filename,
            analysis_type="AI Analysis",
            created_at=h.created_at,
        ))

    return {"analyses": [r.model_dump() for r in result], "total": total, "page": page, "page_size": page_size}


@router.get("/usage")
def admin_ai_usage(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(AIUsage.id)).scalar()
    usages = (
        db.query(AIUsage)
        .order_by(AIUsage.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for u in usages:
        user = db.query(User).filter(User.id == u.user_id).first() if u.user_id else None
        result.append(AdminAIUsageResponse(
            id=u.id,
            username=user.username if user else None,
            model=u.model,
            status=u.status,
            response_time_ms=u.response_time_ms,
            error_message=u.error_message,
            created_at=u.created_at,
        ))

    total_errors = db.query(func.count(AIUsage.id)).filter(AIUsage.status == "error").scalar()
    avg_response = db.query(func.avg(AIUsage.response_time_ms)).filter(AIUsage.status == "success").scalar()

    return {
        "usages": [r.model_dump() for r in result],
        "total": total,
        "total_errors": total_errors,
        "avg_response_time_ms": round(avg_response, 1) if avg_response else None,
        "page": page,
        "page_size": page_size,
    }


@router.get("/logs")
def admin_list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: str = Query("", max_length=50),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(SystemLog)
    if event_type:
        query = query.filter(SystemLog.event_type == event_type)

    total = query.count()
    logs = query.order_by(SystemLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        result.append(AdminSystemLogResponse(
            id=log.id,
            event_type=log.event_type,
            username=user.username if user else None,
            status=log.status,
            message=log.message,
            created_at=log.created_at,
        ))

    return {"logs": [r.model_dump() for r in result], "total": total, "page": page, "page_size": page_size}


@router.get("/health")
def admin_health(admin: User = Depends(get_admin_user)):
    db_ok = False
    db_session = SessionLocal()
    try:
        db_session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    finally:
        db_session.close()

    storage_ok = os.path.exists(settings.UPLOAD_DIR)

    return {
        "backend": "ok",
        "database": "connected" if db_ok else "error",
        "ai_provider": "configured" if settings.AI_API_KEY else "not_configured",
        "storage": "available" if storage_ok else "error",
    }
