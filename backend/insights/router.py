"""
Insights router.
Provides statistical analysis, correlation analysis, interactive Plotly chart specifications,
dataset comparison, and chart recommendations.
"""
from __future__ import annotations

import io
import json
import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from scipy import stats

from database import get_current_user, supabase_admin
from storage.service import create_signed_url

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class StatisticsRequest(BaseModel):
    dataset_id: str
    version_id: str


class CorrelationRequest(BaseModel):
    dataset_id: str
    version_id: str
    columns: Optional[List[str]] = None


class ChartRequest(BaseModel):
    dataset_version_id: str
    chart_type: str  # line, bar, histogram, scatter, box, heatmap, pie
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


class CompareRequest(BaseModel):
    run_id_1: Optional[str] = None
    run_id_2: Optional[str] = None
    version_id_1: Optional[str] = None
    version_id_2: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_dataframe_for_version(version_id: str, user_id: str) -> pd.DataFrame:
    """Download and load DataFrame from storage, verifying user ownership."""
    v_resp = (
        supabase_admin.table("dataset_versions")
        .select("dataset_id, storage_path")
        .eq("id", version_id)
        .single()
        .execute()
    )
    if not v_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version not found")

    dataset_id = v_resp.data["dataset_id"]
    storage_path = v_resp.data["storage_path"]

    # Verify ownership in datasets table
    d_resp = (
        supabase_admin.table("datasets")
        .select("id, owner_id")
        .eq("id", dataset_id)
        .single()
        .execute()
    )
    if not d_resp.data or d_resp.data.get("owner_id") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this dataset")

    # Download from storage
    try:
        content = supabase_admin.storage.from_("datasets").download(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Storage error: {exc}")

    filename = storage_path.split("/")[-1].lower()
    ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".csv"

    try:
        if ext == ".csv":
            return pd.read_csv(io.BytesIO(content))
        elif ext in {".xlsx", ".xls"}:
            return pd.read_excel(io.BytesIO(content))
        elif ext == ".json":
            return pd.read_json(io.BytesIO(content))
        else:
            return pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error parsing dataset file: {exc}")


# ---------------------------------------------------------------------------
# POST /statistics
# ---------------------------------------------------------------------------

@router.post("/statistics")
async def get_statistics(
    body: StatisticsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Calculate descriptive statistics for all columns in a dataset version."""
    df = _load_dataframe_for_version(body.version_id, current_user["id"])

    stats_result: Dict[str, Any] = {}

    for col in df.columns:
        series = df[col]
        total_count = len(series)
        missing_count = int(series.isnull().sum())
        missing_pct = round((missing_count / total_count * 100), 2) if total_count > 0 else 0
        unique_count = int(series.nunique(dropna=True))
        dtype_str = str(series.dtype)

        is_numeric = pd.api.types.is_numeric_dtype(series)

        col_stats: Dict[str, Any] = {
            "count": total_count - missing_count,
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "unique_count": unique_count,
            "dtype": dtype_str,
            "is_numeric": is_numeric,
        }

        if is_numeric and unique_count > 0:
            clean_s = series.dropna()
            if len(clean_s) > 0:
                col_stats["mean"] = float(round(clean_s.mean(), 4))
                col_stats["median"] = float(round(clean_s.median(), 4))
                try:
                    mode_val = clean_s.mode()
                    col_stats["mode"] = float(round(mode_val[0], 4)) if len(mode_val) > 0 else None
                except Exception:
                    col_stats["mode"] = None

                col_stats["std"] = float(round(clean_s.std(), 4)) if len(clean_s) > 1 else 0.0
                col_stats["variance"] = float(round(clean_s.var(), 4)) if len(clean_s) > 1 else 0.0
                col_stats["min"] = float(round(clean_s.min(), 4))
                col_stats["max"] = float(round(clean_s.max(), 4))
                col_stats["range"] = float(round(clean_s.max() - clean_s.min(), 4))
                col_stats["q1"] = float(round(clean_s.quantile(0.25), 4))
                col_stats["q3"] = float(round(clean_s.quantile(0.75), 4))
                col_stats["iqr"] = float(round(col_stats["q3"] - col_stats["q1"], 4))

                if len(clean_s) >= 3:
                    try:
                        col_stats["skewness"] = float(round(stats.skew(clean_s), 4))
                        col_stats["kurtosis"] = float(round(stats.kurtosis(clean_s), 4))
                    except Exception:
                        col_stats["skewness"] = None
                        col_stats["kurtosis"] = None
        else:
            # Categorical value counts (top 15)
            vc = series.value_counts(dropna=True).head(15).to_dict()
            col_stats["value_counts"] = {str(k): int(v) for k, v in vc.items()}

        stats_result[col] = col_stats

    return {
        "dataset_version_id": body.version_id,
        "columns": stats_result,
    }


# ---------------------------------------------------------------------------
# POST /correlation
# ---------------------------------------------------------------------------

@router.post("/correlation")
async def get_correlation(
    body: CorrelationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Compute Pearson correlation matrix for numeric columns."""
    df = _load_dataframe_for_version(body.version_id, current_user["id"])

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if body.columns:
        numeric_cols = [c for c in body.columns if c in numeric_cols]

    if len(numeric_cols) < 2:
        return {
            "matrix": {},
            "columns": numeric_cols,
            "message": "At least 2 numeric columns required for correlation analysis.",
        }

    corr_df = df[numeric_cols].corr(method="pearson").round(4)
    matrix_dict: Dict[str, Dict[str, float]] = {}

    for col in numeric_cols:
        matrix_dict[col] = {}
        for other in numeric_cols:
            val = corr_df.loc[col, other]
            matrix_dict[col][other] = float(val) if not np.isnan(val) else 0.0

    return {
        "matrix": matrix_dict,
        "columns": numeric_cols,
    }


# ---------------------------------------------------------------------------
# POST /chart
# ---------------------------------------------------------------------------

@router.post("/chart")
async def generate_chart(
    body: ChartRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generate an interactive Plotly chart specification based on actual dataset values.
    Returns Plotly figure dictionary (data + layout).
    """
    df = _load_dataframe_for_version(body.dataset_version_id, current_user["id"])

    chart_type = body.chart_type.lower()
    x_col = body.x_column
    y_col = body.y_column

    fig_data: List[Dict[str, Any]] = []
    layout: Dict[str, Any] = {
        "autosize": True,
        "margin": {"l": 50, "r": 30, "t": 50, "b": 50},
        "hovermode": "closest",
        "paper_bgcolor": "transparent",
        "plot_bgcolor": "transparent",
        "font": {"family": "Inter, sans-serif", "size": 12},
    }

    if chart_type == "histogram":
        col = x_col or (df.select_dtypes(include=[np.number]).columns[0] if len(df.select_dtypes(include=[np.number]).columns) > 0 else df.columns[0])
        values = df[col].dropna().tolist()
        fig_data.append({
            "type": "histogram",
            "x": values,
            "name": col,
            "marker": {"color": "#8B79C6"},
            "opacity": 0.85,
        })
        layout["title"] = f"Distribution of {col}"
        layout["xaxis"] = {"title": col}
        layout["yaxis"] = {"title": "Frequency"}

    elif chart_type == "bar":
        if x_col and y_col:
            grouped = df.groupby(x_col)[y_col].mean().reset_index().head(30)
            fig_data.append({
                "type": "bar",
                "x": grouped[x_col].astype(str).tolist(),
                "y": grouped[y_col].round(2).tolist(),
                "marker": {"color": "#8B79C6"},
            })
            layout["title"] = f"Average {y_col} by {x_col}"
            layout["xaxis"] = {"title": x_col}
            layout["yaxis"] = {"title": y_col}
        elif x_col:
            vc = df[x_col].value_counts().head(20)
            fig_data.append({
                "type": "bar",
                "x": vc.index.astype(str).tolist(),
                "y": vc.values.tolist(),
                "marker": {"color": "#8B79C6"},
            })
            layout["title"] = f"Count of {x_col}"
            layout["xaxis"] = {"title": x_col}
            layout["yaxis"] = {"title": "Count"}

    elif chart_type == "scatter":
        if not x_col or not y_col:
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if len(num_cols) >= 2:
                x_col, y_col = num_cols[0], num_cols[1]
            else:
                raise HTTPException(status_code=400, detail="Scatter plot requires two numeric columns.")
        clean_df = df[[x_col, y_col]].dropna().head(1000)
        fig_data.append({
            "type": "scatter",
            "mode": "markers",
            "x": clean_df[x_col].tolist(),
            "y": clean_df[y_col].tolist(),
            "marker": {"color": "#8B79C6", "size": 7, "opacity": 0.7},
        })
        layout["title"] = f"{y_col} vs {x_col}"
        layout["xaxis"] = {"title": x_col}
        layout["yaxis"] = {"title": y_col}

    elif chart_type == "line":
        if x_col and y_col:
            sorted_df = df[[x_col, y_col]].dropna().sort_values(by=x_col).head(500)
            fig_data.append({
                "type": "scatter",
                "mode": "lines+markers",
                "x": sorted_df[x_col].astype(str).tolist(),
                "y": sorted_df[y_col].tolist(),
                "line": {"color": "#8B79C6", "width": 2},
                "marker": {"size": 5},
            })
            layout["title"] = f"{y_col} over {x_col}"
            layout["xaxis"] = {"title": x_col}
            layout["yaxis"] = {"title": y_col}

    elif chart_type == "box":
        col = y_col or x_col or df.select_dtypes(include=[np.number]).columns[0]
        if x_col and y_col and x_col != y_col:
            # Grouped box plot
            top_cats = df[x_col].value_counts().head(8).index.tolist()
            filtered = df[df[x_col].isin(top_cats)]
            for cat in top_cats:
                vals = filtered[filtered[x_col] == cat][y_col].dropna().tolist()
                fig_data.append({
                    "type": "box",
                    "y": vals,
                    "name": str(cat),
                })
            layout["title"] = f"{y_col} Distribution by {x_col}"
        else:
            vals = df[col].dropna().tolist()
            fig_data.append({
                "type": "box",
                "y": vals,
                "name": col,
                "marker": {"color": "#8B79C6"},
            })
            layout["title"] = f"Box Plot of {col}"

    elif chart_type == "heatmap":
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()[:12]
        if len(num_cols) < 2:
            raise HTTPException(status_code=400, detail="Heatmap requires at least 2 numeric columns")
        corr = df[num_cols].corr().round(2).fillna(0)
        fig_data.append({
            "type": "heatmap",
            "z": corr.values.tolist(),
            "x": num_cols,
            "y": num_cols,
            "colorscale": "Viridis",
        })
        layout["title"] = "Correlation Heatmap"

    elif chart_type == "pie":
        col = x_col or df.select_dtypes(include=["object", "category"]).columns[0]
        vc = df[col].value_counts().head(10)
        fig_data.append({
            "type": "pie",
            "labels": vc.index.astype(str).tolist(),
            "values": vc.values.tolist(),
            "hole": 0.4,
        })
        layout["title"] = f"Distribution of {col}"

    return {
        "figure": {
            "data": fig_data,
            "layout": layout,
        }
    }


# ---------------------------------------------------------------------------
# POST /compare
# ---------------------------------------------------------------------------

@router.post("/compare")
async def compare_datasets(
    body: CompareRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Compare two dataset versions or analysis runs side by side.
    Computes row delta, missing delta, duplicate delta, and schema changes.
    """
    v1_id = body.version_id_1
    v2_id = body.version_id_2

    # If run IDs were provided, look up their input & output version IDs
    if body.run_id_1 and not v1_id:
        r1 = supabase_admin.table("analysis_runs").select("*").eq("id", body.run_id_1).single().execute()
        if r1.data:
            v1_id = r1.data.get("dataset_version_id")

    if body.run_id_2 and not v2_id:
        r2 = supabase_admin.table("analysis_runs").select("*").eq("id", body.run_id_2).single().execute()
        if r2.data:
            v2_id = r2.data.get("dataset_version_id")

    if not v1_id or not v2_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two valid versions or analysis runs are required for comparison.",
        )

    df1 = _load_dataframe_for_version(v1_id, current_user["id"])
    df2 = _load_dataframe_for_version(v2_id, current_user["id"])

    cols1 = set(df1.columns)
    cols2 = set(df2.columns)

    added_cols = list(cols2 - cols1)
    removed_cols = list(cols1 - cols2)
    common_cols = list(cols1 & cols2)

    type_changes = []
    for c in common_cols:
        t1 = str(df1[c].dtype)
        t2 = str(df2[c].dtype)
        if t1 != t2:
            type_changes.append({"column": c, "from": t1, "to": t2})

    # Metric changes
    r1_len, r2_len = len(df1), len(df2)
    m1_null, m2_null = int(df1.isnull().sum().sum()), int(df2.isnull().sum().sum())
    d1_dup, d2_dup = int(df1.duplicated().sum()), int(df2.duplicated().sum())

    # Numeric stats comparisons for common columns
    stats_comp: Dict[str, Any] = {}
    for c in common_cols:
        if pd.api.types.is_numeric_dtype(df1[c]) and pd.api.types.is_numeric_dtype(df2[c]):
            s1_clean = df1[c].dropna()
            s2_clean = df2[c].dropna()
            mean1 = float(round(s1_clean.mean(), 2)) if len(s1_clean) > 0 else None
            mean2 = float(round(s2_clean.mean(), 2)) if len(s2_clean) > 0 else None
            stats_comp[c] = {
                "before_mean": mean1,
                "after_mean": mean2,
                "mean_delta": round(mean2 - mean1, 2) if (mean1 is not None and mean2 is not None) else None,
            }

    return {
        "version_id_1": v1_id,
        "version_id_2": v2_id,
        "metrics_diff": {
            "v1": {
                "rows": r1_len,
                "columns": len(df1.columns),
                "missing_cells": m1_null,
                "duplicates": d1_dup,
            },
            "v2": {
                "rows": r2_len,
                "columns": len(df2.columns),
                "missing_cells": m2_null,
                "duplicates": d2_dup,
            },
            "deltas": {
                "row_change": r2_len - r1_len,
                "column_change": len(df2.columns) - len(df1.columns),
                "missing_cells_change": m2_null - m1_null,
                "duplicates_change": d2_dup - d1_dup,
            },
        },
        "schema_diff": {
            "added_columns": added_cols,
            "removed_columns": removed_cols,
            "type_changes": type_changes,
        },
        "numerical_column_stats": stats_comp,
    }


# ---------------------------------------------------------------------------
# GET /recommendations
# ---------------------------------------------------------------------------

@router.get("/recommendations")
async def get_chart_recommendations(
    dataset_id: str = Query(...),
    version_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Recommend best chart visualizations based on column data types."""
    df = _load_dataframe_for_version(version_id, current_user["id"])

    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    date_cols = [c for c in df.columns if "date" in c.lower() or "time" in c.lower() or pd.api.types.is_datetime64_any_dtype(df[c])]

    recommendations: List[Dict[str, Any]] = []

    # 1. Bar chart recommendation for categorical column
    if cat_cols:
        primary_cat = cat_cols[0]
        recommendations.append({
            "chart_type": "bar",
            "x_column": primary_cat,
            "y_column": num_cols[0] if num_cols else None,
            "reason": f"Category distribution and frequency for '{primary_cat}'",
            "priority": 1,
        })

    # 2. Histogram recommendation for numeric column
    if num_cols:
        primary_num = num_cols[0]
        recommendations.append({
            "chart_type": "histogram",
            "x_column": primary_num,
            "reason": f"Understand value spread and skewness of numeric feature '{primary_num}'",
            "priority": 2,
        })

    # 3. Scatter plot recommendation for 2 numeric columns
    if len(num_cols) >= 2:
        recommendations.append({
            "chart_type": "scatter",
            "x_column": num_cols[0],
            "y_column": num_cols[1],
            "reason": f"Explore potential correlation between '{num_cols[0]}' and '{num_cols[1]}'",
            "priority": 3,
        })

    # 4. Correlation heatmap
    if len(num_cols) >= 3:
        recommendations.append({
            "chart_type": "heatmap",
            "reason": f"Comprehensive multi-variable correlation across {len(num_cols)} numeric fields",
            "priority": 4,
        })

    # 5. Box plot for outlier identification
    if num_cols:
        recommendations.append({
            "chart_type": "box",
            "x_column": cat_cols[0] if cat_cols else None,
            "y_column": num_cols[0],
            "reason": f"Detect outliers and inspect quartile boundaries in '{num_cols[0]}'",
            "priority": 5,
        })

    return recommendations
