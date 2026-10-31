"""
Authentication router.
Handles user registration, login, profile management, token refresh,
password management, account deletion, and admin-specific auth.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from config import settings
from database import get_current_user, require_admin, supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Password hashing (used for admin accounts only)
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> Dict[str, Any]:
    """Register a new user account."""
    try:
        auth_response = supabase_admin.auth.sign_up({
            "email": body.email,
            "password": body.password,
        })
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user = auth_response.user
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")

    # Create profile row
    profile_data: Dict[str, Any] = {
        "id": user.id,
        "email": body.email,
        "display_name": body.display_name or body.email.split("@")[0],
        "role": "user",
    }
    try:
        supabase_admin.table("profiles").insert(profile_data).execute()
    except Exception as exc:
        logger.warning("Could not create profile for %s: %s", user.id, exc)

    return {
        "user_id": user.id,
        "email": body.email,
        "message": "Registration successful. Please check your email to confirm your account.",
    }


@router.post("/login")
async def login(body: LoginRequest) -> Dict[str, Any]:
    """Authenticate with email and password."""
    try:
        auth_response = supabase_admin.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    session = auth_response.session
    user = auth_response.user
    if not session or not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed")

    # Fetch profile
    try:
        profile_resp = supabase_admin.table("profiles").select("*").eq("id", user.id).single().execute()
        profile = profile_resp.data or {}
    except Exception:
        profile = {}

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "token_type": "bearer",
        "expires_in": session.expires_in,
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": profile.get("display_name"),
            "role": profile.get("role", "user"),
            "language": profile.get("language", "en"),
            "theme": profile.get("theme", "light"),
        },
    }


@router.post("/logout")
async def logout(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Invalidate the current session."""
    try:
        supabase_admin.auth.sign_out()
    except Exception:
        pass
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Return current user profile."""
    profile = current_user.get("profile") or {}
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "display_name": profile.get("display_name"),
        "role": current_user.get("role", "user"),
        "language": profile.get("language", "en"),
        "theme": profile.get("theme", "light"),
        "created_at": profile.get("created_at"),
    }


@router.put("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Update display_name, language or theme."""
    updates: Dict[str, Any] = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.language is not None:
        updates["language"] = body.language
    if body.theme is not None:
        updates["theme"] = body.theme

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    try:
        resp = (
            supabase_admin.table("profiles")
            .update(updates)
            .eq("id", current_user["id"])
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {"message": "Profile updated", "profile": resp.data}


@router.post("/refresh")
async def refresh_token(body: RefreshTokenRequest) -> Dict[str, Any]:
    """Refresh the access token using a refresh token."""
    try:
        response = supabase_admin.auth.refresh_session(body.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    session = response.session
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not refresh token")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "token_type": "bearer",
        "expires_in": session.expires_in,
    }


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest) -> Dict[str, Any]:
    """Send a password reset email via Supabase."""
    try:
        supabase_admin.auth.reset_password_email(body.email)
    except Exception as exc:
        logger.warning("Password reset request for %s failed: %s", body.email, exc)
    # Always return success to prevent email enumeration
    return {"message": "If an account exists for this email, a reset link has been sent."}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Change password (requires current password verification)."""
    # Verify current password
    try:
        supabase_admin.auth.sign_in_with_password({
            "email": current_user["email"],
            "password": body.current_password,
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    try:
        supabase_admin.auth.admin.update_user_by_id(
            current_user["id"],
            {"password": body.new_password},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {"message": "Password changed successfully"}


@router.delete("/account")
async def delete_account(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete account and all associated data."""
    user_id = current_user["id"]
    try:
        # Delete profile (cascade should handle related rows via FK)
        supabase_admin.table("profiles").delete().eq("id", user_id).execute()
        # Delete auth user
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {"message": "Account deleted successfully"}


# ---------------------------------------------------------------------------
# Admin-specific auth endpoints
# ---------------------------------------------------------------------------

@router.post("/admin/initialize", status_code=status.HTTP_201_CREATED)
async def initialize_admin() -> Dict[str, Any]:
    """
    One-time admin account setup.
    Only works if ALLOW_ADMIN_INIT=true AND no admin account exists yet.
    Creates admin with username 'admin', password 'admin@123', first_login=true.
    """
    if not settings.ALLOW_ADMIN_INIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin initialization is disabled in this environment.",
        )

    # Check no admin exists
    try:
        existing = (
            supabase_admin.table("profiles")
            .select("id")
            .eq("role", "admin")
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An admin account already exists.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    hashed = hash_password("admin@123")

    try:
        # Create auth user for admin
        auth_response = supabase_admin.auth.admin.create_user({
            "email": "admin@datamend.local",
            "password": "admin@123",
            "email_confirm": True,
        })
        admin_user = auth_response.user
        if not admin_user:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create admin auth user")

        supabase_admin.table("profiles").insert({
            "id": admin_user.id,
            "email": "admin@datamend.local",
            "display_name": "Administrator",
            "role": "admin",
            "username": "admin",
            "password_hash": hashed,
            "first_login": True,
        }).execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {"message": "Admin account created. Login with username 'admin' and password 'admin@123'. You will be required to change your password."}


@router.post("/admin/login")
async def admin_login(body: AdminLoginRequest) -> Dict[str, Any]:
    """
    Admin login. Verifies admin credentials using bcrypt-hashed password
    stored in the profiles table. Returns admin JWT (Supabase session).
    """
    try:
        profile_resp = (
            supabase_admin.table("profiles")
            .select("*")
            .eq("username", body.username)
            .eq("role", "admin")
            .single()
            .execute()
        )
        profile = profile_resp.data
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    if not profile:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    password_hash = profile.get("password_hash", "")
    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    # Check if suspended
    if profile.get("is_suspended"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended")

    # Get supabase session
    try:
        auth_response = supabase_admin.auth.sign_in_with_password({
            "email": profile["email"],
            "password": body.password,
        })
        session = auth_response.session
    except Exception:
        # If the Supabase auth user password differs (e.g., only bcrypt stored), skip session
        session = None

    first_login = profile.get("first_login", False)

    result: Dict[str, Any] = {
        "admin": {
            "id": profile["id"],
            "username": profile.get("username"),
            "display_name": profile.get("display_name"),
            "role": "admin",
            "first_login": first_login,
        },
        "requires_password_change": first_login,
    }

    if session:
        result["access_token"] = session.access_token
        result["refresh_token"] = session.refresh_token
        result["token_type"] = "bearer"
        result["expires_in"] = session.expires_in

    return result


@router.post("/admin/change-password")
async def admin_change_password(
    body: AdminChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Change admin password. Updates bcrypt hash and clears first_login flag."""
    profile = current_user.get("profile") or {}
    password_hash = profile.get("password_hash", "")

    if not verify_password(body.current_password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    new_hash = hash_password(body.new_password)
    try:
        supabase_admin.table("profiles").update({
            "password_hash": new_hash,
            "first_login": False,
        }).eq("id", current_user["id"]).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {"message": "Admin password changed successfully"}
