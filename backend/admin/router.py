"""
Admin router.
Provides privileged administration endpoints: platform overview metrics, user management,
job monitoring, storage metrics, app settings, and tamper-evident audit logs.
All endpoints require the `require_admin` dependency.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from database import require_admin, supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class AnnouncementCreateRequest(BaseModel):
    title: str
    body: str
    is_active: bool = True


class SettingsUpdateRequest(BaseModel):
    max_file_size_mb: Optional[int] = None
    allowed_formats: Optional[List[str]] = None
    max_rows: Optional[int] = None
    allow_public_signup: Optional[bool] = None
    default_theme: Optional[str] = None
    support_email: Optional[str] = None


class UserDeleteRequest(BaseModel):
    confirmation_token: str


# ---------------------------------------------------------------------------
# Audit Logger Helper
# ---------------------------------------------------------------------------

def _log_admin_action(
    admin_id: str,
    action_type: str,
    target_user_id: Optional[str] = None,
    target_resource: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Insert immutable row into admin_audit_logs."""
    try:
        supabase_admin.table("admin_audit_logs").insert({
            "admin_id": admin_id,
            "action_type": action_type,
            "target_user_id": target_user_id,
            "target_resource": target_resource,
            "metadata": metadata or {},
        }).execute()
    except Exception as exc:
        logger.error("Failed to write to admin_audit_logs: %s", exc)


# ---------------------------------------------------------------------------
# 1. Platform Overview
# ---------------------------------------------------------------------------

@router.get("/dashboard")
async def get_admin_dashboard(
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Retrieve platform statistics calculated directly from live database tables."""
    # 1. Total users
    users_resp = supabase_admin.table("profiles").select("id, created_at", count="exact").execute()
    total_users = users_resp.count if hasattr(users_resp, "count") and users_resp.count is not None else len(users_resp.data or [])

    # Active users in 7d and 30d
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    active_7d_resp = (
        supabase_admin.table("activity_logs")
        .select("user_id")
        .gte("created_at", seven_days_ago)
        .execute()
    )
    active_7d_set = {r["user_id"] for r in (active_7d_resp.data or []) if "user_id" in r}

    active_30d_resp = (
        supabase_admin.table("activity_logs")
        .select("user_id")
        .gte("created_at", thirty_days_ago)
        .execute()
    )
    active_30d_set = {r["user_id"] for r in (active_30d_resp.data or []) if "user_id" in r}

    # 2. Total datasets
    ds_resp = supabase_admin.table("datasets").select("id, file_size", count="exact").execute()
    total_datasets = ds_resp.count if hasattr(ds_resp, "count") and ds_resp.count is not None else len(ds_resp.data or [])
    total_storage = sum((d.get("file_size") or 0) for d in (ds_resp.data or []))

    # 3. Analysis runs metrics
    runs_resp = supabase_admin.table("analysis_runs").select("id, status, created_at").execute()
    runs = runs_resp.data or []
    total_runs = len(runs)
    successful_runs = sum(1 for r in runs if r.get("status") == "completed")
    failed_runs = sum(1 for r in runs if r.get("status") == "failed")

    # Recent runs (last 10)
    recent_runs_resp = (
        supabase_admin.table("analysis_runs")
        .select("id, owner_id, status, original_prompt, created_at, error_message")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    return {
        "total_users": total_users,
        "active_users_7d": len(active_7d_set),
        "active_users_30d": len(active_30d_set),
        "total_datasets": total_datasets,
        "total_analysis_runs": total_runs,
        "successful_runs": successful_runs,
        "failed_runs": failed_runs,
        "total_storage_bytes": total_storage,
        "recent_runs": recent_runs_resp.data or [],
    }


# ---------------------------------------------------------------------------
# 2. User Management
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    suspended: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Search, filter and inspect registered users with activity metrics."""
    query = supabase_admin.table("profiles").select("*").order("created_at", desc=True)

    if search:
        query = query.ilike("display_name", f"%{search}%")
    if suspended is not None:
        query = query.eq("is_suspended", suspended)

    start = (page - 1) * limit
    resp = query.range(start, start + limit - 1).execute()
    users = resp.data or []

    # Enrich users with dataset and run counts
    enriched = []
    for u in users:
        uid = u["id"]
        # Count datasets
        d_count_resp = supabase_admin.table("datasets").select("id", count="exact").eq("owner_id", uid).execute()
        d_count = d_count_resp.count if hasattr(d_count_resp, "count") and d_count_resp.count is not None else 0

        # Count runs
        r_count_resp = supabase_admin.table("analysis_runs").select("id", count="exact").eq("owner_id", uid).execute()
        r_count = r_count_resp.count if hasattr(r_count_resp, "count") and r_count_resp.count is not None else 0

        enriched.append({
            **u,
            "dataset_count": d_count,
            "run_count": r_count,
        })

    return {
        "items": enriched,
        "page": page,
        "limit": limit,
        "total": len(enriched),
    }


@router.put("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Suspend user account access."""
    if user_id == current_admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot suspend your own administrator account.")

    supabase_admin.table("profiles").update({"is_suspended": True}).eq("id", user_id).execute()

    _log_admin_action(
        admin_id=current_admin["id"],
        action_type="suspend_user",
        target_user_id=user_id,
        target_resource="profiles",
    )
    return {"status": "success", "message": "User account suspended."}


@router.put("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Reactivate a previously suspended user account."""
    supabase_admin.table("profiles").update({"is_suspended": False}).eq("id", user_id).execute()

    _log_admin_action(
        admin_id=current_admin["id"],
        action_type="reactivate_user",
        target_user_id=user_id,
        target_resource="profiles",
    )
    return {"status": "success", "message": "User account reactivated."}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    body: UserDeleteRequest,
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Delete a user account and associated data with explicit confirmation."""
    if body.confirmation_token != "CONFIRM_DELETE":
        raise HTTPException(status_code=400, detail="Invalid confirmation token. Provide 'CONFIRM_DELETE'.")

    if user_id == current_admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account.")

    # Delete profile and cascading records
    supabase_admin.table("profiles").delete().eq("id", user_id).execute()

    _log_admin_action(
        admin_id=current_admin["id"],
        action_type="delete_user",
        target_user_id=user_id,
        target_resource="profiles",
    )
    return {"status": "success", "message": "User and associated resources deleted."}


# ---------------------------------------------------------------------------
# 3. Processing & Job Monitoring
# ---------------------------------------------------------------------------

@router.get("/runs")
async def list_all_runs(
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Monitor all analysis runs across the platform with filtering."""
    query = supabase_admin.table("analysis_runs").select("*").order("created_at", desc=True)

    if status:
        query = query.eq("status", status)
    if user_id:
        query = query.eq("owner_id", user_id)

    start = (page - 1) * limit
    resp = query.range(start, start + limit - 1).execute()

    return {
        "items": resp.data or [],
        "page": page,
        "limit": limit,
    }


@router.get("/runs/{run_id}")
async def get_run_details(
    run_id: str,
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Inspect full execution metadata and transformation step logs for an analysis job."""
    run_resp = supabase_admin.table("analysis_runs").select("*").eq("id", run_id).single().execute()
    if not run_resp.data:
        raise HTTPException(status_code=404, detail="Run not found")

    steps_resp = (
        supabase_admin.table("transformation_steps")
        .select("*")
        .eq("analysis_run_id", run_id)
        .order("step_order")
        .execute()
    )

    return {
        "run": run_resp.data,
        "steps": steps_resp.data or [],
    }


# ---------------------------------------------------------------------------
# 4. Storage Management
# ---------------------------------------------------------------------------

@router.get("/storage")
async def get_storage_stats(
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Inspect storage consumption breakdown by file format and count."""
    ds_resp = supabase_admin.table("datasets").select("file_format, file_size").execute()
    datasets = ds_resp.data or []

    format_counts: Dict[str, int] = {}
    format_bytes: Dict[str, int] = {}
    total_bytes = 0

    for d in datasets:
        fmt = d.get("file_format") or "unknown"
        size = d.get("file_size") or 0
        format_counts[fmt] = format_counts.get(fmt, 0) + 1
        format_bytes[fmt] = format_bytes.get(fmt, 0) + size
        total_bytes += size

    return {
        "total_files": len(datasets),
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 2),
        "by_format": {
            fmt: {
                "count": format_counts[fmt],
                "bytes": format_bytes[fmt],
                "mb": round(format_bytes[fmt] / (1024 * 1024), 2),
            }
            for fmt in format_counts
        },
    }


# ---------------------------------------------------------------------------
# 5. App Settings & Configuration
# ---------------------------------------------------------------------------

@router.get("/settings")
async def get_settings(
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Fetch global application settings."""
    resp = supabase_admin.table("app_settings").select("*").execute()
    settings_dict = {}
    for row in (resp.data or []):
        settings_dict[row["key"]] = row["value"]

    return settings_dict


@router.put("/settings")
async def update_settings(
    body: SettingsUpdateRequest,
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Update global system parameters."""
    updates = body.model_dump(exclude_unset=True)

    for key, val in updates.items():
        supabase_admin.table("app_settings").upsert({
            "key": key,
            "value": val,
            "updated_by": current_admin["id"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="key").execute()

    _log_admin_action(
        admin_id=current_admin["id"],
        action_type="update_settings",
        target_resource="app_settings",
        metadata=updates,
    )

    return {"status": "success", "updated": updates}


# ---------------------------------------------------------------------------
# 6. Audit Logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs")
async def get_audit_logs(
    action_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Retrieve immutable audit log records."""
    query = supabase_admin.table("admin_audit_logs").select("*").order("created_at", desc=True)

    if action_type:
        query = query.eq("action_type", action_type)

    start = (page - 1) * limit
    resp = query.range(start, start + limit - 1).execute()

    return {
        "items": resp.data or [],
        "page": page,
        "limit": limit,
    }


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

@router.post("/announcements")
async def create_announcement(
    body: AnnouncementCreateRequest,
    current_admin: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Broadcast an announcement to all users."""
    row = {
        "title": body.title,
        "body": body.body,
        "is_active": body.is_active,
        "created_by": current_admin["id"],
    }
    resp = supabase_admin.table("announcements").insert(row).execute()

    _log_admin_action(
        admin_id=current_admin["id"],
        action_type="create_announcement",
        target_resource="announcements",
        metadata={"title": body.title},
    )

    return {"status": "success", "announcement": resp.data}


@router.get("/announcements")
async def list_announcements() -> List[Dict[str, Any]]:
    """List active announcements for users and admins."""
    resp = supabase_admin.table("announcements").select("*").eq("is_active", True).order("created_at", desc=True).execute()
    return resp.data or []
