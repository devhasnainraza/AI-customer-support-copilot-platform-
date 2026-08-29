"""
Redis Connection Manager
T023: Redis client configuration
"""
import redis.asyncio as aioredis
from redis.asyncio import Redis
from src.config.settings import settings
import logging

logger = logging.getLogger(__name__)


class RedisClient:
    """Singleton Redis client manager"""

    _instance: Redis = None

    @classmethod
    async def get_client(cls) -> Redis:
        """
        Get Redis client instance

        Returns:
            Async Redis client instance
        """
        if cls._instance is None:
            try:
                cls._instance = await aioredis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20
                )
                # Test connection
                await cls._instance.ping()
                logger.info("Redis connection established")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise

        return cls._instance

    @classmethod
    async def close(cls):
        """Close Redis connection"""
        if cls._instance is not None:
            await cls._instance.close()
            cls._instance = None
            logger.info("Redis connection closed")

    @classmethod
    async def reset(cls):
        """Reset client instance (useful for testing)"""
        await cls.close()


# Convenience function
async def get_redis_client() -> Redis:
    """Get Redis client instance"""
    return await RedisClient.get_client()
