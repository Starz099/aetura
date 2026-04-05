import os
from openai import AsyncOpenAI
from dotenv import load_dotenv  # Add this import

load_dotenv()


class AIEngine:
    def __init__(self):
        # Using Groq for the lightning-fast free tier
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("⚠️ GROQ_API_KEY environment variable is missing!")

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = "llama-3.3-70b-versatile"

    async def get_decision(
        self, system_prompt: str, user_prompt: str, available_tools: list
    ):
        print("🧠 Asking AI for next steps...")
        api_params = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        if available_tools:
            api_params["tools"] = available_tools
            api_params["tool_choice"] = "auto"

        response = await self.client.chat.completions.create(**api_params)
        return response.choices[0].message
