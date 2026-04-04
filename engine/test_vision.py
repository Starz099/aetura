import base64
import httpx
import subprocess
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

# 1. Get the actual default gateway IP (The Windows Host)
wsl_host_ip = (
    subprocess.check_output("ip route list default | awk '{print $3}'", shell=True)
    .decode("utf-8")
    .strip()
)
windows_ollama_url = f"http://{wsl_host_ip}:11434"

print(f"Connecting to Windows Ollama at: {windows_ollama_url}")

# 2. Initialize model
print("Initializing model...")
llm = ChatOllama(model="llama3.2-vision", temperature=0, base_url=windows_ollama_url)

# 3. Grab the image safely
print("Downloading test image...")
image_url = "https://picsum.photos/id/237/400/300.jpg"
# We must follow redirects for this specific URL
response = httpx.get(image_url, follow_redirects=True)
response.raise_for_status()
image_data = base64.b64encode(response.content).decode("utf-8")

# 4. Format the message
# Note: Some Ollama versions prefer just the base64 string without the prefix
message = HumanMessage(
    content=[
        {"type": "text", "text": "What animal is in this image?"},
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
        },
    ]
)

# 5. Ask the model
print("Asking Llama 3.2 Vision to look at the image...")
try:
    response = llm.invoke([message])
    print("\n--- MODEL RESPONSE ---")
    print(response.content)
except Exception as e:
    print("\n--- ERROR ---")
    print(f"Details: {e}")
