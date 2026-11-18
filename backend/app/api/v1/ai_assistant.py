import logging
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.ai_assistant import (
    AIAssistantPromptRequest,
    AIAssistantResponse
)
from app.engine.ai_assistant_service import process_ai_assistant_request
from app.db.credit_repository import (
    get_user_credits,
    deduct_credit,
    refund_credit,
    log_ai_command,
    update_ai_feedback
)

logger = logging.getLogger("veytrix.api.ai_assistant")

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

@router.get("/credits")
async def get_credits_endpoint(user_id: str = "default_user"):
    """
    Returns the user's available AI credits.
    """
    balance = get_user_credits(user_id)
    return {
        "user_id": user_id,
        "balance": balance,
        "tier": "free" if balance <= 50 else "pro"
    }

@router.post("/assistant", response_model=AIAssistantResponse)
async def ai_assistant_endpoint(req: AIAssistantPromptRequest):
    """
    Processes natural language prompt against timeline state manifest.
    Fair-use Credit Policy:
    1. Checks if user has credit balance > 0 (prevents abuse)
    2. Runs AI reasoning and timeline commands
    3. Calculates work done:
       - Pure conversational questions, advice, clarifications -> 0 credits charged
       - Out of scope or unhandled queries -> 0 credits charged
       - Errors or impossible boundary operations -> 0 credits charged
       - Applied video editing commands -> 1 credit per batch of actual timeline work
    4. Deducts credit ONLY if actual work was performed.
    """
    user_id = req.userId or "default_user"
    
    # 1. Pre-flight check: ensure user has at least 1 credit to initiate an AI session
    current_credits = get_user_credits(user_id)
    if current_credits <= 0:
        raise HTTPException(
            status_code=402,
            detail="INSUFFICIENT_CREDITS: Please upgrade to continue using Veytrix AI Assistant."
        )

    # 2. Execute assistant logic without upfront deduction
    try:
        response = process_ai_assistant_request(
            req=req,
            remaining_credits=current_credits
        )
    except Exception as e:
        logger.exception("AI assistant processing error")
        raise HTTPException(status_code=500, detail=f"AI Assistant Error: {str(e)}")

    # 3. Determine if actual timeline editing work was performed
    # Actual work = successful generation of 1 or more executable editor commands
    has_actual_work = response.success and len(response.commands) > 0

    if has_actual_work:
        # Deduct 1 credit for the successful batch of timeline edits
        deducted = deduct_credit(user_id=user_id, amount=1, action="ai_edit_applied")
        if deducted:
            response.credits_charged = 1
            response.remaining_credits = get_user_credits(user_id)
        else:
            # If for some reason balance was exhausted concurrently
            response.credits_charged = 0
            response.remaining_credits = current_credits
    else:
        # Zero work done (just chatting, answering questions, or invalid prompt) -> 0 credits charged!
        response.credits_charged = 0
        response.remaining_credits = current_credits

    # 4. Log to Supabase audit log with RLHF metadata and user tier
    cmd_dicts = [c.model_dump() for c in response.commands]
    log_id = log_ai_command(
        user_id=user_id,
        project_id=req.projectId,
        prompt=req.prompt,
        parsed_commands=cmd_dicts,
        status="success" if response.success else "failed",
        error_message="; ".join(response.validation_errors) if response.validation_errors else None,
        user_tier=getattr(response, "userTier", "beginner"),
        model_used=response.model_used
    )

    return response

@router.post("/feedback")
async def ai_feedback_endpoint(payload: dict):
    """
    Records user feedback ('accepted', 'rejected', 'modified', 'undone')
    for DPO/RLHF preference optimization.
    """
    log_id = payload.get("log_id")
    feedback = payload.get("feedback")
    if not log_id or not feedback:
        raise HTTPException(status_code=400, detail="log_id and feedback are required.")
    
    success = update_ai_feedback(
        log_id=log_id,
        feedback=feedback,
        modified_commands=payload.get("modified_commands"),
        undo_count=payload.get("undo_count", 0)
    )
    return {"status": "recorded" if success else "saved_locally"}
