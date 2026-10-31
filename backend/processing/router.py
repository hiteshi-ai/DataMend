"""
Processing router.
Handles NLP interpretation, plan execution, run management, recipes and script generation.
"""
from __future__ import annotations

import io
import logging
import textwrap
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from database import get_current_user, supabase_admin
from processing.nlp_interpreter import interpret_prompt
from processing.operations import apply_operation
from processing.quality import compare_quality_profiles, compute_quality_profile
from storage.service import create_signed_url, upload_file

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class InterpretRequest(BaseModel):
    prompt: str
    dataset_id: str
    version_id: str


class ExecuteRequest(BaseModel):
    plan: Dict[str, Any]
    dataset_id: str
    version_id: str
    run_name: Optional[str] = None


class RecipeSaveRequest(BaseModel):
    name: str
    description: Optional[str] = None
    operations: List[Dict[str, Any]]


class RecipeApplyRequest(BaseModel):
    dataset_id: str
    version_id: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_df_from_version(dataset_id: str, version_id: str, user_id: str) -> tuple[pd.DataFrame, str, str]:
    """Download version from storage and parse to DataFrame. Returns (df, storage_path, filename)."""
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version not found")

    # Ownership check
    try:
        supabase_admin.table("datasets").select("id").eq("id", dataset_id).eq("owner_id", user_id).single().execute()
    except Exception:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        content = supabase_admin.storage.from_("datasets").download(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not download file: {exc}")

    filename = storage_path.split("/")[-1]
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ".csv"

    if ext == ".csv":
        df = pd.read_csv(io.BytesIO(content))
    elif ext in {".xlsx", ".xls"}:
        df = pd.read_excel(io.BytesIO(content))
    elif ext == ".json":
        df = pd.read_json(io.BytesIO(content))
    else:
        df = pd.read_csv(io.BytesIO(content))

    return df, storage_path, filename


def _df_to_bytes(df: pd.DataFrame, filename: str) -> bytes:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ".csv"
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
# POST /interpret
# ---------------------------------------------------------------------------

@router.post("/interpret")
async def interpret(
    body: InterpretRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Interpret a natural-language prompt and return a structured operation plan."""
    # Get column names from version metadata
    column_names: Optional[List[str]] = None
    try:
        v_resp = (
            supabase_admin.table("dataset_versions")
            .select("column_names")
            .eq("id", body.version_id)
            .single()
            .execute()
        )
        column_names = v_resp.data.get("column_names")
    except Exception:
        pass

    plan = await interpret_prompt(body.prompt, column_names)
    return plan


# ---------------------------------------------------------------------------
# POST /execute
# ---------------------------------------------------------------------------

@router.post("/execute", status_code=status.HTTP_201_CREATED)
async def execute_plan(
    body: ExecuteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Execute an approved cleaning plan. Creates a new dataset version."""
    user_id = current_user["id"]
    run_id = str(uuid.uuid4())

    # Create analysis_run record
    run_record = {
        "id": run_id,
        "owner_id": user_id,
        "dataset_version_id": body.version_id,
        "original_prompt": body.plan.get("objective", ""),
        "approved_plan": body.plan,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase_admin.table("analysis_runs").insert(run_record).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    # Load DataFrame
    try:
        df, storage_path, filename = _load_df_from_version(body.dataset_id, body.version_id, user_id)
    except HTTPException:
        supabase_admin.table("analysis_runs").update({"status": "failed"}).eq("id", run_id).execute()
        raise

    before_profile = compute_quality_profile(df)
    current_df = df.copy()
    steps: List[Dict[str, Any]] = []

    # Execute operations sequentially
    for idx, op in enumerate(body.plan.get("operations", [])):
        op_type = op.get("operation_type", "")
        params = op.get("parameters", {})
        step_id = str(uuid.uuid4())

        try:
            result_df, rows_affected, summary, op_warnings = apply_operation(current_df, op_type, params)
            current_df = result_df
            success = True
            error_msg = None
        except Exception as exc:
            logger.exception("Operation %s failed", op_type)
            success = False
            error_msg = str(exc)
            rows_affected = 0
            summary = f"Operation failed: {exc}"
            op_warnings = [str(exc)]

        step_record = {
            "id": step_id,
            "analysis_run_id": run_id,
            "step_order": idx + 1,
            "operation_type": op_type,
            "parameters": params,
            "affected_columns": op.get("affected_columns", []),
            "rows_affected": rows_affected,
            "result_summary": summary,
            "warnings": op_warnings,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        steps.append({**step_record, "success": success, "error": error_msg})

        try:
            supabase_admin.table("transformation_steps").insert(step_record).execute()
        except Exception as exc:
            logger.warning("Could not save transformation step: %s", exc)

    # Compute after profile and diff
    after_profile = compute_quality_profile(current_df)
    quality_diff = compare_quality_profiles(before_profile, after_profile)

    # Save new version to storage
    new_version_id = str(uuid.uuid4())
    cleaned_bytes = _df_to_bytes(current_df, filename)
    cleaned_filename = f"v_{new_version_id}_{filename}"
    new_storage_path = upload_file(cleaned_bytes, user_id, body.dataset_id, cleaned_filename)

    # Get current version number
    try:
        vn_resp = (
            supabase_admin.table("dataset_versions")
            .select("version_number")
            .eq("dataset_id", body.dataset_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )
        next_version = (vn_resp.data[0]["version_number"] if vn_resp.data else 1) + 1
    except Exception:
        next_version = 2

    column_names = current_df.columns.tolist()
    dtypes = {col: str(dtype) for col, dtype in current_df.dtypes.items()}
    missing_counts = {col: int(v) for col, v in current_df.isnull().sum().items()}

    new_version_record = {
        "id": new_version_id,
        "dataset_id": body.dataset_id,
        "version_number": next_version,
        "storage_path": new_storage_path,
        "row_count": len(current_df),
        "column_count": len(current_df.columns),
        "schema_snapshot": {
            "column_names": column_names,
            "dtypes": dtypes,
            "missing_counts": missing_counts,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_original": False,
    }
    try:
        supabase_admin.table("dataset_versions").insert(new_version_record).execute()
    except Exception as exc:
        logger.warning("Could not save new version: %s", exc)

    # Create report record
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "owner_id": user_id,
        "analysis_run_id": run_id,
        "title": f"Analysis: {body.plan.get('objective', 'Data Cleaning')}",
        "status": "ready",
        "storage_path": None,
        "summary": {
            "prompt": body.plan.get("objective", ""),
            "before_quality": before_profile,
            "after_quality": after_profile,
            "quality_diff": quality_diff,
            "operations_count": len(steps),
            "rows_affected": abs(after_profile["total_rows"] - before_profile["total_rows"]),
            "key_findings": [f"Successfully processed {len(steps)} operations. Final row count: {len(current_df)}."],
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase_admin.table("reports").insert(report_record).execute()
    except Exception as exc:
        logger.warning("Could not save report: %s", exc)

    # Update run status
    all_success = all(s.get("success", True) for s in steps)
    final_status = "completed" if all_success else "failed"
    supabase_admin.table("analysis_runs").update({
        "status": final_status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", run_id).execute()

    return {
        "run_id": run_id,
        "status": final_status,
        "result_version_id": new_version_id,
        "report_id": report_id,
        "steps": steps,
        "quality_diff": quality_diff,
        "rows_before": before_profile["total_rows"],
        "rows_after": after_profile["total_rows"],
    }


# ---------------------------------------------------------------------------
# GET /runs
# ---------------------------------------------------------------------------

@router.get("/runs")
async def list_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """List current user's analysis runs."""
    offset = (page - 1) * page_size
    resp = (
        supabase_admin.table("analysis_runs")
        .select("*")
        .eq("owner_id", current_user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return {"page": page, "page_size": page_size, "runs": resp.data or []}


# ---------------------------------------------------------------------------
# GET /runs/{id}
# ---------------------------------------------------------------------------

@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get detailed info for a run including all steps."""
    try:
        run_resp = (
            supabase_admin.table("analysis_runs")
            .select("*")
            .eq("id", run_id)
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    steps_resp = (
        supabase_admin.table("transformation_steps")
        .select("*")
        .eq("analysis_run_id", run_id)
        .order("step_order")
        .execute()
    )

    return {**run_resp.data, "steps": steps_resp.data or []}


# ---------------------------------------------------------------------------
# GET /runs/{id}/status
# ---------------------------------------------------------------------------

@router.get("/runs/{run_id}/status")
async def get_run_status(
    run_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get the current status of an analysis run."""
    try:
        resp = (
            supabase_admin.table("analysis_runs")
            .select("id, status, completed_at")
            .eq("id", run_id)
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return resp.data


# ---------------------------------------------------------------------------
# GET /runs/{id}/script
# ---------------------------------------------------------------------------

@router.get("/runs/{run_id}/script")
async def generate_script(
    run_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate a reproducible Python script for an analysis run."""
    try:
        run_resp = (
            supabase_admin.table("analysis_runs")
            .select("*")
            .eq("id", run_id)
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        run = run_resp.data
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    steps_resp = (
        supabase_admin.table("transformation_steps")
        .select("*")
        .eq("analysis_run_id", run_id)
        .order("step_order")
        .execute()
    )
    steps = steps_resp.data or []

    lines = [
        '"""',
        f"DataMend generated script – Run: {run.get('name', run_id)}",
        f"Created: {run.get('created_at', '')}",
        f"Objective: {run.get('objective', '')}",
        '"""',
        "import pandas as pd",
        "import numpy as np",
        "",
        "# Load your dataset",
        "df = pd.read_csv('your_dataset.csv')  # adjust path/format",
        "",
    ]

    for step in steps:
        op_type = step["operation_type"]
        params = step.get("parameters") or {}
        lines.append(f"# Step {step['step_index'] + 1}: {op_type}")
        lines.append(f"# {step.get('result_summary', '')}")
        lines.append(f"# Parameters: {params}")

        # Generate idiomatic pandas code per operation
        if op_type == "remove_duplicates":
            subset = params.get("subset")
            keep = params.get("keep", "first")
            lines.append(f"df = df.drop_duplicates(subset={subset!r}, keep={keep!r}).reset_index(drop=True)")
        elif op_type == "drop_missing":
            cols = params.get("columns")
            lines.append(f"df = df.dropna(subset={cols!r}).reset_index(drop=True)")
        elif op_type == "fill_missing":
            method = params.get("method", "mode")
            cols = params.get("columns", [])
            for col in cols:
                if method == "mean":
                    lines.append(f"df[{col!r}] = df[{col!r}].fillna(df[{col!r}].mean())")
                elif method == "median":
                    lines.append(f"df[{col!r}] = df[{col!r}].fillna(df[{col!r}].median())")
                elif method == "mode":
                    lines.append(f"df[{col!r}] = df[{col!r}].fillna(df[{col!r}].mode().iloc[0])")
                elif method in {"ffill", "bfill"}:
                    lines.append(f"df[{col!r}] = df[{col!r}].{method}()")
                else:
                    val = params.get("value")
                    lines.append(f"df[{col!r}] = df[{col!r}].fillna({val!r})")
        elif op_type == "trim_whitespace":
            cols = params.get("columns")
            if cols:
                for col in cols:
                    lines.append(f"df[{col!r}] = df[{col!r}].str.strip()")
            else:
                lines.append("for col in df.select_dtypes(include='object').columns:")
                lines.append("    df[col] = df[col].str.strip()")
        elif op_type == "standardize_text":
            col = params.get("column", "")
            case = params.get("case", "lower")
            lines.append(f"df[{col!r}] = df[{col!r}].str.{case}().str.strip()")
        elif op_type == "drop_columns":
            cols = params.get("columns", [])
            lines.append(f"df = df.drop(columns={cols!r})")
        elif op_type == "rename_columns":
            mapping = params.get("mapping", {})
            lines.append(f"df = df.rename(columns={mapping!r})")
        elif op_type == "convert_dtype":
            col = params.get("column", "")
            target = params.get("target_type", "str")
            lines.append(f"df[{col!r}] = pd.to_numeric(df[{col!r}], errors='coerce')  # adjust for type: {target}")
        elif op_type == "standardize_dates":
            col = params.get("column", "")
            fmt = params.get("format")
            if fmt:
                lines.append(f"df[{col!r}] = pd.to_datetime(df[{col!r}], format={fmt!r}, errors='coerce')")
            else:
                lines.append(f"df[{col!r}] = pd.to_datetime(df[{col!r}], errors='coerce')")
        else:
            lines.append(f"# Manual step: {op_type} with params {params}")

        lines.append("")

    lines.append("# Save result")
    lines.append("df.to_csv('cleaned_dataset.csv', index=False)")

    script_content = "\n".join(lines)
    return {"script": script_content, "run_id": run_id}


# ---------------------------------------------------------------------------
# Recipes
# ---------------------------------------------------------------------------

@router.post("/recipes", status_code=status.HTTP_201_CREATED)
async def save_recipe(
    body: RecipeSaveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Save a reusable cleaning recipe."""
    recipe_id = str(uuid.uuid4())
    record = {
        "id": recipe_id,
        "owner_id": current_user["id"],
        "name": body.name,
        "description": body.description,
        "operations": body.operations,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase_admin.table("saved_recipes").insert(record).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    return {"recipe_id": recipe_id, "message": "Recipe saved"}


@router.get("/recipes")
async def list_recipes(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """List current user's saved recipes."""
    resp = (
        supabase_admin.table("saved_recipes")
        .select("*")
        .eq("owner_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


@router.post("/recipes/{recipe_id}/apply", status_code=status.HTTP_201_CREATED)
async def apply_recipe(
    recipe_id: str,
    body: RecipeApplyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Apply a saved recipe to a dataset version."""
    try:
        recipe_resp = (
            supabase_admin.table("saved_recipes")
            .select("*")
            .eq("id", recipe_id)
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        recipe = recipe_resp.data
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    from processing.router import execute_plan, ExecuteRequest

    plan = {
        "objective": f"Apply recipe: {recipe['name']}",
        "operations": recipe.get("operations", []),
        "assumptions": [],
        "warnings": [],
        "estimated_impact": "From saved recipe.",
    }
    exec_body = ExecuteRequest(
        plan=plan,
        dataset_id=body.dataset_id,
        version_id=body.version_id,
        run_name=f"Recipe: {recipe['name']}",
    )
    return await execute_plan(exec_body, current_user)
