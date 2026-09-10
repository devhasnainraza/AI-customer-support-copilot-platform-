"""
CORS and Logging Middleware
T027: Cross-Origin Resource Sharing and request logging
"""
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging
from typing import Callable
import uuid

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request/response logging"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Log request
        start_time = time.time()
        logger.info(
            f"Request started: {request.method} {request.url.path} "
            f"[request_id={request_id}]"
        )

        # Process request
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000  # Convert to ms

            # Log response
            logger.info(
                f"Request completed: {request.method} {request.url.path} "
                f"status={response.status_code} "
                f"duration={process_time:.2f}ms "
                f"[request_id={request_id}]"
            )

            # Add custom headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

            return response

        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            logger.error(
                f"Request failed: {request.method} {request.url.path} "
                f"error={str(e)} "
                f"duration={process_time:.2f}ms "
                f"[request_id={request_id}]"
            )
            raise


def setup_cors(app):
    """
    Configure CORS middleware

    Args:
        app: FastAPI application instance
    """
    from src.config.settings import settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )
    logger.info(f"CORS enabled for origins: {settings.cors_origins_list}")


def setup_logging_middleware(app):
    """
    Configure logging middleware

    Args:
        app: FastAPI application instance
    """
    app.add_middleware(LoggingMiddleware)
    logger.info("Logging middleware enabled")
