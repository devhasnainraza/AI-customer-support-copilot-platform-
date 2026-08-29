"""
Embedding Generation Utility
T071: Generate embeddings using OpenAI-compatible API
"""
from typing import List, Optional
import logging
from openai import AsyncOpenAI
from src.config.settings import settings

logger = logging.getLogger(__name__)

# Lazily-created OpenAI client. Embeddings require an OpenAI API key -- Groq
# does not serve an embeddings endpoint, so reusing groq_api_key here 401s.
_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    """
    Get (and lazily create) the AsyncOpenAI client used for embeddings.

    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured
    """
    global _client

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. Embeddings (RAG search and "
            "document ingestion) require an OpenAI API key. Set OPENAI_API_KEY "
            "in your environment or .env file."
        )

    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)

    return _client


def _embedding_request_kwargs() -> dict:
    """
    Build model-specific kwargs. Only the text-embedding-3-* family supports
    the `dimensions` parameter; ada-002 already returns 1536 dimensions.
    """
    kwargs = {"model": settings.embedding_model}
    if settings.embedding_model.startswith("text-embedding-3"):
        kwargs["dimensions"] = settings.embedding_dimension
    return kwargs


async def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate embedding vector for text

    Args:
        text: Text to embed

    Returns:
        Embedding vector (1536 dimensions) or None if failed

    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured
    """
    if not text or not text.strip():
        logger.warning("Empty text provided for embedding")
        return None

    try:
        client = get_client()
    except RuntimeError as r_err:
        logger.warning(f"Embedding skipped: {r_err}")
        return None

    try:
        # Clean text
        text = text.strip()

        # Generate embedding
        response = await client.embeddings.create(
            input=text,
            **_embedding_request_kwargs()
        )

        embedding = response.data[0].embedding

        # Validate dimensions
        if len(embedding) != settings.embedding_dimension:
            logger.error(
                f"Embedding dimension mismatch: expected {settings.embedding_dimension}, "
                f"got {len(embedding)}"
            )
            return None

        logger.debug(f"Generated embedding for text (length: {len(text)})")
        return embedding

    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return None


async def generate_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    Generate embeddings for multiple texts in batch

    Args:
        texts: List of texts to embed

    Returns:
        List of embedding vectors (same order as input)

    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured
    """
    if not texts:
        return []

    client = get_client()

    try:
        # Clean texts
        cleaned_texts = [text.strip() for text in texts if text and text.strip()]

        if not cleaned_texts:
            return [None] * len(texts)

        # Generate embeddings in batch
        response = await client.embeddings.create(
            input=cleaned_texts,
            **_embedding_request_kwargs()
        )

        embeddings = [item.embedding for item in response.data]

        logger.info(f"Generated {len(embeddings)} embeddings in batch")
        return embeddings

    except Exception as e:
        logger.error(f"Failed to generate batch embeddings: {e}")
        return [None] * len(texts)


def normalize_embedding(embedding: List[float]) -> List[float]:
    """
    Normalize embedding to unit length (for cosine similarity)

    Args:
        embedding: Embedding vector

    Returns:
        Normalized embedding
    """
    import math

    magnitude = math.sqrt(sum(x * x for x in embedding))

    if magnitude == 0:
        return embedding

    return [x / magnitude for x in embedding]
