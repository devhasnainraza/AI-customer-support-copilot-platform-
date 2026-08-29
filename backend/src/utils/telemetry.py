"""
OpenTelemetry Setup and Configuration
T025: OpenTelemetry distributed tracing and metrics
"""
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
try:
    from opentelemetry.exporter.jaeger.thrift import JaegerExporter
except ImportError:
    JaegerExporter = None
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from src.config.settings import settings

logger = logging.getLogger(__name__)


def setup_telemetry():
    """
    Initialize OpenTelemetry tracing and metrics
    """
    if not settings.otel_enabled:
        logger.info("OpenTelemetry is disabled")
        return

    # Create resource with service name
    resource = Resource(attributes={
        SERVICE_NAME: settings.otel_service_name
    })

    # Setup tracing
    tracer_provider = TracerProvider(resource=resource)

    # Add Jaeger exporter for distributed tracing
    if JaegerExporter is None:
        logger.warning("JaegerExporter could not be imported. Distributed tracing will be disabled.")
    else:
        jaeger_exporter = JaegerExporter(
            collector_endpoint=settings.otel_exporter_jaeger_endpoint,
        )
        tracer_provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))

    trace.set_tracer_provider(tracer_provider)
    logger.info(f"OpenTelemetry tracing enabled: {settings.otel_exporter_jaeger_endpoint}")

    # Setup metrics with Prometheus exporter
    prometheus_reader = PrometheusMetricReader()
    meter_provider = MeterProvider(
        resource=resource,
        metric_readers=[prometheus_reader]
    )
    metrics.set_meter_provider(meter_provider)
    logger.info(f"OpenTelemetry metrics enabled on port {settings.otel_exporter_prometheus_port}")


def instrument_fastapi(app):
    """
    Instrument FastAPI application with OpenTelemetry

    Args:
        app: FastAPI application instance
    """
    if settings.otel_enabled:
        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumented with OpenTelemetry")


def get_tracer(name: str):
    """
    Get a tracer instance

    Args:
        name: Tracer name (usually __name__)

    Returns:
        Tracer instance
    """
    return trace.get_tracer(name)


def get_meter(name: str):
    """
    Get a meter instance for custom metrics

    Args:
        name: Meter name (usually __name__)

    Returns:
        Meter instance
    """
    return metrics.get_meter(name)
