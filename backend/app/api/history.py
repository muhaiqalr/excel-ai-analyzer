from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, File as FileModel, AnalysisHistory
from app.schemas.schemas import (
    AnalysisHistoryCreate,
    AnalysisHistoryResponse,
    AnalysisHistoryListResponse,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])


@router.post("", response_model=AnalysisHistoryResponse, status_code=status.HTTP_201_CREATED)
def create_history(
    body: AnalysisHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_file = (
        db.query(FileModel)
        .filter(FileModel.id == body.file_id, FileModel.user_id == current_user.id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    record = AnalysisHistory(
        user_id=current_user.id,
        file_id=body.file_id,
        filename=body.filename,
        dataset_version=body.dataset_version,
        analysis_question=body.analysis_question,
        ai_response=body.ai_response,
        statistics_snapshot=body.statistics_snapshot,
        chart_config=body.chart_config,
        dataset_snapshot=body.dataset_snapshot,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return AnalysisHistoryResponse.model_validate(record)


@router.get("", response_model=list[AnalysisHistoryListResponse])
def list_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.user_id == current_user.id)
        .order_by(AnalysisHistory.created_at.desc())
        .all()
    )
    result = []
    for r in records:
        preview = r.ai_response[:200] + "..." if len(r.ai_response) > 200 else r.ai_response
        result.append(AnalysisHistoryListResponse(
            id=r.id,
            file_id=r.file_id,
            filename=r.filename,
            dataset_version=r.dataset_version,
            analysis_question=r.analysis_question,
            ai_response_preview=preview,
            created_at=r.created_at,
        ))
    return result


@router.get("/{history_id}", response_model=AnalysisHistoryResponse)
def get_history(
    history_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.id == history_id, AnalysisHistory.user_id == current_user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="History record not found")

    return AnalysisHistoryResponse.model_validate(record)


@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(
    history_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.id == history_id, AnalysisHistory.user_id == current_user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="History record not found")

    db.delete(record)
    db.commit()
