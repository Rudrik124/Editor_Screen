import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger("veytrix.db")

_supabase_client: Optional[Client] = None

def get_supabase() -> Optional[Client]:
    """Returns singleton Supabase client or None if credentials are not configured."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            logger.info("Supabase client initialized successfully.")
            return _supabase_client
        except Exception as e:
            logger.warning(f"Failed to initialize Supabase client: {e}. Running in local mode.")
            return None
    return None
