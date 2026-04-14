"""
Configuration and settings for the engine.
"""
import os
import logging
from dataclasses import dataclass
from typing import Optional


@dataclass
class WorkflowConfig:
    """Configuration for workflow execution."""
    # Step limits
    max_draft_steps: int = 20
    max_resume_steps: int = 15
    
    # Timeouts (in seconds)
    step_timeout: float = 60.0
    network_idle_timeout: float = 10.0
    
    # Page interaction delays
    post_action_delay: float = 1.0
    enter_key_delay: float = 2.0
    hover_delay: float = 1.5
    
    # Browser settings
    headless: bool = False
    viewport_width: int = 1920
    viewport_height: int = 1080
    device_scale_factor: int = 3
    
    # Recording settings
    frame_quality: int = 100
    frame_rate: int = 60
    video_crf: int = 4  # Quality (0=lossless, 51=worst)


@dataclass
class APIConfig:
    """Configuration for API and external services."""
    # Groq/OpenAI settings
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    
    # Timeout settings
    api_timeout: float = 30.0
    api_retry_count: int = 3


@dataclass
class LoggingConfig:
    """Configuration for logging."""
    level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    log_file: Optional[str] = None
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    use_console: bool = True


class Config:
    """Central configuration manager."""
    
    def __init__(self):
        """Initialize configuration from environment variables."""
        self.workflow = WorkflowConfig(
            headless=os.getenv("HEADLESS", "false").lower() == "true",
            max_draft_steps=int(os.getenv("MAX_DRAFT_STEPS", "20")),
            max_resume_steps=int(os.getenv("MAX_RESUME_STEPS", "15")),
        )
        
        self.api = APIConfig(
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            groq_model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            api_timeout=float(os.getenv("API_TIMEOUT", "30.0")),
        )
        
        self.logging = LoggingConfig(
            level=os.getenv("LOG_LEVEL", "INFO"),
            log_file=os.getenv("LOG_FILE"),
            use_console=os.getenv("LOG_CONSOLE", "true").lower() == "true",
        )
    
    def get_workflow_config(self) -> WorkflowConfig:
        """Get workflow configuration."""
        return self.workflow
    
    def get_api_config(self) -> APIConfig:
        """Get API configuration."""
        return self.api
    
    def get_logging_config(self) -> LoggingConfig:
        """Get logging configuration."""
        return self.logging


def setup_logging(config: LoggingConfig = None) -> None:
    """
    Setup structured logging for the engine.
    
    Args:
        config: LoggingConfig instance, uses defaults if None
    """
    if config is None:
        config = LoggingConfig()
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.level))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create formatter
    formatter = logging.Formatter(config.log_format)
    
    # Console handler
    if config.use_console:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    # File handler (if configured)
    if config.log_file:
        file_handler = logging.FileHandler(config.log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)


# Global configuration instance
_config = None


def get_config() -> Config:
    """Get or create global configuration instance."""
    global _config
    if _config is None:
        _config = Config()
        setup_logging(_config.get_logging_config())
    return _config
