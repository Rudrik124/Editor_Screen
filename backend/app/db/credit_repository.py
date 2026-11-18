import logging
import uuid
from typing import Optional, Dict, Any
from app.db.client import get_supabase as get_supabase_client

logger = logging.getLogger("veytrix.credit_repo")

# In-memory fallback balance store for local dev when Supabase tables are offline
_DEV_CREDIT_CACHE: Dict[str, int] = {}

def get_user_credits(user_id: str) -> int:
    """
    Fetches the user's current credit balance.
    Falls back to 50 welcome credits for developer/guest mode.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("user_credits").select("balance").eq("user_id", user_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return int(res.data[0]["balance"])
        except Exception as e:
            logger.debug(f"Supabase user_credits query skipped (using dev cache): {e}")

    return _DEV_CREDIT_CACHE.get(user_id, 50)

def deduct_credit(user_id: str, amount: int = 1, action: str = "ai_prompt", ref_id: Optional[str] = None) -> bool:
    """
    Deducts credit atomically via Supabase RPC or dev cache.
    Returns True if deduction succeeded, False if insufficient credits.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            rpc_res = supabase.rpc("deduct_ai_credit", {
                "p_user_id": user_id,
                "p_amount": amount,
                "p_action": action,
                "p_ref_id": ref_id
            }).execute()
            if rpc_res.data and len(rpc_res.data) > 0:
                return bool(rpc_res.data[0].get("success", False))
        except Exception as e:
            logger.debug(f"Supabase deduct_ai_credit RPC fallback to cache: {e}")

    # Fallback to dev cache
    current = _DEV_CREDIT_CACHE.get(user_id, 50)
    if current < amount:
        return False
    _DEV_CREDIT_CACHE[user_id] = current - amount
    return True

def refund_credit(user_id: str, amount: int = 1, reason: str = "execution_error") -> int:
    """
    Refunds credit on execution or validation failures.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            rpc_res = supabase.rpc("refund_ai_credit", {
                "p_user_id": user_id,
                "p_amount": amount,
                "p_reason": reason
            }).execute()
            if rpc_res.data:
                return int(rpc_res.data)
        except Exception as e:
            logger.debug(f"Supabase refund_ai_credit RPC fallback to cache: {e}")

    current = _DEV_CREDIT_CACHE.get(user_id, 50)
    _DEV_CREDIT_CACHE[user_id] = current + amount
    return _DEV_CREDIT_CACHE[user_id]

def log_ai_command(
    user_id: str,
    project_id: Optional[str],
    prompt: str,
    parsed_commands: Any,
    status: str = "success",
    error_message: Optional[str] = None,
    user_tier: Optional[str] = None,
    latency_ms: Optional[int] = None,
    model_used: Optional[str] = None
) -> Optional[str]:
    """
    Logs the AI interaction to public.ai_command_log with RLHF and user tier metrics.
    """
    supabase = get_supabase_client()
    if not supabase:
        return None

    try:
        data = {
            "user_id": user_id,
            "project_id": project_id or str(uuid.uuid4()),
            "prompt": prompt,
            "parsed_commands": parsed_commands,
            "status": status,
            "error_message": error_message,
            "user_tier": user_tier or "beginner",
            "response_latency_ms": latency_ms,
            "model_used": model_used
        }
        res = supabase.table("ai_command_log").insert(data).execute()
        if res.data and len(res.data) > 0:
            return str(res.data[0].get("id"))
    except Exception as e:
        logger.debug(f"ai_command_log insert skipped: {e}")
    return None

def update_ai_feedback(
    log_id: str,
    feedback: str,
    modified_commands: Optional[Any] = None,
    undo_count: int = 0
) -> bool:
    """
    Updates public.ai_command_log with user feedback ('accepted', 'rejected', 'modified', 'undone')
    for DPO / preference dataset generation.
    """
    supabase = get_supabase_client()
    if not supabase or not log_id:
        return False

    try:
        data: Dict[str, Any] = {
            "user_feedback": feedback,
            "undo_count": undo_count
        }
        if modified_commands is not None:
            data["modified_commands"] = modified_commands
        supabase.table("ai_command_log").update(data).eq("id", log_id).execute()
        return True
    except Exception as e:
        logger.debug(f"update_ai_feedback failed: {e}")
        return False
