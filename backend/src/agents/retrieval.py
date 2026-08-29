"""
Retrieval Agent - Vector Search
T045: Semantic search and context retrieval
"""
from src.agents.graph import AgentState
from src.services.vector_search_service import VectorSearchService
from src.utils.embeddings import generate_embedding
import logging

logger = logging.getLogger(__name__)


async def retrieval_agent(state: AgentState) -> AgentState:
    """
    Retrieval Agent: Performs semantic search to find relevant knowledge base chunks

    Uses pgvector to search for chunks similar to the user's query.
    Retrieved chunks are added to state for the Support Agent to use.

    Args:
        state: Current agent state

    Returns:
        Updated state with retrieved_chunks and retrieval_successful flag
    """
    try:
        logger.info(f"Retrieval Agent processing conversation {state['conversation_id']}")

        user_message = state['user_message']
        language = state['language']
        tenant_id = state['tenant_id']

        # Generate embedding for user query
        query_embedding = await generate_embedding(user_message)

        if not query_embedding:
            logger.error("Failed to generate query embedding")
            state['retrieved_chunks'] = []
            state['retrieval_successful'] = False
            state['error'] = "Embedding generation failed"
            return state

        # Search for similar chunks
        chunks = await VectorSearchService.search_similar_chunks(
            query_embedding=query_embedding,
            language=language,
            tenant_id=tenant_id,
            limit=5,
            similarity_threshold=0.7
        )

        # Convert chunks to dict format for state
        retrieved_chunks = []
        for chunk in chunks:
            retrieved_chunks.append({
                'id': str(chunk.id),
                'content': chunk.content,
                'similarity': chunk.similarity,
                'document_id': str(chunk.document_id),
                'position': chunk.position
            })

        logger.info(
            f"Retrieved {len(retrieved_chunks)} chunks "
            f"(avg similarity: {sum(c['similarity'] for c in retrieved_chunks) / len(retrieved_chunks) if retrieved_chunks else 0:.2f})"
        )

        # Update state
        state['retrieved_chunks'] = retrieved_chunks
        state['retrieval_successful'] = len(retrieved_chunks) > 0
        state['step_count'] = state.get('step_count', 0) + 1

        return state

    except Exception as e:
        logger.error(f"Retrieval Agent failed: {e}")
        state['retrieved_chunks'] = []
        state['retrieval_successful'] = False
        state['error'] = f"Retrieval error: {str(e)}"
        return state
