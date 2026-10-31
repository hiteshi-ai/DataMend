"""
Unit tests for DataMend data quality assessment and profile comparison.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import numpy as np
import pandas as pd
from processing.quality import compute_quality_profile, compare_quality_profiles


def test_quality_profile():
    df = pd.DataFrame({
        "id": [1, 2, 2, 4],
        "name": ["Alice", "Bob", "Bob", None],
        "age": [25, 30, 30, np.nan],
    })

    profile = compute_quality_profile(df)

    assert profile["total_rows"] == 4
    assert profile["total_cols"] == 3
    assert profile["duplicate_rows"] == 1
    assert profile["missing_cells"] == 2
    assert "columns" in profile
    assert profile["columns"]["name"]["missing_count"] == 1
    assert profile["columns"]["age"]["missing_count"] == 1


def test_compare_quality_profiles():
    df_raw = pd.DataFrame({
        "id": [1, 2, 2, 4],
        "name": ["Alice", "Bob", "Bob", None],
    })
    df_clean = pd.DataFrame({
        "id": [1, 2, 4],
        "name": ["Alice", "Bob", "Unknown"],
    })

    p_raw = compute_quality_profile(df_raw)
    p_clean = compute_quality_profile(df_clean)

    diff = compare_quality_profiles(p_raw, p_clean)

    assert diff["total_rows"]["delta"] == -1.0
    assert diff["duplicate_rows"]["delta"] == -1.0
    assert diff["missing_cells"]["delta"] == -1.0


if __name__ == "__main__":
    print("Running quality profile tests...")
    test_quality_profile()
    test_compare_quality_profiles()
    print("All quality profile tests PASSED successfully!")
