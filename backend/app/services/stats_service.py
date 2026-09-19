import pandas as pd
import numpy as np


def _sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def calculate_statistics(df: pd.DataFrame) -> dict:
    stats = {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "missing_values_total": int(df.isna().sum().sum()),
        "columns": {},
    }

    for col in df.columns:
        series = df[col]
        col_stat = {}
        non_null = series.dropna()
        missing_count = int(series.isna().sum())
        missing_pct = round(missing_count / len(series) * 100, 2) if len(series) > 0 else 0.0

        col_stat["missing_count"] = missing_count
        col_stat["missing_pct"] = missing_pct
        col_stat["non_null_count"] = int(non_null.count())

        if pd.api.types.is_bool_dtype(series) and len(non_null) > 0:
            bool_vals = non_null.astype(int)
            col_stat["type"] = "boolean"
            col_stat["count"] = int(len(non_null))
            col_stat["true_count"] = int(non_null.sum())
            col_stat["false_count"] = int((~non_null).sum())
            col_stat["true_pct"] = round(col_stat["true_count"] / len(non_null) * 100, 2)
        elif pd.api.types.is_numeric_dtype(series) and len(non_null) > 0:
            numeric_vals = pd.to_numeric(non_null, errors="coerce").dropna()
            if len(numeric_vals) > 0:
                col_stat["type"] = "numeric"
                col_stat["count"] = int(numeric_vals.count())
                col_stat["sum"] = round(float(numeric_vals.sum()), 4)
                col_stat["mean"] = round(float(numeric_vals.mean()), 4)
                col_stat["median"] = round(float(numeric_vals.median()), 4)
                col_stat["min"] = round(float(numeric_vals.min()), 4)
                col_stat["max"] = round(float(numeric_vals.max()), 4)
                col_stat["std"] = round(float(numeric_vals.std()), 4) if len(numeric_vals) > 1 else 0.0
                col_stat["variance"] = round(float(numeric_vals.var()), 4) if len(numeric_vals) > 1 else 0.0
                col_stat["range"] = round(float(numeric_vals.max() - numeric_vals.min()), 4)
                col_stat["q1"] = round(float(numeric_vals.quantile(0.25)), 4)
                col_stat["q2"] = round(float(numeric_vals.quantile(0.5)), 4)
                col_stat["q3"] = round(float(numeric_vals.quantile(0.75)), 4)
                col_stat["iqr"] = round(
                    float(numeric_vals.quantile(0.75) - numeric_vals.quantile(0.25)), 4
                )
                col_stat["skewness"] = round(float(numeric_vals.skew()), 4) if len(numeric_vals) > 2 else 0.0
                col_stat["kurtosis"] = round(float(numeric_vals.kurtosis()), 4) if len(numeric_vals) > 3 else 0.0
            else:
                col_stat["type"] = "numeric"
                col_stat["count"] = 0

        elif pd.api.types.is_datetime64_any_dtype(series) and len(non_null) > 0:
            date_vals = pd.to_datetime(non_null, errors="coerce").dropna()
            if len(date_vals) > 0:
                col_stat["type"] = "date"
                col_stat["count"] = int(date_vals.count())
                col_stat["earliest"] = str(date_vals.min())
                col_stat["latest"] = str(date_vals.max())
                col_stat["range_days"] = (date_vals.max() - date_vals.min()).days

                by_month = date_vals.dt.to_period("M").value_counts().sort_index()
                col_stat["by_month"] = {str(k): int(v) for k, v in by_month.items()}

                by_year = date_vals.dt.year.value_counts().sort_index()
                col_stat["by_year"] = {str(k): int(v) for k, v in by_year.items()}
            else:
                col_stat["type"] = "date"
                col_stat["count"] = 0

        else:
            str_vals = non_null.astype(str)
            if len(str_vals) > 0:
                value_counts = str_vals.value_counts()
                unique_count = int(value_counts.count())
                col_stat["type"] = "categorical" if unique_count <= 20 else "text"
                col_stat["count"] = int(str_vals.count())
                col_stat["unique_count"] = unique_count
                col_stat["most_common"] = str(value_counts.index[0])
                col_stat["most_common_count"] = int(value_counts.iloc[0])
                col_stat["frequency_distribution"] = {
                    str(k): int(v) for k, v in value_counts.head(20).items()
                }
                col_stat["percentages"] = {
                    str(k): round(v / len(str_vals) * 100, 2)
                    for k, v in value_counts.head(20).items()
                }
            else:
                col_stat["type"] = "text"
                col_stat["count"] = 0
                col_stat["unique_count"] = 0

        stats["columns"][col] = col_stat

    return stats


def calculate_correlation(df: pd.DataFrame) -> dict:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) < 2:
        return {"matrix": {}, "numeric_columns": [], "strong_correlations": []}

    numeric_df = df[numeric_cols].dropna()
    if len(numeric_df) < 2:
        return {"matrix": {}, "numeric_columns": numeric_cols, "strong_correlations": []}

    corr_matrix = numeric_df.corr()
    matrix_dict = {}
    for col in corr_matrix.columns:
        matrix_dict[col] = {
            row: round(float(corr_matrix.loc[row, col]), 4)
            for row in corr_matrix.index
        }

    strong = []
    for i, col1 in enumerate(numeric_cols):
        for col2 in numeric_cols[i + 1:]:
            val = float(corr_matrix.loc[col1, col2])
            if abs(val) >= 0.7:
                strong.append({
                    "column1": col1,
                    "column2": col2,
                    "correlation": round(val, 4),
                    "strength": "strong positive" if val > 0 else "strong negative",
                })

    return {
        "matrix": matrix_dict,
        "numeric_columns": numeric_cols,
        "strong_correlations": strong,
    }


def detect_outliers(df: pd.DataFrame) -> dict:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    results = {}

    for col in numeric_cols:
        numeric_vals = df[col].dropna()
        if len(numeric_vals) < 4:
            continue

        q1 = float(numeric_vals.quantile(0.25))
        q3 = float(numeric_vals.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        outlier_mask = (numeric_vals < lower) | (numeric_vals > upper)
        outlier_count = int(outlier_mask.sum())

        results[col] = {
            "q1": round(q1, 4),
            "q3": round(q3, 4),
            "iqr": round(iqr, 4),
            "lower_bound": round(lower, 4),
            "upper_bound": round(upper, 4),
            "outlier_count": outlier_count,
            "total_count": len(numeric_vals),
            "outlier_percentage": round(outlier_count / len(numeric_vals) * 100, 2),
        }

    return results


def generate_insights(df: pd.DataFrame, column_stats: dict, correlation: dict, outliers: dict) -> list:
    insights = []

    numeric_cols = {
        k: v for k, v in column_stats.items()
        if v.get("type") == "numeric" and v.get("count", 0) > 0
    }
    categorical_cols = {
        k: v for k, v in column_stats.items()
        if v.get("type") in ("categorical", "text") and v.get("count", 0) > 0
    }
    all_cols = {k: v for k, v in column_stats.items() if v.get("count", 0) > 0 or v.get("non_null_count", 0) > 0}

    # Dataset size insight
    total_rows = len(df)
    total_cols = len(df.columns)
    insights.append({
        "type": "info",
        "title": "Dataset Size",
        "message": f"The dataset contains {total_rows} rows and {total_cols} columns ({total_rows * total_cols} total cells).",
    })

    # Missing data insight
    missing_cells = int(df.isna().sum().sum())
    total_cells = total_rows * total_cols
    if missing_cells > 0:
        pct = round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0
        insights.append({
            "type": "warning",
            "title": "Missing Data",
            "message": f"{missing_cells} cells ({pct}% of total) contain missing values.",
        })

    # Columns with high missing data
    high_missing = []
    for col, stats in all_cols.items():
        miss_pct = stats.get("missing_pct", 0)
        if miss_pct > 20:
            high_missing.append((col, miss_pct))
    if high_missing:
        high_missing.sort(key=lambda x: x[1], reverse=True)
        col_list = ", ".join(f"{c} ({p}%)" for c, p in high_missing[:5])
        insights.append({
            "type": "warning",
            "title": "Columns with High Missing Data",
            "message": f"The following columns have more than 20% missing values: {col_list}.",
        })

    # Numeric insights
    if numeric_cols:
        max_mean_col = max(numeric_cols.items(), key=lambda x: x[1].get("mean", 0))
        insights.append({
            "type": "info",
            "title": "Highest Average",
            "message": f"Column '{max_mean_col[0]}' has the highest average value of {max_mean_col[1]['mean']:.2f}.",
        })

        min_mean_col = min(numeric_cols.items(), key=lambda x: x[1].get("mean", float("inf")))
        insights.append({
            "type": "info",
            "title": "Lowest Average",
            "message": f"Column '{min_mean_col[0]}' has the lowest average value of {min_mean_col[1]['mean']:.2f}.",
        })

        global_max_col = max(numeric_cols.items(), key=lambda x: x[1].get("max", float("-inf")))
        insights.append({
            "type": "info",
            "title": "Highest Value",
            "message": f"The highest numeric value is {global_max_col[1]['max']:.2f} in column '{global_max_col[0]}'.",
        })

        global_min_col = min(numeric_cols.items(), key=lambda x: x[1].get("min", float("inf")))
        insights.append({
            "type": "info",
            "title": "Lowest Value",
            "message": f"The lowest numeric value is {global_min_col[1]['min']:.2f} in column '{global_min_col[0]}'.",
        })

        high_var_col = max(numeric_cols.items(), key=lambda x: x[1].get("std", 0))
        if high_var_col[1].get("std", 0) > 0:
            insights.append({
                "type": "info",
                "title": "Highest Variability",
                "message": f"Column '{high_var_col[0]}' has the highest standard deviation of {high_var_col[1]['std']:.2f}, indicating the most variability.",
            })

    # Categorical insights
    if categorical_cols:
        max_unique_col = max(categorical_cols.items(), key=lambda x: x[1].get("unique_count", 0))
        insights.append({
            "type": "info",
            "title": "Most Diverse Column",
            "message": f"Column '{max_unique_col[0]}' has the most unique values ({max_unique_col[1]['unique_count']}).",
        })

        most_freq_col = max(categorical_cols.items(), key=lambda x: x[1].get("most_common_count", 0))
        insights.append({
            "type": "info",
            "title": "Most Common Category",
            "message": f"The most common value overall is '{most_freq_col[1].get('most_common', '')}' in column '{most_freq_col[0]}' (appears {most_freq_col[1].get('most_common_count', 0)} times).",
        })

    # Correlation insights
    if correlation.get("strong_correlations"):
        for corr in correlation["strong_correlations"][:3]:
            direction = "positively" if corr["correlation"] > 0 else "negatively"
            insights.append({
                "type": "correlation",
                "title": "Strong Correlation",
                "message": f"Columns '{corr['column1']}' and '{corr['column2']}' are strongly {direction} correlated (r = {corr['correlation']:.4f}).",
                "note": "Correlation does not imply causation.",
            })

    # Outlier insights
    outlier_cols = {k: v for k, v in outliers.items() if v.get("outlier_count", 0) > 0}
    if outlier_cols:
        most_outliers = max(outlier_cols.items(), key=lambda x: x[1]["outlier_count"])
        insights.append({
            "type": "outlier",
            "title": "Outliers Detected",
            "message": f"Column '{most_outliers[0]}' has the most outliers ({most_outliers[1]['outlier_count']} potential outliers, {most_outliers[1]['outlier_percentage']:.1f}% of values).",
        })

    # Duplicate rows
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        insights.append({
            "type": "warning",
            "title": "Duplicate Rows",
            "message": f"{dup_count} duplicate row(s) detected ({round(dup_count / len(df) * 100, 2)}% of data).",
        })

    # Empty dataset
    if total_rows == 0:
        insights.append({
            "type": "warning",
            "title": "Empty Dataset",
            "message": "The dataset contains no rows.",
        })

    return insights


def calculate_dataset_overview(df: pd.DataFrame) -> dict:
    total_rows = len(df)
    total_cols = len(df.columns)
    total_cells = total_rows * total_cols
    missing_cells = int(df.isna().sum().sum())

    type_counts = {"numeric": 0, "text": 0, "date": 0, "categorical": 0, "boolean": 0}
    for col in df.columns:
        series = df[col]
        non_null = series.dropna()
        if len(non_null) == 0:
            type_counts["text"] += 1
        elif pd.api.types.is_bool_dtype(series):
            type_counts["boolean"] += 1
        elif pd.api.types.is_numeric_dtype(series):
            type_counts["numeric"] += 1
        elif pd.api.types.is_datetime64_any_dtype(series):
            type_counts["date"] += 1
        else:
            str_vals = non_null.astype(str)
            unique_count = str_vals.nunique()
            if unique_count <= 20:
                type_counts["categorical"] += 1
            else:
                type_counts["text"] += 1

    return {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "total_cells": total_cells,
        "missing_cells": missing_cells,
        "missing_percentage": round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0.0,
        "numeric_columns": type_counts["numeric"],
        "text_columns": type_counts["text"],
        "date_columns": type_counts["date"],
        "categorical_columns": type_counts["categorical"],
        "boolean_columns": type_counts["boolean"],
    }


def calculate_full_statistics(df: pd.DataFrame) -> dict:
    base_stats = calculate_statistics(df)
    overview = calculate_dataset_overview(df)
    correlation = calculate_correlation(df)
    outliers = detect_outliers(df)
    insights = generate_insights(df, base_stats["columns"], correlation, outliers)

    result = {
        "overview": overview,
        "columns": base_stats["columns"],
        "correlation": correlation,
        "outliers": outliers,
        "insights": insights,
    }

    return _sanitize_for_json(result)
