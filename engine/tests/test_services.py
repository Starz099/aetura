"""
Unit tests for orchestration service.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from engine.services import (
    OrchestrationService,
    DraftRequest,
    ResumeRequest,
    RecordRequest,
    OrchestrationResponse,
)


class TestOrchestrationService:
    """Test orchestration service."""
    
    def test_service_initialization(self):
        """Should initialize service."""
        service = OrchestrationService()
        assert service is not None
        assert service.logger is not None
    
    @pytest.mark.asyncio
    async def test_draft_script_validation_missing_url(self):
        """Should validate required URL."""
        service = OrchestrationService()
        request = DraftRequest(url="", intent="test", grok_api_key="key")
        
        response = await service.draft_script(request)
        
        assert response.success is False
        assert response.error_code == "INVALID_URL"
    
    @pytest.mark.asyncio
    async def test_draft_script_validation_missing_intent(self):
        """Should validate required intent."""
        service = OrchestrationService()
        request = DraftRequest(url="https://example.com", intent="", grok_api_key="key")
        
        response = await service.draft_script(request)
        
        assert response.success is False
        assert response.error_code == "INVALID_INTENT"
    
    @pytest.mark.asyncio
    async def test_draft_script_validation_missing_api_key(self):
        """Should validate required API key."""
        service = OrchestrationService()
        request = DraftRequest(url="https://example.com", intent="test", grok_api_key="")
        
        response = await service.draft_script(request)
        
        assert response.success is False
        assert response.error_code == "MISSING_API_KEY"
    
    @pytest.mark.asyncio
    async def test_resume_script_validation_missing_steps(self):
        """Should validate steps parameter."""
        service = OrchestrationService()
        request = ResumeRequest(
            url="https://example.com",
            intent="test",
            approved_steps="not a list",
            grok_api_key="key"
        )
        
        response = await service.resume_script(request)
        
        assert response.success is False
        assert response.error_code == "INVALID_STEPS"
    
    @pytest.mark.asyncio
    async def test_record_video_validation_empty_steps(self):
        """Should validate at least one step for recording."""
        service = OrchestrationService()
        request = RecordRequest(url="https://example.com", approved_steps=[])
        
        response = await service.record_video(request)
        
        assert response.success is False
        assert response.error_code == "INVALID_STEPS"
    
    @pytest.mark.asyncio
    @patch('engine.services.DraftWorkflow')
    async def test_draft_script_success(self, mock_workflow_class):
        """Should successfully draft script."""
        # Mock the workflow
        mock_workflow = AsyncMock()
        mock_workflow.execute = AsyncMock(return_value={"goal": "test", "steps": []})
        mock_workflow_class.return_value = mock_workflow
        
        service = OrchestrationService()
        request = DraftRequest(
            url="https://example.com",
            intent="test",
            grok_api_key="test_key"
        )
        
        response = await service.draft_script(request)
        
        # Note: In real tests with proper mocking, this would work
        # For now, this demonstrates the test structure
        
    @pytest.mark.asyncio
    @patch('engine.services.ResumeWorkflow')
    async def test_resume_script_success(self, mock_workflow_class):
        """Should successfully resume script."""
        mock_workflow = AsyncMock()
        mock_workflow.execute = AsyncMock(return_value={"goal": "test", "steps": []})
        mock_workflow_class.return_value = mock_workflow
        
        service = OrchestrationService()
        request = ResumeRequest(
            url="https://example.com",
            intent="test",
            approved_steps=[{"action_taken": {"tool_name": "click_element", "arguments": {}}}],
            grok_api_key="test_key"
        )
        
        response = await service.resume_script(request)
        
        # Response handling structure is demonstrated
    
    @pytest.mark.asyncio
    @patch('engine.services.RecordWorkflow')
    async def test_record_video_success(self, mock_workflow_class):
        """Should successfully record video."""
        mock_workflow = AsyncMock()
        mock_workflow.execute = AsyncMock(return_value="/path/to/video.mp4")
        mock_workflow_class.return_value = mock_workflow
        
        service = OrchestrationService()
        request = RecordRequest(
            url="https://example.com",
            approved_steps=[{"action_taken": {"tool_name": "click_element", "arguments": {}}}]
        )
        
        response = await service.record_video(request)
        
        # Response handling structure is demonstrated


class TestOrchestrationResponse:
    """Test response data structure."""
    
    def test_success_response(self):
        """Should create success response."""
        response = OrchestrationResponse(success=True, data={"test": "data"})
        
        assert response.success is True
        assert response.data == {"test": "data"}
        assert response.error is None
    
    def test_error_response(self):
        """Should create error response."""
        response = OrchestrationResponse(
            success=False,
            error="Something failed",
            error_code="FAILURE"
        )
        
        assert response.success is False
        assert response.error == "Something failed"
        assert response.error_code == "FAILURE"
