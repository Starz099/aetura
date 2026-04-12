from openai import AsyncOpenAI


class AIEngine:
    def __init__(self, api_key: str):
        if not api_key or not api_key.strip():
            raise ValueError("Grok API key is missing.")

        self.client = AsyncOpenAI(
            api_key=api_key.strip(),
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = "llama-3.3-70b-versatile"

    async def get_decision(
        self, system_prompt: str, user_prompt: str, available_tools: list
    ):
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
