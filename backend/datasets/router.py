"""
Datasets router.
Handles file upload, listing, versioning, preview and profiling.
"""
from __future__ import annotations

import io
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from config import settings
from database import get_current_user, supabase_admin
from storage.service import create_signed_url, delete_file, delete_prefix, upload_file

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Allowed file types
# ---------------------------------------------------------------------------
ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/json",
    "text/plain",  # some CSVs arrive as text/plain
}
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ext(filename: str) -> str:
    from pathlib import Path
    return Path(filename).suffix.lower()


def _parse_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    """Parse file bytes into a DataFrame based on extension."""
    ext = _ext(filename)
    if ext == ".csv":
        return pd.read_csv(io.BytesIO(content))
    elif ext in {".xlsx", ".xls"}:
        return pd.read_excel(io.BytesIO(content))
    elif ext == ".json":
        return pd.read_json(io.BytesIO(content))
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def _df_summary(df: pd.DataFrame, sample_rows: int = 10) -> Dict[str, Any]:
    """Generate summary metadata from a DataFrame."""
    missing_counts: Dict[str, int] = df.isnull().sum().to_dict()
    dtypes: Dict[str, str] = {col: str(dtype) for col, dtype in df.dtypes.items()}
    sample = df.head(sample_rows).replace({np.nan: None}).to_dict(orient="records")

    return {
        "row_count": len(df),
        "column_count": len(df.columns),
        "column_names": df.columns.tolist(),
        "dtypes": dtypes,
        "missing_counts": {k: int(v) for k, v in missing_counts.items()},
        "sample_rows": sample,
    }


def _df_to_bytes(df: pd.DataFrame, filename: str) -> bytes:
    """Serialise DataFrame back to bytes in original format."""
    ext = _ext(filename)
    buf = io.BytesIO()
    if ext == ".csv":
        df.to_csv(buf, index=False)
    elif ext in {".xlsx", ".xls"}:
        df.to_excel(buf, index=False)
    elif ext == ".json":
        df.to_json(buf, orient="records")
    else:
        df.to_csv(buf, index=False)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Upload a new dataset file (csv/xlsx/xls/json)."""
    # Validate extension
    ext = _ext(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read content
    content = await file.read()

    # Validate size
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB",
        )

    # Parse
    try:
        df = _parse_dataframe(content, file.filename or "upload")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse file: {exc}",
        )

    user_id = current_user["id"]
    dataset_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    filename = file.filename or f"{dataset_id}{ext}"

    # Upload to storage
    storage_path = upload_file(content, user_id, dataset_id, filename, file.content_type or "application/octet-stream")

    summary = _df_summary(df)

    # Persist dataset record
    dataset_row = {
        "id": dataset_id,
        "owner_id": user_id,
        "filename": filename,
        "original_filename": file.filename or filename,
        "file_format": ext.lstrip("."),
        "row_count": summary["row_count"],
        "column_count": summary["column_count"],
        "file_size": len(content),
        "upload_status": "ready",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase_admin.table("datasets").insert(dataset_row).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    # Persist version record
    version_row = {
        "id": version_id,
        "dataset_id": dataset_id,
        "version_number": 1,
        "storage_path": storage_path,
        "row_count": summary["row_count"],
        "column_count": summary["column_count"],
        "schema_snapshot": {
            "column_names": summary["column_names"],
            "dtypes": summary["dtypes"],
            "missing_counts": summary["missing_counts"],
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_original": True,
    }
    try:
        supabase_admin.table("dataset_versions").insert(version_row).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {
        "dataset_id": dataset_id,
        "version_id": version_id,
        "filename": filename,
        **summary,
    }


# ---------------------------------------------------------------------------
# List datasets
# ---------------------------------------------------------------------------

@router.get("")
async def list_datasets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    format: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """List current user's datasets with optional filters."""
    user_id = current_user["id"]
    query = supabase_admin.table("datasets").select("*").eq("owner_id", user_id)

    if format:
        query = query.eq("file_format", format)
    if search:
        query = query.ilike("original_filename", f"%{search}%")

    offset = (page - 1) * page_size
    query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)

    try:
        resp = query.execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return {
        "page": page,
        "page_size": page_size,
        "datasets": resp.data or [],
    }


# ---------------------------------------------------------------------------
# Get dataset
# ---------------------------------------------------------------------------

@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get details of a specific dataset."""
    try:
        resp = (
            supabase_admin.table("datasets")
            .select("*")
            .eq("id", dataset_id)
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    return resp.data


# ---------------------------------------------------------------------------
# Delete dataset
# ---------------------------------------------------------------------------

@router.delete("/{dataset_id}", status_code=status.HTTP_200_OK)
async def delete_dataset(
    dataset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a dataset and all its versions from DB and storage."""
    user_id = current_user["id"]

    # Verify ownership
    try:
        ds_resp = (
            supabase_admin.table("datasets")
            .select("id")
            .eq("id", dataset_id)
            .eq("owner_id", user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    # Delete all versions from storage
    delete_prefix(f"{user_id}/{dataset_id}/")

    # Delete dataset record (cascade should handle versions)
    supabase_admin.table("datasets").delete().eq("id", dataset_id).execute()

    return {"message": "Dataset deleted"}


# ---------------------------------------------------------------------------
# List versions
# ---------------------------------------------------------------------------

@router.get("/{dataset_id}/versions")
async def list_versions(
    dataset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """List all versions for a dataset."""
    # Ensure ownership
    try:
        supabase_admin.table("datasets").select("id").eq("id", dataset_id).eq("owner_id", current_user["id"]).single().execute()
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    resp = (
        supabase_admin.table("dataset_versions")
        .select("*")
        .eq("dataset_id", dataset_id)
        .order("version_number", desc=False)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Version preview
# ---------------------------------------------------------------------------

@router.get("/{dataset_id}/versions/{version_id}/preview")
async def preview_version(
    dataset_id: str,
    version_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return first 50 rows, column info and quality summary."""
    from processing.quality import compute_quality_profile

    storage_path, df = _load_version_df(dataset_id, version_id, current_user["id"])

    preview = df.head(50).replace({np.nan: None}).to_dict(orient="records")
    quality = compute_quality_profile(df)

    return {
        "version_id": version_id,
        "row_count": len(df),
        "column_count": len(df.columns),
        "column_names": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "preview_rows": preview,
        "quality": quality,
    }


# ---------------------------------------------------------------------------
# Download (signed URL)
# ---------------------------------------------------------------------------

@router.get("/{dataset_id}/versions/{version_id}/download")
async def download_version(
    dataset_id: str,
    version_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return a signed download URL for a dataset version."""
    try:
        v_resp = (
            supabase_admin.table("dataset_versions")
            .select("storage_path")
            .eq("id", version_id)
            .eq("dataset_id", dataset_id)
            .single()
            .execute()
        )
        storage_path = v_resp.data["storage_path"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    signed_url = create_signed_url(storage_path)
    return {"signed_url": signed_url, "expires_in": 60}


# ---------------------------------------------------------------------------
# Dataset profile
# ---------------------------------------------------------------------------

@router.post("/{dataset_id}/profile")
async def profile_dataset(
    dataset_id: str,
    version_id: Optional[str] = Query(None, description="Specific version; defaults to latest"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate a full quality profile for a dataset version."""
    from processing.quality import compute_quality_profile

    # Get latest version if not specified
    if not version_id:
        v_resp = (
            supabase_admin.table("dataset_versions")
            .select("id")
            .eq("dataset_id", dataset_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )
        if not v_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No versions found")
        version_id = v_resp.data[0]["id"]

    _, df = _load_version_df(dataset_id, version_id, current_user["id"])
    return compute_quality_profile(df)


# ---------------------------------------------------------------------------
# Internal helper: load version as DataFrame
# ---------------------------------------------------------------------------

def _load_version_df(dataset_id: str, version_id: str, user_id: str):
    """Download a version from storage and parse to DataFrame."""
    try:
        v_resp = (
            supabase_admin.table("dataset_versions")
            .select("storage_path")
            .eq("id", version_id)
            .eq("dataset_id", dataset_id)
            .single()
            .execute()
        )
        storage_path: str = v_resp.data["storage_path"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Ensure dataset belongs to user
    try:
        supabase_admin.table("datasets").select("id").eq("id", dataset_id).eq("owner_id", user_id).single().execute()
    except Exception:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        content = supabase_admin.storage.from_("datasets").download(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not download file: {exc}")

    filename = storage_path.split("/")[-1]
    try:
        df = _parse_dataframe(content, filename)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not parse file: {exc}")

    return storage_path, df
