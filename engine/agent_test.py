import os
import json
from openai import OpenAI

os.environ["GROK_API_KEY"] = "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"

client = OpenAI(
    api_key=os.getenv("GROK_API_KEY"), base_url="https://api.groq.com/openai/v1"
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "click_element",
            "description": "Clicks an element on the webpage using its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {
                        "type": "integer",
                        "description": "The ID of the element to click.",
                    }
                },
                "required": ["element_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "type_text",
            "description": "Types text into an input field using its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {
                        "type": "integer",
                        "description": "The ID of the input field.",
                    },
                    "text": {
                        "type": "string",
                        "description": "The exact text to type.",
                    },
                },
                "required": ["element_id", "text"],
            },
        },
    },
]


def test_agent_logic():
    simulated_dom = """
    Currently visible elements:
    [ID: 1, Type: Input, Placeholder: "Search for anything..."]
    [ID: 2, Type: Button, Text: "Submit Search"]
    [ID: 3, Type: Link, Text: "Login"]
    """

    user_intent = "Search for 'Open Source LLMs' and hit submit."

    print("Sending DOM and Intent to Groq...")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are a web automation agent. Use the provided tools to fulfill the user's intent based on the visible DOM.",
            },
            {
                "role": "user",
                "content": f"DOM State:\n{simulated_dom}\n\nIntent: {user_intent}",
            },
        ],
        tools=tools,
        tool_choice="auto",
    )

    response_message = response.choices[0].message
    tool_calls = response_message.tool_calls

    if tool_calls:
        print("AI Decided to use tools!")
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            print(f"-> Playwright Action Triggered: {function_name}({function_args})")
    else:
        print("AI didn't use a tool. It just said:")
        print(response_message.content)


if __name__ == "__main__":
    test_agent_logic()
