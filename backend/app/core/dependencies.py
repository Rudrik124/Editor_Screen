from typing import Optional
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
from app.core.config import settings
from app.db.client import get_supabase

DEV_GUEST_USER_ID = "00000000-0000-0000-0000-000000000001"

def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """
    Extracts user_id from Supabase JWT token in Authorization header.
    If Supabase auth is not configured or in development, assigns a guest user ID.
    """
    local_development = settings.ENVIRONMENT == "development"
    if not authorization or not authorization.startswith("Bearer "):
        if not local_development:
            raise HTTPException(status_code=401, detail="Authentication required")
        # Dev / Guest fallback for unauthenticated local editing
        return DEV_GUEST_USER_ID

    token = authorization.split(" ")[1]
    jwt_secret = settings.effective_jwt_secret
    if settings.WATERMARK_SUBSCRIPTIONS_ENABLED:
        try:
            algorithm = jwt.get_unverified_header(token).get("alg")
        except JWTError as error:
            raise HTTPException(401, "Invalid authentication token") from error
        if not jwt_secret or algorithm != "HS256":
            client = get_supabase()
            if client is None:
                raise HTTPException(503, "Authentication is not configured")
            try:
                user = client.auth.get_user(token).user
            except Exception as error:
                if getattr(error, "status", None) in (400, 401, 403):
                    raise HTTPException(401, "Invalid authentication token") from error
                raise HTTPException(503, "Authentication verification is unavailable") from error
            if not user:
                raise HTTPException(401, "Invalid authentication token")
            return str(user.id)

    if not jwt_secret:
        if not local_development:
            raise HTTPException(status_code=503, detail="Authentication is not configured")
        # If secret not set in .env, decode unverified sub for development
        try:
            unverified_claims = jwt.get_unverified_claims(token)
            return unverified_claims.get("sub", DEV_GUEST_USER_ID)
        except Exception:
            return DEV_GUEST_USER_ID

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
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
