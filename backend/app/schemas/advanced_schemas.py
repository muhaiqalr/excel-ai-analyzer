from typing import Any, Optional
from pydantic import BaseModel, Field


class TrendRequest(BaseModel):
    date_column: Optional[str] = None
    value_column: Optional[str] = None


class CompareRequest(BaseModel):
    group_column: str
    value_column: str


class TopBottomRequest(BaseModel):
    column: str
    n: int = Field(default=10, ge=1, le=100)
    ascending: bool = False


class AnomalyRequest(BaseModel):
    column: Optional[str] = None


class ForecastRequest(BaseModel):
    date_column: str
    value_column: str
    periods: int = Field(default=12, ge=1, le=365)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=5000)


class ExplainRequest(BaseModel):
    analysis_type: str
    params: Optional[dict] = None


class GenericAnalysisResponse(BaseModel):
    success: bool
    data: Any
