"""
Knowledge Service - Document and Chunk CRUD
T074: KnowledgeService implementation
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import logging

from src.config.supabase import get_service_client
from src.models.document import Document, DocumentCreate, DocumentUpdate, ProcessingStatus
from src.models.chunk import Chunk, ChunkCreate

logger = logging.getLogger(__name__)


class KnowledgeService:
    """Service for managing documents and knowledge base chunks"""

    @staticmethod
    async def create_document(doc: DocumentCreate) -> Document:
        """
        Create a new document metadata entry
        """
        supabase = get_service_client()

        try:
            data = {
                "tenant_id": str(doc.tenant_id),
                "filename": doc.filename,
                "file_url": doc.file_url,
                "file_type": doc.file_type.value,
                "file_size_bytes": doc.file_size_bytes,
                "language": doc.language,
                "uploaded_by": str(doc.uploaded_by),
                "processing_status": doc.processing_status.value,
                "metadata": doc.metadata,
                "version": 1,
            }

            result = supabase.table("documents").insert(data).execute()

            if not result.data:
                raise Exception("Failed to create document")

            logger.info(f"Document created: {result.data[0]['id']}")
            return Document(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to create document: {e}")
            raise

    @staticmethod
    async def get_document(doc_id: UUID) -> Optional[Document]:
        """Get document by ID"""
        supabase = get_service_client()

        try:
            result = supabase.table("documents").select("*").eq("id", str(doc_id)).execute()

            if not result.data:
                return None

            return Document(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to get document {doc_id}: {e}")
            raise

    @staticmethod
    async def get_tenant_documents(
        tenant_id: UUID,
        limit: int = 50
    ) -> List[Document]:
        """Get all documents for a tenant"""
        supabase = get_service_client()

        try:
            result = (
                supabase.table("documents")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .order("uploaded_at", desc=True)
                .limit(limit)
                .execute()
            )

            return [Document(**doc) for doc in result.data]

        except Exception as e:
            logger.error(f"Failed to get documents for tenant {tenant_id}: {e}")
            raise

    @staticmethod
    async def update_document(
        doc_id: UUID,
        update: DocumentUpdate
    ) -> Document:
        """Update document metadata"""
        supabase = get_service_client()

        try:
            data = update.model_dump(exclude_none=True)

            if "processing_status" in data and data["processing_status"]:
                data["processing_status"] = data["processing_status"].value

            result = (
                supabase.table("documents")
                .update(data)
                .eq("id", str(doc_id))
                .execute()
            )

            if not result.data:
                raise Exception(f"Document {doc_id} not found")

            logger.info(f"Document updated: {doc_id}")
            return Document(**result.data[0])

        except Exception as e:
            logger.error(f"Failed to update document {doc_id}: {e}")
            raise

    @staticmethod
    async def delete_document(doc_id: UUID) -> bool:
        """Delete document and all corresponding chunks (via CASCADE)"""
        supabase = get_service_client()

        try:
            # Delete document. Chunks should CASCADE delete as defined in schema.
            result = supabase.table("documents").delete().eq("id", str(doc_id)).execute()

            logger.info(f"Document deleted: {doc_id}")
            return len(result.data) > 0

        except Exception as e:
            logger.error(f"Failed to delete document {doc_id}: {e}")
            raise

    @staticmethod
    async def create_chunks_batch(chunks: List[ChunkCreate]) -> List[Chunk]:
        """Insert multiple document chunks in batch"""
        if not chunks:
            return []

        supabase = get_service_client()

        try:
            data = [
                {
                    "document_id": str(chunk.document_id),
                    "tenant_id": str(chunk.tenant_id),
                    "content": chunk.content,
                    "embedding": chunk.embedding,
                    "language": chunk.language,
                    "position": chunk.position,
                    "char_start": chunk.char_start,
                    "char_end": chunk.char_end,
                    "token_count": chunk.token_count,
                    "metadata": chunk.metadata,
                }
                for chunk in chunks
            ]

            # Supabase insert accepts a list of records for batch insertion
            result = supabase.table("chunks").insert(data).execute()

            if not result.data:
                raise Exception("Failed to batch insert chunks")

            logger.info(f"Batch inserted {len(result.data)} chunks for document {chunks[0].document_id}")
            return [Chunk(**c) for c in result.data]

        except Exception as e:
            logger.error(f"Failed to batch insert chunks: {e}")
            raise

    @staticmethod
    async def get_document_chunks(doc_id: UUID) -> List[Chunk]:
        """Get all chunks for a document"""
        supabase = get_service_client()

        try:
            result = (
                supabase.table("chunks")
                .select("*")
                .eq("document_id", str(doc_id))
                .order("position", desc=False)
                .execute()
            )

            return [Chunk(**c) for c in result.data]

        except Exception as e:
            logger.error(f"Failed to get chunks for document {doc_id}: {e}")
            raise
