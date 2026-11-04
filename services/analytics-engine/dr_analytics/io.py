"""Reading and profiling uploaded tables. Original bytes are never modified by this module."""
from __future__ import annotations

import csv
import io
import re

import numpy as np
import pandas as pd

from .common import AnalysisError, to_jsonable

MAX_COLUMNS = 500
DATE_NAME = re.compile(r"(date|time|timestamp|datetime|fecha|zeit)", re.I)


def read_table(data: bytes, filename: str, max_rows: int = 5_000_000) -> tuple[pd.DataFrame, dict]:
    """Parse CSV or Excel bytes into a DataFrame and return a validation report."""
    name = filename.lower()
    report: dict = {"filename": filename, "warnings": []}
    if name.endswith((".xlsx", ".xlsm")):
        try:
            df = pd.read_excel(io.BytesIO(data), engine="openpyxl")
        except Exception as exc:  # noqa: BLE001
            raise AnalysisError(f"Could not read the Excel workbook: {exc}") from exc
        report["format"] = "xlsx (first sheet)"
    elif name.endswith((".csv", ".txt")):
        try:
            text = data.decode("utf-8-sig")
            report["encoding"] = "utf-8"
        except UnicodeDecodeError:
            text = data.decode("latin-1")
            report["encoding"] = "latin-1"
            report["warnings"].append("File is not UTF-8; decoded as Latin-1.")
        lines = [ln for ln in text.splitlines() if ln.strip()]
        comments = [ln for ln in lines if ln.lstrip().startswith("#")]
        if comments:
            report["header_comments"] = comments[:5]
        body = "\n".join(ln for ln in lines if not ln.lstrip().startswith("#"))
        if not body:
            raise AnalysisError("The file contains no data rows.")
        try:
            dialect = csv.Sniffer().sniff(body[:20000], delimiters=",;\t|")
            sep = dialect.delimiter
        except csv.Error:
            sep = ","
        report["delimiter"] = {"\t": "tab"}.get(sep, sep)
        try:
            df = pd.read_csv(io.StringIO(body), sep=sep, nrows=max_rows + 1)
        except Exception as exc:  # noqa: BLE001
            raise AnalysisError(f"Could not parse CSV: {exc}") from exc
        report["format"] = "csv"
    else:
        raise AnalysisError("Unsupported file type. Upload .csv, .txt or .xlsx files.")
    if df.shape[1] == 0 or df.shape[0] == 0:
        raise AnalysisError("The table is empty.")
    if df.shape[1] > MAX_COLUMNS:
        raise AnalysisError(f"Too many columns ({df.shape[1]} > {MAX_COLUMNS}).")
    if len(df) > max_rows:
        raise AnalysisError(f"Too many rows (limit {max_rows:,}).")
    df.columns = [str(c).strip() for c in df.columns]
    if len(set(df.columns)) != len(df.columns):
        raise AnalysisError("Column names must be unique.")
    report["rows"], report["columns"] = int(df.shape[0]), int(df.shape[1])
    return df, report


def profile_columns(df: pd.DataFrame) -> list[dict]:
    """Identify column kinds (datetime / numeric / text) with missing and unique counts."""
    out = []
    for c in df.columns:
        s = df[c]
        kind = "text"
        if pd.api.types.is_numeric_dtype(s):
            kind = "numeric"
        elif DATE_NAME.search(c) or s.dtype == object:
            parsed = pd.to_datetime(s.dropna().head(200), errors="coerce", utc=True, format="mixed")
            if len(parsed) and parsed.notna().mean() > 0.9 and (DATE_NAME.search(c) or not pd.to_numeric(s.dropna().head(200), errors="coerce").notna().all()):
                kind = "datetime"
            elif pd.to_numeric(s.dropna().head(200), errors="coerce").notna().mean() > 0.95:
                kind = "numeric"
        if pd.api.types.is_datetime64_any_dtype(s):
            kind = "datetime"
        out.append({"name": c, "dtype": str(s.dtype), "kind": kind, "missing": int(s.isna().sum() + (s.astype(str).str.strip() == "").sum() if s.dtype == object else s.isna().sum()), "unique": int(s.nunique(dropna=True))})
    return out


def guess_time_column(columns: list[dict]) -> str | None:
    for c in columns:
        if c["kind"] == "datetime":
            return c["name"]
    return None


def preview(df: pd.DataFrame, n: int = 50) -> dict:
    head = df.head(n).replace({np.nan: None})
    return {"columns": list(df.columns), "rows": to_jsonable(head.astype(object).where(head.notna(), None).values.tolist())}
