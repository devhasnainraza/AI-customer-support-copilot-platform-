"""
FastAPI Application Entry Point
T028: Main FastAPI application with middleware and routing
"""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging
from contextlib import asynccontextmanager

from src.config.settings import settings
from src.api.middleware.logging import setup_cors, setup_logging_middleware
from src.utils.telemetry import setup_telemetry, instrument_fastapi
from src.api.routes.health import router as health_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    Handles startup and shutdown events
    """
    # Startup
    logger.info(f"Starting {settings.otel_service_name} in {settings.environment} environment")

    # Initialize OpenTelemetry
    setup_telemetry()

    # Start the chat-responses Kafka consumer in-process: the WebSocket
    # ConnectionManager lives here, so delivery must run inside the API process.
    from src.api.websockets.delivery import start_delivery_task, stop_delivery_task

    try:
        await start_delivery_task()
    except Exception as e:
        logger.error(f"Failed to start WebSocket delivery task: {e}")

    # Initialize services (connection pools will be created on first use)
    logger.info("Services initialized")

    yield

    # Shutdown
    logger.info("Shutting down application")

    try:
        await stop_delivery_task()
    except Exception as e:
        logger.error(f"Failed to stop WebSocket delivery task: {e}")

    # Close connections
    from src.config.redis import RedisClient
    from src.services.kafka_producer import KafkaProducerService

    await RedisClient.close()
    KafkaProducerService.close()

    logger.info("All connections closed")


# Create FastAPI application
app = FastAPI(
    title="AI Customer Support Copilot API",
    description="Real-time AI-powered customer support with RAG, multi-agent orchestration, and human escalation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Setup middleware
setup_cors(app)
setup_logging_middleware(app)

# Instrument with OpenTelemetry
instrument_fastapi(app)

# Register routers
app.include_router(health_router)

# Chat routes (User Story 1)
from src.api.routes.chat import router as chat_router
app.include_router(chat_router)

# WebSocket route
from src.api.routes.chat_websocket import router as ws_router
app.include_router(ws_router)

# Knowledge Base routes (User Story 2)
from src.api.routes.knowledge import router as knowledge_router
app.include_router(knowledge_router)

# Tickets routes (User Story 3)
from src.api.routes.tickets import router as tickets_router
app.include_router(tickets_router)

# Auth routes (Password Reset)
from src.api.routes.auth import router as auth_router
app.include_router(auth_router)

# Analytics routes (User Story 5)
from src.api.routes.analytics import router as analytics_router
app.include_router(analytics_router)

# Handoff routes (Talk-to-Human feature)
from src.api.routes.admin import router as admin_router
from src.api.routes.manager import router as manager_router
from src.api.routes.notifications import router as notifications_router
from src.api.routes.handoff import router as handoff_router
app.include_router(handoff_router)
app.include_router(admin_router)
app.include_router(manager_router)
app.include_router(notifications_router)

# WhatsApp Business API routes
from src.api.routes.whatsapp import router as whatsapp_router
from src.api.routes.whatsapp_ws import router as whatsapp_ws_router
app.include_router(whatsapp_router)
app.include_router(whatsapp_ws_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return JSONResponse(
        content={
            "message": "AI Customer Support Copilot API",
            "version": "1.0.0",
            "environment": settings.environment,
            "docs": "/docs" if settings.debug else "disabled"
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
