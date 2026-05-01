"""
Unit tests for configuration module.
"""
import os
from engine.config import (
    Config,
    WorkflowConfig,
    APIConfig,
    LoggingConfig,
    get_config,
    setup_logging,
)
from engine.workflows import _sanitize_recording_settings


class TestWorkflowConfig:
    """Test workflow configuration."""
    
    def test_default_values(self):
        """Should have reasonable defaults."""
        config = WorkflowConfig()
        
        assert config.max_draft_steps == 20
        assert config.max_resume_steps == 15
        assert config.headless is False
        assert config.viewport_width == 1920
    
    def test_custom_values(self):
        """Should accept custom values."""
        config = WorkflowConfig(max_draft_steps=30, headless=True)
        
        assert config.max_draft_steps == 30
        assert config.headless is True


class TestAPIConfig:
    """Test API configuration."""
    
    def test_default_values(self):
        """Should have reasonable defaults."""
        config = APIConfig()
        
        assert config.groq_model == "llama-3.3-70b-versatile"
        assert config.api_timeout == 30.0
        assert config.api_retry_count == 3


class TestLoggingConfig:
    """Test logging configuration."""
    
    def test_default_values(self):
        """Should have reasonable defaults."""
        config = LoggingConfig()
        
        assert config.level == "INFO"
        assert config.use_console is True
        assert config.log_file is None


class TestConfig:
    """Test configuration manager."""
    
    def setUp(self):
        """Clear environment before each test."""
        # Save original env vars
        self.original_env = {}
    
    def test_initialization(self):
        """Should initialize with defaults."""
        config = Config()
        
        assert config.workflow is not None
        assert config.api is not None
        assert config.logging is not None
    
    def test_get_workflow_config(self):
        """Should return workflow config."""
        config = Config()
        workflow = config.get_workflow_config()
        
        assert isinstance(workflow, WorkflowConfig)
    
    def test_get_api_config(self):
        """Should return API config."""
        config = Config()
        api = config.get_api_config()
        
        assert isinstance(api, APIConfig)
    
    def test_get_logging_config(self):
        """Should return logging config."""
        config = Config()
        logging_cfg = config.get_logging_config()
        
        assert isinstance(logging_cfg, LoggingConfig)
    
    def test_environment_variable_override(self):
        """Should read from environment variables."""
        os.environ["LOG_LEVEL"] = "DEBUG"
        os.environ["HEADLESS"] = "true"
        
        config = Config()
        
        assert config.logging.level == "DEBUG"
        assert config.workflow.headless is True
        
        # Cleanup
        del os.environ["LOG_LEVEL"]
        del os.environ["HEADLESS"]


class TestLoggingSetup:
    """Test logging setup function."""
    
    def test_setup_logging_with_defaults(self):
        """Should setup logging with defaults."""
        # Should not raise
        setup_logging()
    
    def test_setup_logging_with_config(self):
        """Should setup logging with custom config."""
        config = LoggingConfig(level="DEBUG")
        
        # Should not raise
        setup_logging(config)


class TestConfigGlobal:
    """Test global configuration functions."""
    
    def test_get_config_singleton(self):
        """Should return same instance."""
        config1 = get_config()
        config2 = get_config()
        
        assert config1 is config2


class TestRecordingSettingsSanitization:
    """Test recording settings normalization and bounds."""

    def test_defaults_when_settings_missing(self):
        """Should return defaults when payload is absent."""
        settings = _sanitize_recording_settings(None)

        assert settings["capture_fps"] == 30
        assert settings["viewport_width"] == 1920
        assert settings["viewport_height"] == 1080
        assert settings["record_audio"] is False
        assert settings["audio_device"] == "default"
        assert settings["audio_bitrate_kbps"] == 192
        assert settings["output_preset"] == "medium"
        assert settings["output_crf"] == 12
        assert settings["device_scale_factor"] == 3

    def test_clamps_and_filters_invalid_values(self):
        """Should clamp the allowed numeric fields and ignore invalid preset."""
        settings = _sanitize_recording_settings(
            {
                "capture_fps": 120,
                "viewport_width": 5000,
                "viewport_height": 100,
                "record_audio": True,
                "output_preset": "invalid",
            }
        )

        assert settings["capture_fps"] == 30
        assert settings["viewport_width"] == 3840
        assert settings["viewport_height"] == 360
        assert settings["record_audio"] is True
        assert settings["audio_device"] == "default"
        assert settings["audio_bitrate_kbps"] == 192
        assert settings["output_preset"] == "medium"
        assert settings["capture_frame_quality"] == 100
        assert settings["capture_every_nth_frame"] == 1
        assert settings["device_scale_factor"] == 3
        assert settings["output_crf"] == 12
        assert settings["output_profile"] == "main"
        assert settings["output_pix_fmt"] == "yuv420p"
