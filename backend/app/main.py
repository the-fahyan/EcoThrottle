"""GreenShift main FastAPI application."""

from typing import Any

from fastapi import FastAPI

app = FastAPI(
    title="GreenShift",
    description="Carbon-aware job scheduling proxy",
    version="0.1.0",
)


@app.get("/healthz", tags=["Health"])
async def healthz() -> dict[str, Any]:
    """Liveness probe per FR-22."""
    return {"status": "ok"}
