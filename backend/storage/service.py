"""
Supabase Storage service helpers.
Handles upload, signed-URL generation, deletion and listing of files
within the 'datasets' bucket.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from database import supabase_admin

logger = logging.getLogger(__name__)

BUCKET = "datasets"
SIGNED_URL_EXPIRY = 60  # seconds


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def upload_file(
    file_bytes: bytes,
    user_id: str,
    dataset_id: str,
    filename: str,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Upload file to Supabase Storage.

    Storage path: ``{user_id}/{dataset_id}/{filename}``

    Returns the storage path on success.
    """
    path = f"{user_id}/{dataset_id}/{filename}"
    try:
        supabase_admin.storage.from_(BUCKET).upload(
            path,
            file_bytes,
            {"content-type": content_type, "upsert": "true"},
        )
        return path
    except Exception as exc:
        logger.error("Storage upload failed for path %s: %s", path, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {exc}",
        )


# ---------------------------------------------------------------------------
# Signed URL
# ---------------------------------------------------------------------------

def create_signed_url(storage_path: str, expires_in: int = SIGNED_URL_EXPIRY) -> str:
    """
    Generate a signed download URL for *storage_path* (expiry in seconds).
    """
    try:
        response = supabase_admin.storage.from_(BUCKET).create_signed_url(
            storage_path, expires_in
        )
        signed_url: Optional[str] = None
        if isinstance(response, dict):
            signed_url = response.get("signedURL") or response.get("signedUrl")
        elif hasattr(response, "signed_url"):
            signed_url = response.signed_url
        if not signed_url:
            raise ValueError(f"Unexpected response: {response}")
        return signed_url
    except Exception as exc:
        logger.error("Failed to create signed URL for %s: %s", storage_path, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {exc}",
        )


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def delete_file(storage_path: str) -> None:
    """Delete a file from Supabase Storage."""
    try:
        supabase_admin.storage.from_(BUCKET).remove([storage_path])
    except Exception as exc:
        logger.warning("Failed to delete storage file %s: %s", storage_path, exc)


def delete_prefix(prefix: str) -> None:
    """Delete all files under a given prefix (folder)."""
    files = list_files(prefix)
    paths = [f["name"] for f in files if "name" in f]
    if paths:
        try:
            supabase_admin.storage.from_(BUCKET).remove(paths)
        except Exception as exc:
            logger.warning("Failed to delete prefix %s: %s", prefix, exc)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def list_files(prefix: str) -> List[Dict[str, Any]]:
    """List files under a storage prefix."""
    try:
        response = supabase_admin.storage.from_(BUCKET).list(prefix)
        if isinstance(response, list):
            return response
        return []
    except Exception as exc:
        logger.warning("Failed to list files under %s: %s", prefix, exc)
        return []
