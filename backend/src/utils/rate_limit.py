"""
In-memory Rate Limiter
Prevents brute-force attacks on authentication endpoints.
"""
import time
import logging
from collections import defaultdict
from functools import wraps
from typing import Callable, Optional

from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

# Store: {key: [(timestamp, ...), ...]}
_buckets: dict[str, list[float]] = defaultdict(list)


def _prune(key: str, window: int) -> None:
    """Remove entries older than the window."""
    cutoff = time.time() - window
    _buckets[key] = [t for t in _buckets[key] if t > cutoff]


def check_rate_limit(
    key: str,
    max_requests: int = 10,
    window_seconds: int = 60,
) -> bool:
    """
    Check if the request is within rate limits.

    Args:
        key: Unique identifier (e.g. IP + endpoint).
        max_requests: Max allowed requests within the window.
        window_seconds: Time window in seconds.

    Returns:
        True if allowed, False if rate limited.
    """
    _prune(key, window_seconds)
    if len(_buckets[key]) >= max_requests:
        return False
    _buckets[key].append(time.time())
    return True


def rate_limit(
    max_requests: int = 10,
    window_seconds: int = 60,
    key_func: Optional[Callable[[Request], str]] = None,
):
    """
    Rate limit decorator for FastAPI endpoints.

    Args:
        max_requests: Max requests per window.
        window_seconds: Window duration.
        key_func: Custom key function. Defaults to IP-based.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            if key_func:
                key = key_func(request)
            else:
                # Default: IP + function name
                client_ip = request.client.host if request.client else "unknown"
                key = f"{client_ip}:{func.__name__}"

            if not check_rate_limit(key, max_requests, window_seconds):
                logger.warning(f"Rate limit exceeded for {key}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Try again in {window_seconds} seconds."
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
