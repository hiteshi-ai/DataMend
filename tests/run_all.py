"""
DataMend Test Suite Runner.
Runs all automated unit and integration tests across data processing, NLP interpretation,
and quality profiling.
"""
import subprocess
import sys
from pathlib import Path

PYTHON_EXE = sys.executable

TEST_FILES = [
    "test_operations.py",
    "test_nlp_interpreter.py",
    "test_quality.py",
]

def run_tests():
    tests_dir = Path(__file__).resolve().parent
    passed = 0
    failed = 0

    print("==================================================")
    print("           DATAMEND AUTOMATED TEST SUITE          ")
    print("==================================================")

    for test_file in TEST_FILES:
        file_path = tests_dir / test_file
        print(f"\n>> Executing: {test_file} ...")
        res = subprocess.run([PYTHON_EXE, str(file_path)])
        if res.returncode == 0:
            passed += 1
            print(f"[PASS] {test_file}")
        else:
            failed += 1
            print(f"[FAIL] {test_file}")

    print("\n--------------------------------------------------")
    print(f"Total: {len(TEST_FILES)} | Passed: {passed} | Failed: {failed}")
    print("--------------------------------------------------")

    if failed > 0:
        sys.exit(1)
    else:
        print("ALL TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
