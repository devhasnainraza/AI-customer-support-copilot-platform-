"""
Kafka Producer Service
T024: Kafka producer wrapper
"""
from kafka import KafkaProducer
from kafka.errors import KafkaError
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
from src.config.settings import settings

logger = logging.getLogger(__name__)


class KafkaProducerService:
    """Singleton Kafka producer service"""

    _instance: KafkaProducer = None

    @classmethod
    def get_producer(cls) -> KafkaProducer:
        """
        Get Kafka producer instance

        Returns:
            KafkaProducer instance
        """
        if cls._instance is None:
            try:
                cls._instance = KafkaProducer(
                    bootstrap_servers=settings.kafka_bootstrap_servers.split(','),
                    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                    key_serializer=lambda k: k.encode('utf-8') if k else None,
                    acks='all',  # Wait for all replicas
                    retries=3,
                    max_in_flight_requests_per_connection=5,
                    compression_type='gzip'
                )
                logger.info(f"Kafka producer connected to {settings.kafka_bootstrap_servers}")
            except KafkaError as e:
                logger.error(f"Failed to create Kafka producer: {e}")
                raise

        return cls._instance

    @classmethod
    def close(cls):
        """Close Kafka producer"""
        if cls._instance is not None:
            cls._instance.close()
            cls._instance = None
            logger.info("Kafka producer closed")

    @classmethod
    def send_event(
        cls,
        topic: str,
        event_type: str,
        payload: Dict[str, Any],
        key: Optional[str] = None,
        tenant_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send event to Kafka topic

        Args:
            topic: Kafka topic name
            event_type: Event type identifier (e.g., 'message.created')
            payload: Event payload data
            key: Partition key (optional)
            tenant_id: Tenant identifier for multi-tenancy
            correlation_id: Correlation ID for distributed tracing
            metadata: Additional metadata

        Returns:
            True if sent successfully, False otherwise
        """
        producer = cls.get_producer()

        # Construct event envelope
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "correlation_id": correlation_id or str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "payload": payload,
            "metadata": {
                "source": "api",
                "version": "1.0",
                **(metadata or {})
            }
        }

        try:
            future = producer.send(topic, value=event, key=key)
            # Wait for send to complete (with timeout)
            record_metadata = future.get(timeout=10)
            logger.info(
                f"Event sent to Kafka: topic={topic}, "
                f"event_type={event_type}, "
                f"partition={record_metadata.partition}, "
                f"offset={record_metadata.offset}"
            )
            return True
        except KafkaError as e:
            logger.error(f"Failed to send event to Kafka: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending event to Kafka: {e}")
            return False


# Convenience functions
def get_kafka_producer() -> KafkaProducer:
    """Get Kafka producer instance"""
    return KafkaProducerService.get_producer()


def send_kafka_event(
    topic: str,
    event_type: str,
    payload: Dict[str, Any],
    **kwargs
) -> bool:
    """Send event to Kafka (convenience function)"""
    return KafkaProducerService.send_event(topic, event_type, payload, **kwargs)
