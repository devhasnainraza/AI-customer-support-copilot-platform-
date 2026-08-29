"""
Vector Search Service - pgvector semantic search
T041: VectorSearchService with pgvector queries
"""
from typing import List, Optional
from uuid import UUID
import logging

from src.config.supabase import get_service_client
from src.models.chunk import ChunkWithSimilarity

logger = logging.getLogger(__name__)


class VectorSearchService:
    """Service for semantic search using pgvector"""

    @staticmethod
    async def search_similar_chunks(
        query_embedding: List[float],
        language: str,
        tenant_id: UUID,
        limit: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[ChunkWithSimilarity]:
        """
        Search for similar chunks using vector similarity

        Args:
            query_embedding: Query embedding vector (1536 dimensions)
            language: ISO 639-1 language code
            tenant_id: Tenant UUID for isolation
            limit: Maximum number of results
            similarity_threshold: Minimum similarity score (0.0-1.0)

        Returns:
            List of chunks with similarity scores
        """
        supabase = get_service_client()

        try:
            # pgvector cosine similarity query
            # Note: Supabase Python client doesn't have native pgvector support yet,
            # so we use RPC function or raw SQL via PostgREST

            # Build the query using RPC function (need to create this in migration)
            result = supabase.rpc(
                "search_chunks",
                {
                    "query_embedding": query_embedding,
                    "query_language": language,
                    "query_tenant_id": str(tenant_id),
                    "match_threshold": similarity_threshold,
                    "match_count": limit
                }
            ).execute()

            chunks = []
            for row in result.data:
                chunk_data = {
                    "id": row["id"],
                    "document_id": row["document_id"],
                    "tenant_id": row["tenant_id"],
                    "content": row["content"],
                    "language": row["language"],
                    "position": row["position"],
                    "char_start": row["char_start"],
                    "char_end": row["char_end"],
                    "token_count": row["token_count"],
                    "metadata": row.get("metadata", {}),
                    "similarity": row["similarity"]
                }
                chunks.append(ChunkWithSimilarity(**chunk_data))

            logger.info(
                f"Vector search returned {len(chunks)} chunks "
                f"(language={language}, threshold={similarity_threshold})"
            )

            return chunks

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            # Return empty list on error rather than failing
            return []

    @staticmethod
    async def hybrid_search(
        query_embedding: List[float],
        query_text: str,
        language: str,
        tenant_id: UUID,
        limit: int = 5,
        vector_weight: float = 0.7,
        text_weight: float = 0.3
    ) -> List[ChunkWithSimilarity]:
        """
        Hybrid search combining vector similarity and full-text search

        Args:
            query_embedding: Query embedding vector
            query_text: Query text for full-text search
            language: ISO 639-1 language code
            tenant_id: Tenant UUID
            limit: Maximum number of results
            vector_weight: Weight for vector similarity (0.0-1.0)
            text_weight: Weight for text ranking (0.0-1.0)

        Returns:
            List of chunks with combined scores
        """
        supabase = get_service_client()

        try:
            # Use RPC function for hybrid search
            result = supabase.rpc(
                "hybrid_search_chunks",
                {
                    "query_embedding": query_embedding,
                    "query_text": query_text,
                    "query_language": language,
                    "query_tenant_id": str(tenant_id),
                    "match_count": limit,
                    "vector_weight": vector_weight,
                    "text_weight": text_weight
                }
            ).execute()

            chunks = []
            for row in result.data:
                chunk_data = {
                    "id": row["id"],
                    "document_id": row["document_id"],
                    "tenant_id": row["tenant_id"],
                    "content": row["content"],
                    "language": row["language"],
                    "position": row["position"],
                    "char_start": row["char_start"],
                    "char_end": row["char_end"],
                    "token_count": row["token_count"],
                    "metadata": row.get("metadata", {}),
                    "similarity": row["combined_score"]
                }
                chunks.append(ChunkWithSimilarity(**chunk_data))

            logger.info(
                f"Hybrid search returned {len(chunks)} chunks "
                f"(language={language})"
            )

            return chunks

        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            # Fallback to vector-only search
            return await VectorSearchService.search_similar_chunks(
                query_embedding, language, tenant_id, limit
            )
