from typing import Any, Dict, Optional
from workflows import DraftWorkflow, ResumeWorkflow, RecordWorkflow


async def draft_demo_script(url: str, intent: str, grok_api_key: str) -> dict:
    """
    Draft a new automation script from scratch.
    
    Args:
        url: Starting URL
        intent: User's goal/task
        grok_api_key: Groq API key
        
    Returns:
        Structured DemoScript as dictionary
    """
    workflow = DraftWorkflow()
    return await workflow.execute(url, intent, grok_api_key)


async def resume_demo_script(
    url: str,
    intent: str,
    approved_steps: list,
    grok_api_key: str,
) -> dict:
    """
    Resume an automation script from approved steps.
    
    Args:
        url: Starting URL
        intent: User's goal/task
        approved_steps: Previously approved steps to replay
        grok_api_key: Groq API key
        
    Returns:
        Structured DemoScript as dictionary
    """
    workflow = ResumeWorkflow()
    return await workflow.execute(url, intent, approved_steps, grok_api_key)


async def record_demo_video(
    url: str,
    approved_steps: list,
    recording_settings: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Record a demo video of automation steps.
    
    Args:
        url: Starting URL
        approved_steps: Steps to record
        recording_settings: Optional recording quality configuration
        
    Returns:
        Path to recorded video file
    """
    workflow = RecordWorkflow()
    return await workflow.execute(url, approved_steps, recording_settings)

