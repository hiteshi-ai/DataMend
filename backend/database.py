"""
Database helpers – Supabase clients and JWT authentication utilities.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from supabase import Client, create_client

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase clients
# ---------------------------------------------------------------------------

# Service-role client: full DB access, bypasses RLS. Use only server-side.
supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)

# Anon client: respects RLS, suitable for user-facing queries.
supabase_anon: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY,
)

# ---------------------------------------------------------------------------
# JWT / auth helpers
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


def _decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Decode and verify a Supabase-issued JWT.

    Supabase uses the ``JWT_SECRET`` (found in project settings → API).
    Algorithm: HS256.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        )


def _fetch_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the user profile row from the ``profiles`` table."""
    try:
        response = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()
        return response.data
    except Exception as exc:
        logger.warning("Could not fetch profile for user %s: %s", user_id, exc)
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Dict[str, Any]:
    """
    FastAPI dependency: extract & verify Bearer token → return user dict.

    Returned dict contains at least: id, email, role.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )

    payload = _decode_supabase_jwt(credentials.credentials)

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no subject",
        )

    profile = _fetch_profile(user_id)

    return {
        "id": user_id,
        "email": payload.get("email", ""),
        "role": (profile or {}).get("role", "user"),
        "profile": profile,
        "token": credentials.credentials,
    }


async def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """FastAPI dependency: same as get_current_user but enforces admin role."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
