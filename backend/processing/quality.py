"""
Quality profile helpers.
Compute per-column and whole-dataset quality metrics from a DataFrame.
"""
from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd


def compute_quality_profile(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Return a comprehensive quality profile for a DataFrame.

    Keys returned:
    - total_rows, total_cols
    - missing_cells, missing_pct
    - duplicate_rows, duplicate_pct
    - columns: dict of per-column stats
    """
    total_rows = len(df)
    total_cols = len(df.columns)
    missing_cells = int(df.isnull().sum().sum())
    total_cells = total_rows * total_cols
    missing_pct = round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0.0
    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = round(duplicate_rows / total_rows * 100, 2) if total_rows > 0 else 0.0

    columns: Dict[str, Any] = {}
    for col in df.columns:
        series = df[col]
        missing_count = int(series.isnull().sum())
        col_missing_pct = round(missing_count / total_rows * 100, 2) if total_rows > 0 else 0.0
        unique_count = int(series.nunique(dropna=True))

        # Safe sample values
        sample_values: List[Any] = []
        try:
            sample_values = [
                v if not (isinstance(v, float) and np.isnan(v)) else None
                for v in series.dropna().head(5).tolist()
            ]
        except Exception:
            pass

        col_stats: Dict[str, Any] = {
            "dtype": str(series.dtype),
            "missing_count": missing_count,
            "missing_pct": col_missing_pct,
            "unique_count": unique_count,
            "sample_values": sample_values,
        }

        # Numeric stats
        if pd.api.types.is_numeric_dtype(series):
            described = series.describe()
            col_stats.update({
                "min": _safe_float(described.get("min")),
                "max": _safe_float(described.get("max")),
                "mean": _safe_float(described.get("mean")),
                "std": _safe_float(described.get("std")),
                "q25": _safe_float(described.get("25%")),
                "q50": _safe_float(described.get("50%")),
                "q75": _safe_float(described.get("75%")),
            })

        # Categorical stats (value_counts for low-cardinality)
        if (
            pd.api.types.is_object_dtype(series)
            or pd.api.types.is_string_dtype(series)
            or pd.api.types.is_categorical_dtype(series)
        ):
            if unique_count <= 50:
                col_stats["value_counts"] = series.value_counts().head(20).to_dict()

        columns[col] = col_stats

    return {
        "total_rows": total_rows,
        "total_cols": total_cols,
        "missing_cells": missing_cells,
        "missing_pct": missing_pct,
        "duplicate_rows": duplicate_rows,
        "duplicate_pct": duplicate_pct,
        "columns": columns,
    }


def compare_quality_profiles(
    profile1: Dict[str, Any],
    profile2: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compare two quality profiles and return a diff dict.
    Useful for before/after comparison of a cleaning operation.
    """
    scalar_keys = [
        "total_rows", "total_cols", "missing_cells", "missing_pct",
        "duplicate_rows", "duplicate_pct",
    ]
    diff: Dict[str, Any] = {}

    for key in scalar_keys:
        v1 = profile1.get(key, 0)
        v2 = profile2.get(key, 0)
        try:
            delta = round(float(v2) - float(v1), 4)
        except (TypeError, ValueError):
            delta = None
        diff[key] = {"before": v1, "after": v2, "delta": delta}

    # Per-column diff
    cols1: Dict[str, Any] = profile1.get("columns", {})
    cols2: Dict[str, Any] = profile2.get("columns", {})
    all_cols = set(cols1) | set(cols2)
    col_diffs: Dict[str, Any] = {}
    for col in all_cols:
        c1 = cols1.get(col, {})
        c2 = cols2.get(col, {})
        col_diffs[col] = {
            "missing_count": {
                "before": c1.get("missing_count"),
                "after": c2.get("missing_count"),
            },
            "missing_pct": {
                "before": c1.get("missing_pct"),
                "after": c2.get("missing_pct"),
            },
            "unique_count": {
                "before": c1.get("unique_count"),
                "after": c2.get("unique_count"),
            },
            "dtype": {
                "before": c1.get("dtype"),
                "after": c2.get("dtype"),
            },
            "added": col not in cols1,
            "removed": col not in cols2,
        }

    diff["columns"] = col_diffs
    return diff


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(value) -> Any:
    """Convert to float, replacing NaN/inf with None."""
    try:
        f = float(value)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 6)
    except (TypeError, ValueError):
        return None
