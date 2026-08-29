"""
Chunk Pydantic Model
T039: Chunk data model for vector search
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ChunkBase(BaseModel):
    """Base chunk fields"""
    content: str = Field(..., min_length=100, max_length=2000)
    language: str = Field(..., pattern="^[a-z]{2}$")  # ISO 639-1


class ChunkCreate(ChunkBase):
    """Chunk creation model"""
    document_id: UUID
    tenant_id: UUID
    embedding: List[float] = Field(..., min_length=1536, max_length=1536)  # OpenAI ada-002
    position: int = Field(..., ge=0)
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., gt=0)
    token_count: int = Field(..., gt=0)
    metadata: dict = Field(default_factory=dict)


class Chunk(ChunkBase):
    """Chunk database model"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    tenant_id: UUID
    embedding: Optional[List[float]] = None  # May not be included in all queries
    position: int
    char_start: int
    char_end: int
    token_count: int
    metadata: dict = Field(default_factory=dict)


class ChunkWithSimilarity(Chunk):
    """Chunk with similarity score from vector search"""
    # No bounds: hybrid combined_score can exceed 1 and raw cosine can be < 0
    similarity: float


class ChunkPublic(BaseModel):
    """Public chunk information (for citations)"""
    id: UUID
    document_id: UUID
    content: str
    position: int
    similarity: Optional[float] = None
    source_title: Optional[str] = None  # From document metadata
