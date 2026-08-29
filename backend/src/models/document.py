"""
Document Pydantic Model
T073: Document data models for knowledge base
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum


class FileType(str, Enum):
    """Supported file formats"""
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    MARKDOWN = "markdown"
    HTML = "html"


class ProcessingStatus(str, Enum):
    """Ingestion processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentBase(BaseModel):
    """Base document fields"""
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: FileType
    language: str = Field(..., pattern="^[a-z]{2}$")  # ISO 639-1


class DocumentCreate(DocumentBase):
    """Document creation model"""
    tenant_id: UUID
    file_url: str
    file_size_bytes: int = Field(..., gt=0)
    uploaded_by: UUID
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    metadata: dict = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Document update model"""
    processing_status: Optional[ProcessingStatus] = None
    processing_error: Optional[str] = None
    version: Optional[int] = None
    metadata: Optional[dict] = None


class Document(DocumentBase):
    """Document database model"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    file_url: str
    file_size_bytes: int
    uploaded_by: UUID
    uploaded_at: datetime
    processing_status: ProcessingStatus
    processing_error: Optional[str] = None
    version: int
    metadata: dict = Field(default_factory=dict)


class DocumentPublic(DocumentBase):
    """Public document fields (for API responses)"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_size_bytes: int
    uploaded_at: datetime
    processing_status: ProcessingStatus
    processing_error: Optional[str] = None
    version: int
    metadata: dict = Field(default_factory=dict)
