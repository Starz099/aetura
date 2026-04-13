"""
Orchestration service layer - provides clean API for workflow execution.
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging

from workflows import DraftWorkflow, ResumeWorkflow, RecordWorkflow
from models.script import DemoScript, ToolResult, ToolResultStatus


logger = logging.getLogger(__name__)


@dataclass
class DraftRequest:
    """Request to draft a new automation script."""
    url: str
    intent: str
    grok_api_key: str


@dataclass
class ResumeRequest:
    """Request to resume an automation script."""
    url: str
    intent: str
    approved_steps: List[Dict[str, Any]]
    grok_api_key: str


@dataclass
class RecordRequest:
    """Request to record a demo video."""
    url: str
    approved_steps: List[Dict[str, Any]]


@dataclass
class OrchestrationResponse:
    """Response from orchestration service."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class OrchestrationService:
    """Service for orchestrating automation workflows."""
    
    def __init__(self):
        """Initialize orchestration service."""
        self.logger = logger
    
    async def draft_script(self, request: DraftRequest) -> OrchestrationResponse:
        """
        Draft a new automation script.
        
        Args:
            request: DraftRequest with URL, intent, and API key
            
        Returns:
            OrchestrationResponse with DemoScript or error
        """
        try:
            # Validate request
            if not request.url or not request.url.strip():
                return OrchestrationResponse(
                    success=False,
                    error="URL is required",
                    error_code="INVALID_URL"
                )
            
            if not request.intent or not request.intent.strip():
                return OrchestrationResponse(
                    success=False,
                    error="Intent is required",
                    error_code="INVALID_INTENT"
                )
            
            if not request.grok_api_key:
                return OrchestrationResponse(
                    success=False,
                    error="API key is required",
                    error_code="MISSING_API_KEY"
                )
            
            self.logger.info(f"Drafting script for {request.url}: {request.intent}")
            
            # Execute workflow
            workflow = DraftWorkflow()
            result = await workflow.execute(
                url=request.url,
                intent=request.intent,
                grok_api_key=request.grok_api_key
            )
            
            self.logger.info(f"Draft completed with {len(result.get('steps', []))} steps")
            
            return OrchestrationResponse(
                success=True,
                data=result
            )
        
        except ValueError as e:
            self.logger.error(f"Validation error: {str(e)}")
            return OrchestrationResponse(
                success=False,
                error=str(e),
                error_code="VALIDATION_ERROR"
            )
        
        except Exception as e:
            self.logger.error(f"Workflow error: {str(e)}", exc_info=True)
            return OrchestrationResponse(
                success=False,
                error=f"Workflow execution failed: {str(e)}",
                error_code="EXECUTION_ERROR"
            )
    
    async def resume_script(self, request: ResumeRequest) -> OrchestrationResponse:
        """
        Resume an automation script from approved steps.
        
        Args:
            request: ResumeRequest with URL, intent, steps, and API key
            
        Returns:
            OrchestrationResponse with DemoScript or error
        """
        try:
            # Validate request
            if not request.url:
                return OrchestrationResponse(
                    success=False,
                    error="URL is required",
                    error_code="INVALID_URL"
                )
            
            if not request.intent:
                return OrchestrationResponse(
                    success=False,
                    error="Intent is required",
                    error_code="INVALID_INTENT"
                )
            
            if not isinstance(request.approved_steps, list):
                return OrchestrationResponse(
                    success=False,
                    error="Approved steps must be a list",
                    error_code="INVALID_STEPS"
                )
            
            if not request.grok_api_key:
                return OrchestrationResponse(
                    success=False,
                    error="API key is required",
                    error_code="MISSING_API_KEY"
                )
            
            self.logger.info(f"Resuming script: {len(request.approved_steps)} approved steps")
            
            # Execute workflow
            workflow = ResumeWorkflow()
            result = await workflow.execute(
                url=request.url,
                intent=request.intent,
                approved_steps=request.approved_steps,
                grok_api_key=request.grok_api_key
            )
            
            self.logger.info(f"Resume completed with {len(result.get('steps', []))} total steps")
            
            return OrchestrationResponse(
                success=True,
                data=result
            )
        
        except ValueError as e:
            self.logger.error(f"Validation error: {str(e)}")
            return OrchestrationResponse(
                success=False,
                error=str(e),
                error_code="VALIDATION_ERROR"
            )
        
        except Exception as e:
            self.logger.error(f"Workflow error: {str(e)}", exc_info=True)
            return OrchestrationResponse(
                success=False,
                error=f"Workflow execution failed: {str(e)}",
                error_code="EXECUTION_ERROR"
            )
    
    async def record_video(self, request: RecordRequest) -> OrchestrationResponse:
        """
        Record a demo video from automation steps.
        
        Args:
            request: RecordRequest with URL and steps
            
        Returns:
            OrchestrationResponse with video path or error
        """
        try:
            # Validate request
            if not request.url:
                return OrchestrationResponse(
                    success=False,
                    error="URL is required",
                    error_code="INVALID_URL"
                )
            
            if not isinstance(request.approved_steps, list) or len(request.approved_steps) == 0:
                return OrchestrationResponse(
                    success=False,
                    error="At least one step is required for recording",
                    error_code="INVALID_STEPS"
                )
            
            self.logger.info(f"Recording video with {len(request.approved_steps)} steps")
            
            # Execute workflow
            workflow = RecordWorkflow()
            video_path = await workflow.execute(
                url=request.url,
                approved_steps=request.approved_steps
            )
            
            self.logger.info(f"Video recorded successfully: {video_path}")
            
            return OrchestrationResponse(
                success=True,
                data={"video_path": video_path}
            )
        
        except ValueError as e:
            self.logger.error(f"Validation error: {str(e)}")
            return OrchestrationResponse(
                success=False,
                error=str(e),
                error_code="VALIDATION_ERROR"
            )
        
        except Exception as e:
            self.logger.error(f"Recording error: {str(e)}", exc_info=True)
            return OrchestrationResponse(
                success=False,
                error=f"Video recording failed: {str(e)}",
                error_code="EXECUTION_ERROR"
            )
