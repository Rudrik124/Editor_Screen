import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("veytrix.connection_manager")

class ConnectionManager:
    """Manages active WebSocket connections grouped by job_id."""

    def __init__(self):
        self._active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self._active_connections:
            self._active_connections[job_id] = set()
        self._active_connections[job_id].add(websocket)
        logger.debug(f"Client connected to job {job_id}. Total: {len(self._active_connections[job_id])}")

    def disconnect(self, job_id: str, websocket: WebSocket):
        if job_id in self._active_connections:
            self._active_connections[job_id].discard(websocket)
            if not self._active_connections[job_id]:
                del self._active_connections[job_id]
        logger.debug(f"Client disconnected from job {job_id}")

    async def broadcast(self, job_id: str, message: dict):
        if job_id in self._active_connections:
            disconnected = []
            for connection in list(self._active_connections[job_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
            for dead in disconnected:
                self.disconnect(job_id, dead)

ws_manager = ConnectionManager()
