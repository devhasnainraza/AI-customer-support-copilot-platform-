"""
Language Detection Service
T042: Automatic language detection for conversations
"""
from typing import Optional, Tuple
import logging
from langdetect import detect, detect_langs, LangDetectException

logger = logging.getLogger(__name__)


class LanguageDetectionService:
    """Service for detecting language from text"""

    # Supported languages mapping (ISO 639-1)
    SUPPORTED_LANGUAGES = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French'
    }

    # Minimum confidence threshold for auto-detection
    MIN_CONFIDENCE = 0.8

    @staticmethod
    def detect_language(text: str, fallback: str = 'en') -> Tuple[str, float]:
        """
        Detect language from text

        Args:
            text: Text to analyze
            fallback: Fallback language code if detection fails

        Returns:
            Tuple of (language_code, confidence)
        """
        if not text or len(text.strip()) < 10:
            logger.warning("Text too short for reliable language detection")
            return fallback, 0.0

        try:
            # Get language probabilities
            langs = detect_langs(text)

            if not langs:
                return fallback, 0.0

            # Get highest probability language
            detected_lang = langs[0].lang
            confidence = langs[0].prob

            # Check if detected language is supported
            if detected_lang not in LanguageDetectionService.SUPPORTED_LANGUAGES:
                logger.info(
                    f"Detected unsupported language: {detected_lang} "
                    f"(confidence={confidence:.2f}), using fallback"
                )
                return fallback, 0.0

            logger.info(
                f"Language detected: {detected_lang} "
                f"({LanguageDetectionService.SUPPORTED_LANGUAGES[detected_lang]}) "
                f"confidence={confidence:.2f}"
            )

            return detected_lang, confidence

        except LangDetectException as e:
            logger.error(f"Language detection failed: {e}")
            return fallback, 0.0
        except Exception as e:
            logger.error(f"Unexpected error in language detection: {e}")
            return fallback, 0.0

    @staticmethod
    def should_ask_user(confidence: float) -> bool:
        """
        Determine if we should ask user to confirm language

        Args:
            confidence: Detection confidence score

        Returns:
            True if confidence is below threshold
        """
        return confidence < LanguageDetectionService.MIN_CONFIDENCE

    @staticmethod
    def get_supported_languages() -> dict:
        """Get dictionary of supported languages"""
        return LanguageDetectionService.SUPPORTED_LANGUAGES.copy()

    @staticmethod
    def is_language_supported(language_code: str) -> bool:
        """Check if language code is supported"""
        return language_code in LanguageDetectionService.SUPPORTED_LANGUAGES
