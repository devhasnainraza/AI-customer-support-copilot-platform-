"""
Document Chunking Utility
T072: Split documents into overlapping chunks
"""
from typing import List, Dict
import logging
import re
from src.config.settings import settings

logger = logging.getLogger(__name__)

# chunks.content has a DB CHECK of length BETWEEN 100 AND 2000, so a chunk
# shorter than this cannot be persisted.
MIN_CHUNK_CHARS = 100


def chunk_text(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
    metadata: Dict = None
) -> List[Dict]:
    """
    Split text into overlapping chunks

    Args:
        text: Text to chunk
        chunk_size: Target chunk size in characters (default from settings)
        chunk_overlap: Overlap between chunks in characters (default from settings)
        metadata: Additional metadata to include with each chunk

    Returns:
        List of chunk dictionaries with content, char_start, char_end, position
    """
    if chunk_size is None:
        chunk_size = settings.chunk_size

    if chunk_overlap is None:
        chunk_overlap = settings.chunk_overlap

    if metadata is None:
        metadata = {}

    if not text or not text.strip():
        logger.warning("Empty text provided for chunking")
        return []

    # Clean text
    text = text.strip()

    # Split into sentences for better chunk boundaries
    sentences = split_into_sentences(text)

    chunks = []
    current_chunk = ""
    current_start = 0
    position = 0

    for sentence in sentences:
        # If adding this sentence exceeds chunk_size, save current chunk
        if current_chunk and len(current_chunk) + len(sentence) > chunk_size:
            # Save current chunk
            chunks.append({
                "content": current_chunk.strip(),
                "char_start": current_start,
                "char_end": current_start + len(current_chunk),
                "position": position,
                "token_count": estimate_token_count(current_chunk),
                "metadata": metadata.copy()
            })

            # Start new chunk with overlap. Offsets must be computed from the
            # chunk that was just saved, before current_chunk is reassigned.
            overlap_text = get_overlap_text(current_chunk, chunk_overlap)
            current_start = current_start + len(current_chunk) - len(overlap_text)
            current_chunk = overlap_text + " " + sentence
            position += 1
        else:
            # Add sentence to current chunk
            if current_chunk:
                current_chunk += " " + sentence
            else:
                current_chunk = sentence

    # Add final chunk
    if current_chunk.strip():
        chunks.append({
            "content": current_chunk.strip(),
            "char_start": current_start,
            "char_end": current_start + len(current_chunk),
            "position": position,
            "token_count": estimate_token_count(current_chunk),
            "metadata": metadata.copy()
        })

    chunks = _enforce_min_chunk_size(chunks)

    logger.info(f"Text chunked into {len(chunks)} chunks")
    return chunks


def _enforce_min_chunk_size(chunks: List[Dict]) -> List[Dict]:
    """
    Ensure no chunk is shorter than the DB minimum.

    A trailing chunk under MIN_CHUNK_CHARS is merged into the previous chunk;
    if it is the only chunk and still too short, it is dropped (nothing that
    short can be inserted).

    Args:
        chunks: Chunks produced by chunk_text

    Returns:
        Chunks that all satisfy the length constraint
    """
    if not chunks:
        return chunks

    while len(chunks) > 1 and len(chunks[-1]["content"]) < MIN_CHUNK_CHARS:
        short = chunks.pop()
        previous = chunks[-1]
        previous["content"] = f"{previous['content']} {short['content']}".strip()
        previous["char_end"] = max(previous["char_end"], short["char_end"])
        previous["token_count"] = estimate_token_count(previous["content"])

    if len(chunks) == 1 and len(chunks[0]["content"]) < MIN_CHUNK_CHARS:
        logger.warning(
            f"Dropping single chunk of {len(chunks[0]['content'])} chars "
            f"(minimum is {MIN_CHUNK_CHARS})"
        )
        return []

    # Re-number positions after any merges
    for index, chunk in enumerate(chunks):
        chunk["position"] = index

    return chunks


def split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences

    Args:
        text: Text to split

    Returns:
        List of sentences
    """
    # Simple sentence splitting (can be improved with spacy or nltk)
    # Split on .!? followed by space or newline
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # Filter out empty sentences
    sentences = [s.strip() for s in sentences if s.strip()]

    return sentences


def get_overlap_text(text: str, overlap_size: int) -> str:
    """
    Get the last N characters from text for overlap

    Args:
        text: Source text
        overlap_size: Number of characters to overlap

    Returns:
        Overlap text
    """
    if len(text) <= overlap_size:
        return text

    # Try to break at sentence boundary
    overlap_text = text[-overlap_size:]

    # Find last sentence boundary
    last_period = overlap_text.rfind('.')
    last_exclamation = overlap_text.rfind('!')
    last_question = overlap_text.rfind('?')

    last_boundary = max(last_period, last_exclamation, last_question)

    if last_boundary > 0:
        return overlap_text[last_boundary + 1:].strip()

    return overlap_text.strip()


def estimate_token_count(text: str) -> int:
    """
    Estimate token count for text

    Simple estimation: ~4 characters per token on average
    For accurate tokenization, use tiktoken library

    Args:
        text: Text to estimate

    Returns:
        Estimated token count
    """
    return len(text) // 4


def chunk_by_paragraphs(
    text: str,
    max_chunk_size: int = None,
    metadata: Dict = None
) -> List[Dict]:
    """
    Chunk text by paragraphs (alternative chunking strategy)

    Args:
        text: Text to chunk
        max_chunk_size: Maximum chunk size
        metadata: Additional metadata

    Returns:
        List of chunks
    """
    if max_chunk_size is None:
        max_chunk_size = settings.chunk_size

    if metadata is None:
        metadata = {}

    # Split by double newlines (paragraphs)
    paragraphs = re.split(r'\n\s*\n', text)

    chunks = []
    current_chunk = ""
    current_start = 0
    position = 0

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        # If paragraph alone exceeds max size, split it
        if len(paragraph) > max_chunk_size:
            # Save current chunk if exists
            if current_chunk:
                chunks.append({
                    "content": current_chunk.strip(),
                    "char_start": current_start,
                    "char_end": current_start + len(current_chunk),
                    "position": position,
                    "token_count": estimate_token_count(current_chunk),
                    "metadata": metadata.copy()
                })
                position += 1
                current_chunk = ""

            # Split large paragraph with sentence-based chunking
            para_chunks = chunk_text(paragraph, max_chunk_size, 0, metadata)
            for pc in para_chunks:
                pc["position"] = position
                chunks.append(pc)
                position += 1

            current_start = chunks[-1]["char_end"]
        elif len(current_chunk) + len(paragraph) > max_chunk_size:
            # Save current chunk
            chunks.append({
                "content": current_chunk.strip(),
                "char_start": current_start,
                "char_end": current_start + len(current_chunk),
                "position": position,
                "token_count": estimate_token_count(current_chunk),
                "metadata": metadata.copy()
            })
            position += 1

            # Start new chunk with this paragraph
            current_chunk = paragraph
            current_start = current_start + len(current_chunk)
        else:
            # Add to current chunk
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph

    # Add final chunk
    if current_chunk.strip():
        chunks.append({
            "content": current_chunk.strip(),
            "char_start": current_start,
            "char_end": current_start + len(current_chunk),
            "position": position,
            "token_count": estimate_token_count(current_chunk),
            "metadata": metadata.copy()
        })

    logger.info(f"Text chunked by paragraphs into {len(chunks)} chunks")
    return chunks
