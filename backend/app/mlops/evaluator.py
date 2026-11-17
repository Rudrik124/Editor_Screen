import json
import sys
from pathlib import Path
from typing import Dict, Any

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.schemas.ai_assistant import TOOL_ARG_MODELS

def evaluate_dataset_integrity(dataset_path: Path) -> Dict[str, Any]:
    total_records = 0
    valid_tool_calls = 0
    total_tool_calls = 0
    tier_counts = {}

    with open(dataset_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total_records += 1
            data = json.loads(line)
            tier = data.get("tier", "unknown")
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

            messages = data.get("messages", [])
            for msg in messages:
                if msg.get("role") == "assistant" and "tool_calls" in msg:
                    for tc in msg["tool_calls"]:
                        total_tool_calls += 1
                        fn = tc.get("function", {})
                        name = fn.get("name")
                        args = json.loads(fn.get("arguments", "{}"))

                        model_cls = TOOL_ARG_MODELS.get(name)
                        if model_cls:
                            try:
                                model_cls(**args)
                                valid_tool_calls += 1
                            except Exception:
                                pass
                        elif name in ["set_ratio", "undo_redo"]:
                            valid_tool_calls += 1

    pass_rate = (valid_tool_calls / total_tool_calls * 100) if total_tool_calls > 0 else 100.0

    metrics = {
        "dataset_file": dataset_path.name,
        "total_dialogues": total_records,
        "total_tool_calls": total_tool_calls,
        "valid_tool_calls": valid_tool_calls,
        "schema_pass_rate_pct": round(pass_rate, 2),
        "tier_distribution": tier_counts
    }
    return metrics

if __name__ == "__main__":
    val_file = BACKEND_DIR / "storage" / "datasets" / "veytrix_sft_val.jsonl"
    if val_file.exists():
        results = evaluate_dataset_integrity(val_file)
        print("MLOps Evaluation Results:")
        print(json.dumps(results, indent=2))
    else:
        print(f"Validation file not found: {val_file}")
