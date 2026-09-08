"""
Redis Connection Manager
T023: Redis client configuration with non-blocking graceful fallback
"""
import asyncio
import time
import logging
from typing import Optional
import redis.asyncio as aioredis
from redis.asyncio import Redis
from src.config.settings import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Singleton Redis client manager with non-blocking fallback"""

    _instance: Optional[Redis] = None
    _disabled: bool = False
    _last_failed_time: float = 0.0

    @classmethod
    async def get_client(cls) -> Optional[Redis]:
        """
        Get Redis client instance.
        If Redis is unreachable, returns None immediately without blocking request loops.
        """
        now = time.time()
        # Circuit breaker: If failed recently (within 60s), avoid blocking retries
        if cls._disabled and (now - cls._last_failed_time < 60.0):
            return None

        if cls._instance is None:
            try:
                client = await aioredis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20,
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                )
                # Test connection with strict 0.5s timeout
                await asyncio.wait_for(client.ping(), timeout=0.5)
                cls._instance = client
                cls._disabled = False
                logger.info("Redis connection established")
            except Exception as e:
                cls._disabled = True
                cls._last_failed_time = now
                cls._instance = None
                logger.warning(f"Redis unavailable ({e}). Continuing with in-memory caching.")
                return None

        return cls._instance

    @classmethod
    async def close(cls):
        """Close Redis connection"""
        if cls._instance is not None:
            try:
                await cls._instance.close()
            except Exception:
                pass
            cls._instance = None
            logger.info("Redis connection closed")

    @classmethod
    async def reset(cls):
        """Reset client instance"""
        await cls.close()
        cls._disabled = False
        cls._last_failed_time = 0.0


# Convenience function
async def get_redis_client() -> Optional[Redis]:
    """Get Redis client instance or None if unavailable"""
    return await RedisClient.get_client()

