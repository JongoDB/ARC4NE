from fastapi import APIRouter
from pydantic import BaseModel
import psutil
import time
from datetime import datetime

router = APIRouter()

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    uptime: float
    system: dict

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="0.2.0",
        uptime=time.time() - psutil.boot_time(),
        system={
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        }
    )
