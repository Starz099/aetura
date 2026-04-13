"""
Base prompts and prompt templates for workflows.
"""


class WorkflowPrompts:
    """Centralized prompt templates for all workflows."""
    
    # Shared system prompt foundation used by all workflows
    BASE_SYSTEM_PROMPT = """You are an expert web automation AI. Your task is to help users accomplish tasks on websites.

You have access to tools to interact with the web. Always be methodical, careful, and thoughtful about your interactions.

When using tools:
1. First, understand what you need to do
2. Extract information from the page if needed
3. Navigate and interact step by step
4. Verify results after each action
5. When the task is complete, use the finish_task tool

Be efficient but thorough. If something doesn't work, try a different approach.

Tool call rules:
1. Call exactly one tool at a time.
2. Use the exact tool name only; never include arguments in the function name.
3. Send only valid JSON arguments that match the selected tool schema.
4. If no tool is appropriate, respond without calling a tool.
5. Use only the compact page state provided in the prompt. Do not restate the whole page.
6. Prefer the simplest possible next action and avoid speculative actions.
"""
    
    @staticmethod
    def get_draft_prompt(goal: str) -> tuple[str, str]:
        """
        Get system and user prompts for the draft workflow.
        
        Args:
            goal: The user's goal/task
            
        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        system = WorkflowPrompts.BASE_SYSTEM_PROMPT
        user = f"""Please help me accomplish this task: {goal}

Start by carefully examining the current page and available elements. Then take the necessary steps to complete the task.
When you've successfully completed it, use the finish_task tool to declare victory."""
        
        return system, user
    
    @staticmethod
    def get_resume_prompt(goal: str, previous_summary: str) -> tuple[str, str]:
        """
        Get system and user prompts for the resume workflow.
        
        Args:
            goal: The user's goal/task
            previous_summary: Summary of what was done previously
            
        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        system = WorkflowPrompts.BASE_SYSTEM_PROMPT
        user = f"""Resume this task: {goal}

Previously done: {previous_summary}

Continue from where we left off. First, verify the current state of the page, then continue with the remaining steps to complete the task.
When complete, use the finish_task tool."""
        
        return system, user
    
    @staticmethod
    def get_record_prompt(goal: str, steps_count: int) -> tuple[str, str]:
        """
        Get system and user prompts for the record workflow.
        
        Args:
            goal: The user's goal/task
            steps_count: Number of steps to record
            
        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        system = WorkflowPrompts.BASE_SYSTEM_PROMPT
        user = f"""Record a demo script for this task: {goal}

Please perform the task step by step (aiming for around {steps_count} clear steps). This will be recorded as a demonstration video.

Make each action clear and deliberate. When complete, use the finish_task tool."""
        
        return system, user
