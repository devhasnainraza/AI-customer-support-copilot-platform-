"""
Health Check Endpoint
T033: System health check with per-service timeouts
"""
import asyncio
from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Dict
import logging
from src.config.supabase import get_supabase_client
from src.config.redis import get_redis_client
from src.services.kafka_producer import get_kafka_producer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

HEALTH_TIMEOUT = 5  # seconds per service check


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    services: Dict[str, str]
    version: str


async def _check_supabase() -> str:
    try:
        supabase = get_supabase_client()
        await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.table("customers").select("id").limit(1).execute()
            ),
            timeout=HEALTH_TIMEOUT,
        )
        return "connected"
    except asyncio.TimeoutError:
        logger.warning("Supabase health check timed out")
        return "timeout"
    except Exception as e:
        logger.error(f"Supabase health check failed: {e}")
        return "disconnected"


async def _check_redis() -> str:
    try:
        redis = await get_redis_client()
        await asyncio.wait_for(redis.ping(), timeout=HEALTH_TIMEOUT)
        return "connected"
    except asyncio.TimeoutError:
        logger.warning("Redis health check timed out")
        return "timeout"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return "disconnected"


async def _check_kafka() -> str:
    try:
        producer = get_kafka_producer()
        if producer:
            return "connected"
        return "disconnected"
    except Exception as e:
        logger.error(f"Kafka health check failed: {e}")
        return "disconnected"


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check():
    """
    Health check endpoint

    Returns system health status and service connectivity.
    Each service check has a timeout to prevent hanging.
    """
    services_status = {}

    # Run all checks concurrently with individual timeouts
    supabase_status, redis_status, kafka_status = await asyncio.gather(
        _check_supabase(),
        _check_redis(),
        _check_kafka(),
    )

    services_status["supabase"] = supabase_status
    services_status["redis"] = redis_status
    services_status["kafka"] = kafka_status

    # Determine overall status
    overall_status = "healthy" if all(
        s == "connected" for s in services_status.values()
    ) else "degraded"

    return HealthResponse(
        status=overall_status,
        services=services_status,
        version="1.1.0"
    )
