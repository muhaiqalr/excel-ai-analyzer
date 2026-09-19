from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str = "user"
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SheetResponse(BaseModel):
    id: str
    sheet_name: str
    sheet_index: int
    row_count: int
    column_count: int
    column_names: Optional[list] = None
    column_types: Optional[dict] = None

    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    total_sheets: int
    total_rows: int
    total_columns: int
    dataset_version: int = 1
    created_at: datetime
    updated_at: datetime
    sheets: list[SheetResponse] = []

    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size: int
    total_sheets: int
    total_rows: int
    total_columns: int
    dataset_version: int = 1
    sheets: list[SheetResponse]
    created_at: datetime


class FileVersionResponse(BaseModel):
    id: str
    version_number: int
    file_size: int
    change_description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisSessionCreate(BaseModel):
    file_id: str
    title: Optional[str] = "New Analysis"


class AnalysisSessionResponse(BaseModel):
    id: str
    file_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class AnalysisMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class AnalysisMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    metadata_json: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    sheet_name: Optional[str] = None
    columns: Optional[list[str]] = None
    rows: Optional[list[list[Any]]] = None
    dataset_version: Optional[int] = None


class ChatResponse(BaseModel):
    role: str
    content: str
    chart_request: Optional[dict] = None
    tool_results: Optional[list[dict]] = None


class StatisticsResponse(BaseModel):
    id: str
    sheet_name: str
    statistics: dict
    created_at: datetime

    class Config:
        from_attributes = True


class ChartConfigResponse(BaseModel):
    id: str
    sheet_name: str
    chart_type: str
    title: Optional[str] = None
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    config: dict
    created_at: datetime

    class Config:
        from_attributes = True


class CellUpdate(BaseModel):
    sheet_name: str
    row: int
    column: str
    value: Any


class StructuralUpdate(BaseModel):
    operation: str  # add_row, delete_row, add_column, delete_column, rename_column
    sheet_name: str
    index: Optional[int] = None
    column_name: Optional[str] = None
    new_name: Optional[str] = None
    row_data: Optional[list] = None


class DataUpdateRequest(BaseModel):
    changes: list[CellUpdate] = []
    structural: list[StructuralUpdate] = []


class RecalculationResponse(BaseModel):
    success: bool
    statistics: dict
    message: str


class PaginatedDataResponse(BaseModel):
    sheet_name: str
    columns: list[str]
    rows: list[list[Any]]
    total_rows: int
    page: int
    page_size: int
    total_pages: int


class ColumnDetail(BaseModel):
    name: str
    detected_type: str
    total_count: int
    non_null_count: int
    missing_count: int
    missing_percentage: float
    unique_count: int


class SheetAnalysisResponse(BaseModel):
    filename: str
    sheet_name: str
    row_count: int
    column_count: int
    column_names: list[str]
    detected_types: dict
    missing_values: dict
    column_details: list[ColumnDetail]
    preview: list[dict]


class DatasetOverview(BaseModel):
    total_rows: int
    total_columns: int
    total_cells: int
    missing_cells: int
    missing_percentage: float
    numeric_columns: int
    text_columns: int
    date_columns: int
    categorical_columns: int
    boolean_columns: int


class CorrelationResult(BaseModel):
    matrix: dict
    numeric_columns: list[str]
    strong_correlations: list[dict]


class OutlierResult(BaseModel):
    q1: float
    q3: float
    iqr: float
    lower_bound: float
    upper_bound: float
    outlier_count: int
    total_count: int
    outlier_percentage: float


class InsightItem(BaseModel):
    type: str
    title: str
    message: str
    note: Optional[str] = None


class FullStatisticsResponse(BaseModel):
    overview: DatasetOverview
    columns: dict
    correlation: CorrelationResult
    outliers: dict
    insights: list[InsightItem]


class InlineStatisticsRequest(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


class InlineStatisticsResponse(BaseModel):
    overview: DatasetOverview
    columns: dict
    correlation: CorrelationResult
    outliers: dict
    insights: list[InsightItem]


class InlineChartRequest(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    chart_type: Optional[str] = None
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    aggregation: Optional[str] = None


class ChartDataItem(BaseModel):
    name: str
    value: Any
    x: Optional[Any] = None
    y: Optional[Any] = None


class ChartResult(BaseModel):
    chart_type: str
    title: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    data: list[dict]
    aggregation: Optional[str] = None


class InlineChartsResponse(BaseModel):
    suggestions: list[ChartResult]
    columns: dict


class SaveDataRequest(BaseModel):
    changes: list[CellUpdate] = []
    structural: list[StructuralUpdate] = []
    dataset_version: int


class SaveDataResponse(BaseModel):
    success: bool
    dataset_version: int
    message: str


class VersionConflictResponse(BaseModel):
    conflict: bool
    server_version: int
    message: str


class DiscardResponse(BaseModel):
    success: bool
    dataset_version: int
    message: str


class AnalysisHistoryCreate(BaseModel):
    file_id: str
    filename: str
    dataset_version: Optional[int] = None
    analysis_question: str
    ai_response: str
    statistics_snapshot: Optional[dict] = None
    chart_config: Optional[dict] = None
    dataset_snapshot: Optional[dict] = None


class AnalysisHistoryResponse(BaseModel):
    id: str
    file_id: str
    filename: str
    dataset_version: Optional[int] = None
    analysis_question: str
    ai_response: str
    statistics_snapshot: Optional[dict] = None
    chart_config: Optional[dict] = None
    dataset_snapshot: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisHistoryListResponse(BaseModel):
    id: str
    file_id: str
    filename: str
    dataset_version: Optional[int] = None
    analysis_question: str
    ai_response_preview: str
    created_at: datetime

    class Config:
        from_attributes = True


# Admin Schemas
class AdminDashboardResponse(BaseModel):
    total_users: int
    active_users: int
    total_datasets: int
    total_analyses: int
    ai_requests: int
    storage_bytes: int
    system_status: str
    db_status: str
    ai_configured: bool


class AdminUserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    dataset_count: int = 0
    analysis_count: int = 0


class AdminDatasetResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    owner_username: str
    file_size: int
    total_sheets: int
    total_rows: int
    dataset_version: int
    analysis_count: int
    created_at: datetime
    updated_at: datetime


class AdminAnalysisResponse(BaseModel):
    id: str
    username: str
    filename: str
    analysis_type: str
    created_at: datetime


class AdminAIUsageResponse(BaseModel):
    id: str
    username: Optional[str] = None
    model: Optional[str] = None
    status: str
    response_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime


class AdminSystemLogResponse(BaseModel):
    id: str
    event_type: str
    username: Optional[str] = None
    status: str
    message: str
    created_at: datetime


class AdminUserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
