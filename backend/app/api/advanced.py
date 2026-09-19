import re
import json
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, File as FileModel
from app.schemas.advanced_schemas import (
    TrendRequest,
    CompareRequest,
    TopBottomRequest,
    AnomalyRequest,
    ForecastRequest,
    AskRequest,
    ExplainRequest,
    GenericAnalysisResponse,
)
from app.utils.security import get_current_user
from app.services.excel_service import parse_excel
from app.services.stats_service import (
    calculate_statistics,
    calculate_full_statistics,
)
from app.services.data_analysis_tools import execute_tool, TOOLS_MAP
from app.services.ai_service import (
    build_rich_context,
    call_ai_api,
    parse_chart_request,
)

router = APIRouter(prefix="/api/analysis", tags=["advanced"])


def _load_dataframe(db_file: FileModel, sheet_name: str = None):
    parsed = parse_excel(db_file.file_path)
    target_sheet = sheet_name
    if not target_sheet and parsed["sheets"]:
        target_sheet = parsed["sheets"][0]["name"]
    if not target_sheet:
        return None, None, None, None
    sheet_info = next((s for s in parsed["sheets"] if s["name"] == target_sheet), None)
    if not sheet_info:
        return None, None, None, None
    df = pd.read_excel(db_file.file_path, sheet_name=target_sheet)
    col_types = sheet_info.get("column_types", {})
    return df, col_types, target_sheet, parsed


def _get_file(file_id: str, user: User, db: Session) -> FileModel:
    db_file = (
        db.query(FileModel)
        .filter(FileModel.id == file_id, FileModel.user_id == user.id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    return db_file


def _load(file_id: str, user: User, db: Session):
    db_file = _get_file(file_id, user, db)
    df, col_types, sheet_name, parsed = _load_dataframe(db_file)
    if df is None:
        raise HTTPException(status_code=400, detail="Could not load worksheet")
    return db_file, df, col_types, sheet_name, parsed


def _sanitize(obj):
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


# === 1. POST /{file_id}/profile ===
@router.post("/{file_id}/profile", response_model=GenericAnalysisResponse)
def profile_dataset(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)
        stats = calculate_statistics(df)
        full_stats = calculate_full_statistics(df)

        profile = {
            "sheet_name": sheet_name,
            "overview": full_stats.get("overview", {}),
            "columns": {},
            "correlation": full_stats.get("correlation", {}),
            "outliers": full_stats.get("outliers", {}),
            "insights": full_stats.get("insights", []),
        }

        for col_name, col_stat in stats.get("columns", {}).items():
            profile["columns"][col_name] = {
                "type": col_types.get(col_name, col_stat.get("type", "unknown")),
                "missing_count": col_stat.get("missing_count", 0),
                "missing_pct": col_stat.get("missing_pct", 0),
                "non_null_count": col_stat.get("non_null_count", 0),
            }
            if col_stat.get("type") == "numeric":
                for key in ["count", "sum", "mean", "median", "min", "max", "std", "variance", "range", "q1", "q3", "iqr", "skewness", "kurtosis"]:
                    if key in col_stat:
                        profile["columns"][col_name][key] = col_stat[key]
            elif col_stat.get("type") in ("categorical", "text"):
                for key in ["count", "unique_count", "most_common", "most_common_count", "frequency_distribution", "percentages"]:
                    if key in col_stat:
                        profile["columns"][col_name][key] = col_stat[key]
            elif col_stat.get("type") == "date":
                for key in ["count", "earliest", "latest", "range_days", "by_month", "by_year"]:
                    if key in col_stat:
                        profile["columns"][col_name][key] = col_stat[key]
            elif col_stat.get("type") == "boolean":
                for key in ["count", "true_count", "false_count", "true_pct"]:
                    if key in col_stat:
                        profile["columns"][col_name][key] = col_stat[key]

        return GenericAnalysisResponse(success=True, data=_sanitize(profile))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profiling failed: {str(e)}")


# === 2. POST /{file_id}/insights ===
@router.post("/{file_id}/insights", response_model=GenericAnalysisResponse)
def generate_insights_endpoint(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)
        full_stats = calculate_full_statistics(df)

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "insights": full_stats.get("insights", []),
                "overview": full_stats.get("overview", {}),
                "correlation": full_stats.get("correlation", {}),
                "outliers": full_stats.get("outliers", {}),
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insight generation failed: {str(e)}")


# === 3. POST /{file_id}/trends ===
@router.post("/{file_id}/trends", response_model=GenericAnalysisResponse)
def detect_trends(
    file_id: str,
    body: TrendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        date_col = body.date_column
        value_col = body.value_column

        if not date_col:
            date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
            if not date_cols:
                date_cols = [c for c in df.columns if col_types.get(c) == "date"]
            if not date_cols:
                raise HTTPException(status_code=400, detail="No date column found. Please specify date_column.")
            date_col = date_cols[0]

        if date_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{date_col}' not found")

        if not value_col:
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if not numeric_cols:
                raise HTTPException(status_code=400, detail="No numeric column found. Please specify value_column.")
            value_col = numeric_cols[0]

        if value_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{value_col}' not found")

        temp = df[[date_col, value_col]].copy()
        temp[date_col] = pd.to_datetime(temp[date_col], errors="coerce")
        temp[value_col] = pd.to_numeric(temp[value_col], errors="coerce")
        temp = temp.dropna().sort_values(date_col)

        if len(temp) < 2:
            raise HTTPException(status_code=400, detail="Insufficient data points for trend detection (need at least 2)")

        values = temp[value_col].values
        x_numeric = np.arange(len(values), dtype=float)

        coeffs = np.polyfit(x_numeric, values, 1)
        slope = round(float(coeffs[0]), 4)
        intercept = round(float(coeffs[1]), 4)

        mean_val = float(np.mean(values))
        std_val = float(np.std(values)) if len(values) > 1 else 0.0

        residuals = values - np.polyval(coeffs, x_numeric)
        ss_res = float(np.sum(residuals ** 2))
        ss_tot = float(np.sum((values - mean_val) ** 2))
        r_squared = round(1 - (ss_res / ss_tot), 4) if ss_tot != 0 else 0.0

        if abs(slope) < 1e-10:
            direction = "stable"
        elif slope > 0:
            direction = "increasing"
        else:
            direction = "decreasing"

        if abs(r_squared) >= 0.7:
            confidence = "strong"
        elif abs(r_squared) >= 0.4:
            confidence = "moderate"
        else:
            confidence = "weak"

        first_half = values[: len(values) // 2]
        second_half = values[len(values) // 2 :]
        first_mean = float(np.mean(first_half)) if len(first_half) > 0 else 0
        second_mean = float(np.mean(second_half)) if len(second_half) > 0 else 0
        pct_change = round(((second_mean - first_mean) / first_mean) * 100, 2) if first_mean != 0 else None

        time_series = []
        for _, row in temp.iterrows():
            d = row[date_col]
            time_series.append({
                "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
                "value": round(float(row[value_col]), 4),
            })

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "date_column": date_col,
                "value_column": value_col,
                "data_points": len(temp),
                "slope": slope,
                "intercept": intercept,
                "r_squared": r_squared,
                "direction": direction,
                "confidence": confidence,
                "mean": round(mean_val, 4),
                "std": round(std_val, 4),
                "period_pct_change": pct_change,
                "time_series": time_series,
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trend detection failed: {str(e)}")


# === 4. POST /{file_id}/compare ===
@router.post("/{file_id}/compare", response_model=GenericAnalysisResponse)
def compare_groups(
    file_id: str,
    body: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        if body.group_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Group column '{body.group_column}' not found")
        if body.value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Value column '{body.value_column}' not found")

        temp = df[[body.group_column, body.value_column]].copy()
        temp[body.value_column] = pd.to_numeric(temp[body.value_column], errors="coerce")
        temp = temp.dropna()

        if len(temp) == 0:
            raise HTTPException(status_code=400, detail="No valid numeric data for comparison")

        grouped = temp.groupby(body.group_column)[body.value_column]

        groups = {}
        for name, group in grouped:
            vals = group.values
            groups[str(name)] = {
                "count": int(len(vals)),
                "mean": round(float(np.mean(vals)), 4),
                "median": round(float(np.median(vals)), 4),
                "min": round(float(np.min(vals)), 4),
                "max": round(float(np.max(vals)), 4),
                "std": round(float(np.std(vals)), 4) if len(vals) > 1 else 0.0,
                "sum": round(float(np.sum(vals)), 4),
            }

        sorted_groups = dict(sorted(groups.items(), key=lambda x: x[1]["mean"], reverse=True))

        all_means = [g["mean"] for g in groups.values()]
        overall_mean = round(float(np.mean(all_means)), 4) if all_means else 0

        summary = {
            "total_groups": len(groups),
            "overall_mean": overall_mean,
            "highest_group": next(iter(sorted_groups)) if sorted_groups else None,
            "lowest_group": next(reversed(list(sorted_groups.keys()))) if sorted_groups else None,
        }

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "group_column": body.group_column,
                "value_column": body.value_column,
                "groups": sorted_groups,
                "summary": summary,
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Group comparison failed: {str(e)}")


# === 5. POST /{file_id}/top-bottom ===
@router.post("/{file_id}/top-bottom", response_model=GenericAnalysisResponse)
def top_bottom(
    file_id: str,
    body: TopBottomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        if body.column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{body.column}' not found")

        temp = df.copy()
        is_numeric = pd.api.types.is_numeric_dtype(temp[body.column])
        if not is_numeric:
            temp["_sort_key"] = pd.to_numeric(temp[body.column], errors="coerce")
            sort_col = "_sort_key"
        else:
            sort_col = body.column

        sorted_df = temp.sort_values(sort_col, ascending=body.ascending, na_position="last").head(body.n)
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

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "column": body.column,
                "n": body.n,
                "ascending": body.ascending,
                "rows": result,
                "total_rows": len(df),
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Top/bottom analysis failed: {str(e)}")


# === 6. POST /{file_id}/anomalies ===
@router.post("/{file_id}/anomalies", response_model=GenericAnalysisResponse)
def detect_anomalies(
    file_id: str,
    body: AnomalyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        target_cols = []
        if body.column:
            if body.column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{body.column}' not found")
            target_cols = [body.column]
        else:
            target_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if not target_cols:
            raise HTTPException(status_code=400, detail="No numeric columns found for anomaly detection")

        anomalies = {}
        for col in target_cols:
            vals = df[col].dropna()
            if len(vals) < 4:
                continue

            q1 = float(vals.quantile(0.25))
            q3 = float(vals.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr

            outlier_mask = (vals < lower) | (vals > upper)
            outlier_indices = vals[outlier_mask].index.tolist()
            outlier_values = [round(float(v), 4) for v in vals[outlier_mask].values]

            anomalies[col] = {
                "q1": round(q1, 4),
                "q3": round(q3, 4),
                "iqr": round(iqr, 4),
                "lower_bound": round(lower, 4),
                "upper_bound": round(upper, 4),
                "outlier_count": len(outlier_values),
                "total_count": len(vals),
                "outlier_percentage": round(len(outlier_values) / len(vals) * 100, 2),
                "outlier_values": outlier_values[:20],
                "outlier_indices": outlier_indices[:20],
            }

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "anomalies": anomalies,
                "columns_analyzed": len(anomalies),
                "method": "IQR (Interquartile Range)",
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")


# === 7. POST /{file_id}/forecast ===
@router.post("/{file_id}/forecast", response_model=GenericAnalysisResponse)
def forecast(
    file_id: str,
    body: ForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        if body.date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Date column '{body.date_column}' not found")
        if body.value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Value column '{body.value_column}' not found")

        temp = df[[body.date_column, body.value_column]].copy()
        temp[body.date_column] = pd.to_datetime(temp[body.date_column], errors="coerce")
        temp[body.value_column] = pd.to_numeric(temp[body.value_column], errors="coerce")
        temp = temp.dropna().sort_values(body.date_column)

        if len(temp) < 3:
            raise HTTPException(status_code=400, detail="Need at least 3 data points for forecasting")

        values = temp[body.value_column].values
        x = np.arange(len(values), dtype=float)

        coeffs = np.polyfit(x, values, 1)
        slope = float(coeffs[0])
        intercept = float(coeffs[1])

        forecast_values = []
        residuals = values - np.polyval(coeffs, x)
        std_residuals = float(np.std(residuals)) if len(residuals) > 1 else 0.0

        last_date = temp[body.date_column].iloc[-1]
        date_diff = (temp[body.date_column].iloc[-1] - temp[body.date_column].iloc[0]) / max(len(temp) - 1, 1)

        for i in range(1, body.periods + 1):
            next_x = len(values) + i - 1
            predicted = round(float(slope * next_x + intercept), 4)
            lower = round(predicted - 1.96 * std_residuals, 4)
            upper = round(predicted + 1.96 * std_residuals, 4)
            forecast_date = last_date + date_diff * i

            forecast_values.append({
                "period": i,
                "date": forecast_date.isoformat() if hasattr(forecast_date, "isoformat") else str(forecast_date),
                "predicted": predicted,
                "lower_bound": lower,
                "upper_bound": upper,
            })

        ss_res = float(np.sum(residuals ** 2))
        ss_tot = float(np.sum((values - np.mean(values)) ** 2))
        r_squared = round(1 - (ss_res / ss_tot), 4) if ss_tot != 0 else 0.0

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "date_column": body.date_column,
                "value_column": body.value_column,
                "historical_points": len(values),
                "forecast_periods": body.periods,
                "slope": round(slope, 4),
                "intercept": round(intercept, 4),
                "r_squared": r_squared,
                "method": "Linear Regression",
                "forecast": forecast_values,
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")


# === 8. POST /{file_id}/chart-recommend ===
@router.post("/{file_id}/chart-recommend", response_model=GenericAnalysisResponse)
def recommend_chart(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        recommendations = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = [c for c in df.columns if col_types.get(c) in ("categorical", "text")]
        date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c]) or col_types.get(c) == "date"]

        if date_cols and numeric_cols:
            recommendations.append({
                "chart_type": "line",
                "title": f"Time Series: {numeric_cols[0]} over {date_cols[0]}",
                "x_column": date_cols[0],
                "y_column": numeric_cols[0],
                "reason": "Date column detected with numeric values - line chart shows trends over time",
                "priority": 1,
            })

        if categorical_cols and numeric_cols:
            recommendations.append({
                "chart_type": "bar",
                "title": f"{numeric_cols[0]} by {categorical_cols[0]}",
                "x_column": categorical_cols[0],
                "y_column": numeric_cols[0],
                "reason": "Categorical and numeric columns detected - bar chart compares values across categories",
                "priority": 2,
            })

        if len(numeric_cols) >= 2:
            recommendations.append({
                "chart_type": "scatter",
                "title": f"{numeric_cols[0]} vs {numeric_cols[1]}",
                "x_column": numeric_cols[0],
                "y_column": numeric_cols[1],
                "reason": "Two numeric columns detected - scatter plot reveals correlation",
                "priority": 3,
            })

        if categorical_cols:
            recommendations.append({
                "chart_type": "pie",
                "title": f"Distribution of {categorical_cols[0]}",
                "x_column": categorical_cols[0],
                "y_column": None,
                "reason": "Categorical column detected - pie chart shows proportion distribution",
                "priority": 4,
            })

        if numeric_cols:
            recommendations.append({
                "chart_type": "histogram",
                "title": f"Distribution of {numeric_cols[0]}",
                "x_column": numeric_cols[0],
                "y_column": None,
                "reason": "Numeric column detected - histogram shows value distribution",
                "priority": 5,
            })

        if date_cols and len(numeric_cols) >= 2:
            recommendations.append({
                "chart_type": "area",
                "title": f"Stacked Area: {numeric_cols[:2]} over {date_cols[0]}",
                "x_column": date_cols[0],
                "y_column": numeric_cols[:2],
                "reason": "Multiple numeric columns with dates - area chart shows cumulative trends",
                "priority": 6,
            })

        recommendations.sort(key=lambda x: x["priority"])

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "recommendations": recommendations,
                "available_columns": {
                    "numeric": numeric_cols,
                    "categorical": categorical_cols,
                    "date": date_cols,
                },
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart recommendation failed: {str(e)}")


# === 9. POST /{file_id}/report ===
@router.post("/{file_id}/report", response_model=GenericAnalysisResponse)
def generate_report(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, _ = _load(file_id, current_user, db)

        stats = calculate_statistics(df)
        full_stats = calculate_full_statistics(df)

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = [c for c in df.columns if col_types.get(c) in ("categorical", "text")]

        key_metrics = {}
        if numeric_cols:
            for col in numeric_cols[:10]:
                col_stat = stats.get("columns", {}).get(col, {})
                if col_stat.get("type") == "numeric":
                    key_metrics[col] = {
                        "mean": col_stat.get("mean"),
                        "median": col_stat.get("median"),
                        "min": col_stat.get("min"),
                        "max": col_stat.get("max"),
                    }

        group_analysis = {}
        if categorical_cols and numeric_cols:
            target_cat = categorical_cols[0]
            target_num = numeric_cols[0]
            temp = df[[target_cat, target_num]].copy()
            temp[target_num] = pd.to_numeric(temp[target_num], errors="coerce")
            temp = temp.dropna()
            if len(temp) > 0:
                grouped = temp.groupby(target_cat)[target_num].agg(["mean", "count"]).to_dict("index")
                group_analysis = {k: {"mean": round(float(v["mean"]), 4), "count": int(v["count"])} for k, v in grouped.items()}

        top_bottom = {}
        if numeric_cols:
            for col in numeric_cols[:5]:
                vals = df[col].dropna()
                if len(vals) > 0:
                    top_bottom[col] = {
                        "top_5": [round(float(v), 4) for v in vals.nlargest(5).values],
                        "bottom_5": [round(float(v), 4) for v in vals.nsmallest(5).values],
                    }

        report = {
            "title": f"Analysis Report: {db_file.original_filename}",
            "sheet": sheet_name,
            "generated_at": pd.Timestamp.now().isoformat(),
            "overview": full_stats.get("overview", {}),
            "key_metrics": key_metrics,
            "group_analysis": group_analysis,
            "top_bottom_values": top_bottom,
            "correlation": full_stats.get("correlation", {}),
            "outliers": full_stats.get("outliers", {}),
            "insights": full_stats.get("insights", []),
            "data_quality": {
                "total_cells": stats.get("total_rows", 0) * stats.get("total_columns", 0),
                "missing_cells": stats.get("missing_values_total", 0),
            },
        }

        return GenericAnalysisResponse(success=True, data=_sanitize(report))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


# === 10. POST /{file_id}/explain ===
@router.post("/{file_id}/explain", response_model=GenericAnalysisResponse)
def explain_analysis(
    file_id: str,
    body: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, parsed = _load(file_id, current_user, db)

        stats = calculate_statistics(df)
        full_stats = calculate_full_statistics(df)

        file_info = {
            "filename": db_file.original_filename,
            "sheet_name": sheet_name,
        }

        context = build_rich_context(
            df=df,
            column_types=col_types,
            statistics=stats,
            full_stats=full_stats,
            file_info=file_info,
        )

        params_str = ""
        if body.params:
            params_str = "\nAdditional parameters: " + json.dumps(body.params)

        question = f"Explain the {body.analysis_type} analysis for this dataset in detail.{params_str} Provide clear, actionable insights."

        system_prompt = (
            "You are an expert data analyst. Explain analysis results clearly and thoroughly. "
            "Break down complex concepts into simple terms. Highlight key findings with specific numbers. "
            "Provide actionable recommendations. Note any limitations or caveats. "
            "Respond in the same language as the dataset suggests."
        )

        ai_response = call_ai_api(context, question, [], system_prompt=system_prompt, user_id=current_user.id, file_id=db_file.id)

        chart_request = parse_chart_request(ai_response)

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "analysis_type": body.analysis_type,
                "explanation": ai_response,
                "chart_request": chart_request,
                "params": body.params,
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


# === 11. POST /{file_id}/ask ===
@router.post("/{file_id}/ask", response_model=GenericAnalysisResponse)
def ask_question(
    file_id: str,
    body: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        db_file, df, col_types, sheet_name, parsed = _load(file_id, current_user, db)

        stats = calculate_statistics(df)
        full_stats = calculate_full_statistics(df)

        file_info = {
            "filename": db_file.original_filename,
            "sheet_name": sheet_name,
        }

        context = build_rich_context(
            df=df,
            column_types=col_types,
            statistics=stats,
            full_stats=full_stats,
            file_info=file_info,
        )

        ai_response = call_ai_api(context, body.question, [], user_id=current_user.id, file_id=db_file.id)

        tool_pattern = r"CALC:(\w+):(\{[^}]+\})"
        matches = re.findall(tool_pattern, ai_response)
        tool_results = []
        for tool_name, params_str in matches:
            try:
                params = json.loads(params_str)
                result = execute_tool(df, tool_name, params)
                tool_results.append({"tool": tool_name, "params": params, "result": result})
            except Exception:
                tool_results.append({"tool": tool_name, "params": params_str, "result": {"error": "Failed to parse"}})

        if tool_results:
            tool_summary = "\n\n**Calculated Results:**\n"
            for tr in tool_results:
                if "error" not in tr["result"]:
                    result_val = tr["result"].get("result", tr["result"])
                    tool_summary += f"- {tr['tool']}({tr['params']}): {result_val}\n"
                else:
                    tool_summary += f"- {tr['tool']}: {tr['result']['error']}\n"
            ai_response += tool_summary

        chart_request = parse_chart_request(ai_response)

        return GenericAnalysisResponse(
            success=True,
            data=_sanitize({
                "question": body.question,
                "answer": ai_response,
                "chart_request": chart_request,
                "tool_results": tool_results if tool_results else None,
            }),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question processing failed: {str(e)}")
