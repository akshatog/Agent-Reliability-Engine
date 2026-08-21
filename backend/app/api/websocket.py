"""WebSocket connection manager for live trace streaming."""
from __future__ import annotations

import json
from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts trace steps.

    A singleton instance (`manager`) is used by the FastAPI WebSocket
    endpoint and by `execute_scenario()` via its `on_step` callback,
    so every trace step streams to the browser in real time.
    """

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        """Remove a WebSocket from the active connections list."""
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, message: dict) -> None:
        """Broadcast a JSON-serialisable message to all connected clients.

        If a connection has gone away, it is silently removed.
        """
        data = json.dumps(message, default=str)
        for ws in list(self._connections):
            try:
                await ws.send_text(data)
            except Exception:
                self.disconnect(ws)

    @property
    def active_connections(self) -> int:
        """Return the count of currently open connections."""
        return len(self._connections)


# Module-level singleton used by the FastAPI WebSocket route
manager = ConnectionManager()
