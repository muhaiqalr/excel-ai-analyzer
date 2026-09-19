import pandas as pd
import numpy as np
from typing import Optional


def _sanitize(obj):
    """Sanitize values for JSON serialization (NaN -> None)."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    return obj


def _detect_column_type(series: pd.Series) -> str:
    """Detect the semantic type of a pandas Series."""
    non_null = series.dropna()
    if len(non_null) == 0:
        return "text"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"
    str_vals = non_null.astype(str)
    unique_count = str_vals.nunique()
    return "categorical" if unique_count <= 20 else "text"


def _safe_numeric(series: pd.Series) -> pd.Series:
    """Convert a series to numeric, coercing errors to NaN, then drop NaN."""
    return pd.to_numeric(series, errors="coerce").dropna()


def auto_profile(df: pd.DataFrame) -> dict:
    """Automatic data profiling when dataset is loaded.

    Returns rows, columns, column types, missing values, duplicates,
    numeric stats (min, max, mean, median, std), unique counts, potential outliers.
    """
    if df.empty:
        return {
            "rows": 0,
            "columns": 0,
            "total_cells": 0,
            "missing_cells": 0,
            "missing_percentage": 0.0,
            "duplicate_rows": 0,
            "column_profiles": {},
        }

    rows = len(df)
    columns = len(df.columns)
    total_cells = rows * columns
    missing_cells = int(df.isna().sum().sum())
    missing_percentage = round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0.0
    duplicate_rows = int(df.duplicated().sum())

    column_profiles = {}
    for col in df.columns:
        series = df[col]
        non_null = series.dropna()
        col_type = _detect_column_type(series)
        missing_count = int(series.isna().sum())
        missing_pct = round(missing_count / rows * 100, 2) if rows > 0 else 0.0

        profile = {
            "type": col_type,
            "non_null_count": int(len(non_null)),
            "missing_count": missing_count,
            "missing_pct": missing_pct,
        }

        if col_type == "numeric":
            vals = _safe_numeric(series)
            if len(vals) > 0:
                profile["min"] = round(float(vals.min()), 4)
                profile["max"] = round(float(vals.max()), 4)
                profile["mean"] = round(float(vals.mean()), 4)
                profile["median"] = round(float(vals.median()), 4)
                profile["std"] = round(float(vals.std()), 4) if len(vals) > 1 else 0.0
                profile["sum"] = round(float(vals.sum()), 4)
                profile["q1"] = round(float(vals.quantile(0.25)), 4)
                profile["q3"] = round(float(vals.quantile(0.75)), 4)
                profile["iqr"] = round(
                    float(vals.quantile(0.75) - vals.quantile(0.25)), 4
                )
                # Outlier detection (IQR)
                q1 = float(vals.quantile(0.25))
                q3 = float(vals.quantile(0.75))
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outlier_mask = (vals < lower_bound) | (vals > upper_bound)
                profile["outlier_count"] = int(outlier_mask.sum())
                profile["outlier_pct"] = round(
                    profile["outlier_count"] / len(vals) * 100, 2
                )
                # Skewness
                if len(vals) > 2:
                    profile["skewness"] = round(float(vals.skew()), 4)
                if len(vals) > 3:
                    profile["kurtosis"] = round(float(vals.kurtosis()), 4)
            else:
                profile["min"] = None
                profile["max"] = None
                profile["mean"] = None
                profile["median"] = None
                profile["std"] = None
                profile["outlier_count"] = 0
                profile["outlier_pct"] = 0.0

        elif col_type == "date":
            date_vals = pd.to_datetime(non_null, errors="coerce").dropna()
            if len(date_vals) > 0:
                profile["earliest"] = str(date_vals.min())
                profile["latest"] = str(date_vals.max())
                profile["range_days"] = int((date_vals.max() - date_vals.min()).days)

        elif col_type in ("categorical", "boolean"):
            str_vals = non_null.astype(str) if col_type == "categorical" else non_null
            value_counts = str_vals.value_counts()
            profile["unique_count"] = int(value_counts.count())
            profile["most_common"] = str(value_counts.index[0]) if len(value_counts) > 0 else None
            profile["most_common_count"] = int(value_counts.iloc[0]) if len(value_counts) > 0 else 0
            profile["top_values"] = {str(k): int(v) for k, v in value_counts.head(10).items()}

        elif col_type == "text":
            str_vals = non_null.astype(str)
            profile["unique_count"] = int(str_vals.nunique())
            profile["avg_length"] = round(float(str_vals.str.len().mean()), 1) if len(str_vals) > 0 else 0

        column_profiles[col] = profile

    return _sanitize({
        "rows": rows,
        "columns": columns,
        "total_cells": total_cells,
        "missing_cells": missing_cells,
        "missing_percentage": missing_percentage,
        "duplicate_rows": duplicate_rows,
        "column_profiles": column_profiles,
    })


def generate_insights(df: pd.DataFrame) -> dict:
    """Generate smart insights about the dataset.

    Returns overview, key_findings, highest_lowest, trends, missing_data,
    outliers, correlations, recommendations.
    """
    if df.empty:
        return {
            "overview": "Empty dataset with no rows or columns.",
            "key_findings": [],
            "highest_lowest": {},
            "missing_data": {},
            "outliers": {},
            "correlations": [],
            "recommendations": ["Upload a non-empty dataset to generate insights."],
        }

    rows = len(df)
    columns = len(df.columns)

    # Overview
    overview = f"Dataset contains {rows} rows and {columns} columns."

    # Key findings
    key_findings = []
    total_missing = int(df.isna().sum().sum())
    total_cells = rows * columns
    if total_missing > 0:
        pct = round(total_missing / total_cells * 100, 2)
        key_findings.append(
            f"{total_missing} cells ({pct}%) contain missing values."
        )
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        key_findings.append(f"{dup_count} duplicate row(s) detected ({round(dup_count / rows * 100, 2)}%).")

    # Column type summary
    type_counts = {}
    for col in df.columns:
        ct = _detect_column_type(df[col])
        type_counts[ct] = type_counts.get(ct, 0) + 1
    if type_counts:
        parts = [f"{count} {ctype}" for ctype, count in sorted(type_counts.items())]
        key_findings.append(f"Column types: {', '.join(parts)}.")

    # Highest / Lowest values for numeric columns
    highest_lowest = {}
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    for col in numeric_cols:
        vals = _safe_numeric(df[col])
        if len(vals) > 0:
            highest_lowest[col] = {
                "highest": round(float(vals.max()), 4),
                "lowest": round(float(vals.min()), 4),
                "mean": round(float(vals.mean()), 4),
            }

    # Missing data per column
    missing_data = {}
    for col in df.columns:
        mc = int(df[col].isna().sum())
        if mc > 0:
            missing_data[col] = {
                "missing_count": mc,
                "missing_pct": round(mc / rows * 100, 2),
            }

    # Outliers using IQR
    outlier_info = {}
    for col in numeric_cols:
        vals = _safe_numeric(df[col])
        if len(vals) < 4:
            continue
        q1 = float(vals.quantile(0.25))
        q3 = float(vals.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outlier_mask = (vals < lower) | (vals > upper)
        oc = int(outlier_mask.sum())
        if oc > 0:
            outlier_info[col] = {
                "outlier_count": oc,
                "lower_bound": round(lower, 4),
                "upper_bound": round(upper, 4),
            }

    # Correlations between numeric columns
    correlations = []
    if len(numeric_cols) >= 2:
        numeric_df = df[numeric_cols].dropna()
        if len(numeric_df) >= 3:
            corr_matrix = numeric_df.corr()
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i + 1:]:
                    val = float(corr_matrix.loc[col1, col2])
                    if not np.isnan(val) and abs(val) >= 0.5:
                        strength = "strong positive" if val > 0 else "strong negative"
                        if abs(val) >= 0.7:
                            strength = "strong positive" if val > 0 else "strong negative"
                        elif abs(val) >= 0.5:
                            strength = "moderate positive" if val > 0 else "moderate negative"
                        correlations.append({
                            "column1": col1,
                            "column2": col2,
                            "correlation": round(val, 4),
                            "strength": strength,
                        })

    # Recommendations
    recommendations = []
    if total_missing > 0:
        recommendations.append("Consider handling missing values through imputation or removal.")
    if outlier_info:
        cols_with_outliers = list(outlier_info.keys())[:3]
        recommendations.append(
            f"Columns {', '.join(cols_with_outliers)} have outliers that may skew analysis."
        )
    if dup_count > 0:
        recommendations.append("Remove duplicate rows to ensure accurate analysis.")
    for col in numeric_cols:
        vals = _safe_numeric(df[col])
        if len(vals) > 2:
            skew = float(vals.skew())
            if abs(skew) > 1:
                recommendations.append(
                    f"Column '{col}' is significantly skewed ({round(skew, 2)}). Consider log transformation."
                )
    if not recommendations:
        recommendations.append("Dataset looks clean. Proceed with deeper analysis.")

    return _sanitize({
        "overview": overview,
        "key_findings": key_findings,
        "highest_lowest": highest_lowest,
        "missing_data": missing_data,
        "outliers": outlier_info,
        "correlations": correlations,
        "recommendations": recommendations,
    })


def detect_trends(df: pd.DataFrame, date_col: str = None, value_col: str = None) -> dict:
    """Detect trends in time series data.

    Auto-detects date and numeric columns if not specified.
    Finds increasing/decreasing trends, peaks, drops.
    Uses np.polyfit for trend direction.
    Calculates period-over-period changes.
    """
    if df.empty:
        return {"error": "Dataset is empty."}

    # Auto-detect date column
    if date_col is None:
        date_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col])]
        if not date_cols:
            # Try parsing string columns as dates
            for col in df.columns:
                try:
                    parsed = pd.to_datetime(df[col], errors="coerce")
                    if parsed.notna().sum() > len(df) * 0.5:
                        date_cols.append(col)
                        break
                except Exception:
                    continue
        if date_cols:
            date_col = date_cols[0]
        else:
            return {"error": "No date column found. Please specify date_col."}

    if date_col not in df.columns:
        return {"error": f"Column '{date_col}' not found in dataset."}

    # Auto-detect value column
    if value_col is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            return {"error": "No numeric column found. Please specify value_col."}
        value_col = numeric_cols[0]

    if value_col not in df.columns:
        return {"error": f"Column '{value_col}' not found in dataset."}

    # Prepare data: sort by date, drop NaN
    temp = df[[date_col, value_col]].copy()
    temp[date_col] = pd.to_datetime(temp[date_col], errors="coerce")
    temp[value_col] = pd.to_numeric(temp[value_col], errors="coerce")
    temp = temp.dropna().sort_values(date_col).reset_index(drop=True)

    if len(temp) < 2:
        return {
            "date_column": date_col,
            "value_column": value_col,
            "trend_direction": "insufficient_data",
            "message": "Need at least 2 data points for trend detection.",
        }

    values = temp[value_col].values.astype(float)
    dates = temp[date_col].values
    n = len(values)

    # Linear regression using np.polyfit
    x_numeric = np.arange(n, dtype=float)
    coeffs = np.polyfit(x_numeric, values, 1)
    slope = float(coeffs[0])
    intercept = float(coeffs[1])

    if slope > 0:
        trend_direction = "increasing"
    elif slope < 0:
        trend_direction = "decreasing"
    else:
        trend_direction = "stable"

    # R-squared for fit quality
    y_pred = np.polyval(coeffs, x_numeric)
    ss_res = np.sum((values - y_pred) ** 2)
    ss_tot = np.sum((values - np.mean(values)) ** 2)
    r_squared = round(float(1 - ss_res / ss_tot), 4) if ss_tot > 0 else 0.0

    # Find peaks and drops (local maxima/minima)
    peaks = []
    drops = []
    if n >= 3:
        for i in range(1, n - 1):
            if values[i] > values[i - 1] and values[i] > values[i + 1]:
                peaks.append({
                    "date": str(dates[i])[:10],
                    "value": round(float(values[i]), 4),
                    "index": i,
                })
            elif values[i] < values[i - 1] and values[i] < values[i + 1]:
                drops.append({
                    "date": str(dates[i])[:10],
                    "value": round(float(values[i]), 4),
                    "index": i,
                })

    # Period-over-period changes
    changes = []
    for i in range(1, n):
        prev = values[i - 1]
        curr = values[i]
        if prev != 0:
            pct_change = round(float((curr - prev) / abs(prev) * 100), 2)
        else:
            pct_change = None
        changes.append({
            "from_date": str(dates[i - 1])[:10],
            "to_date": str(dates[i])[:10],
            "change": round(float(curr - prev), 4),
            "pct_change": pct_change,
        })

    # Summary statistics
    total_change = round(float(values[-1] - values[0]), 4)
    avg_change = round(float(np.mean(np.diff(values))), 4)

    return _sanitize({
        "date_column": date_col,
        "value_column": value_col,
        "data_points": n,
        "trend_direction": trend_direction,
        "slope_per_period": round(slope, 6),
        "r_squared": r_squared,
        "total_change": total_change,
        "average_change_per_period": avg_change,
        "peaks": peaks[:10],
        "drops": drops[:10],
        "period_changes": changes[:20],
        "start_date": str(dates[0])[:10],
        "end_date": str(dates[-1])[:10],
        "start_value": round(float(values[0]), 4),
        "end_value": round(float(values[-1]), 4),
    })


def compare_groups(df: pd.DataFrame, group_col: str, value_col: str) -> dict:
    """Compare groups in a categorical column.

    Calculates mean, median, count for each group.
    Identifies highest/lowest performing groups.
    Calculates differences between groups.
    """
    if group_col not in df.columns:
        return {"error": f"Column '{group_col}' not found in dataset."}
    if value_col not in df.columns:
        return {"error": f"Column '{value_col}' not found in dataset."}

    temp = df[[group_col, value_col]].copy()
    temp[value_col] = pd.to_numeric(temp[value_col], errors="coerce")
    temp = temp.dropna()

    if len(temp) == 0:
        return {"error": "No valid numeric data for comparison after dropping NaN values."}

    grouped = temp.groupby(group_col)[value_col]

    groups = {}
    for name, group in grouped:
        vals = group.dropna()
        if len(vals) == 0:
            continue
        groups[str(name)] = {
            "count": int(len(vals)),
            "mean": round(float(vals.mean()), 4),
            "median": round(float(vals.median()), 4),
            "std": round(float(vals.std()), 4) if len(vals) > 1 else 0.0,
            "min": round(float(vals.min()), 4),
            "max": round(float(vals.max()), 4),
            "sum": round(float(vals.sum()), 4),
        }

    if not groups:
        return {"error": "No valid groups found after filtering."}

    # Find highest and lowest by mean
    sorted_groups = sorted(groups.items(), key=lambda x: x[1]["mean"], reverse=True)
    highest = sorted_groups[0]
    lowest = sorted_groups[-1]

    # Differences
    group_means = [g["mean"] for g in groups.values()]
    overall_range = round(max(group_means) - min(group_means), 4) if group_means else 0.0

    # Percent difference between highest and lowest
    if lowest[1]["mean"] != 0:
        pct_diff = round((highest[1]["mean"] - lowest[1]["mean"]) / abs(lowest[1]["mean"]) * 100, 2)
    else:
        pct_diff = None

    return _sanitize({
        "group_column": group_col,
        "value_column": value_col,
        "group_count": len(groups),
        "groups": groups,
        "highest_group": {
            "name": highest[0],
            "mean": highest[1]["mean"],
            "count": highest[1]["count"],
        },
        "lowest_group": {
            "name": lowest[0],
            "mean": lowest[1]["mean"],
            "count": lowest[1]["count"],
        },
        "mean_range": overall_range,
        "pct_difference_highest_vs_lowest": pct_diff,
    })


def top_bottom(df: pd.DataFrame, column: str, n: int = 5, ascending: bool = False) -> dict:
    """Get top or bottom N values.

    Sorts and returns top/bottom N with their values.
    Includes the column name and sort direction.
    """
    if column not in df.columns:
        return {"error": f"Column '{column}' not found in dataset."}

    if n < 1:
        return {"error": "n must be at least 1."}

    vals = _safe_numeric(df[column])
    if len(vals) == 0:
        return {"error": f"No numeric values in column '{column}'."}

    if ascending:
        result_vals = vals.nsmallest(n)
        direction = "bottom"
    else:
        result_vals = vals.nlargest(n)
        direction = "top"

    items = []
    for idx, val in result_vals.items():
        row_data = {}
        for col in df.columns:
            cell_val = df.at[idx, col]
            if pd.isna(cell_val):
                row_data[col] = None
            elif isinstance(cell_val, (np.integer, np.floating)):
                row_data[col] = round(float(cell_val), 4)
            else:
                row_data[col] = str(cell_val)
        row_data["_rank"] = len(items) + 1
        row_data[f"_{column}"] = round(float(val), 4)
        items.append(row_data)

    return _sanitize({
        "column": column,
        "direction": direction,
        "n": n,
        "requested_n": n,
        "returned_n": len(items),
        "items": items,
    })


def detect_anomalies(df: pd.DataFrame, column: str = None) -> dict:
    """Detect outliers using IQR and Z-score methods.

    For each numeric column (or specified column):
    IQR method: Q1 - 1.5*IQR, Q3 + 1.5*IQR
    Z-score method: |z| > 2
    Returns: column, index, value, method, reason
    """
    if df.empty:
        return {"error": "Dataset is empty."}

    columns_to_check = []
    if column:
        if column not in df.columns:
            return {"error": f"Column '{column}' not found in dataset."}
        columns_to_check = [column]
    else:
        columns_to_check = df.select_dtypes(include=[np.number]).columns.tolist()
        if not columns_to_check:
            return {"error": "No numeric columns found for anomaly detection."}

    all_anomalies = []
    summary = {}

    for col in columns_to_check:
        vals = _safe_numeric(df[col])
        col_anomalies = []

        if len(vals) < 4:
            summary[col] = {"method": "insufficient_data", "anomaly_count": 0}
            continue

        # IQR method
        q1 = float(vals.quantile(0.25))
        q3 = float(vals.quantile(0.75))
        iqr = q3 - q1
        iqr_lower = q1 - 1.5 * iqr
        iqr_upper = q3 + 1.5 * iqr

        # Z-score method
        mean_val = float(vals.mean())
        std_val = float(vals.std()) if len(vals) > 1 else 0.0

        iqr_count = 0
        zscore_count = 0

        for idx in vals.index:
            val = float(vals[idx])

            # IQR detection
            if val < iqr_lower or val > iqr_upper:
                reason = "below IQR lower bound" if val < iqr_lower else "above IQR upper bound"
                col_anomalies.append({
                    "column": col,
                    "index": int(idx),
                    "value": round(val, 4),
                    "method": "IQR",
                    "reason": reason,
                    "bound": round(iqr_lower if val < iqr_lower else iqr_upper, 4),
                })
                iqr_count += 1

            # Z-score detection
            if std_val > 0:
                z_score = (val - mean_val) / std_val
                if abs(z_score) > 2:
                    direction = "above" if z_score > 0 else "below"
                    col_anomalies.append({
                        "column": col,
                        "index": int(idx),
                        "value": round(val, 4),
                        "method": "Z-score",
                        "reason": f"z={round(z_score, 2)} ({direction} 2 std devs)",
                        "z_score": round(z_score, 4),
                    })
                    zscore_count += 1

        summary[col] = {
            "iqr_count": iqr_count,
            "zscore_count": zscore_count,
            "iqr_bounds": {"lower": round(iqr_lower, 4), "upper": round(iqr_upper, 4)},
            "mean": round(mean_val, 4),
            "std": round(std_val, 4),
        }

        all_anomalies.extend(col_anomalies)

    # Deduplicate anomalies: same index+column detected by multiple methods
    seen = {}
    unique_anomalies = []
    for a in all_anomalies:
        key = (a["column"], a["index"], a["value"])
        if key not in seen:
            seen[key] = a
            unique_anomalies.append(a)
        else:
            # Add secondary method info
            existing = seen[key]
            if existing["method"] != a["method"]:
                existing["method"] = "IQR + Z-score"
                existing["reason"] = f"{existing['reason']}; {a['reason']}"

    return _sanitize({
        "total_anomalies": len(unique_anomalies),
        "columns_analyzed": columns_to_check,
        "summary": summary,
        "anomalies": unique_anomalies,
    })


def forecast_simple(df: pd.DataFrame, date_col: str, value_col: str, periods: int = 3) -> dict:
    """Simple forecasting using linear regression.

    Uses numpy polyfit for linear trend.
    Projects forward `periods` time units.
    Returns forecast values, confidence note, trend direction.
    If insufficient data (< 3 points), returns error message.
    """
    if date_col not in df.columns:
        return {"error": f"Column '{date_col}' not found in dataset."}
    if value_col not in df.columns:
        return {"error": f"Column '{value_col}' not found in dataset."}
    if periods < 1:
        return {"error": "periods must be at least 1."}

    temp = df[[date_col, value_col]].copy()
    temp[date_col] = pd.to_datetime(temp[date_col], errors="coerce")
    temp[value_col] = pd.to_numeric(temp[value_col], errors="coerce")
    temp = temp.dropna().sort_values(date_col).reset_index(drop=True)

    if len(temp) < 3:
        return {
            "error": f"Insufficient data points ({len(temp)}). Need at least 3 for forecasting.",
            "data_points_available": len(temp),
        }

    values = temp[value_col].values.astype(float)
    n = len(values)

    # Use numeric index for x-axis
    x = np.arange(n, dtype=float)

    # Linear regression
    coeffs = np.polyfit(x, values, 1)
    slope = float(coeffs[0])
    intercept = float(coeffs[1])

    # R-squared
    y_pred = np.polyval(coeffs, x)
    ss_res = np.sum((values - y_pred) ** 2)
    ss_tot = np.sum((values - np.mean(values)) ** 2)
    r_squared = round(float(1 - ss_res / ss_tot), 4) if ss_tot > 0 else 0.0

    # Trend direction
    if slope > 0:
        trend = "increasing"
    elif slope < 0:
        trend = "decreasing"
    else:
        trend = "stable"

    # Forecast
    future_x = np.arange(n, n + periods, dtype=float)
    forecasts = np.polyval(coeffs, future_x)

    # Generate forecast dates
    date_diffs = pd.to_datetime(temp[date_col]).diff().dropna()
    if len(date_diffs) > 0:
        median_diff = date_diffs.median()
    else:
        median_diff = pd.Timedelta(days=1)

    last_date = pd.to_datetime(temp[date_col]).iloc[-1]
    forecast_dates = []
    for i in range(1, periods + 1):
        forecast_date = last_date + median_diff * i
        forecast_dates.append(str(forecast_date)[:10])

    forecast_values = [round(float(v), 4) for v in forecasts]

    # Confidence note
    if r_squared >= 0.7:
        confidence = "high"
        confidence_note = "The linear trend fits the data well (R² >= 0.7). Forecast is relatively reliable."
    elif r_squared >= 0.4:
        confidence = "moderate"
        confidence_note = "The linear trend has moderate fit (0.4 <= R² < 0.7). Forecast should be used with caution."
    else:
        confidence = "low"
        confidence_note = "The linear trend has weak fit (R² < 0.4). Forecast may not be reliable."

    # Residual standard error for confidence intervals
    if n > 2:
        residual_std = float(np.std(values - y_pred))
    else:
        residual_std = 0.0

    return _sanitize({
        "date_column": date_col,
        "value_column": value_col,
        "historical_data_points": n,
        "forecast_periods": periods,
        "trend_direction": trend,
        "slope": round(slope, 6),
        "intercept": round(intercept, 4),
        "r_squared": r_squared,
        "confidence": confidence,
        "confidence_note": confidence_note,
        "forecast": [
            {"date": forecast_dates[i], "predicted_value": forecast_values[i]}
            for i in range(periods)
        ],
        "historical_values": [
            {"date": str(temp[date_col].iloc[i])[:10], "value": round(float(values[i]), 4)}
            for i in range(n)
        ],
        "residual_std": round(residual_std, 4),
    })


def auto_chart_recommend(df: pd.DataFrame) -> list:
    """Recommend charts based on data types.

    Date + Numeric -> Line chart
    Category + Numeric -> Bar chart
    Category distribution -> Pie chart
    Numeric + Numeric -> Scatter plot
    Single numeric -> Histogram
    Returns list of {chart_type, x_column, y_column, title, reason}
    """
    if df.empty:
        return []

    recommendations = []

    # Classify columns
    date_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col])]
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = []
    for col in df.columns:
        if col in numeric_cols or col in date_cols:
            continue
        ct = _detect_column_type(df[col])
        if ct in ("categorical", "boolean"):
            categorical_cols.append(col)

    # Try to parse potential date columns that are strings
    for col in df.columns:
        if col in numeric_cols or col in date_cols:
            continue
        try:
            parsed = pd.to_datetime(df[col], errors="coerce")
            if parsed.notna().sum() > len(df) * 0.5:
                date_cols.append(col)
        except Exception:
            continue

    # Date + Numeric -> Line chart
    if date_cols and numeric_cols:
        recommendations.append({
            "chart_type": "line",
            "x_column": date_cols[0],
            "y_column": numeric_cols[0],
            "title": f"{numeric_cols[0]} over Time",
            "reason": "Date column detected with numeric values - ideal for time series visualization.",
        })

    # Category + Numeric -> Bar chart
    if categorical_cols and numeric_cols:
        # Pick categorical with fewer unique values
        best_cat = min(
            categorical_cols,
            key=lambda c: df[c].nunique()
        )
        recommendations.append({
            "chart_type": "bar",
            "x_column": best_cat,
            "y_column": numeric_cols[0],
            "title": f"{numeric_cols[0]} by {best_cat}",
            "reason": f"Categorical column '{best_cat}' ({df[best_cat].nunique()} categories) paired with numeric column.",
        })

    # Category distribution -> Pie chart
    if categorical_cols:
        best_cat = min(
            categorical_cols,
            key=lambda c: df[c].nunique()
        )
        unique_count = df[best_cat].nunique()
        if unique_count <= 8:
            recommendations.append({
                "chart_type": "pie",
                "x_column": best_cat,
                "y_column": None,
                "title": f"Distribution of {best_cat}",
                "reason": f"Categorical column '{best_cat}' with {unique_count} categories - suitable for pie chart.",
            })

    # Numeric + Numeric -> Scatter plot
    if len(numeric_cols) >= 2:
        recommendations.append({
            "chart_type": "scatter",
            "x_column": numeric_cols[0],
            "y_column": numeric_cols[1],
            "title": f"{numeric_cols[1]} vs {numeric_cols[0]}",
            "reason": "Two numeric columns - scatter plot reveals relationships and patterns.",
        })

    # Single numeric -> Histogram
    if numeric_cols:
        recommendations.append({
            "chart_type": "histogram",
            "x_column": numeric_cols[0],
            "y_column": None,
            "title": f"Distribution of {numeric_cols[0]}",
            "reason": "Numeric column - histogram shows value distribution and shape.",
        })

    # Bar chart for comparing multiple numeric columns
    if len(numeric_cols) >= 3:
        recommendations.append({
            "chart_type": "bar",
            "x_column": "Column",
            "y_column": numeric_cols[0],
            "title": f"Comparison of Numeric Columns",
            "reason": f"Multiple numeric columns ({len(numeric_cols)}) - grouped comparison chart.",
        })

    # Area chart for stacked time series
    if date_cols and len(numeric_cols) >= 2:
        recommendations.append({
            "chart_type": "area",
            "x_column": date_cols[0],
            "y_column": numeric_cols[0],
            "title": f"{numeric_cols[0]} Area Over Time",
            "reason": "Date with numeric data - area chart shows cumulative trends.",
        })

    return recommendations


def generate_report(df: pd.DataFrame, filename: str = "Dataset") -> dict:
    """Generate a structured analysis report.

    Sections: Executive Summary, Dataset Overview, Key Statistics,
    Main Trends, Comparisons, Outliers, Correlations, Insights,
    Recommendations, Limitations
    """
    if df.empty:
        return {
            "title": f"Analysis Report: {filename}",
            "sections": {
                "executive_summary": "Dataset is empty. No analysis possible.",
                "dataset_overview": {"rows": 0, "columns": 0},
                "key_statistics": {},
                "main_trends": {},
                "comparisons": {},
                "outliers": {},
                "correlations": [],
                "insights": [],
                "recommendations": ["Upload a non-empty dataset for analysis."],
                "limitations": ["Cannot analyze empty data."],
            },
        }

    rows = len(df)
    columns = len(df.columns)
    total_cells = rows * columns
    missing_cells = int(df.isna().sum().sum())
    dup_count = int(df.duplicated().sum())

    # Column types
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = []
    date_cols = []
    boolean_cols = []
    for col in df.columns:
        if col in numeric_cols:
            continue
        ct = _detect_column_type(df[col])
        if ct == "categorical":
            categorical_cols.append(col)
        elif ct == "date":
            date_cols.append(col)
        elif ct == "boolean":
            boolean_cols.append(col)

    # Key Statistics
    key_stats = {}
    for col in numeric_cols:
        vals = _safe_numeric(df[col])
        if len(vals) > 0:
            key_stats[col] = {
                "mean": round(float(vals.mean()), 4),
                "median": round(float(vals.median()), 4),
                "std": round(float(vals.std()), 4) if len(vals) > 1 else 0.0,
                "min": round(float(vals.min()), 4),
                "max": round(float(vals.max()), 4),
                "count": int(len(vals)),
            }

    # Main Trends (for each date+numeric pair)
    main_trends = {}
    if date_cols and numeric_cols:
        for dcol in date_cols[:2]:
            for vcol in numeric_cols[:2]:
                trend_result = detect_trends(df, date_col=dcol, value_col=vcol)
                if "error" not in trend_result:
                    main_trends[f"{vcol}_over_{dcol}"] = {
                        "direction": trend_result.get("trend_direction"),
                        "slope": trend_result.get("slope_per_period"),
                        "r_squared": trend_result.get("r_squared"),
                    }

    # Comparisons (for first categorical + first numeric)
    comparisons = {}
    if categorical_cols and numeric_cols:
        comp_result = compare_groups(df, group_col=categorical_cols[0], value_col=numeric_cols[0])
        if "error" not in comp_result:
            comparisons = {
                "group_column": comp_result.get("group_column"),
                "value_column": comp_result.get("value_column"),
                "group_count": comp_result.get("group_count"),
                "highest": comp_result.get("highest_group"),
                "lowest": comp_result.get("lowest_group"),
            }

    # Outliers
    outlier_result = detect_anomalies(df)
    outlier_summary = outlier_result.get("summary", {})
    outlier_count = outlier_result.get("total_anomalies", 0)

    # Correlations
    correlations = []
    if len(numeric_cols) >= 2:
        numeric_df = df[numeric_cols].dropna()
        if len(numeric_df) >= 3:
            corr_matrix = numeric_df.corr()
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i + 1:]:
                    val = float(corr_matrix.loc[col1, col2])
                    if not np.isnan(val):
                        strength = "strong" if abs(val) >= 0.7 else "moderate" if abs(val) >= 0.4 else "weak"
                        direction = "positive" if val > 0 else "negative"
                        correlations.append({
                            "columns": [col1, col2],
                            "correlation": round(val, 4),
                            "strength": f"{strength} {direction}",
                        })

    # Insights (from generate_insights)
    insights_result = generate_insights(df)
    insights = insights_result.get("key_findings", [])
    recommendations = insights_result.get("recommendations", [])

    # Limitations
    limitations = []
    if missing_cells > 0:
        pct = round(missing_cells / total_cells * 100, 2)
        limitations.append(f"Missing data ({pct}%) may affect accuracy of some analyses.")
    if dup_count > 0:
        limitations.append(f"{dup_count} duplicate rows could skew aggregate statistics.")
    if rows < 30:
        limitations.append(f"Small sample size ({rows} rows) limits statistical confidence.")
    if not date_cols:
        limitations.append("No date columns detected - time-based trend analysis not available.")
    if not numeric_cols:
        limitations.append("No numeric columns detected - statistical analysis limited.")
    if not limitations:
        limitations.append("No significant limitations detected.")

    # Executive Summary
    type_parts = []
    if numeric_cols:
        type_parts.append(f"{len(numeric_cols)} numeric")
    if categorical_cols:
        type_parts.append(f"{len(categorical_cols)} categorical")
    if date_cols:
        type_parts.append(f"{len(date_cols)} date")
    if boolean_cols:
        type_parts.append(f"{len(boolean_cols)} boolean")
    type_summary = ", ".join(type_parts) if type_parts else "no significant columns"

    executive_summary = (
        f"'{filename}' contains {rows} rows and {columns} columns ({type_summary}). "
        f"{missing_cells} cells ({round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0}%) have missing values. "
    )
    if main_trends:
        trend_dirs = [t["direction"] for t in main_trends.values() if t.get("direction")]
        if trend_dirs:
            executive_summary += f"Detected trends: {', '.join(set(trend_dirs))}. "
    if outlier_count > 0:
        executive_summary += f"{outlier_count} anomalies detected. "
    executive_summary += f"Analysis complete with {len(recommendations)} recommendations."

    return _sanitize({
        "title": f"Analysis Report: {filename}",
        "sections": {
            "executive_summary": executive_summary,
            "dataset_overview": {
                "rows": rows,
                "columns": columns,
                "total_cells": total_cells,
                "missing_cells": missing_cells,
                "missing_pct": round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0.0,
                "duplicate_rows": dup_count,
                "numeric_columns": len(numeric_cols),
                "categorical_columns": len(categorical_cols),
                "date_columns": len(date_cols),
                "boolean_columns": len(boolean_cols),
            },
            "key_statistics": key_stats,
            "main_trends": main_trends,
            "comparisons": comparisons,
            "outliers": outlier_summary,
            "correlations": correlations,
            "insights": insights,
            "recommendations": recommendations,
            "limitations": limitations,
        },
    })


def explain_analysis(df: pd.DataFrame, analysis_type: str, params: dict) -> dict:
    """Explain how an analysis was performed.

    Returns: what was calculated, columns used, how, assumptions, limitations
    """
    explanations = {
        "auto_profile": {
            "what": "Automatic data profiling that summarizes dataset structure and quality.",
            "how": (
                "For each column, the type is detected (numeric, categorical, date, boolean, text). "
                "Numeric columns get min, max, mean, median, std, IQR, and outlier counts. "
                "Categorical columns get value counts and most common values. "
                "Date columns get earliest/latest dates and range in days. "
                "Missing values and duplicates are counted across the entire dataset."
            ),
            "assumptions": [
                "Column type is inferred from data values and pandas dtype.",
                "Categorical type is assigned if unique values <= 20.",
                "Outliers are detected using the IQR method (1.5 * IQR beyond Q1/Q3).",
            ],
            "limitations": [
                "Date detection relies on pandas datetime parsing; some formats may not be detected.",
                "Inferred types may not match the true semantic meaning of the data.",
            ],
        },
        "generate_insights": {
            "what": "Smart insights including key findings, correlations, outliers, and recommendations.",
            "how": (
                "Combines auto_profile statistics, IQR-based outlier detection, and Pearson correlation "
                "analysis. Key findings are derived from missing data percentages, duplicate counts, "
                "and column type distributions. Recommendations are generated based on data quality issues."
            ),
            "assumptions": [
                "Correlation uses Pearson method (linear relationships only).",
                "Outliers use IQR method with 1.5x multiplier.",
                "Recommendations are heuristic-based.",
            ],
            "limitations": [
                "Does not detect non-linear relationships.",
                "Recommendations may not apply to all use cases.",
            ],
        },
        "detect_trends": {
            "what": "Time series trend detection using linear regression.",
            "how": (
                "Data is sorted by date column. A linear regression (numpy polyfit, degree 1) is fitted "
                "to the numeric values. The slope indicates direction (positive = increasing, negative = decreasing). "
                "R-squared measures fit quality. Peaks and drops are identified as local extrema. "
                "Period-over-period absolute and percentage changes are calculated."
            ),
            "assumptions": [
                "Trend is approximated as linear.",
                "Date column is parseable by pandas to_datetime.",
                "Periods are assumed to be evenly spaced (uses median date difference for forecasting).",
            ],
            "limitations": [
                "Cannot detect seasonal patterns, cyclical trends, or non-linear patterns.",
                "Requires at least 2 data points.",
                "Unevenly spaced dates may affect slope interpretation.",
            ],
        },
        "compare_groups": {
            "what": "Comparison of groups defined by a categorical column on a numeric value.",
            "how": (
                "Groups are formed by unique values in the group column. For each group, mean, median, "
                "std, min, max, and sum are calculated on the numeric column. Groups are ranked by mean. "
                "The percentage difference between highest and lowest groups is computed."
            ),
            "assumptions": [
                "Groups are compared using arithmetic mean by default.",
                "NaN rows are excluded from calculations.",
            ],
            "limitations": [
                "Does not perform statistical significance testing.",
                "Groups with very different sizes may not be directly comparable.",
            ],
        },
        "top_bottom": {
            "what": "Retrieves the top or bottom N values from a numeric column.",
            "how": (
                "The numeric column is sorted in descending (top) or ascending (bottom) order. "
                "The top N rows are returned along with all column values for context."
            ),
            "assumptions": [
                "Sorting is based on the numeric column only.",
                "Ties are broken by original row order.",
            ],
            "limitations": [
                "Does not handle ties explicitly.",
                "Only works with numeric columns.",
            ],
        },
        "detect_anomalies": {
            "what": "Outlier detection using IQR and Z-score methods.",
            "how": (
                "IQR method: Values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR are flagged. "
                "Z-score method: Values with |z| > 2 (where z = (x - mean) / std) are flagged. "
                "If both methods flag the same point, it is marked as 'IQR + Z-score' anomaly."
            ),
            "assumptions": [
                "IQR multiplier is fixed at 1.5 (standard).",
                "Z-score threshold is fixed at 2 (covers ~95% of normal distribution).",
                "Assumes roughly normal distribution for Z-score method.",
            ],
            "limitations": [
                "IQR method may miss anomalies in skewed distributions.",
                "Z-score is sensitive to extreme values (mean and std are affected by outliers).",
                "Requires at least 4 data points per column.",
            ],
        },
        "forecast_simple": {
            "what": "Simple linear forecast using linear regression.",
            "how": (
                "A linear regression is fitted to the time series data using numpy polyfit (degree 1). "
                "Future values are projected by extending the trend line forward by the specified number of periods. "
                "Period spacing is estimated from the median difference between consecutive dates. "
                "R-squared indicates forecast reliability."
            ),
            "assumptions": [
                "Future trend continues linearly (no seasonality or regime changes).",
                "Time periods are approximately evenly spaced.",
                "Requires at least 3 data points.",
            ],
            "limitations": [
                "Cannot capture non-linear patterns, seasonality, or cyclical effects.",
                "Forecast accuracy degrades rapidly for longer horizons.",
                "Confidence intervals are approximate (based on residual standard error).",
            ],
        },
        "auto_chart_recommend": {
            "what": "Chart type recommendations based on column data types.",
            "how": (
                "Columns are classified as date, numeric, categorical, boolean, or text. "
                "Combinations of types map to chart types: Date+Numeric -> Line, Category+Numeric -> Bar, "
                "Category -> Pie (if <=8 categories), Numeric+Numeric -> Scatter, Numeric -> Histogram."
            ),
            "assumptions": [
                "Chart suitability is determined purely by data types.",
                "First matching column of each type is used.",
            ],
            "limitations": [
                "Does not consider data volume, distribution shape, or user preferences.",
                "May recommend charts that are not meaningful for the specific data context.",
            ],
        },
        "generate_report": {
            "what": "Comprehensive structured analysis report.",
            "how": (
                "Calls detect_trends, compare_groups, detect_anomalies, and generate_insights internally. "
                "Results are organized into sections: Executive Summary, Dataset Overview, Key Statistics, "
                "Main Trends, Comparisons, Outliers, Correlations, Insights, Recommendations, Limitations."
            ),
            "assumptions": [
                "Report sections are generated from automated calculations.",
                "Insights and recommendations use heuristic rules.",
            ],
            "limitations": [
                "Report does not include visualizations.",
                "Interpretation is left to the user.",
            ],
        },
    }

    if analysis_type not in explanations:
        return {
            "error": f"Unknown analysis type '{analysis_type}'.",
            "available_types": list(explanations.keys()),
        }

    base = explanations[analysis_type].copy()
    base["analysis_type"] = analysis_type
    base["available_types"] = list(explanations.keys())
    base["params_used"] = params
    base["dataset_shape"] = {"rows": len(df), "columns": len(df.columns)}
    base["columns_in_dataset"] = list(df.columns)

    return _sanitize(base)
