import pandas as pd
import numpy as np


def generate_chart_configs(df: pd.DataFrame, column_types: dict) -> list:
    configs = []
    numeric_cols = [col for col, t in column_types.items() if t == "numeric"]
    categorical_cols = [col for col, t in column_types.items() if t == "categorical"]
    date_cols = [col for col, t in column_types.items() if t == "date"]

    if numeric_cols and categorical_cols:
        x_col = categorical_cols[0]
        y_col = numeric_cols[0]
        try:
            grouped = df.groupby(x_col)[y_col].sum().sort_values(ascending=False).head(10)
            data = [{"name": str(k), "value": round(float(v), 2)} for k, v in grouped.items()]
        except Exception:
            data = [{"name": str(i), "value": 0} for i in range(min(5, len(df)))]
        configs.append({
            "chart_type": "bar",
            "title": f"{y_col} by {x_col}",
            "x_column": x_col,
            "y_column": y_col,
            "data": data,
        })

    if numeric_cols:
        y_col = numeric_cols[0]
        try:
            values = df[y_col].dropna().head(20).tolist()
            data = [{"name": f"Row {i+1}", "value": round(float(v), 2)} for i, v in enumerate(values)]
        except Exception:
            data = [{"name": "No Data", "value": 0}]
        configs.append({
            "chart_type": "line",
            "title": f"{y_col} Trend",
            "x_column": "Index",
            "y_column": y_col,
            "data": data,
        })

    if numeric_cols and len(numeric_cols) >= 2:
        x_col = numeric_cols[0]
        y_col = numeric_cols[1]
        try:
            sample = df[[x_col, y_col]].dropna().head(100)
            data = [
                {"name": str(i), "x": round(float(row[x_col]), 2), "y": round(float(row[y_col]), 2)}
                for i, row in sample.iterrows()
            ]
        except Exception:
            data = [{"name": "No Data", "x": 0, "y": 0}]
        configs.append({
            "chart_type": "scatter",
            "title": f"{y_col} vs {x_col}",
            "x_column": x_col,
            "y_column": y_col,
            "data": data,
        })

    if not configs:
        configs.append({
            "chart_type": "table",
            "title": "Data Preview",
            "x_column": None,
            "y_column": None,
            "data": [],
        })

    return configs


def generate_inline_charts(
    columns: list,
    rows: list,
    chart_type: str = None,
    x_column: str = None,
    y_column: str = None,
    aggregation: str = None,
) -> dict:
    if not columns or not rows:
        return {"suggestions": [], "columns": {}}

    df = pd.DataFrame(rows, columns=columns)

    col_types = {}
    for col in df.columns:
        series = df[col]
        non_null = series.dropna()
        if len(non_null) == 0:
            col_types[col] = "text"
        elif pd.api.types.is_bool_dtype(series):
            col_types[col] = "boolean"
        elif pd.api.types.is_numeric_dtype(series):
            col_types[col] = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            col_types[col] = "date"
        else:
            str_vals = non_null.astype(str)
            unique_count = str_vals.nunique()
            col_types[col] = "categorical" if unique_count <= 20 else "text"

    if chart_type and x_column and y_column:
        result = _generate_single_chart(df, col_types, chart_type, x_column, y_column, aggregation)
        return {"suggestions": [result] if result else [], "columns": col_types}

    suggestions = []

    categorical_cols = [c for c, t in col_types.items() if t in ("categorical", "boolean")]
    numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
    date_cols = [c for c, t in col_types.items() if t == "date"]

    if categorical_cols and numeric_cols:
        x_col = categorical_cols[0]
        y_col = numeric_cols[0]
        chart = _build_bar_chart(df, x_col, y_col, "sum")
        if chart:
            suggestions.append(chart)

    if date_cols and numeric_cols:
        x_col = date_cols[0]
        y_col = numeric_cols[0]
        chart = _build_line_chart(df, x_col, y_col)
        if chart:
            suggestions.append(chart)

    if categorical_cols:
        x_col = categorical_cols[0]
        chart = _build_pie_chart(df, x_col)
        if chart:
            suggestions.append(chart)

    if numeric_cols and len(numeric_cols) >= 2:
        x_col = numeric_cols[0]
        y_col = numeric_cols[1]
        chart = _build_scatter_chart(df, x_col, y_col)
        if chart:
            suggestions.append(chart)

    if numeric_cols and len(numeric_cols) >= 2:
        y_cols = numeric_cols[:5]
        chart = _build_bar_chart(df, None, None, "sum", aggregate_cols=y_cols)
        if chart:
            suggestions.append(chart)

    if not suggestions and numeric_cols:
        y_col = numeric_cols[0]
        chart = _build_line_chart(df, None, y_col)
        if chart:
            suggestions.append(chart)

    return {"suggestions": suggestions, "columns": col_types}


def _generate_single_chart(df, col_types, chart_type, x_column, y_column, aggregation):
    if chart_type == "bar":
        return _build_bar_chart(df, x_column, y_column, aggregation or "sum")
    elif chart_type == "line":
        return _build_line_chart(df, x_column, y_column)
    elif chart_type == "pie":
        return _build_pie_chart(df, x_column, y_column)
    elif chart_type == "scatter":
        return _build_scatter_chart(df, x_column, y_column)
    elif chart_type == "area":
        return _build_area_chart(df, x_column, y_column)
    elif chart_type == "doughnut":
        return _build_pie_chart(df, x_column, y_column, inner_radius=60)
    return None


def _safe_numeric(val):
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None


def _build_bar_chart(df, x_col, y_col, aggregation="sum", aggregate_cols=None):
    if aggregate_cols:
        try:
            data = []
            for col in aggregate_cols:
                vals = pd.to_numeric(df[col], errors="coerce").dropna()
                if aggregation == "sum":
                    val = float(vals.sum())
                elif aggregation == "mean":
                    val = float(vals.mean())
                elif aggregation == "count":
                    val = int(len(vals))
                elif aggregation == "min":
                    val = float(vals.min())
                elif aggregation == "max":
                    val = float(vals.max())
                else:
                    val = float(vals.sum())
                data.append({"name": col, "value": _safe_numeric(val)})
            return {
                "chart_type": "bar",
                "title": f"{aggregation.title()} by Column",
                "x_column": "Column",
                "y_column": aggregation.title(),
                "data": data,
                "aggregation": aggregation,
            }
        except Exception:
            return None

    if not x_col or not y_col:
        return None

    try:
        x_series = df[x_col].astype(str)
        y_series = pd.to_numeric(df[y_col], errors="coerce")

        temp = pd.DataFrame({"x": x_series, "y": y_series}).dropna()

        if aggregation == "sum":
            grouped = temp.groupby("x")["y"].sum()
        elif aggregation == "mean":
            grouped = temp.groupby("x")["y"].mean()
        elif aggregation == "count":
            grouped = temp.groupby("x")["y"].count()
        elif aggregation == "min":
            grouped = temp.groupby("x")["y"].min()
        elif aggregation == "max":
            grouped = temp.groupby("x")["y"].max()
        else:
            grouped = temp.groupby("x")["y"].sum()

        grouped = grouped.sort_values(ascending=False).head(15)
        data = [{"name": str(k), "value": _safe_numeric(v)} for k, v in grouped.items()]
        data = [d for d in data if d["value"] is not None]

        if not data:
            return None

        return {
            "chart_type": "bar",
            "title": f"{y_col} by {x_col} ({aggregation.title()})",
            "x_column": x_col,
            "y_column": y_col,
            "data": data,
            "aggregation": aggregation,
        }
    except Exception:
        return None


def _build_line_chart(df, x_col, y_col):
    if not y_col:
        return None

    try:
        y_series = pd.to_numeric(df[y_col], errors="coerce")

        if x_col:
            x_series = df[x_col].astype(str)
            temp = pd.DataFrame({"x": x_series, "y": y_series}).dropna().head(50)
            data = [{"name": str(row["x"]), "value": _safe_numeric(row["y"])} for _, row in temp.iterrows()]
        else:
            vals = y_series.dropna().head(50)
            data = [{"name": f"Row {i+1}", "value": _safe_numeric(v)} for i, v in enumerate(vals)]

        data = [d for d in data if d["value"] is not None]

        if not data:
            return None

        return {
            "chart_type": "line",
            "title": f"{y_col} Trend",
            "x_column": x_col or "Index",
            "y_column": y_col,
            "data": data,
        }
    except Exception:
        return None


def _build_pie_chart(df, x_col, y_col=None, inner_radius=0):
    if not x_col:
        return None

    try:
        if y_col:
            y_series = pd.to_numeric(df[y_col], errors="coerce")
            temp = pd.DataFrame({"x": df[x_col].astype(str), "y": y_series}).dropna()
            grouped = temp.groupby("x")["y"].sum().sort_values(ascending=False).head(8)
            data = [{"name": str(k), "value": _safe_numeric(v)} for k, v in grouped.items()]
            title = f"{y_col} by {x_col}"
        else:
            counts = df[x_col].astype(str).value_counts().head(8)
            data = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
            title = f"Distribution of {x_col}"

        data = [d for d in data if d["value"] is not None and d["value"] > 0]

        if not data:
            return None

        result = {
            "chart_type": "doughnut" if inner_radius > 0 else "pie",
            "title": title,
            "x_column": x_col,
            "y_column": y_col,
            "data": data,
        }
        if inner_radius:
            result["inner_radius"] = inner_radius
        return result
    except Exception:
        return None


def _build_scatter_chart(df, x_col, y_col):
    if not x_col or not y_col:
        return None

    try:
        temp = df[[x_col, y_col]].dropna().head(200)
        x_series = pd.to_numeric(temp[x_col], errors="coerce")
        y_series = pd.to_numeric(temp[y_col], errors="coerce")

        valid = pd.DataFrame({"x": x_series, "y": y_series}).dropna()

        if len(valid) < 2:
            return None

        data = [
            {"name": f"Row {i+1}", "x": _safe_numeric(row["x"]), "y": _safe_numeric(row["y"])}
            for i, (_, row) in enumerate(valid.iterrows())
        ]

        return {
            "chart_type": "scatter",
            "title": f"{y_col} vs {x_col}",
            "x_column": x_col,
            "y_column": y_col,
            "data": data,
        }
    except Exception:
        return None


def _build_area_chart(df, x_col, y_col):
    line_chart = _build_line_chart(df, x_col, y_col)
    if line_chart:
        line_chart["chart_type"] = "area"
        line_chart["title"] = f"{y_col} Area"
        return line_chart
    return None
