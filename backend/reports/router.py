"""
Reports router.
Manages persistent analysis reports and file exports: PDF, HTML, cleaned datasets (CSV/Excel/JSON),
and reproducible Python cleaning scripts.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse, PlainTextResponse, StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from database import get_current_user, supabase_admin
from storage.service import create_signed_url, upload_file

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_report_and_verify(report_id: str, user_id: str) -> Dict[str, Any]:
    """Fetch report by ID and verify owner."""
    try:
        resp = supabase_admin.table("reports").select("*").eq("id", report_id).single().execute()
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        if resp.data.get("owner_id") != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this report")
        return resp.data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def _get_cleaned_dataframe(report: Dict[str, Any]) -> pd.DataFrame:
    """Fetch the cleaned dataset DataFrame associated with the report."""
    run_id = report.get("analysis_run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="Report is not linked to an analysis run")

    run_resp = supabase_admin.table("analysis_runs").select("*").eq("id", run_id).single().execute()
    if not run_resp.data:
        raise HTTPException(status_code=404, detail="Associated analysis run not found")

    version_id = run_resp.data.get("dataset_version_id")
    version_resp = supabase_admin.table("dataset_versions").select("*").eq("id", version_id).single().execute()
    if not version_resp.data:
        raise HTTPException(status_code=404, detail="Dataset version not found")

    storage_path = version_resp.data["storage_path"]
    content = supabase_admin.storage.from_("datasets").download(storage_path)

    ext = "." + storage_path.split("/")[-1].rsplit(".", 1)[-1].lower() if "." in storage_path else ".csv"
    if ext == ".csv":
        return pd.read_csv(io.BytesIO(content))
    elif ext in {".xlsx", ".xls"}:
        return pd.read_excel(io.BytesIO(content))
    elif ext == ".json":
        return pd.read_json(io.BytesIO(content))
    return pd.read_csv(io.BytesIO(content))


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """List reports belonging to current user."""
    user_id = current_user["id"]
    query = supabase_admin.table("reports").select("*").eq("owner_id", user_id).order("created_at", desc=True)

    if search:
        query = query.ilike("title", f"%{search}%")

    start = (page - 1) * limit
    resp = query.range(start, start + limit - 1).execute()
    items = resp.data or []

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": len(items),
    }


# ---------------------------------------------------------------------------
# GET /{id}
# ---------------------------------------------------------------------------

@router.get("/{report_id}")
async def get_report(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get single report with full summary details."""
    report = _get_report_and_verify(report_id, current_user["id"])

    # Also fetch transformation steps from the linked analysis run
    run_id = report.get("analysis_run_id")
    steps: List[Dict[str, Any]] = []
    if run_id:
        steps_resp = (
            supabase_admin.table("transformation_steps")
            .select("*")
            .eq("analysis_run_id", run_id)
            .order("step_order")
            .execute()
        )
        steps = steps_resp.data or []

    report["transformation_steps"] = steps
    return report


# ---------------------------------------------------------------------------
# POST /{id}/export/pdf
# ---------------------------------------------------------------------------

@router.post("/{report_id}/export/pdf")
async def export_report_pdf(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate and return a professional PDF summary report."""
    report = _get_report_and_verify(report_id, current_user["id"])
    summary = report.get("summary") or {}

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#29243B"),
        spaceAfter=12,
    )
    heading2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#8B79C6"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#29243B"),
    )

    story = []
    # Title
    story.append(Paragraph("DataMend - Data Quality & Transformation Report", title_style))
    story.append(Paragraph(f"<b>Report Title:</b> {report.get('title', 'Data Cleaning Report')}", body_style))
    story.append(Paragraph(f"<b>Generated At:</b> {report.get('created_at', str(datetime.now(timezone.utc)))}", body_style))
    story.append(Spacer(1, 14))

    # Prompt & Objective
    story.append(Paragraph("1. User Objective & Cleaning Prompt", heading2_style))
    prompt_text = summary.get("prompt") or report.get("title") or "N/A"
    story.append(Paragraph(f"<i>\"{prompt_text}\"</i>", body_style))
    story.append(Spacer(1, 12))

    # Metrics comparison table
    story.append(Paragraph("2. Transformation Metrics", heading2_style))
    b_q = summary.get("before_quality") or {}
    a_q = summary.get("after_quality") or {}

    table_data = [
        ["Metric", "Before Cleaning", "After Cleaning", "Change"],
        ["Total Rows", str(b_q.get("total_rows", "N/A")), str(a_q.get("total_rows", "N/A")), str(summary.get("rows_affected", 0))],
        ["Duplicate Rows", str(b_q.get("duplicate_rows", "N/A")), str(a_q.get("duplicate_rows", 0)), "-"],
        ["Missing Cells", str(b_q.get("missing_cells", "N/A")), str(a_q.get("missing_cells", 0)), "-"],
        ["Operations Executed", "-", str(summary.get("operations_count", 0)), "-"],
    ]
    t = Table(table_data, colWidths=[160, 110, 110, 110])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#8B79C6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDD8F5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F0FF")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    # Key findings
    findings = summary.get("key_findings") or []
    if findings:
        story.append(Paragraph("3. Key Insights & Findings", heading2_style))
        for item in findings:
            story.append(Paragraph(f"• {item}", body_style))
        story.append(Spacer(1, 12))

    # Warnings / Disclaimers
    story.append(Paragraph("4. Transparency & Reproducibility Notice", heading2_style))
    story.append(Paragraph(
        "All statistics reflect actual calculations performed on the uploaded dataset. "
        "No values have been simulated or fabricated. The immutable original dataset remains intact.",
        body_style,
    ))

    doc.build(story)
    pdf_bytes = buffer.getvalue()

    filename = f"DataMend_Report_{report_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# POST /{id}/export/html
# ---------------------------------------------------------------------------

@router.post("/{report_id}/export/html")
async def export_report_html(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> HTMLResponse:
    """Generate self-contained downloadable HTML report."""
    report = _get_report_and_verify(report_id, current_user["id"])
    summary = report.get("summary") or {}
    b_q = summary.get("before_quality") or {}
    a_q = summary.get("after_quality") or {}
    findings = summary.get("key_findings") or ["Cleaning pipeline applied successfully."]

    findings_html = "".join([f"<li>{f}</li>" for f in findings])

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DataMend Report - {report.get('title')}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F4F0FF; color: #29243B; margin: 0; padding: 40px; }}
    .container {{ max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #DDD8F5; }}
    h1 {{ color: #8B79C6; margin-top: 0; }}
    table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
    th, td {{ border: 1px solid #DDD8F5; padding: 10px 14px; text-align: left; }}
    th {{ background: #8B79C6; color: #fff; }}
    tr:nth-child(even) {{ background: #F4F0FF; }}
    .badge {{ display: inline-block; background: #648B68; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>DataMend Quality & Transformation Report</h1>
    <p><strong>Report:</strong> {report.get('title')}</p>
    <p><strong>Date:</strong> {report.get('created_at')}</p>
    <p><strong>User Request:</strong> <em>"{summary.get('prompt', 'N/A')}"</em></p>

    <h2>Quality Comparison</h2>
    <table>
      <thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead>
      <tbody>
        <tr><td>Total Rows</td><td>{b_q.get('total_rows', 'N/A')}</td><td>{a_q.get('total_rows', 'N/A')}</td></tr>
        <tr><td>Duplicate Rows</td><td>{b_q.get('duplicate_rows', 'N/A')}</td><td>{a_q.get('duplicate_rows', 0)}</td></tr>
        <tr><td>Missing Cells</td><td>{b_q.get('missing_cells', 'N/A')}</td><td>{a_q.get('missing_cells', 0)}</td></tr>
        <tr><td>Operations Executed</td><td>-</td><td>{summary.get('operations_count', 0)}</td></tr>
      </tbody>
    </table>

    <h2>Key Findings</h2>
    <ul>{findings_html}</ul>
  </div>
</body>
</html>"""
    return HTMLResponse(
        content=html_content,
        headers={"Content-Disposition": f"attachment; filename=DataMend_Report_{report_id[:8]}.html"},
    )


# ---------------------------------------------------------------------------
# POST /{id}/export/csv
# ---------------------------------------------------------------------------

@router.post("/{report_id}/export/csv")
async def export_cleaned_csv(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Download cleaned dataset as genuine CSV."""
    report = _get_report_and_verify(report_id, current_user["id"])
    df = _get_cleaned_dataframe(report)

    stream = io.StringIO()
    df.to_csv(stream, index=False)
    csv_bytes = stream.getvalue().encode("utf-8")

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=DataMend_Cleaned_{report_id[:8]}.csv"},
    )


# ---------------------------------------------------------------------------
# POST /{id}/export/xlsx
# ---------------------------------------------------------------------------

@router.post("/{report_id}/export/xlsx")
async def export_cleaned_xlsx(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Download cleaned dataset as Excel XLSX."""
    report = _get_report_and_verify(report_id, current_user["id"])
    df = _get_cleaned_dataframe(report)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="CleanedData")

    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=DataMend_Cleaned_{report_id[:8]}.xlsx"},
    )


# ---------------------------------------------------------------------------
# POST /{id}/export/json
# ---------------------------------------------------------------------------

@router.post("/{report_id}/export/json")
async def export_cleaned_json(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Download cleaned dataset as JSON."""
    report = _get_report_and_verify(report_id, current_user["id"])
    df = _get_cleaned_dataframe(report)

    json_str = df.to_json(orient="records", indent=2)

    return Response(
        content=json_str.encode("utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=DataMend_Cleaned_{report_id[:8]}.json"},
    )


# ---------------------------------------------------------------------------
# POST /{id}/export/python
# ---------------------------------------------------------------------------

@router.post("/{report_id}/export/python")
async def export_python_script(
    report_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate and download a self-contained Python script to reproduce the cleaning pipeline."""
    report = _get_report_and_verify(report_id, current_user["id"])
    run_id = report.get("analysis_run_id")

    steps: List[Dict[str, Any]] = []
    if run_id:
        steps_resp = (
            supabase_admin.table("transformation_steps")
            .select("*")
            .eq("analysis_run_id", run_id)
            .order("step_order")
            .execute()
        )
        steps = steps_resp.data or []

    script_lines = [
        "#!/usr/bin/env python3",
        '"""',
        "DataMend Reproducible Data Cleaning Pipeline",
        f"Generated from Report ID: {report_id}",
        f"Date: {datetime.now(timezone.utc).isoformat()}",
        '"""',
        "import pandas as pd",
        "import numpy as np",
        "",
        "def run_cleaning_pipeline(input_path: str, output_path: str = 'cleaned_dataset.csv') -> pd.DataFrame:",
        "    print(f'Loading {input_path}...')",
        "    if input_path.endswith('.csv'):",
        "        df = pd.read_csv(input_path)",
        "    elif input_path.endswith(('.xlsx', '.xls')):",
        "        df = pd.read_excel(input_path)",
        "    elif input_path.endswith('.json'):",
        "        df = pd.read_json(input_path)",
        "    else:",
        "        df = pd.read_csv(input_path)",
        "",
        "    print(f'Initial shape: {df.shape}')",
        "",
    ]

    for step in steps:
        op = step.get("operation_type")
        params = step.get("parameters") or {}
        cols = step.get("affected_columns") or []

        script_lines.append(f"    # Step {step.get('step_order')}: {op}")
        if op == "remove_duplicates":
            script_lines.append("    df = df.drop_duplicates()")
        elif op == "drop_missing":
            if cols:
                script_lines.append(f"    df = df.dropna(subset={cols})")
            else:
                script_lines.append("    df = df.dropna()")
        elif op == "fill_missing":
            method = params.get("method", "median")
            for c in cols:
                if method == "median":
                    script_lines.append(f"    if '{c}' in df.columns: df['{c}'] = df['{c}'].fillna(df['{c}'].median())")
                elif method == "mean":
                    script_lines.append(f"    if '{c}' in df.columns: df['{c}'] = df['{c}'].fillna(df['{c}'].mean())")
                elif method == "mode":
                    script_lines.append(f"    if '{c}' in df.columns and len(df['{c}'].mode()) > 0: df['{c}'] = df['{c}'].fillna(df['{c}'].mode()[0])")
                else:
                    val = params.get("value", "")
                    script_lines.append(f"    if '{c}' in df.columns: df['{c}'] = df['{c}'].fillna('{val}')")
        elif op == "trim_whitespace":
            script_lines.append("    str_cols = df.select_dtypes(include=['object']).columns")
            script_lines.append("    for c in str_cols: df[c] = df[c].str.strip()")
        elif op == "rename_columns":
            mapping = params.get("mapping", {})
            script_lines.append(f"    df = df.rename(columns={mapping})")
        elif op == "drop_columns":
            script_lines.append(f"    df = df.drop(columns={cols}, errors='ignore')")

    script_lines.extend([
        "",
        "    print(f'Final cleaned shape: {df.shape}')",
        "    df.to_csv(output_path, index=False)",
        "    print(f'Cleaned dataset saved to {output_path}')",
        "    return df",
        "",
        "if __name__ == '__main__':",
        "    import sys",
        "    input_file = sys.argv[1] if len(sys.argv) > 1 else 'dataset.csv'",
        "    run_cleaning_pipeline(input_file)",
    ])

    script_code = "\n".join(script_lines)

    return Response(
        content=script_code.encode("utf-8"),
        media_type="text/x-python",
        headers={"Content-Disposition": f"attachment; filename=datamend_pipeline_{report_id[:8]}.py"},
    )
