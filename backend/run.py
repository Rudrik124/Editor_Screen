import asyncio

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    if hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    print(f"Starting {settings.PROJECT_NAME} on http://127.0.0.1:8000")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False
    )
