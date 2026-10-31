"""
Data cleaning operations.
Pure functions that operate on pandas DataFrames.
Each function returns: (cleaned_df, rows_affected, result_summary, warnings)
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

OperationResult = Tuple[pd.DataFrame, int, str, List[str]]


# ---------------------------------------------------------------------------
# 1. remove_duplicates
# ---------------------------------------------------------------------------

def remove_duplicates(
    df: pd.DataFrame,
    subset: Optional[List[str]] = None,
    keep: str = "first",
) -> OperationResult:
    """Remove duplicate rows."""
    warnings: List[str] = []
    original_len = len(df)

    if subset:
        missing_cols = [c for c in subset if c not in df.columns]
        if missing_cols:
            warnings.append(f"Columns not found and ignored: {missing_cols}")
            subset = [c for c in subset if c in df.columns]
        if not subset:
            return df.copy(), 0, "No valid columns specified; no rows removed.", warnings

    if keep not in {"first", "last", False}:
        warnings.append(f"Invalid keep='{keep}'; defaulting to 'first'.")
        keep = "first"

    cleaned = df.drop_duplicates(subset=subset or None, keep=keep).reset_index(drop=True)
    rows_affected = original_len - len(cleaned)
    summary = f"Removed {rows_affected} duplicate rows. {len(cleaned)} rows remain."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 2. drop_missing
# ---------------------------------------------------------------------------

def drop_missing(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
    thresh: Optional[int] = None,
) -> OperationResult:
    """Drop rows with missing values."""
    warnings: List[str] = []
    original_len = len(df)

    if columns:
        invalid = [c for c in columns if c not in df.columns]
        if invalid:
            warnings.append(f"Columns not found: {invalid}")
            columns = [c for c in columns if c in df.columns]

    kwargs: Dict[str, Any] = {}
    if columns:
        kwargs["subset"] = columns
    if thresh is not None:
        kwargs["thresh"] = thresh

    cleaned = df.dropna(**kwargs).reset_index(drop=True)
    rows_affected = original_len - len(cleaned)
    summary = f"Dropped {rows_affected} rows with missing values. {len(cleaned)} rows remain."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 3. fill_missing
# ---------------------------------------------------------------------------

def fill_missing(
    df: pd.DataFrame,
    columns: List[str],
    method: str,
    value: Any = None,
) -> OperationResult:
    """
    Fill missing values.
    Methods: 'mean', 'median', 'mode', 'constant', 'ffill', 'bfill'.
    """
    warnings: List[str] = []
    cleaned = df.copy()
    rows_affected = 0
    results: List[str] = []

    valid_methods = {"mean", "median", "mode", "constant", "ffill", "bfill"}
    if method not in valid_methods:
        return df.copy(), 0, f"Invalid method '{method}'. Must be one of {valid_methods}.", [f"Invalid method: {method}"]

    invalid = [c for c in columns if c not in df.columns]
    if invalid:
        warnings.append(f"Columns not found: {invalid}")
        columns = [c for c in columns if c in df.columns]

    for col in columns:
        missing_before = cleaned[col].isnull().sum()
        if missing_before == 0:
            results.append(f"Column '{col}': no missing values.")
            continue
        try:
            if method == "mean":
                if pd.api.types.is_numeric_dtype(cleaned[col]):
                    fill_val = cleaned[col].mean()
                    cleaned[col] = cleaned[col].fillna(fill_val)
                else:
                    warnings.append(f"Column '{col}' is not numeric; skipped mean fill.")
                    continue
            elif method == "median":
                if pd.api.types.is_numeric_dtype(cleaned[col]):
                    fill_val = cleaned[col].median()
                    cleaned[col] = cleaned[col].fillna(fill_val)
                else:
                    warnings.append(f"Column '{col}' is not numeric; skipped median fill.")
                    continue
            elif method == "mode":
                mode_vals = cleaned[col].mode()
                if mode_vals.empty:
                    warnings.append(f"Column '{col}': no mode found.")
                    continue
                cleaned[col] = cleaned[col].fillna(mode_vals.iloc[0])
            elif method == "constant":
                if value is None:
                    warnings.append(f"Column '{col}': constant fill requires a value.")
                    continue
                cleaned[col] = cleaned[col].fillna(value)
            elif method == "ffill":
                cleaned[col] = cleaned[col].ffill()
            elif method == "bfill":
                cleaned[col] = cleaned[col].bfill()
        except Exception as exc:
            warnings.append(f"Column '{col}': fill failed – {exc}")
            continue

        filled = missing_before - cleaned[col].isnull().sum()
        rows_affected += int(filled)
        results.append(f"Column '{col}': filled {filled} missing values with {method}.")

    summary = " ".join(results) if results else "No values filled."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 4. convert_dtype
# ---------------------------------------------------------------------------

def convert_dtype(
    df: pd.DataFrame,
    column: str,
    target_type: str,
) -> OperationResult:
    """Convert a column's data type."""
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]

    cleaned = df.copy()
    original_dtype = str(cleaned[column].dtype)
    rows_affected = 0

    type_map = {
        "int": "Int64",
        "float": "float64",
        "str": "string",
        "string": "string",
        "datetime": "datetime",
        "bool": "boolean",
    }

    if target_type not in type_map:
        return df.copy(), 0, f"Unknown target type '{target_type}'.", [f"Unknown type: {target_type}"]

    try:
        if target_type == "datetime":
            cleaned[column] = pd.to_datetime(cleaned[column], errors="coerce")
            coerced = cleaned[column].isnull().sum() - df[column].isnull().sum()
            if coerced > 0:
                warnings.append(f"{coerced} values could not be converted to datetime and became NaT.")
            rows_affected = len(cleaned) - int(cleaned[column].isnull().sum())
        elif target_type in {"int", "float"}:
            cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce").astype(type_map[target_type])
            coerced = cleaned[column].isnull().sum() - df[column].isnull().sum()
            if coerced > 0:
                warnings.append(f"{coerced} values could not be converted and became NaN.")
            rows_affected = len(cleaned)
        elif target_type == "bool":
            cleaned[column] = cleaned[column].astype("boolean")
            rows_affected = len(cleaned)
        else:
            cleaned[column] = cleaned[column].astype(type_map[target_type])
            rows_affected = len(cleaned)
    except Exception as exc:
        warnings.append(f"Conversion failed: {exc}")
        return df.copy(), 0, f"Failed to convert column '{column}': {exc}", warnings

    summary = f"Column '{column}' converted from {original_dtype} to {target_type}."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 5. standardize_text
# ---------------------------------------------------------------------------

def standardize_text(
    df: pd.DataFrame,
    column: str,
    case: str = "lower",
    strip: bool = True,
) -> OperationResult:
    """Standardize text column: change case and/or strip whitespace."""
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]

    cleaned = df.copy()
    if not pd.api.types.is_string_dtype(cleaned[column]) and not pd.api.types.is_object_dtype(cleaned[column]):
        warnings.append(f"Column '{column}' is not string type; converting first.")
        cleaned[column] = cleaned[column].astype(str)

    original = cleaned[column].copy()

    if strip:
        cleaned[column] = cleaned[column].str.strip()

    case_lower = case.lower()
    if case_lower == "lower":
        cleaned[column] = cleaned[column].str.lower()
    elif case_lower == "upper":
        cleaned[column] = cleaned[column].str.upper()
    elif case_lower == "title":
        cleaned[column] = cleaned[column].str.title()
    elif case_lower == "sentence":
        cleaned[column] = cleaned[column].str.capitalize()
    else:
        warnings.append(f"Unknown case '{case}'; no case transformation applied.")

    rows_affected = int((original != cleaned[column]).sum())
    summary = f"Standardized text in '{column}': case={case}, strip={strip}. {rows_affected} cells modified."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 6. rename_columns
# ---------------------------------------------------------------------------

def rename_columns(
    df: pd.DataFrame,
    mapping: Dict[str, str],
) -> OperationResult:
    """Rename columns according to mapping dict {old_name: new_name}."""
    warnings: List[str] = []
    invalid = {k: v for k, v in mapping.items() if k not in df.columns}
    if invalid:
        warnings.append(f"Columns not found and skipped: {list(invalid.keys())}")
    valid_mapping = {k: v for k, v in mapping.items() if k in df.columns}

    if not valid_mapping:
        return df.copy(), 0, "No valid columns to rename.", warnings

    cleaned = df.rename(columns=valid_mapping)
    rows_affected = len(df)
    summary = f"Renamed {len(valid_mapping)} column(s): {valid_mapping}."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 7. drop_columns
# ---------------------------------------------------------------------------

def drop_columns(
    df: pd.DataFrame,
    columns: List[str],
) -> OperationResult:
    """Drop specified columns."""
    warnings: List[str] = []
    invalid = [c for c in columns if c not in df.columns]
    if invalid:
        warnings.append(f"Columns not found: {invalid}")
    valid = [c for c in columns if c in df.columns]

    if not valid:
        return df.copy(), 0, "No valid columns to drop.", warnings

    cleaned = df.drop(columns=valid)
    summary = f"Dropped columns: {valid}."
    return cleaned, len(df), summary, warnings


# ---------------------------------------------------------------------------
# 8. filter_rows
# ---------------------------------------------------------------------------

def filter_rows(
    df: pd.DataFrame,
    column: str,
    operator: str,
    value: Any,
) -> OperationResult:
    """
    Filter rows by a condition.
    Operators: '==', '!=', '>', '>=', '<', '<=', 'contains', 'startswith', 'endswith', 'isnull', 'notnull'.
    """
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]

    original_len = len(df)
    try:
        col = df[column]
        if operator == "==":
            mask = col == value
        elif operator == "!=":
            mask = col != value
        elif operator == ">":
            mask = col > value
        elif operator == ">=":
            mask = col >= value
        elif operator == "<":
            mask = col < value
        elif operator == "<=":
            mask = col <= value
        elif operator == "contains":
            mask = col.astype(str).str.contains(str(value), na=False)
        elif operator == "startswith":
            mask = col.astype(str).str.startswith(str(value), na=False)
        elif operator == "endswith":
            mask = col.astype(str).str.endswith(str(value), na=False)
        elif operator == "isnull":
            mask = col.isnull()
        elif operator == "notnull":
            mask = col.notnull()
        else:
            return df.copy(), 0, f"Unknown operator '{operator}'.", [f"Unknown operator: {operator}"]
    except Exception as exc:
        warnings.append(f"Filter failed: {exc}")
        return df.copy(), 0, f"Filter failed: {exc}", warnings

    cleaned = df[mask].reset_index(drop=True)
    rows_removed = original_len - len(cleaned)
    summary = f"Filtered rows: {len(cleaned)} kept, {rows_removed} removed. Condition: {column} {operator} {value}."
    return cleaned, rows_removed, summary, warnings


# ---------------------------------------------------------------------------
# 9. create_derived_column
# ---------------------------------------------------------------------------

def create_derived_column(
    df: pd.DataFrame,
    new_col: str,
    expression: str,
    source_cols: List[str],
) -> OperationResult:
    """
    Create a new derived column by evaluating a pandas expression.
    The expression is evaluated in a restricted namespace of source columns.
    """
    warnings: List[str] = []
    invalid = [c for c in source_cols if c not in df.columns]
    if invalid:
        warnings.append(f"Source columns not found: {invalid}")

    # Build safe local namespace
    local_ns = {col: df[col] for col in source_cols if col in df.columns}
    local_ns["pd"] = pd
    local_ns["np"] = np

    try:
        cleaned = df.copy()
        cleaned[new_col] = eval(expression, {"__builtins__": {}}, local_ns)  # noqa: S307
        rows_affected = len(cleaned)
        summary = f"Created derived column '{new_col}' from expression: {expression}."
    except Exception as exc:
        warnings.append(f"Expression evaluation failed: {exc}")
        return df.copy(), 0, f"Failed to create column '{new_col}': {exc}", warnings

    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 10. bin_column
# ---------------------------------------------------------------------------

def bin_column(
    df: pd.DataFrame,
    column: str,
    bins: int,
    labels: Optional[List[str]] = None,
    strategy: str = "equal_width",
) -> OperationResult:
    """Bin a numerical column into discrete intervals."""
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]
    if not pd.api.types.is_numeric_dtype(df[column]):
        return df.copy(), 0, f"Column '{column}' is not numeric.", [f"Column '{column}' must be numeric."]

    cleaned = df.copy()
    new_col = f"{column}_bin"
    try:
        if strategy == "equal_width":
            cleaned[new_col] = pd.cut(cleaned[column], bins=bins, labels=labels)
        elif strategy == "quantile":
            cleaned[new_col] = pd.qcut(cleaned[column], q=bins, labels=labels, duplicates="drop")
        else:
            warnings.append(f"Unknown strategy '{strategy}'; using equal_width.")
            cleaned[new_col] = pd.cut(cleaned[column], bins=bins, labels=labels)
    except Exception as exc:
        warnings.append(f"Binning failed: {exc}")
        return df.copy(), 0, f"Failed to bin column '{column}': {exc}", warnings

    rows_affected = cleaned[new_col].notna().sum()
    summary = f"Binned '{column}' into {bins} bins (strategy={strategy}). New column: '{new_col}'."
    return cleaned, int(rows_affected), summary, warnings


# ---------------------------------------------------------------------------
# 11. detect_outliers
# ---------------------------------------------------------------------------

def detect_outliers(
    df: pd.DataFrame,
    column: str,
    method: str = "iqr",
    threshold: float = 1.5,
) -> OperationResult:
    """
    Detect and flag outliers. Adds a boolean column '{column}_is_outlier'.
    Methods: 'iqr', 'zscore'.
    """
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]
    if not pd.api.types.is_numeric_dtype(df[column]):
        return df.copy(), 0, f"Column '{column}' is not numeric.", [f"Column '{column}' must be numeric."]

    cleaned = df.copy()
    flag_col = f"{column}_is_outlier"
    series = cleaned[column].dropna()

    try:
        if method == "iqr":
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            lower = q1 - threshold * iqr
            upper = q3 + threshold * iqr
            cleaned[flag_col] = ~cleaned[column].between(lower, upper) & cleaned[column].notna()
        elif method == "zscore":
            from scipy import stats as scipy_stats
            z_scores = np.abs(scipy_stats.zscore(series))
            outlier_indices = series[z_scores > threshold].index
            cleaned[flag_col] = cleaned.index.isin(outlier_indices)
        else:
            warnings.append(f"Unknown method '{method}'; using iqr.")
            return detect_outliers(df, column, "iqr", threshold)
    except Exception as exc:
        warnings.append(f"Outlier detection failed: {exc}")
        return df.copy(), 0, f"Failed to detect outliers in '{column}': {exc}", warnings

    rows_affected = int(cleaned[flag_col].sum())
    summary = f"Detected {rows_affected} outliers in '{column}' using {method} (threshold={threshold}). Flagged in '{flag_col}'."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 12. standardize_dates
# ---------------------------------------------------------------------------

def standardize_dates(
    df: pd.DataFrame,
    column: str,
    format: Optional[str] = None,
) -> OperationResult:
    """Parse and standardize a datetime column."""
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]

    cleaned = df.copy()
    kwargs: Dict[str, Any] = {"errors": "coerce"}
    if format:
        kwargs["format"] = format

    cleaned[column] = pd.to_datetime(cleaned[column], **kwargs)
    coerced = int(cleaned[column].isnull().sum() - df[column].isnull().sum())
    if coerced > 0:
        warnings.append(f"{coerced} values could not be parsed and became NaT.")

    rows_affected = int(cleaned[column].notna().sum())
    summary = f"Standardized datetime column '{column}'. {rows_affected} values parsed successfully."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 13. trim_whitespace
# ---------------------------------------------------------------------------

def trim_whitespace(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
) -> OperationResult:
    """Trim leading/trailing whitespace from string columns."""
    warnings: List[str] = []
    cleaned = df.copy()
    rows_affected = 0

    target_cols = columns if columns else df.columns.tolist()
    invalid = [c for c in target_cols if c not in df.columns]
    if invalid:
        warnings.append(f"Columns not found: {invalid}")
    target_cols = [c for c in target_cols if c in df.columns]

    for col in target_cols:
        if pd.api.types.is_string_dtype(cleaned[col]) or pd.api.types.is_object_dtype(cleaned[col]):
            before = cleaned[col].copy()
            cleaned[col] = cleaned[col].str.strip()
            changed = int((before != cleaned[col]).sum())
            rows_affected += changed

    summary = f"Trimmed whitespace in {len(target_cols)} column(s). {rows_affected} cells modified."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 14. replace_values
# ---------------------------------------------------------------------------

def replace_values(
    df: pd.DataFrame,
    column: str,
    mapping: Dict[Any, Any],
) -> OperationResult:
    """Replace specific values in a column using a mapping dict."""
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]

    cleaned = df.copy()
    before = cleaned[column].copy()
    cleaned[column] = cleaned[column].replace(mapping)
    rows_affected = int((before != cleaned[column]).sum())
    summary = f"Replaced values in '{column}'. {rows_affected} cells updated."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# 15. keep_columns
# ---------------------------------------------------------------------------

def keep_columns(
    df: pd.DataFrame,
    columns: List[str],
) -> OperationResult:
    """Keep only the specified columns, drop all others."""
    warnings: List[str] = []
    invalid = [c for c in columns if c not in df.columns]
    if invalid:
        warnings.append(f"Columns not found: {invalid}")
    valid = [c for c in columns if c in df.columns]

    if not valid:
        return df.copy(), 0, "No valid columns specified.", warnings

    cleaned = df[valid]
    dropped = [c for c in df.columns if c not in valid]
    summary = f"Kept {len(valid)} column(s). Dropped: {dropped}."
    return cleaned, len(df), summary, warnings


# ---------------------------------------------------------------------------
# 16. validate_values
# ---------------------------------------------------------------------------

def validate_values(
    df: pd.DataFrame,
    column: str,
    rules: Dict[str, Any],
) -> OperationResult:
    """
    Flag rows that violate validation rules.
    Rules dict may contain: min, max, regex, not_null.
    Adds a boolean column '{column}_invalid'.
    """
    warnings: List[str] = []
    if column not in df.columns:
        return df.copy(), 0, f"Column '{column}' not found.", [f"Column '{column}' not found."]

    cleaned = df.copy()
    flag_col = f"{column}_invalid"
    invalid_mask = pd.Series([False] * len(df), index=df.index)

    try:
        if rules.get("not_null"):
            invalid_mask |= cleaned[column].isnull()

        if "min" in rules:
            try:
                invalid_mask |= pd.to_numeric(cleaned[column], errors="coerce") < rules["min"]
            except Exception as exc:
                warnings.append(f"min rule failed: {exc}")

        if "max" in rules:
            try:
                invalid_mask |= pd.to_numeric(cleaned[column], errors="coerce") > rules["max"]
            except Exception as exc:
                warnings.append(f"max rule failed: {exc}")

        if "regex" in rules:
            pattern = str(rules["regex"])
            try:
                invalid_mask |= ~cleaned[column].astype(str).str.match(pattern, na=True)
            except Exception as exc:
                warnings.append(f"regex rule failed: {exc}")

        cleaned[flag_col] = invalid_mask
    except Exception as exc:
        warnings.append(f"Validation failed: {exc}")
        return df.copy(), 0, f"Validation failed: {exc}", warnings

    rows_affected = int(invalid_mask.sum())
    summary = f"Validated '{column}' with rules {rules}. {rows_affected} invalid values flagged in '{flag_col}'."
    return cleaned, rows_affected, summary, warnings


# ---------------------------------------------------------------------------
# Operation dispatcher
# ---------------------------------------------------------------------------

OPERATION_MAP = {
    "remove_duplicates": remove_duplicates,
    "drop_missing": drop_missing,
    "fill_missing": fill_missing,
    "convert_dtype": convert_dtype,
    "standardize_text": standardize_text,
    "rename_columns": rename_columns,
    "drop_columns": drop_columns,
    "filter_rows": filter_rows,
    "create_derived_column": create_derived_column,
    "bin_column": bin_column,
    "detect_outliers": detect_outliers,
    "standardize_dates": standardize_dates,
    "trim_whitespace": trim_whitespace,
    "replace_values": replace_values,
    "keep_columns": keep_columns,
    "validate_values": validate_values,
}


def apply_operation(
    df: pd.DataFrame,
    operation_type: str,
    parameters: Dict[str, Any],
) -> OperationResult:
    """Dispatch an operation by name with the given parameters."""
    fn = OPERATION_MAP.get(operation_type)
    if fn is None:
        return df.copy(), 0, f"Unknown operation: {operation_type}", [f"Unknown operation: {operation_type}"]
    try:
        return fn(df, **parameters)
    except TypeError as exc:
        return df.copy(), 0, f"Invalid parameters for '{operation_type}': {exc}", [str(exc)]
    except Exception as exc:
        logger.exception("Operation '%s' raised an unexpected error.", operation_type)
        return df.copy(), 0, f"Operation '{operation_type}' failed: {exc}", [str(exc)]
