"""FastAPI application entry point."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Agent Reliability Engine",
    description="CI for autonomous agents — adversarial testing, failure classification, reliability tracking.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket endpoint — live trace streaming (Task 3.5)
# ---------------------------------------------------------------------------

@app.websocket("/ws/traces")
async def ws_traces(websocket: WebSocket):
    """WebSocket endpoint that streams trace steps during sandbox execution.

    Connect from the dashboard at ws://localhost:8000/ws/traces.
    Receives JSON events of the form:
      {"event": "trace_step", "data": {...step dict...}}
      {"event": "run_complete", "data": {"status": "COMPLETED"}}
    """
    from app.api.websocket import manager
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; broadcasts come from execute_run endpoint
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# REST API router (includes all /api/* routes)
# ---------------------------------------------------------------------------

from app.api.routes import router as api_router  # noqa: E402
app.include_router(api_router)
