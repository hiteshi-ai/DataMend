"""
Unit tests for DataMend NLP prompt interpreter.
Verifies keyword-based and heuristic rule interpretation of natural-language cleaning commands.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import pandas as pd
from processing.nlp_interpreter import interpret_with_rules


def test_interpret_remove_duplicates():
    df = pd.DataFrame({"id": [1, 1], "name": ["a", "a"]})
    plan = interpret_with_rules("Please remove all duplicate rows from this dataset", list(df.columns))
    op_types = [op["operation_type"] for op in plan["operations"]]
    assert "remove_duplicates" in op_types
    assert len(plan["operations"]) >= 1


def test_interpret_fill_missing():
    df = pd.DataFrame({"age": [20, None, 40], "salary": [50000, 60000, None]})
    plan = interpret_with_rules("Fill missing values using median for numerical columns", list(df.columns))
    op_types = [op["operation_type"] for op in plan["operations"]]
    assert "fill_missing" in op_types


def test_interpret_trim_whitespace():
    df = pd.DataFrame({"name": [" Alice "]})
    plan = interpret_with_rules("Trim all leading and trailing whitespace from text fields", list(df.columns))
    op_types = [op["operation_type"] for op in plan["operations"]]
    assert "trim_whitespace" in op_types


def test_interpret_detect_outliers():
    df = pd.DataFrame({"salary": [1000, 2000, 100000]})
    plan = interpret_with_rules("Detect outliers in salary", list(df.columns))
    op_types = [op["operation_type"] for op in plan["operations"]]
    assert "detect_outliers" in op_types


if __name__ == "__main__":
    print("Running NLP interpreter tests...")
    test_interpret_remove_duplicates()
    test_interpret_fill_missing()
    test_interpret_trim_whitespace()
    test_interpret_detect_outliers()
    print("All NLP interpreter tests PASSED successfully!")
