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
    log_ai_command
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
    1. Checks and deducts user credit
    2. Invokes LLM tool calling (Gemini)
    3. Validates against 25 Pydantic tool schemas
    4. Transforms to EditorCommand[]
    5. Logs to Supabase ai_command_log
    """
    user_id = req.userId or "default_user"
    
    # Check credit balance
    current_credits = get_user_credits(user_id)
    if current_credits <= 0:
        raise HTTPException(
            status_code=402,
            detail="INSUFFICIENT_CREDITS: Please upgrade to continue using Veytrix AI Assistant."
        )

    # Reserve / deduct 1 credit
    deducted = deduct_credit(user_id=user_id, amount=1, action="ai_prompt")
    if not deducted:
        raise HTTPException(
            status_code=402,
            detail="INSUFFICIENT_CREDITS: Insufficient balance to perform action."
        )

    # Execute assistant logic
    try:
        response = process_ai_assistant_request(
            req=req,
            remaining_credits=get_user_credits(user_id)
        )
    except Exception as e:
        # Refund on server failure
        refund_credit(user_id=user_id, amount=1, reason="unhandled_exception")
        logger.exception("AI assistant processing error")
        raise HTTPException(status_code=500, detail=f"AI Assistant Error: {str(e)}")

    # If the request was purely conversational (e.g. asking for python code or advice) without tool edits,
    # refund the credit so users aren't charged for chatting or asking questions!
    if response.success and len(response.commands) == 0:
        new_balance = refund_credit(user_id=user_id, amount=1, reason="conversational_turn")
        response.remaining_credits = new_balance

    # If generation produced no valid commands and had validation errors, refund
    if not response.success and response.validation_errors:
        new_balance = refund_credit(user_id=user_id, amount=1, reason="validation_error")
        response.remaining_credits = new_balance

    # Log to Supabase audit log
    cmd_dicts = [c.model_dump() for c in response.commands]
    log_ai_command(
        user_id=user_id,
        project_id=req.projectId,
        prompt=req.prompt,
        parsed_commands=cmd_dicts,
        status="success" if response.success else "failed",
        error_message="; ".join(response.validation_errors) if response.validation_errors else None
    )

    return response
