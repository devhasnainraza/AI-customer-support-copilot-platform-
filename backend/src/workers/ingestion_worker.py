"""
Ingestion Worker - Kafka Consumer for Ingestion Events
T084-T090: Processes document uploads, parses formats, chunks, generates embeddings, and saves to pgvector
"""
import io
import json
import logging
import asyncio
from uuid import UUID
from typing import List

import httpx
from kafka import KafkaConsumer
from kafka.errors import KafkaError

from src.config.settings import settings
from src.config.supabase import get_service_client
from src.models.document import ProcessingStatus, DocumentUpdate, FileType
from src.models.chunk import ChunkCreate
from src.services.knowledge_service import KnowledgeService
from src.services.kafka_producer import send_kafka_event
from src.utils.chunking import chunk_text
from src.utils.embeddings import generate_embeddings_batch

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def parse_pdf(file_bytes: bytes) -> str:
    """Parse text from PDF bytes"""
    from PyPDF2 import PdfReader
    
    reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def parse_docx(file_bytes: bytes) -> str:
    """Parse text from DOCX bytes"""
    import docx
    
    doc = docx.Document(io.BytesIO(file_bytes))
    text = ""
    for paragraph in doc.paragraphs:
        if paragraph.text:
            text += paragraph.text + "\n"
    return text


def parse_html(file_bytes: bytes) -> str:
    """Parse clean text from HTML bytes"""
    from bs4 import BeautifulSoup
    
    soup = BeautifulSoup(file_bytes, "html.parser")
    # Remove script and style blocks
    for element in soup(["script", "style"]):
        element.extract()
    return soup.get_text(separator="\n")


def parse_txt(file_bytes: bytes) -> str:
    """Parse text from TXT or Markdown bytes"""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")


class IngestionWorker:
    """
    Worker that consumes ingestion-events and processes files
    """

    def __init__(self):
        self.consumer = None
        self.running = False

    def create_consumer(self):
        """Create Kafka consumer"""
        try:
            self.consumer = KafkaConsumer(
                'ingestion-events',
                bootstrap_servers=settings.kafka_bootstrap_servers.split(','),
                group_id=f"{settings.kafka_consumer_group_id}-ingestion",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                max_poll_records=settings.ingestion_worker_concurrency
            )
            logger.info(f"Kafka Ingestion Consumer connected to {settings.kafka_bootstrap_servers}")
            return True
        except KafkaError as e:
            logger.error(f"Failed to create Kafka consumer: {e}")
            return False

    async def process_document_event(self, event: dict):
        """
        Process a single document upload event
        """
        payload = event.get('payload', {})
        document_id = payload.get('document_id')
        tenant_id = payload.get('tenant_id')
        filename = payload.get('filename')
        file_type_str = payload.get('file_type')
        language = payload.get('language', 'en')
        storage_path = payload.get('storage_path')

        logger.info(f"Processing ingestion event: document={document_id}, name={filename}")

        if not document_id or not tenant_id or not storage_path:
            logger.error(f"Missing required metadata in ingestion payload: {payload}")
            return

        doc_uuid = UUID(document_id)
        tenant_uuid = UUID(tenant_id)

        try:
            # 1. Update status to 'processing'
            await KnowledgeService.update_document(
                doc_uuid,
                DocumentUpdate(processing_status=ProcessingStatus.PROCESSING)
            )

            # 2. Download file from Supabase Storage
            supabase = get_service_client()
            bucket_name = "knowledge-base"
            
            try:
                file_bytes = supabase.storage.from_(bucket_name).download(storage_path)
            except Exception as e:
                logger.error(f"Failed to download file from Supabase storage: {e}")
                raise Exception(f"Failed to download file from storage path: {storage_path}")

            # 3. Parse content based on file type
            file_type = FileType(file_type_str)
            text = ""
            
            if file_type == FileType.PDF:
                text = parse_pdf(file_bytes)
            elif file_type == FileType.DOCX:
                text = parse_docx(file_bytes)
            elif file_type == FileType.HTML:
                text = parse_html(file_bytes)
            elif file_type in (FileType.TXT, FileType.MARKDOWN):
                text = parse_txt(file_bytes)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")

            if not text or not text.strip():
                raise ValueError("Parsed document content is empty or contains no readable text")

            # 4. Chunk text
            raw_chunks = chunk_text(text, metadata={"filename": filename})
            if not raw_chunks:
                raise ValueError("Document contains no valid paragraphs or text to chunk")

            # 5. Generate embeddings (batched) and create chunks
            contents = [chunk_data["content"] for chunk_data in raw_chunks]
            embeddings = await generate_embeddings_batch(contents)

            if len(embeddings) != len(raw_chunks):
                raise Exception(
                    f"Embedding count mismatch: got {len(embeddings)} for {len(raw_chunks)} chunks"
                )

            chunks_to_create = []
            for chunk_data, embedding in zip(raw_chunks, embeddings):
                if not embedding:
                    raise Exception("Failed to generate embedding vector for chunk")

                chunks_to_create.append(
                    ChunkCreate(
                        document_id=doc_uuid,
                        tenant_id=tenant_uuid,
                        content=chunk_data["content"],
                        embedding=embedding,
                        language=language,
                        position=chunk_data["position"],
                        char_start=chunk_data["char_start"],
                        char_end=chunk_data["char_end"],
                        token_count=chunk_data["token_count"],
                        metadata={"source_title": filename}
                    )
                )

            # 6. Save chunks in batch
            await KnowledgeService.create_chunks_batch(chunks_to_create)

            # 7. Update status to 'completed'
            await KnowledgeService.update_document(
                doc_uuid,
                DocumentUpdate(
                    processing_status=ProcessingStatus.COMPLETED,
                    version=1,
                    metadata={"chunk_count": len(chunks_to_create), "storage_path": storage_path}
                )
            )

            logger.info(f"Ingestion completed successfully for document {document_id}. Chunks={len(chunks_to_create)}")

            # 8. Emit completed event
            send_kafka_event(
                topic='ingestion-events',
                event_type='document.processing_completed',
                payload={
                    'document_id': document_id,
                    'tenant_id': tenant_id,
                    'chunk_count': len(chunks_to_create)
                },
                tenant_id=tenant_id,
                correlation_id=event.get('correlation_id')
            )

        except Exception as e:
            logger.error(f"Failed to ingest document {document_id}: {e}", exc_info=True)
            
            # Update status to 'failed' and save error
            try:
                await KnowledgeService.update_document(
                    doc_uuid,
                    DocumentUpdate(
                        processing_status=ProcessingStatus.FAILED,
                        processing_error=str(e)
                    )
                )
            except Exception as update_err:
                logger.error(f"Failed to update document failure status: {update_err}")

            # Emit failure event
            try:
                send_kafka_event(
                    topic='ingestion-events',
                    event_type='document.processing_failed',
                    payload={
                        'document_id': document_id,
                        'tenant_id': tenant_id,
                        'error': str(e)
                    },
                    tenant_id=tenant_id,
                    correlation_id=event.get('correlation_id')
                )
            except Exception as kafka_err:
                logger.error(f"Failed to emit ingestion failure event: {kafka_err}")

    async def run(self):
        """Main worker loop"""
        logger.info("Ingestion Worker starting...")

        if not self.create_consumer():
            logger.error("Failed to initialize consumer, exiting")
            return

        self.running = True
        logger.info(
            f"Ingestion Worker ready - consuming from 'ingestion-events' topic "
            f"(concurrency: {settings.ingestion_worker_concurrency})"
        )

        try:
            while self.running:
                # Poll for messages off the event loop (consumer.poll blocks)
                messages = await asyncio.to_thread(self.consumer.poll, timeout_ms=1000)

                if not messages:
                    continue

                tasks = []
                for topic_partition, records in messages.items():
                    for record in records:
                        event = record.value

                        if event.get('event_type') == 'document.uploaded':
                            task = asyncio.create_task(
                                self.process_document_event(event)
                            )
                            tasks.append(task)

                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)

        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
        finally:
            self.stop()

    def stop(self):
        """Stop the worker"""
        self.running = False
        if self.consumer:
            self.consumer.close()
            logger.info("Ingestion Worker stopped")


async def main():
    """Entry point"""
    worker = IngestionWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
