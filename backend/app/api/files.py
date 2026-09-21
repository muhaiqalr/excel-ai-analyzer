import os
import shutil
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import File as FileModel, FileVersion, Sheet, StatisticsSnapshot, ChartConfiguration
from app.schemas.schemas import (
    FileResponse as FileResponseSchema,
    FileUploadResponse,
    FileVersionResponse,
    SheetResponse,
    DataUpdateRequest,
    PaginatedDataResponse,
    SaveDataRequest,
    SaveDataResponse,
    VersionConflictResponse,
    DiscardResponse,
    RecalculationResponse,
    StatisticsResponse,
    FullStatisticsResponse,
    ChartConfigResponse,
    SheetAnalysisResponse,
)
from app.services.chart_service import generate_chart_configs
from app.services.excel_service import (
    analyze_sheet,
    parse_excel,
    read_excel_data,
    save_excel_data,
)
from app.services.stats_service import calculate_full_statistics
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/files", tags=["files"])


def _get_file_or_404(file_id: str, user_id: str, db: Session) -> FileModel:
    db_file = db.query(FileModel).filter(FileModel.id == file_id, FileModel.user_id == user_id).first()
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return db_file


def _save_file_metadata(db: Session, db_file: FileModel, parsed: dict) -> None:
    db_file.total_sheets = parsed["total_sheets"]
    db_file.total_rows = parsed["total_rows"]
    db_file.total_columns = parsed["total_columns"]

    for sheet in db_file.sheets:
        db.delete(sheet)
    db.flush()

    for sheet_info in parsed["sheets"]:
        db_sheet = Sheet(
            file_id=db_file.id,
            sheet_name=sheet_info["name"],
            sheet_index=sheet_info["index"],
            row_count=sheet_info["row_count"],
            column_count=sheet_info["column_count"],
            column_names=sheet_info["column_names"],
            column_types=sheet_info["column_types"],
        )
        db.add(db_sheet)
    db.flush()


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_extensions = {".xlsx", ".xls", ".csv"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: .xlsx, .xls, and .csv",
        )

    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}{ext}"
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, stored_filename)

    file_size = 0
    with open(file_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            buffer.write(chunk)
            file_size += len(chunk)

    if file_size > settings.MAX_FILE_SIZE:
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds maximum size",
        )

    try:
        parsed = parse_excel(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error parsing file: {str(e)}",
        )

    db_file = FileModel(
        id=file_id,
        user_id=current_user.id,
        filename=stored_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        total_sheets=parsed["total_sheets"],
        total_rows=parsed["total_rows"],
        total_columns=parsed["total_columns"],
        dataset_version=1,
    )
    db.add(db_file)
    db.flush()

    for sheet_info in parsed["sheets"]:
        db_sheet = Sheet(
            file_id=db_file.id,
            sheet_name=sheet_info["name"],
            sheet_index=sheet_info["index"],
            row_count=sheet_info["row_count"],
            column_count=sheet_info["column_count"],
            column_names=sheet_info["column_names"],
            column_types=sheet_info["column_types"],
        )
        db.add(db_sheet)
    db.flush()

    db_version = FileVersion(
        file_id=db_file.id,
        version_number=1,
        file_path=file_path,
        file_size=file_size,
        change_description="Initial upload",
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_file)

    sheets = db.query(Sheet).filter(Sheet.file_id == db_file.id).all()
    sheet_responses = [SheetResponse.model_validate(s) for s in sheets]

    return FileUploadResponse(
        id=db_file.id,
        filename=db_file.filename,
        original_filename=db_file.original_filename,
        file_size=db_file.file_size,
        total_sheets=db_file.total_sheets,
        total_rows=db_file.total_rows,
        total_columns=db_file.total_columns,
        dataset_version=db_file.dataset_version,
        sheets=sheet_responses,
        created_at=db_file.created_at,
    )


@router.get("/", response_model=list[FileResponseSchema])
def list_files(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_files = db.query(FileModel).filter(FileModel.user_id == current_user.id).order_by(FileModel.created_at.desc()).all()
    result = []
    for f in db_files:
        sheets = db.query(Sheet).filter(Sheet.file_id == f.id).all()
        fr = FileResponseSchema.model_validate(f)
        fr.sheets = [SheetResponse.model_validate(s) for s in sheets]
        result.append(fr)
    return result


@router.get("/{file_id}", response_model=FileResponseSchema)
def get_file(
    file_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)
    sheets = db.query(Sheet).filter(Sheet.file_id == db_file.id).all()
    fr = FileResponseSchema.model_validate(db_file)
    fr.sheets = [SheetResponse.model_validate(s) for s in sheets]
    return fr


@router.put("/{file_id}", response_model=FileResponseSchema)
def update_file(
    file_id: str,
    update_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if "filename" in update_data:
        new_name = update_data["filename"].strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Filename cannot be empty")
        if any(c in new_name for c in '/\\:*?"<>|'):
            raise HTTPException(status_code=400, detail="Filename contains invalid characters")
        if len(new_name) > 255:
            raise HTTPException(status_code=400, detail="Filename too long")
        db_file.filename = new_name

    db.commit()
    db.refresh(db_file)

    sheets = db.query(Sheet).filter(Sheet.file_id == db_file.id).all()
    fr = FileResponseSchema.model_validate(db_file)
    fr.sheets = [SheetResponse.model_validate(s) for s in sheets]
    return fr


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if os.path.exists(db_file.file_path):
        try:
            os.remove(db_file.file_path)
        except PermissionError:
            pass

    db.query(ChartConfiguration).filter(ChartConfiguration.file_id == db_file.id).delete()
    db.query(StatisticsSnapshot).filter(StatisticsSnapshot.file_id == db_file.id).delete()
    db.query(FileVersion).filter(FileVersion.file_id == db_file.id).delete()
    db.query(Sheet).filter(Sheet.file_id == db_file.id).delete()
    db.delete(db_file)
    db.commit()
    return None


@router.get("/{file_id}/data", response_model=PaginatedDataResponse)
def get_file_data(
    file_id: str,
    sheet_name: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=2000),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    if not sheet_name:
        parsed = parse_excel(db_file.file_path)
        sheet_name = parsed["sheets"][0]["name"] if parsed.get("sheets") else "Sheet1"

    try:
        data = read_excel_data(db_file.file_path, sheet_name, page, page_size)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading data: {str(e)}",
        )

    return PaginatedDataResponse(**data)


@router.put("/{file_id}/data")
def update_file_data(
    file_id: str,
    update_request: DataUpdateRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        for change in update_request.changes:
            save_excel_data(db_file.file_path, [change], sheet_name=change.sheet_name, structural=None)

        if update_request.structural:
            save_excel_data(db_file.file_path, [], structural=update_request.structural)

        parsed = parse_excel(db_file.file_path)
        _save_file_metadata(db, db_file, parsed)

        db_file.dataset_version += 1
        db.commit()
        db.refresh(db_file)

        db_version = FileVersion(
            file_id=db_file.id,
            version_number=db_file.dataset_version,
            file_path=db_file.file_path,
            file_size=os.path.getsize(db_file.file_path),
            change_description="Data update",
        )
        db.add(db_version)
        db.commit()

        return {"success": True, "dataset_version": db_file.dataset_version, "message": "Data updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating data: {str(e)}",
        )


@router.put("/{file_id}/data/save", response_model=SaveDataResponse)
def save_data_with_version(
    file_id: str,
    save_request: SaveDataRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if db_file.dataset_version != save_request.dataset_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Version conflict. Please refresh and try again.",
        )

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        for change in save_request.changes:
            save_excel_data(db_file.file_path, [change], sheet_name=change.sheet_name, structural=None)

        if save_request.structural:
            save_excel_data(db_file.file_path, [], structural=save_request.structural)

        parsed = parse_excel(db_file.file_path)
        _save_file_metadata(db, db_file, parsed)

        db_file.dataset_version += 1
        db_file.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_file)

        db_version = FileVersion(
            file_id=db_file.id,
            version_number=db_file.dataset_version,
            file_path=db_file.file_path,
            file_size=os.path.getsize(db_file.file_path),
            change_description="Saved data changes",
        )
        db.add(db_version)
        db.commit()

        return SaveDataResponse(
            success=True,
            dataset_version=db_file.dataset_version,
            message="Data saved successfully",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error saving data: {str(e)}",
        )


@router.delete("/{file_id}/data/discard", response_model=DiscardResponse)
def discard_changes(
    file_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    return DiscardResponse(
        success=True,
        dataset_version=db_file.dataset_version,
        message="Changes have already been saved directly to the file and cannot be discarded. To revert, use the version restore endpoint.",
    )


@router.get("/{file_id}/version")
def get_dataset_version(
    file_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)
    return {"dataset_version": db_file.dataset_version, "file_id": db_file.id}


@router.post("/{file_id}/recalculate", response_model=RecalculationResponse)
def recalculate_statistics(
    file_id: str,
    sheet_name: str = Query(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        ext = os.path.splitext(db_file.file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(db_file.file_path)
        else:
            df = pd.read_excel(db_file.file_path, sheet_name=sheet_name)

        stats = calculate_full_statistics(df)

        existing = db.query(StatisticsSnapshot).filter(
            StatisticsSnapshot.file_id == db_file.id,
            StatisticsSnapshot.sheet_name == sheet_name,
        ).first()
        if existing:
            existing.statistics = stats
        else:
            snapshot = StatisticsSnapshot(
                file_id=db_file.id,
                sheet_name=sheet_name,
                statistics=stats,
            )
            db.add(snapshot)

        db.commit()

        return RecalculationResponse(
            success=True,
            statistics=stats,
            message="Statistics recalculated successfully",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error recalculating statistics: {str(e)}",
        )


@router.get("/{file_id}/statistics", response_model=FullStatisticsResponse)
def get_statistics(
    file_id: str,
    sheet_name: str = Query(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        ext = os.path.splitext(db_file.file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(db_file.file_path)
        else:
            df = pd.read_excel(db_file.file_path, sheet_name=sheet_name)

        stats = calculate_full_statistics(df)

        snapshot = StatisticsSnapshot(
            file_id=db_file.id,
            sheet_name=sheet_name,
            statistics=stats,
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)

        return FullStatisticsResponse(**stats)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error computing statistics: {str(e)}",
        )


@router.get("/{file_id}/charts")
def get_chart_configurations(
    file_id: str,
    sheet_name: str = Query(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        ext = os.path.splitext(db_file.file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(db_file.file_path)
        else:
            df = pd.read_excel(db_file.file_path, sheet_name=sheet_name)

        col_types = {}
        for col in df.columns:
            series = df[col]
            non_null = series.dropna()
            if len(non_null) == 0:
                col_types[col] = "text"
            elif pd.api.types.is_bool_dtype(series):
                col_types[col] = "boolean"
            elif pd.api.types.is_numeric_dtype(series):
                col_types[col] = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(series):
                col_types[col] = "date"
            else:
                unique_ratio = non_null.nunique() / len(non_null) if len(non_null) > 0 else 1
                if unique_ratio < 0.5 or non_null.nunique() <= 20:
                    col_types[col] = "categorical"
                else:
                    col_types[col] = "text"

        configs = generate_chart_configs(df, col_types)

        for cfg in configs:
            chart = ChartConfiguration(
                file_id=db_file.id,
                sheet_name=sheet_name,
                chart_type=cfg["chart_type"],
                title=cfg.get("title"),
                x_column=cfg.get("x_column"),
                y_column=cfg.get("y_column"),
                config=cfg,
            )
            db.add(chart)
        db.commit()

        return {"charts": configs}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating charts: {str(e)}",
        )


@router.get("/{file_id}/sheets/{sheet_name}/analysis", response_model=SheetAnalysisResponse)
def get_sheet_analysis(
    file_id: str,
    sheet_name: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        result = analyze_sheet(db_file.file_path, sheet_name)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error analyzing sheet: {str(e)}",
        )

    return SheetAnalysisResponse(**result)


@router.get("/{file_id}/versions", response_model=list[FileVersionResponse])
def list_versions(
    file_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    versions = db.query(FileVersion).filter(FileVersion.file_id == db_file.id).order_by(FileVersion.version_number.desc()).all()
    return [FileVersionResponse.model_validate(v) for v in versions]


@router.get("/{file_id}/versions/{version_id}", response_model=FileVersionResponse)
def get_version(
    file_id: str,
    version_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    version = db.query(FileVersion).filter(
        FileVersion.id == version_id,
        FileVersion.file_id == db_file.id,
    ).first()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    return FileVersionResponse.model_validate(version)


@router.post("/{file_id}/versions/{version_id}/restore", response_model=FileResponseSchema)
def restore_version(
    file_id: str,
    version_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    version = db.query(FileVersion).filter(
        FileVersion.id == version_id,
        FileVersion.file_id == db_file.id,
    ).first()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    if not os.path.exists(version.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version file not found on disk")

    shutil.copy2(version.file_path, db_file.file_path)

    try:
        parsed = parse_excel(db_file.file_path)
        _save_file_metadata(db, db_file, parsed)

        db_file.file_size = os.path.getsize(db_file.file_path)
        db_file.dataset_version += 1
        db_file.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_file)

        restore_version_record = FileVersion(
            file_id=db_file.id,
            version_number=db_file.dataset_version,
            file_path=db_file.file_path,
            file_size=db_file.file_size,
            change_description=f"Restored from version {version.version_number}",
        )
        db.add(restore_version_record)
        db.commit()

        sheets = db.query(Sheet).filter(Sheet.file_id == db_file.id).all()
        fr = FileResponseSchema.model_validate(db_file)
        fr.sheets = [SheetResponse.model_validate(s) for s in sheets]
        return fr
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error restoring version: {str(e)}",
        )


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = _get_file_or_404(file_id, current_user.id, db)

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    return FastAPIFileResponse(
        path=db_file.file_path,
        filename=db_file.original_filename,
        media_type="application/octet-stream",
    )
