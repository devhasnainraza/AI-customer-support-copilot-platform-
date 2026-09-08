"""
Pydantic Settings Configuration
T022: Settings management with environment variables
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Supabase Configuration
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Groq AI Configuration
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    # OpenAI Configuration (embeddings)
    openai_api_key: str = ""

    # Redis Configuration
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""
    redis_db: int = 0

    # Kafka Configuration
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group_id: str = "ai-copilot-consumer-group"

    # Application Configuration
    environment: str = "development"
    log_level: str = "INFO"
    debug: bool = False

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_url: str = "http://localhost:8000"

    frontend_url: str = "http://localhost:3000"

    # Security Configuration
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440

    cors_origins: str = "http://localhost:3000,http://localhost:51511,http://localhost:8000"

    # OpenTelemetry Configuration
    otel_enabled: bool = True
    otel_service_name: str = "ai-copilot"
    otel_exporter_jaeger_endpoint: str = "http://localhost:14268/api/traces"
    otel_exporter_prometheus_port: int = 8001

    # Worker Configuration
    ai_inference_worker_concurrency: int = 10
    ingestion_worker_concurrency: int = 5
    notification_worker_concurrency: int = 3

    # Document Processing Configuration
    max_upload_size_mb: int = 10
    supported_languages: str = "en,es,fr"
    default_language: str = "en"

    chunk_size: int = 1000
    chunk_overlap: int = 100

    # Embedding Configuration
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536

    # Notification Configuration
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@example.com"
    admin_notification_email: str = "admin@example.com"

    # WhatsApp Business API Configuration
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_business_account_id: str = ""
    whatsapp_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_business_name: str = "AI Support Copilot"
    whatsapp_display_phone: str = ""
    whatsapp_notification_phone: str = ""

    slack_webhook_url: str = ""
    slack_bot_token: str = ""

    # Feature Flags
    enable_multi_language: bool = True
    enable_analytics: bool = True
    enable_notifications: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def supported_languages_list(self) -> List[str]:
        """Parse supported languages into list"""
        return [lang.strip() for lang in self.supported_languages.split(",")]

    @property
    def redis_url(self) -> str:
        """Construct Redis URL"""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment.lower() == "production"


# Global settings instance
settings = Settings()
