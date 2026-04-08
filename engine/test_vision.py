import base64
import httpx
import subprocess
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

wsl_host_ip = (
    subprocess.check_output("ip route list default | awk '{print $3}'", shell=True)
    .decode("utf-8")
    .strip()
)
windows_ollama_url = f"http://{wsl_host_ip}:11434"

print(f"Connecting to Windows Ollama at: {windows_ollama_url}")

llm = ChatOllama(model="llama3.2-vision", temperature=0, base_url=windows_ollama_url)

print("Downloading test image...")
image_url = "https://picsum.photos/id/237/400/300.jpg"
response = httpx.get(image_url, follow_redirects=True)
response.raise_for_status()
image_data = base64.b64encode(response.content).decode("utf-8")

message = HumanMessage(
    content=[
        {"type": "text", "text": "What animal is in this image?"},
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
        },
    ]
)

print("Asking Llama 3.2 Vision to look at the image...")
try:
    response = llm.invoke([message])
    print("\n--- MODEL RESPONSE ---")
    print(response.content)
except Exception as e:
    print("\n--- ERROR ---")
    print(f"Details: {e}")
