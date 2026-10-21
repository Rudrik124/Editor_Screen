from typing import Optional
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
from app.core.config import settings

def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """
    Extracts user_id from Supabase JWT token in Authorization header.
    If Supabase auth is not configured or in development, assigns a guest user ID.
    """
    if not authorization or not authorization.startswith("Bearer "):
        # Dev / Guest fallback for unauthenticated local editing
        return "00000000-0000-0000-0000-000000000001"

    token = authorization.split(" ")[1]
    if not settings.SUPABASE_JWT_SECRET:
        # If secret not set in .env, decode unverified sub for development
        try:
            unverified_claims = jwt.get_unverified_claims(token)
            return unverified_claims.get("sub", "00000000-0000-0000-0000-000000000001")
        except Exception:
            return "00000000-0000-0000-0000-000000000001"

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject (user_id)"
            )
        return user_id
    except JWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(err)}"
        )
