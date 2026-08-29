"""
Knowledge Base API Endpoints
T075-T082: REST API for documents and chunks search/management
"""
import logging
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field

from src.api.middleware.auth import require_role
from src.models.document import DocumentPublic, DocumentCreate, FileType, ProcessingStatus, Document
from src.models.chunk import ChunkPublic
from src.services.knowledge_service import KnowledgeService
from src.services.kafka_producer import send_kafka_event
from src.config.supabase import get_service_client
from src.config.settings import settings
from src.utils.embeddings import generate_embedding
from src.services.vector_search_service import VectorSearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/knowledge", tags=["knowledge"])

# Explicit extension -> FileType map. FileType("md") raises because the enum
# value is "markdown", which broke every .md upload from the frontend.
EXTENSION_FILE_TYPES = {
    "pdf": FileType.PDF,
    "docx": FileType.DOCX,
    "txt": FileType.TXT,
    "md": FileType.MARKDOWN,
    "markdown": FileType.MARKDOWN,
    "html": FileType.HTML,
    "htm": FileType.HTML,
}


class SearchRequest(BaseModel):
    """Schema for vector search preview request"""
    query: str = Field(..., min_length=1)
    language: str = Field("en", pattern="^[a-z]{2}$")
    match_count: int = Field(5, ge=1, le=20)
    similarity_threshold: float = Field(0.7, ge=0.0, le=1.0)


class SearchResultChunk(BaseModel):
    """Schema for individual match result chunk"""
    id: UUID
    document_id: UUID
    content: str
    position: int
    similarity: float
    source_title: Optional[str] = None


class SearchResponse(BaseModel):
    """Schema for vector search response"""
    query: str
    results: List[SearchResultChunk]


class LanguageListResponse(BaseModel):
    """Schema for listing supported languages"""
    languages: List[str]


@router.post("/documents", response_model=DocumentPublic, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    language: str = Form("en"),
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T075 & T083: Upload document and trigger ingestion
    """
    filename = file.filename
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing"
        )

    ext = filename.split(".")[-1].lower() if "." in filename else ""
    file_type = EXTENSION_FILE_TYPES.get(ext)
    if file_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '.{ext}'. Supported: {', '.join(sorted(EXTENSION_FILE_TYPES))}"
        )

    supabase = get_service_client()
    tenant_id = current_user["tenant_id"]
    document_id = uuid4()
    storage_path = f"{tenant_id}/{document_id}.{ext}"
    bucket_name = "knowledge-base"

    file_bytes = await file.read()
    file_size = len(file_bytes)

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum upload size of {settings.max_upload_size_mb} MB"
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )

    try:
        # Upload file to Supabase Storage
        supabase.storage.from_(bucket_name).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type}
        )

        # Get public URL
        file_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)

    except Exception as e:
        logger.error(f"Failed to upload file to storage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file: {str(e)}"
        )

    try:
        doc_create = DocumentCreate(
            filename=filename,
            file_type=file_type,
            language=language,
            tenant_id=UUID(tenant_id),
            file_url=file_url,
            file_size_bytes=file_size,
            uploaded_by=UUID(current_user["user_id"]),
            processing_status=ProcessingStatus.PENDING,
            metadata={"storage_path": storage_path}
        )

        # mode="json" so UUID/enum values serialize for the PostgREST payload
        doc_data = doc_create.model_dump(mode="json", exclude_none=True)
        doc_data["id"] = str(document_id)

        db_result = supabase.table("documents").insert(doc_data).execute()
        if not db_result.data:
            raise Exception("Failed to insert document record")

        document = Document(**db_result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create document record: {e}")
        try:
            supabase.storage.from_(bucket_name).remove([storage_path])
        except Exception as cleanup_err:
            logger.warning(f"Failed to clean up orphaned storage object: {cleanup_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save document metadata"
        )

    try:
        send_kafka_event(
            topic="ingestion-events",
            event_type="document.uploaded",
            payload={
                "document_id": str(document.id),
                "tenant_id": str(document.tenant_id),
                "filename": document.filename,
                "file_url": document.file_url,
                "file_type": document.file_type.value,
                "language": document.language,
                "uploaded_by": str(document.uploaded_by),
                "storage_path": storage_path
            },
            tenant_id=str(document.tenant_id),
            correlation_id=str(document.id)
        )
    except Exception as e:
        logger.error(f"Failed to emit Kafka ingestion event: {e}")

    return DocumentPublic(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        language=document.language,
        file_size_bytes=document.file_size_bytes,
        uploaded_at=document.uploaded_at,
        processing_status=document.processing_status,
        processing_error=document.processing_error,
        version=document.version,
        metadata=document.metadata
    )


@router.get("/documents", response_model=List[DocumentPublic])
async def list_documents(
    limit: int = 50,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T076: Get all documents for the current tenant
    """
    tenant_id = UUID(current_user["tenant_id"])
    documents = await KnowledgeService.get_tenant_documents(tenant_id, limit=limit)
    
    return [
        DocumentPublic(
            id=doc.id,
            filename=doc.filename,
            file_type=doc.file_type,
            language=doc.language,
            file_size_bytes=doc.file_size_bytes,
            uploaded_at=doc.uploaded_at,
            processing_status=doc.processing_status,
            processing_error=doc.processing_error,
            version=doc.version,
            metadata=doc.metadata
        )
        for doc in documents
    ]


@router.get("/documents/{document_id}", response_model=DocumentPublic)
async def get_document(
    document_id: UUID,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T077: Get specific document metadata
    """
    document = await KnowledgeService.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    if str(document.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
        
    return DocumentPublic(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        language=document.language,
        file_size_bytes=document.file_size_bytes,
        uploaded_at=document.uploaded_at,
        processing_status=document.processing_status,
        processing_error=document.processing_error,
        version=document.version,
        metadata=document.metadata
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: UUID,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T079: Delete document, its chunks, and its file in Supabase storage
    """
    document = await KnowledgeService.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    if str(document.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
        
    # Remove from Supabase Storage
    try:
        supabase = get_service_client()
        storage_path = document.metadata.get("storage_path")
        if storage_path:
            supabase.storage.from_("knowledge-base").remove([storage_path])
    except Exception as e:
        logger.error(f"Failed to remove file from Supabase storage: {e}")
        
    # Delete database record (cascades to chunks)
    success = await KnowledgeService.delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document record"
        )
        
    return {"message": "Document successfully deleted"}


@router.get("/documents/{document_id}/chunks", response_model=List[ChunkPublic])
async def get_document_chunks(
    document_id: UUID,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T080: Get all chunk details for a document
    """
    document = await KnowledgeService.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    if str(document.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
        
    chunks = await KnowledgeService.get_document_chunks(document_id)
    return [
        ChunkPublic(
            id=c.id,
            document_id=c.document_id,
            content=c.content,
            position=c.position,
            source_title=document.filename
        )
        for c in chunks
    ]


@router.post("/search", response_model=SearchResponse)
async def preview_search(
    req: SearchRequest,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T081: Vector semantic search sandbox preview for admins
    """
    tenant_id = UUID(current_user["tenant_id"])
    
    # Generate query embedding
    embedding = await generate_embedding(req.query)
    if not embedding:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate embedding vector"
        )
        
    # Retrieve similar chunks
    matching_chunks = await VectorSearchService.search_similar_chunks(
        query_embedding=embedding,
        language=req.language,
        tenant_id=tenant_id,
        limit=req.match_count,
        similarity_threshold=req.similarity_threshold
    )
    
    # Format response
    results = []
    for chunk in matching_chunks:
        # Fetch document to get title
        doc = await KnowledgeService.get_document(chunk.document_id)
        source_title = doc.filename if doc else None
        
        results.append(
            SearchResultChunk(
                id=chunk.id,
                document_id=chunk.document_id,
                content=chunk.content,
                position=chunk.position,
                similarity=chunk.similarity,
                source_title=source_title
            )
        )
        
    return SearchResponse(
        query=req.query,
        results=results
    )


@router.get("/languages", response_model=LanguageListResponse)
async def list_languages(
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    T082: Get list of supported languages
    """
    return LanguageListResponse(languages=settings.supported_languages_list)
