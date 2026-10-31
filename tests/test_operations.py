"""
Unit tests for DataMend data-cleaning operations.
Tests pure functions that operate on pandas DataFrames without external side-effects.
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import numpy as np
import pandas as pd

from processing.operations import (
    remove_duplicates,
    drop_missing,
    fill_missing,
    convert_dtype,
    standardize_text,
    trim_whitespace,
    filter_rows,
    rename_columns,
    bin_column,
    detect_outliers,
)


def test_remove_duplicates():
    df = pd.DataFrame({
        "id": [1, 2, 2, 3],
        "name": ["Alice", "Bob", "Bob", "Charlie"],
    })
    cleaned, affected, summary, warnings = remove_duplicates(df)
    assert len(cleaned) == 3
    assert affected == 1
    assert "1" in summary


def test_drop_missing():
    df = pd.DataFrame({
        "a": [1.0, 2.0, np.nan, 4.0],
        "b": ["x", "y", "z", None],
    })
    cleaned, affected, summary, warnings = drop_missing(df)
    assert len(cleaned) == 2
    assert affected == 2


def test_fill_missing_median():
    df = pd.DataFrame({
        "val": [10.0, 20.0, np.nan, 30.0],
    })
    cleaned, affected, summary, warnings = fill_missing(df, columns=["val"], method="median")
    assert cleaned["val"].isnull().sum() == 0
    assert cleaned.loc[2, "val"] == 20.0
    assert affected == 1


def test_fill_missing_mean():
    df = pd.DataFrame({
        "val": [10.0, 20.0, np.nan, 30.0],
    })
    cleaned, affected, summary, warnings = fill_missing(df, columns=["val"], method="mean")
    assert cleaned["val"].isnull().sum() == 0
    assert cleaned.loc[2, "val"] == 20.0


def test_trim_whitespace():
    df = pd.DataFrame({
        "name": ["  Alice ", "Bob\t", " Charlie  "],
    })
    cleaned, affected, summary, warnings = trim_whitespace(df, columns=["name"])
    assert cleaned["name"].tolist() == ["Alice", "Bob", "Charlie"]


def test_filter_rows():
    df = pd.DataFrame({
        "year": [2023, 2024, 2025, 2025],
        "val": [1, 2, 3, 4],
    })
    cleaned, affected, summary, warnings = filter_rows(df, column="year", operator="==", value=2025)
    assert len(cleaned) == 2
    assert affected == 2


def test_rename_columns():
    df = pd.DataFrame({"old_col": [1, 2, 3]})
    cleaned, affected, summary, warnings = rename_columns(df, mapping={"old_col": "new_col"})
    assert "new_col" in cleaned.columns
    assert "old_col" not in cleaned.columns


def test_detect_outliers():
    df = pd.DataFrame({
        "salary": [30000, 32000, 31000, 33000, 32500, 300000],  # 300000 is an outlier
    })
    cleaned, affected, summary, warnings = detect_outliers(df, column="salary", method="iqr")
    assert "salary_is_outlier" in cleaned.columns
    assert cleaned["salary_is_outlier"].sum() >= 1


if __name__ == "__main__":
    print("Running operations tests...")
    test_remove_duplicates()
    test_drop_missing()
    test_fill_missing_median()
    test_fill_missing_mean()
    test_trim_whitespace()
    test_filter_rows()
    test_rename_columns()
    test_detect_outliers()
    print("All operations tests PASSED successfully!")
