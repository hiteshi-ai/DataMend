"""
Rule-based NLP interpreter for data-cleaning prompts.
Maps natural-language text to structured operation plans.
Optionally delegates to OpenAI when a key is configured.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Plan schema
# ---------------------------------------------------------------------------

OperationPlan = Dict[str, Any]
Plan = Dict[str, Any]


def _make_operation(
    operation_type: str,
    parameters: Dict[str, Any],
    affected_columns: List[str],
    description: str,
    warnings: Optional[List[str]] = None,
) -> OperationPlan:
    return {
        "operation_type": operation_type,
        "parameters": parameters,
        "affected_columns": affected_columns,
        "description": description,
        "warnings": warnings or [],
    }


def _make_plan(
    objective: str,
    operations: List[OperationPlan],
    assumptions: Optional[List[str]] = None,
    warnings: Optional[List[str]] = None,
    estimated_impact: str = "Unknown",
) -> Plan:
    return {
        "objective": objective,
        "operations": operations,
        "assumptions": assumptions or [],
        "warnings": warnings or [],
        "estimated_impact": estimated_impact,
    }


# ---------------------------------------------------------------------------
# Keyword patterns
# ---------------------------------------------------------------------------

_RULES: List[Dict[str, Any]] = [
    {
        "patterns": [r"\bduplicates?\b"],
        "intent": "remove_duplicates",
    },
    {
        "patterns": [r"\bclean\b", r"\bprepare\b", r"\bpreprocess\b"],
        "intent": "clean_bundle",
    },
    {
        "patterns": [r"\boutliers?\b"],
        "intent": "detect_outliers",
    },
    {
        "patterns": [r"\btrim\b", r"\bwhitespace\b", r"\bstrip\b"],
        "intent": "trim_whitespace",
    },
    {
        "patterns": [r"\blowercase\b", r"\buppercase\b", r"\bnormalize\b", r"\bstandardize\b"],
        "intent": "standardize_text",
    },
    {
        "patterns": [r"\bdate\b", r"\bdatetime\b", r"\btimestamp\b"],
        "intent": "standardize_dates",
    },
    {
        "patterns": [r"\bconvert\b", r"\bchange\s+type\b", r"\bformat\b"],
        "intent": "convert_dtype",
    },
    {
        "patterns": [r"\bfilter\b", r"\bkeep\s+only\b", r"\bwhere\b"],
        "intent": "filter_rows",
    },
    {
        "patterns": [r"\brename\b"],
        "intent": "rename_columns",
    },
    {
        "patterns": [r"\bdrop\s+column\b", r"\bremove\s+column\b", r"\bdelete\s+column\b"],
        "intent": "drop_columns",
    },
    {
        "patterns": [r"\bbin\b", r"\bbucket\b", r"\bgroup\s+by\s+range\b"],
        "intent": "bin_column",
    },
    {
        "patterns": [r"\bcreate\s+column\b", r"\badd\s+column\b", r"\bderive\b", r"\bnew\s+column\b"],
        "intent": "create_derived_column",
    },
    # Missing-value patterns – check fill before drop
    {
        "patterns": [r"\bfill\b.*\b(missing|null|empty|nan|na)\b", r"\b(missing|null|empty|nan|na)\b.*\bfill\b", r"\bimpute\b"],
        "intent": "fill_missing",
    },
    {
        "patterns": [r"\bdrop\b.*\b(missing|null|empty|nan|na)\b", r"\bremove\b.*\b(missing|null|empty|nan|na)\b"],
        "intent": "drop_missing",
    },
    {
        "patterns": [r"\b(missing|null|empty|nan|na)\b"],
        "intent": "fill_missing",  # default for generic missing mention
    },
]

# Column extraction helpers
_COL_PATTERN = re.compile(r"column[s]?\s+['\"]?([a-zA-Z0-9_,\s]+)['\"]?", re.IGNORECASE)
_IN_PATTERN = re.compile(r"\bin\s+['\"]?([a-zA-Z0-9_]+)['\"]?", re.IGNORECASE)


def _extract_columns(prompt: str) -> List[str]:
    """Extract column names mentioned in the prompt (best-effort)."""
    cols: List[str] = []
    m = _COL_PATTERN.search(prompt)
    if m:
        raw = m.group(1)
        cols = [c.strip() for c in raw.split(",") if c.strip()]
    if not cols:
        m2 = _IN_PATTERN.search(prompt)
        if m2:
            cols = [m2.group(1).strip()]
    return cols


def _match_intents(prompt: str) -> List[str]:
    """Return a list of matched intents from the prompt."""
    text = prompt.lower()
    matched: List[str] = []
    seen: set = set()
    for rule in _RULES:
        for pattern in rule["patterns"]:
            if re.search(pattern, text):
                intent = rule["intent"]
                if intent not in seen:
                    matched.append(intent)
                    seen.add(intent)
                break
    return matched


def _build_operations_from_intents(
    intents: List[str],
    columns: List[str],
    prompt: str,
) -> List[OperationPlan]:
    """Convert detected intents into OperationPlan dicts."""
    ops: List[OperationPlan] = []
    text = prompt.lower()

    for intent in intents:
        if intent == "remove_duplicates":
            ops.append(_make_operation(
                "remove_duplicates",
                {"subset": columns or None, "keep": "first"},
                columns,
                "Remove duplicate rows" + (f" based on columns: {columns}" if columns else "."),
            ))

        elif intent == "clean_bundle":
            ops.extend([
                _make_operation(
                    "remove_duplicates",
                    {"keep": "first"},
                    [],
                    "Remove all duplicate rows.",
                ),
                _make_operation(
                    "fill_missing",
                    {"columns": columns or [], "method": "mode"},
                    columns,
                    "Fill missing values with column mode.",
                ),
                _make_operation(
                    "trim_whitespace",
                    {"columns": columns or None},
                    columns,
                    "Trim leading/trailing whitespace from text columns.",
                ),
            ])

        elif intent == "detect_outliers":
            target_col = columns[0] if columns else ""
            ops.append(_make_operation(
                "detect_outliers",
                {"column": target_col, "method": "iqr", "threshold": 1.5},
                [target_col] if target_col else [],
                f"Detect outliers in '{target_col or '<column>'}' using IQR method.",
                warnings=[] if target_col else ["No target column detected; please specify."],
            ))

        elif intent == "trim_whitespace":
            ops.append(_make_operation(
                "trim_whitespace",
                {"columns": columns or None},
                columns,
                "Trim whitespace from " + (f"columns: {columns}" if columns else "all text columns."),
            ))

        elif intent == "standardize_text":
            case = "lower"
            if "uppercase" in text:
                case = "upper"
            target_col = columns[0] if columns else ""
            ops.append(_make_operation(
                "standardize_text",
                {"column": target_col, "case": case, "strip": True},
                [target_col] if target_col else [],
                f"Standardize text in '{target_col or '<column>'}' to {case}case.",
                warnings=[] if target_col else ["No target column detected; please specify."],
            ))

        elif intent == "standardize_dates":
            target_col = columns[0] if columns else ""
            ops.append(_make_operation(
                "standardize_dates",
                {"column": target_col},
                [target_col] if target_col else [],
                f"Parse and standardize datetime values in '{target_col or '<column>'}'.",
                warnings=[] if target_col else ["No target column detected; please specify."],
            ))

        elif intent == "convert_dtype":
            target_col = columns[0] if columns else ""
            target_type = "float"
            for t in ["int", "float", "str", "string", "datetime", "bool"]:
                if t in text:
                    target_type = t
                    break
            ops.append(_make_operation(
                "convert_dtype",
                {"column": target_col, "target_type": target_type},
                [target_col] if target_col else [],
                f"Convert column '{target_col or '<column>'}' to {target_type}.",
                warnings=[] if target_col else ["No target column detected; please specify."],
            ))

        elif intent == "filter_rows":
            ops.append(_make_operation(
                "filter_rows",
                {"column": columns[0] if columns else "", "operator": "notnull", "value": None},
                columns,
                "Filter rows based on condition (review and adjust parameters).",
                warnings=["Operator and value need manual review."],
            ))

        elif intent == "rename_columns":
            ops.append(_make_operation(
                "rename_columns",
                {"mapping": {}},
                columns,
                "Rename columns (provide mapping of old→new names).",
                warnings=["Column rename mapping must be specified manually."],
            ))

        elif intent == "drop_columns":
            ops.append(_make_operation(
                "drop_columns",
                {"columns": columns},
                columns,
                f"Drop columns: {columns}." if columns else "Drop specified columns.",
                warnings=[] if columns else ["No columns detected; please specify."],
            ))

        elif intent == "bin_column":
            target_col = columns[0] if columns else ""
            ops.append(_make_operation(
                "bin_column",
                {"column": target_col, "bins": 5, "strategy": "equal_width"},
                [target_col] if target_col else [],
                f"Bin numeric column '{target_col or '<column>'}' into 5 equal-width bins.",
                warnings=[] if target_col else ["No target column detected; please specify."],
            ))

        elif intent == "create_derived_column":
            ops.append(_make_operation(
                "create_derived_column",
                {"new_col": "derived_column", "expression": "", "source_cols": columns},
                columns,
                "Create a new derived column (provide expression).",
                warnings=["Expression must be specified manually."],
            ))

        elif intent == "fill_missing":
            method = "mode"
            for m in ["mean", "median", "mode", "ffill", "bfill", "constant"]:
                if m in text:
                    method = m
                    break
            ops.append(_make_operation(
                "fill_missing",
                {"columns": columns or [], "method": method},
                columns,
                "Fill missing values" + (f" in {columns}" if columns else "") + f" using {method}.",
                warnings=["Specify columns if you want targeted filling."] if not columns else [],
            ))

        elif intent == "drop_missing":
            ops.append(_make_operation(
                "drop_missing",
                {"columns": columns or None},
                columns,
                "Drop rows with missing values" + (f" in {columns}" if columns else "."),
            ))

    return ops


# ---------------------------------------------------------------------------
# Rule-based interpreter
# ---------------------------------------------------------------------------

def interpret_with_rules(prompt: str, column_names: Optional[List[str]] = None) -> Plan:
    """Produce a cleaning plan from a natural-language prompt using rules only."""
    intents = _match_intents(prompt)
    columns = _extract_columns(prompt)

    # Cross-reference extracted columns against dataset columns
    if column_names and columns:
        columns = [c for c in columns if c in column_names]

    if not intents:
        return _make_plan(
            objective=prompt,
            operations=[],
            warnings=["Could not identify any cleaning operations from the prompt. Please be more specific."],
            estimated_impact="No operations to apply.",
        )

    operations = _build_operations_from_intents(intents, columns, prompt)
    n_ops = len(operations)
    estimated_impact = f"Will apply {n_ops} operation(s)."

    return _make_plan(
        objective=prompt,
        operations=operations,
        assumptions=[
            "Column names were inferred from the prompt text.",
            "Default parameters are used; review before executing.",
        ],
        estimated_impact=estimated_impact,
    )


# ---------------------------------------------------------------------------
# OpenAI fallback
# ---------------------------------------------------------------------------

async def interpret_with_openai(
    prompt: str,
    column_names: Optional[List[str]] = None,
) -> Optional[Plan]:
    """
    Attempt to resolve the prompt using OpenAI's API.
    Returns None on failure so the caller can fall back to rules.
    """
    if not settings.OPENAI_API_KEY:
        return None

    try:
        import httpx

        system_msg = (
            "You are a data cleaning assistant. Given a user prompt about cleaning a dataset, "
            "return a JSON object matching this schema:\n"
            "{\n"
            '  "objective": "string",\n'
            '  "operations": [\n'
            '    {\n'
            '      "operation_type": "one of [remove_duplicates, drop_missing, fill_missing, '
            "convert_dtype, standardize_text, rename_columns, drop_columns, filter_rows, "
            "create_derived_column, bin_column, detect_outliers, standardize_dates, "
            'trim_whitespace, replace_values, keep_columns, validate_values]",\n'
            '      "parameters": {},\n'
            '      "affected_columns": [],\n'
            '      "description": "string",\n'
            '      "warnings": []\n'
            "    }\n"
            "  ],\n"
            '  "assumptions": [],\n'
            '  "warnings": [],\n'
            '  "estimated_impact": "string"\n'
            "}\n"
            "Respond with valid JSON only, no markdown."
        )

        user_content = f"Dataset columns: {column_names or []}\n\nUser request: {prompt}"

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as exc:
        logger.warning("OpenAI interpretation failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def interpret_prompt(
    prompt: str,
    column_names: Optional[List[str]] = None,
) -> Plan:
    """
    Main entry point.
    1. Try OpenAI if key is configured.
    2. Fall back to rule-based interpreter.
    """
    if settings.OPENAI_API_KEY:
        plan = await interpret_with_openai(prompt, column_names)
        if plan:
            return plan

    return interpret_with_rules(prompt, column_names)
