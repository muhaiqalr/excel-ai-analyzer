import httpx
import json
import pandas as pd
from typing import Optional

from app.config import settings


def build_rich_context(
    df: Optional[pd.DataFrame],
    column_types: dict,
    statistics: dict,
    full_stats: dict = None,
    file_info: dict = None,
) -> str:
    parts = []

    if file_info:
        parts.append("=== FILE INFORMATION ===")
        parts.append(f"File: {file_info.get('filename', 'Unknown')}")
        parts.append(f"Worksheet: {file_info.get('sheet_name', 'Unknown')}")
        parts.append("")

    overview = full_stats.get("overview", {}) if full_stats else {}
    parts.append("=== DATASET OVERVIEW ===")
    parts.append(f"Total rows: {statistics.get('total_rows', overview.get('total_rows', 0))}")
    parts.append(f"Total columns: {statistics.get('total_columns', overview.get('total_columns', 0))}")
    parts.append(f"Total cells: {overview.get('total_cells', 0)}")
    parts.append(f"Missing cells: {overview.get('missing_cells', 0)} ({overview.get('missing_percentage', 0)}%)")
    parts.append(f"Numeric columns: {overview.get('numeric_columns', 0)}")
    parts.append(f"Text columns: {overview.get('text_columns', 0)}")
    parts.append(f"Date columns: {overview.get('date_columns', 0)}")
    parts.append(f"Categorical columns: {overview.get('categorical_columns', 0)}")
    parts.append("")

    parts.append("=== COLUMN DETAILS ===")
    for col_name, col_stat in statistics.get("columns", {}).items():
        col_type = column_types.get(col_name, col_stat.get("type", "unknown"))
        parts.append(f"Column '{col_name}' (type: {col_type}):")

        if col_type == "numeric":
            for key in ["count", "sum", "mean", "median", "min", "max", "std", "variance", "range", "q1", "q3", "iqr", "missing_count", "missing_pct"]:
                if key in col_stat:
                    parts.append(f"  {key}: {col_stat[key]}")
        elif col_type in ("categorical", "text"):
            for key in ["count", "unique_count", "most_common", "most_common_count", "missing_count", "missing_pct"]:
                if key in col_stat:
                    parts.append(f"  {key}: {col_stat[key]}")
            freq = col_stat.get("frequency_distribution")
            if freq:
                parts.append(f"  Top values: {json.dumps(dict(list(freq.items())[:8]))}")
        elif col_type == "date":
            for key in ["count", "earliest", "latest", "range_days", "missing_count", "missing_pct"]:
                if key in col_stat:
                    parts.append(f"  {key}: {col_stat[key]}")
        elif col_type == "boolean":
            for key in ["count", "true_count", "false_count", "true_pct", "missing_count", "missing_pct"]:
                if key in col_stat:
                    parts.append(f"  {key}: {col_stat[key]}")
        parts.append("")

    correlation = full_stats.get("correlation", {}) if full_stats else {}
    if correlation.get("strong_correlations"):
        parts.append("=== STRONG CORRELATIONS ===")
        for c in correlation["strong_correlations"]:
            parts.append(f"  {c['column1']} <-> {c['column2']}: r={c['correlation']} ({c['strength']})")
        parts.append("")

    outliers = full_stats.get("outliers", {}) if full_stats else {}
    outlier_cols = {k: v for k, v in outliers.items() if v.get("outlier_count", 0) > 0}
    if outlier_cols:
        parts.append("=== OUTLIERS DETECTED ===")
        for col, info in outlier_cols.items():
            parts.append(f"  {col}: {info['outlier_count']} outliers ({info['outlier_percentage']}%), bounds: [{info['lower_bound']}, {info['upper_bound']}]")
        parts.append("")

    insights = full_stats.get("insights", []) if full_stats else []
    if insights:
        parts.append("=== KEY INSIGHTS ===")
        for insight in insights[:8]:
            parts.append(f"  [{insight['type']}] {insight['title']}: {insight['message']}")
        parts.append("")

    if df is not None and len(df) > 0:
        parts.append("=== SAMPLE DATA (first 10 rows) ===")
        sample_df = df.head(10)
        parts.append(sample_df.to_string(index=False))
        parts.append("")

        parts.append("=== ALL COLUMN NAMES ===")
        parts.append(", ".join(df.columns.tolist()))
        parts.append("")

    return "\n".join(parts)


def build_automatic_analysis(
    df: Optional[pd.DataFrame],
    column_types: dict,
    statistics: dict,
    full_stats: dict = None,
) -> str:
    parts = []

    overview = full_stats.get("overview", {}) if full_stats else {}
    parts.append("=== DATASET OVERVIEW ===")
    parts.append(f"Total rows: {statistics.get('total_rows', overview.get('total_rows', 0))}")
    parts.append(f"Total columns: {statistics.get('total_columns', overview.get('total_columns', 0))}")
    parts.append(f"Total cells: {overview.get('total_cells', 0)}")
    parts.append(f"Missing cells: {overview.get('missing_cells', 0)} ({overview.get('missing_percentage', 0)}%)")
    parts.append("")

    parts.append("=== COLUMN STATISTICS ===")
    for col_name, col_stat in statistics.get("columns", {}).items():
        col_type = column_types.get(col_name, col_stat.get("type", "unknown"))
        if col_type == "numeric" and col_stat.get("count", 0) > 0:
            parts.append(f"{col_name}: min={col_stat.get('min')}, max={col_stat.get('max')}, mean={col_stat.get('mean')}, median={col_stat.get('median')}, std={col_stat.get('std')}")
        elif col_type in ("categorical", "text") and col_stat.get("count", 0) > 0:
            parts.append(f"{col_name}: {col_stat.get('unique_count', 0)} unique values, most common='{col_stat.get('most_common', '')}' ({col_stat.get('most_common_count', 0)} times)")
        elif col_type == "date" and col_stat.get("count", 0) > 0:
            parts.append(f"{col_name}: range from {col_stat.get('earliest', '')} to {col_stat.get('latest', '')} ({col_stat.get('range_days', 0)} days)")
    parts.append("")

    correlation = full_stats.get("correlation", {}) if full_stats else {}
    if correlation.get("strong_correlations"):
        parts.append("=== STRONG CORRELATIONS ===")
        for c in correlation["strong_correlations"]:
            parts.append(f"  {c['column1']} <-> {c['column2']}: r={c['correlation']} ({c['strength']})")
        parts.append("")

    outliers = full_stats.get("outliers", {}) if full_stats else {}
    outlier_cols = {k: v for k, v in outliers.items() if v.get("outlier_count", 0) > 0}
    if outlier_cols:
        parts.append("=== OUTLIERS ===")
        for col, info in outlier_cols.items():
            parts.append(f"  {col}: {info['outlier_count']} outliers ({info['outlier_percentage']}%)")
        parts.append("")

    if df is not None and len(df) > 0:
        parts.append("=== SAMPLE DATA (first 5 rows) ===")
        parts.append(df.head(5).to_string(index=False))
        parts.append("")

    return "\n".join(parts)


SYSTEM_PROMPT = """You are an expert data analyst AI assistant for an Excel/CSV analysis application.

CRITICAL RULES:
1. You MUST ONLY use data from the dataset context provided. NEVER invent, fabricate, or guess numbers.
2. If a value is not in the data context, say "I don't have that information in the current dataset."
3. Always reference specific numbers when answering questions about the data.
4. Distinguish between calculated facts and your interpretation.
5. Avoid claiming causation from correlation. Say "correlated with" not "caused by."
6. Respond in the SAME LANGUAGE the user uses (English or Bahasa Melayu).
7. Be concise but thorough. Use bullet points for lists.
8. If the user asks to create a chart, respond with a JSON chart configuration in this exact format:
   CHART_REQUEST:{"chart_type":"bar","x_column":"ColumnName","y_column":"ColumnName","aggregation":"sum"}
   Supported chart types: bar, line, pie, scatter, doughnut, area
   Supported aggregations: sum, mean, count, min, max
9. If you need more data to answer a question, explain what information you need.
10. For the "Analyze Dataset" request, provide a structured analysis covering:
    - Dataset Overview
    - Key Statistics for each column
    - Important Trends
    - Highest/Lowest Values
    - Missing Data Analysis
    - Outliers
    - Correlations
    - Key Insights
    - Areas requiring attention

You have access to these data analysis capabilities (use them when the user's question requires specific calculations):
- sum(column): Calculate sum of a numeric column
- average(column): Calculate average of a numeric column
- count(column?): Count rows or non-null values
- min(column): Find minimum value
- max(column): Find maximum value
- median(column): Find median value
- groupby(group_column, agg_column, agg_func): Group and aggregate
- sort(column, ascending, limit): Sort and show top values
- filter(column, operator, value): Filter rows
- top_n(column, n): Show top N values
- percentage(column, value): Calculate percentage
- correlation(col1, col2): Calculate correlation
- unique(column): Count unique values
- value_counts(column): Show value distribution
- missing(column?): Show missing data info
- describe(column): Full column description

When you determine a calculation is needed, include it in your response as:
CALC:tool_name:{"param1":"value1","param2":"value2"}

The system will execute the calculation and append the result to the context."""


def call_ai_api(
    context: str,
    question: str,
    chat_history: list[dict],
    system_prompt: str = None,
    user_id: str = None,
    file_id: str = None,
) -> str:
    import time as _time
    api_key = settings.AI_API_KEY

    if not api_key:
        return (
            "AI service is not configured. To enable AI-powered analysis, "
            "please set the AI_API_KEY environment variable with your API key. "
            "You can still use the statistics and chart features to explore your data."
        )

    messages = []

    sys_msg = system_prompt or SYSTEM_PROMPT
    messages.append({"role": "user", "parts": [sys_msg + "\n\n" + context]})

    for msg in chat_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant"):
            messages.append({"role": role, "parts": [content]})

    messages.append({"role": "user", "parts": [question]})

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent"
    )

    payload = {
        "contents": messages,
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 4096,
        },
    }

    start_time = _time.time()
    try:
        response = httpx.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            params={"key": api_key},
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        elapsed_ms = int((_time.time() - start_time) * 1000)

        _record_ai_usage(user_id, file_id, "success", elapsed_ms)

        candidates = data.get("candidates", [])
        if candidates:
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if parts:
                return parts[0].get("text", "No response generated.")

        return "I received an empty response from the AI service. Please try again."

    except httpx.TimeoutException:
        elapsed_ms = int((_time.time() - start_time) * 1000)
        _record_ai_usage(user_id, file_id, "error", elapsed_ms, "timeout")
        return (
            "The AI service timed out. This may be due to high demand. "
            "Please try again in a moment."
        )
    except httpx.HTTPStatusError as e:
        elapsed_ms = int((_time.time() - start_time) * 1000)
        _record_ai_usage(user_id, file_id, "error", elapsed_ms, f"HTTP {e.response.status_code}")
        if e.response.status_code == 401:
            return "Invalid API key. Please check your AI_API_KEY environment variable."
        return f"AI service returned an error (HTTP {e.response.status_code}). Please try again later."
    except Exception as e:
        elapsed_ms = int((_time.time() - start_time) * 1000)
        _record_ai_usage(user_id, file_id, "error", elapsed_ms, str(e)[:200])
        return f"An error occurred while communicating with the AI service. Please try again later."


def _record_ai_usage(user_id, file_id, status, response_time_ms, error_message=None):
    try:
        from app.models.models import AIUsage
        from app.database import SessionLocal
        db = SessionLocal()
        usage = AIUsage(
            user_id=user_id,
            file_id=file_id,
            model=settings.AI_MODEL if hasattr(settings, 'AI_MODEL') else "gemini-2.0-flash",
            status=status,
            response_time_ms=response_time_ms,
            error_message=error_message,
        )
        db.add(usage)
        db.commit()
        db.close()
    except Exception:
        pass


def parse_chart_request(response_text: str) -> Optional[dict]:
    marker = "CHART_REQUEST:"
    idx = response_text.find(marker)
    if idx == -1:
        return None

    json_start = idx + len(marker)
    json_str = response_text[json_start:].strip()

    depth = 0
    end_idx = json_start
    for i, ch in enumerate(json_str):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end_idx = json_start + i + 1
                break

    json_str = response_text[json_start:end_idx].strip()

    try:
        chart_config = json.loads(json_str)
        required = ["chart_type", "x_column", "y_column"]
        if all(k in chart_config for k in required):
            return chart_config
    except (json.JSONDecodeError, KeyError):
        pass

    return None
