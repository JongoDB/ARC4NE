import hashlib
import hmac
from fastapi import HTTPException, Header, Request, status
from typing import Optional
from uuid import UUID
from .db import get_agent_psk_from_db, DB_AGENT_PSKS # Simplified DB access

async def verify_agent_signature(
    request: Request,
    x_agent_id: Optional[str] = Header(None),
    x_signature: Optional[str] = Header(None)
):
    if not x_agent_id or not x_signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing agent ID or signature headers"
        )

    try:
        agent_id_uuid = UUID(x_agent_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Agent ID format"
        )

    actual_psk = get_agent_psk_from_db(agent_id_uuid)
    if not actual_psk:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Agent not found or PSK not available"
        )

    body = await request.body()
    expected_signature = hmac.new(
        actual_psk.encode('utf-8'), # Key must be bytes
        body, # Message must be bytes
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, x_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature"
        )
    return agent_id_uuid # Return validated agent_id
