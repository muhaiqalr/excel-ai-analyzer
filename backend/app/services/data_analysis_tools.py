import pandas as pd
import numpy as np
from typing import Any, Optional


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").dropna()


def sum_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}
    return {"result": round(float(vals.sum()), 4), "column": column, "operation": "sum", "count": len(vals)}


def average_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}
    return {"result": round(float(vals.mean()), 4), "column": column, "operation": "average", "count": len(vals)}


def count_value(df: pd.DataFrame, column: str = None) -> dict:
    if column and column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    if column:
        total = len(df)
        non_null = int(df[column].notna().sum())
        return {"result": non_null, "total": total, "missing": total - non_null, "column": column, "operation": "count"}
    return {"result": len(df), "operation": "count_rows", "columns": len(df.columns)}


def min_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}
    return {"result": round(float(vals.min()), 4), "column": column, "operation": "min"}


def max_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}
    return {"result": round(float(vals.max()), 4), "column": column, "operation": "max"}


def median_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}
    return {"result": round(float(vals.median()), 4), "column": column, "operation": "median"}


def std_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) < 2:
        return {"error": f"Need at least 2 values in column '{column}'"}
    return {"result": round(float(vals.std()), 4), "column": column, "operation": "std_dev"}


def variance_value(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}
    vals = _safe_numeric(df[column])
    if len(vals) < 2:
        return {"error": f"Need at least 2 values in column '{column}'"}
    return {"result": round(float(vals.var()), 4), "column": column, "operation": "variance"}


def groupby_value(df: pd.DataFrame, group_col: str, agg_col: str, agg_func: str = "sum") -> dict:
    if group_col not in df.columns:
        return {"error": f"Group column '{group_col}' not found"}
    if agg_col not in df.columns:
        return {"error": f"Aggregation column '{agg_col}' not found"}

    valid_agg = {"sum", "mean", "count", "min", "max", "median"}
    if agg_func not in valid_agg:
        return {"error": f"Invalid aggregation. Use: {', '.join(valid_agg)}"}

    try:
        temp = df[[group_col, agg_col]].copy()
        temp[agg_col] = pd.to_numeric(temp[agg_col], errors="coerce")
        temp = temp.dropna()

        if len(temp) == 0:
            return {"error": "No valid numeric data for aggregation"}

        grouped = temp.groupby(group_col)[agg_col].agg(agg_func).sort_values(ascending=False)
        result = {str(k): round(float(v), 4) for k, v in grouped.items()}

        return {
            "result": result,
            "group_column": group_col,
            "agg_column": agg_col,
            "agg_function": agg_func,
            "operation": "groupby",
            "group_count": len(result),
        }
    except Exception as e:
        return {"error": f"Groupby failed: {str(e)}"}


def sort_values(df: pd.DataFrame, column: str, ascending: bool = True, limit: int = 10) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    try:
        temp = df.copy()
        is_numeric = pd.api.types.is_numeric_dtype(temp[column])
        if not is_numeric:
            temp["_sort_key"] = pd.to_numeric(temp[column], errors="coerce")
            sort_col = "_sort_key"
        else:
            sort_col = column

        sorted_df = temp.sort_values(sort_col, ascending=ascending, na_position="last").head(limit)
        result = []
        for _, row in sorted_df.iterrows():
            row_data = {}
            for c in df.columns:
                val = row[c]
                if pd.isna(val):
                    row_data[c] = None
                elif isinstance(val, (np.integer, np.floating)):
                    row_data[c] = round(float(val), 4)
                else:
                    row_data[c] = str(val)
            result.append(row_data)

        return {
            "result": result,
            "column": column,
            "ascending": ascending,
            "limit": limit,
            "operation": "sort",
            "total_rows": len(df),
        }
    except Exception as e:
        return {"error": f"Sort failed: {str(e)}"}


def filter_rows(df: pd.DataFrame, column: str, operator: str, value: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    valid_ops = {"eq", "neq", "gt", "gte", "lt", "lte", "contains", "startswith", "endswith"}
    if operator not in valid_ops:
        return {"error": f"Invalid operator. Use: {', '.join(valid_ops)}"}

    try:
        series = df[column]
        numeric_val = pd.to_numeric(value, errors="coerce")

        if operator == "eq":
            if not np.isnan(numeric_val):
                mask = pd.to_numeric(series, errors="coerce") == numeric_val
            else:
                mask = series.astype(str) == value
        elif operator == "neq":
            if not np.isnan(numeric_val):
                mask = pd.to_numeric(series, errors="coerce") != numeric_val
            else:
                mask = series.astype(str) != value
        elif operator == "gt":
            mask = pd.to_numeric(series, errors="coerce") > numeric_val
        elif operator == "gte":
            mask = pd.to_numeric(series, errors="coerce") >= numeric_val
        elif operator == "lt":
            mask = pd.to_numeric(series, errors="coerce") < numeric_val
        elif operator == "lte":
            mask = pd.to_numeric(series, errors="coerce") <= numeric_val
        elif operator == "contains":
            mask = series.astype(str).str.contains(value, case=False, na=False)
        elif operator == "startswith":
            mask = series.astype(str).str.startswith(value, na=False)
        elif operator == "endswith":
            mask = series.astype(str).str.endswith(value, na=False)
        else:
            mask = pd.Series([False] * len(df))

        filtered = df[mask]
        count = len(filtered)

        return {
            "result": f"Found {count} rows matching the filter",
            "count": count,
            "column": column,
            "operator": operator,
            "value": value,
            "operation": "filter",
        }
    except Exception as e:
        return {"error": f"Filter failed: {str(e)}"}


def top_n(df: pd.DataFrame, column: str, n: int = 5) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}

    top = vals.nlargest(n)
    result = [{"value": round(float(v), 4)} for v in top.values]

    return {
        "result": result,
        "column": column,
        "n": n,
        "operation": "top_n",
    }


def bottom_n(df: pd.DataFrame, column: str, n: int = 5) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'"}

    bottom = vals.nsmallest(n)
    result = [{"value": round(float(v), 4)} for v in bottom.values]

    return {
        "result": result,
        "column": column,
        "n": n,
        "operation": "bottom_n",
    }


def percentage(df: pd.DataFrame, column: str, value: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    total = len(df)
    if total == 0:
        return {"error": "Dataset is empty"}

    series = df[column]
    numeric_val = pd.to_numeric(value, errors="coerce")

    if not np.isnan(numeric_val):
        matches = (pd.to_numeric(series, errors="coerce") == numeric_val).sum()
    else:
        matches = (series.astype(str) == value).sum()

    pct = round(float(matches / total * 100), 2)

    return {
        "result": pct,
        "matches": int(matches),
        "total": total,
        "column": column,
        "value": value,
        "operation": "percentage",
    }


def correlation_between(df: pd.DataFrame, col1: str, col2: str) -> dict:
    if col1 not in df.columns:
        return {"error": f"Column '{col1}' not found"}
    if col2 not in df.columns:
        return {"error": f"Column '{col2}' not found"}

    temp = df[[col1, col2]].dropna()
    v1 = pd.to_numeric(temp[col1], errors="coerce")
    v2 = pd.to_numeric(temp[col2], errors="coerce")

    valid = pd.DataFrame({"a": v1, "b": v2}).dropna()
    if len(valid) < 3:
        return {"error": "Need at least 3 paired numeric values"}

    corr = valid["a"].corr(valid["b"])

    if abs(corr) >= 0.7:
        strength = "strong positive" if corr > 0 else "strong negative"
    elif abs(corr) >= 0.4:
        strength = "moderate positive" if corr > 0 else "moderate negative"
    elif abs(corr) >= 0.2:
        strength = "weak positive" if corr > 0 else "weak negative"
    else:
        strength = "very weak or no correlation"

    return {
        "result": round(float(corr), 4),
        "column1": col1,
        "column2": col2,
        "strength": strength,
        "operation": "correlation",
        "data_points": len(valid),
    }


def unique_values(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    unique = df[column].dropna().unique()
    unique_count = len(unique)

    return {
        "result": unique_count,
        "column": column,
        "operation": "unique_count",
        "sample_values": [str(v) for v in unique[:10]],
    }


def value_counts(df: pd.DataFrame, column: str, top_n: int = 10) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    counts = df[column].dropna().value_counts().head(top_n)
    result = {str(k): int(v) for k, v in counts.items()}

    return {
        "result": result,
        "column": column,
        "operation": "value_counts",
        "unique_count": int(df[column].nunique()),
    }


def missing_data(df: pd.DataFrame, column: str = None) -> dict:
    if column:
        if column not in df.columns:
            return {"error": f"Column '{column}' not found"}
        missing = int(df[column].isna().sum())
        total = len(df)
        pct = round(missing / total * 100, 2) if total > 0 else 0
        return {
            "result": {"missing": missing, "total": total, "percentage": pct},
            "column": column,
            "operation": "missing_data",
        }

    result = {}
    for col in df.columns:
        missing = int(df[col].isna().sum())
        if missing > 0:
            total = len(df)
            pct = round(missing / total * 100, 2) if total > 0 else 0
            result[col] = {"missing": missing, "percentage": pct}

    return {
        "result": result,
        "operation": "missing_data",
        "total_missing": int(df.isna().sum().sum()),
    }


def describe_column(df: pd.DataFrame, column: str) -> dict:
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    series = df[column]
    col_type = "unknown"

    if pd.api.types.is_bool_dtype(series):
        col_type = "boolean"
    elif pd.api.types.is_numeric_dtype(series):
        col_type = "numeric"
    elif pd.api.types.is_datetime64_any_dtype(series):
        col_type = "date"
    else:
        str_vals = series.dropna().astype(str)
        if str_vals.nunique() <= 20:
            col_type = "categorical"
        else:
            col_type = "text"

    info = {"type": col_type, "count": int(series.count()), "missing": int(series.isna().sum())}

    if col_type == "numeric":
        vals = _safe_numeric(series)
        if len(vals) > 0:
            info.update({
                "sum": round(float(vals.sum()), 4),
                "mean": round(float(vals.mean()), 4),
                "median": round(float(vals.median()), 4),
                "min": round(float(vals.min()), 4),
                "max": round(float(vals.max()), 4),
                "std": round(float(vals.std()), 4) if len(vals) > 1 else 0,
            })
    elif col_type in ("categorical", "text"):
        counts = series.dropna().value_counts().head(5)
        info["top_values"] = {str(k): int(v) for k, v in counts.items()}
        info["unique_count"] = int(series.nunique())
    elif col_type == "boolean":
        info["true_count"] = int(series.sum())
        info["false_count"] = int((~series).sum())

    return {"result": info, "column": column, "operation": "describe"}


TOOLS_MAP = {
    "sum": lambda df, params: sum_value(df, params.get("column", "")),
    "average": lambda df, params: average_value(df, params.get("column", "")),
    "mean": lambda df, params: average_value(df, params.get("column", "")),
    "count": lambda df, params: count_value(df, params.get("column")),
    "min": lambda df, params: min_value(df, params.get("column", "")),
    "max": lambda df, params: max_value(df, params.get("column", "")),
    "median": lambda df, params: median_value(df, params.get("column", "")),
    "std": lambda df, params: std_value(df, params.get("column", "")),
    "variance": lambda df, params: variance_value(df, params.get("column", "")),
    "groupby": lambda df, params: groupby_value(df, params.get("group_column", ""), params.get("agg_column", ""), params.get("agg_func", "sum")),
    "sort": lambda df, params: sort_values(df, params.get("column", ""), params.get("ascending", True), params.get("limit", 10)),
    "filter": lambda df, params: filter_rows(df, params.get("column", ""), params.get("operator", "eq"), params.get("value", "")),
    "top_n": lambda df, params: top_n(df, params.get("column", ""), params.get("n", 5)),
    "bottom_n": lambda df, params: bottom_n(df, params.get("column", ""), params.get("n", 5)),
    "percentage": lambda df, params: percentage(df, params.get("column", ""), params.get("value", "")),
    "correlation": lambda df, params: correlation_between(df, params.get("column1", ""), params.get("column2", "")),
    "unique": lambda df, params: unique_values(df, params.get("column", "")),
    "value_counts": lambda df, params: value_counts(df, params.get("column", ""), params.get("top_n", 10)),
    "missing": lambda df, params: missing_data(df, params.get("column")),
    "describe": lambda df, params: describe_column(df, params.get("column", "")),
}


def execute_tool(df: pd.DataFrame, tool_name: str, params: dict) -> dict:
    if tool_name not in TOOLS_MAP:
        return {"error": f"Unknown tool '{tool_name}'. Available: {', '.join(TOOLS_MAP.keys())}"}

    try:
        return TOOLS_MAP[tool_name](df, params)
    except Exception as e:
        return {"error": f"Tool '{tool_name}' failed: {str(e)}"}
