from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("Fetching available models...")
try:
    # Use pagination to list models
    for model in client.models.list():
        # Only print gemini models to keep output clean
        if "gemini" in model.name:
            print(f"- {model.name}")
    print("\nAPI Key is VALID! 🚀")
except Exception as e:
    print(f"\nAPI Key check failed: {e}")
