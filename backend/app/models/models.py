import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Boolean,
)
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # "user" or "admin"
    is_active = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    files = relationship("File", back_populates="user", cascade="all, delete-orphan")
    analysis_sessions = relationship(
        "AnalysisSession", back_populates="user", cascade="all, delete-orphan"
    )
    analysis_histories = relationship(
        "AnalysisHistory", back_populates="user", cascade="all, delete-orphan"
    )


class File(Base):
    __tablename__ = "files"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    mime_type = Column(String(100), nullable=True)
    total_sheets = Column(Integer, nullable=False, default=0)
    total_rows = Column(Integer, nullable=False, default=0)
    total_columns = Column(Integer, nullable=False, default=0)
    dataset_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="files")
    versions = relationship(
        "FileVersion", back_populates="file", cascade="all, delete-orphan"
    )
    sheets = relationship("Sheet", back_populates="file", cascade="all, delete-orphan")
    statistics_snapshots = relationship(
        "StatisticsSnapshot", back_populates="file", cascade="all, delete-orphan"
    )
    chart_configurations = relationship(
        "ChartConfiguration", back_populates="file", cascade="all, delete-orphan"
    )
    analysis_sessions = relationship(
        "AnalysisSession", back_populates="file", cascade="all, delete-orphan"
    )
    analysis_histories = relationship(
        "AnalysisHistory", back_populates="file", cascade="all, delete-orphan"
    )


class FileVersion(Base):
    __tablename__ = "file_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    change_description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    file = relationship("File", back_populates="versions")


class Sheet(Base):
    __tablename__ = "sheets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    sheet_name = Column(String(255), nullable=False)
    sheet_index = Column(Integer, nullable=False, default=0)
    row_count = Column(Integer, nullable=False, default=0)
    column_count = Column(Integer, nullable=False, default=0)
    column_names = Column(JSON, nullable=True)
    column_types = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    file = relationship("File", back_populates="sheets")


class AnalysisSession(Base):
    __tablename__ = "analysis_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False, default="New Analysis")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="analysis_sessions")
    file = relationship("File", back_populates="analysis_sessions")
    messages = relationship(
        "AnalysisMessage", back_populates="session", cascade="all, delete-orphan"
    )


class AnalysisMessage(Base):
    __tablename__ = "analysis_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(
        String(36), ForeignKey("analysis_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("AnalysisSession", back_populates="messages")


class StatisticsSnapshot(Base):
    __tablename__ = "statistics_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    sheet_name = Column(String(255), nullable=False)
    statistics = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    file = relationship("File", back_populates="statistics_snapshots")


class ChartConfiguration(Base):
    __tablename__ = "chart_configurations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    sheet_name = Column(String(255), nullable=False)
    chart_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=True)
    x_column = Column(String(255), nullable=True)
    y_column = Column(String(255), nullable=True)
    config = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    file = relationship("File", back_populates="chart_configurations")


class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    dataset_version = Column(Integer, nullable=True)
    analysis_question = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    statistics_snapshot = Column(JSON, nullable=True)
    chart_config = Column(JSON, nullable=True)
    dataset_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="analysis_histories")
    file = relationship("File", back_populates="analysis_histories")


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_type = Column(String(50), nullable=False, index=True)  # auth, upload, analysis, ai_error, db_error, system
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), nullable=False, default="success")  # success, error, warning
    message = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)


class AIUsage(Base):
    __tablename__ = "ai_usage"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    model = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="success")  # success, error
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
