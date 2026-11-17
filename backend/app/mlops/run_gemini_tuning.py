import os
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings

DATASET_FILE = BACKEND_DIR / "storage" / "datasets" / "veytrix_sft_train.jsonl"
ENV_FILE = BACKEND_DIR / ".env"

def validate_api_key(api_key: str) -> bool:
    if not api_key:
        print("[ERROR] GEMINI_API_KEY is missing from your backend/.env file.")
        print("Please obtain an API key from: https://aistudio.google.com/app/apikey")
        return False
    if not api_key.startswith("AIzaSy"):
        print(f"[WARNING] Your current GEMINI_API_KEY starts with '{api_key[:6]}...'.")
        print("Standard Google Gemini API keys start with 'AIzaSy' from Google AI Studio.")
        print("If you get a 403 Forbidden error, generate a free key at: https://aistudio.google.com/app/apikey")
    return True

def convert_jsonl_to_tuning_examples(jsonl_path: Path, max_samples: int = 250):
    """Converts multi-turn SFT jsonl records to Google Generative Language examples format."""
    examples = []
    if not jsonl_path.exists():
        raise FileNotFoundError(f"Training dataset not found at {jsonl_path}. Run dataset_generator.py first.")

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if idx >= max_samples:
                break
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            messages = data.get("messages", [])

            sys_prompt = ""
            user_prompt = ""
            assistant_output = ""

            for m in messages:
                role = m.get("role")
                if role == "system":
                    sys_prompt = m.get("content", "")
                elif role == "user":
                    user_prompt = m.get("content", "")
                elif role == "assistant":
                    content = m.get("content", "")
                    tool_calls = m.get("tool_calls", [])
                    if tool_calls:
                        assistant_output = f"{content}\n[Tool Calls]: {json.dumps(tool_calls)}"
                    else:
                        assistant_output = content

            if user_prompt and assistant_output:
                combined_input = f"{sys_prompt}\n\nUser: {user_prompt}" if sys_prompt else user_prompt
                examples.append({
                    "text_input": combined_input,
                    "output": assistant_output
                })

    return examples

def submit_gemini_tuning_job():
    print("=" * 60)
    print("       Veytrix AI — Google Gemini Model Fine-Tuning Job       ")
    print("=" * 60)

    api_key = settings.GEMINI_API_KEY
    if not validate_api_key(api_key):
        return

    print(f"\n[1/4] Loading training examples from: {DATASET_FILE.name}...")
    examples = convert_jsonl_to_tuning_examples(DATASET_FILE, max_samples=200)
    print(f"      Loaded {len(examples)} verified examples covering Novice, Creator, and Film Editor tiers.")

    display_name = f"veytrix-editing-copilot-{int(time.time())}"
    base_model = "models/gemini-1.5-flash-001-tuning"

    tuning_payload = {
        "display_name": display_name,
        "base_model": base_model,
        "tuning_task": {
            "hyperparameters": {
                "batch_size": 4,
                "learning_rate": 0.001,
                "epoch_count": 5
            },
            "training_data": {
                "examples": {
                    "examples": examples
                }
            }
        }
    }

    print("\n[2/4] Submitting tuning task to Google Gemini Tuning API...")
    url = f"https://generativelanguage.googleapis.com/v1beta/tunedModels?key={api_key}"
    req_data = json.dumps(tuning_payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp_body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8", errors="ignore")
        print(f"\n[API ERROR {e.code}]: Google rejected the tuning request:")
        print(error_msg)
        print("\nTroubleshooting:")
        print("1. Ensure your GEMINI_API_KEY starts with 'AIzaSy' from https://aistudio.google.com/app/apikey")
        print("2. Ensure Generative Language API is enabled in your Google Cloud / AI Studio project.")
        return
    except Exception as e:
        print(f"\n[ERROR] Request failed: {e}")
        return

    model_id = resp_body.get("name")
    print(f"\n[3/4] Tuning job successfully created on Google Cloud!")
    print(f"      Model Resource: {model_id}")
    print(f"      Initial State: {resp_body.get('state', 'CREATING')}")

    # Polling for status
    print("\n[4/4] Monitoring training progress (this typically takes 10-15 minutes on Google Cloud)...")
    poll_url = f"https://generativelanguage.googleapis.com/v1beta/{model_id}?key={api_key}"

    start_time = time.time()
    while True:
        try:
            poll_req = urllib.request.Request(poll_url)
            with urllib.request.urlopen(poll_req, timeout=30) as poll_resp:
                status_body = json.loads(poll_resp.read().decode("utf-8"))
                state = status_body.get("state")
                elapsed = int(time.time() - start_time)

                print(f"      Elapsed: {elapsed}s | State: {state}")

                if state == "ACTIVE":
                    print("\n" + "=" * 60)
                    print("  SUCCESS! Model fine-tuning completed successfully on Google Cloud!")
                    print(f"  Tuned Model: {model_id}")
                    print("=" * 60)

                    # Update .env
                    update_env_model_name(model_id)
                    break
                elif state == "FAILED":
                    print(f"\n[ERROR] Tuning job failed on Google Cloud: {status_body}")
                    break
        except Exception as e:
            print(f"      Polling notice: {e}")

        time.sleep(20)

def update_env_model_name(new_model_name: str):
    if not ENV_FILE.exists():
        print(f"[NOTICE] .env not found at {ENV_FILE}. Add `AI_MODEL_NAME={new_model_name}` manually.")
        return

    content = ENV_FILE.read_text(encoding="utf-8")
    lines = content.splitlines()
    found = False
    new_lines = []

    for line in lines:
        if line.strip().startswith("AI_MODEL_NAME="):
            new_lines.append(f"AI_MODEL_NAME={new_model_name}")
            found = True
        else:
            new_lines.append(line)

    if not found:
        new_lines.append(f"AI_MODEL_NAME={new_model_name}")

    ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print(f"\n[SUCCESS] Updated backend/.env: AI_MODEL_NAME={new_model_name}")
    print("Veytrix AI backend is now connected to your custom-tuned Google model!")

if __name__ == "__main__":
    submit_gemini_tuning_job()
