import httpx
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
        parts.append(f"File: {file_info.get('filename', 'Unknown')} | Sheet: {file_info.get('sheet_name', 'Unknown')}")
        parts.append("")

    parts.append("=== COLUMNS ===")
    for col_name, col_stat in statistics.get("columns", {}).items():
        col_type = column_types.get(col_name, col_stat.get("type", "unknown"))
        parts.append(f"- {col_name} ({col_type})")
    parts.append("")

    if df is not None and len(df) > 0:
        parts.append("=== FULL DATA ===")
        parts.append(df.to_string(index=False, max_rows=None, max_cols=None))
        parts.append("")

    return "\n".join(parts)


def build_automatic_analysis(
    df: Optional[pd.DataFrame],
    column_types: dict,
    statistics: dict,
    full_stats: dict = None,
) -> str:
    parts = []

    parts.append("=== DATA CONTENT ===")
    parts.append(f"Columns: {', '.join(df.columns.tolist()) if df is not None else 'None'}")
    parts.append("")

    parts.append("=== COLUMN SUMMARY ===")
    for col_name, col_stat in statistics.get("columns", {}).items():
        col_type = column_types.get(col_name, col_stat.get("type", "unknown"))
        if col_type == "numeric" and col_stat.get("count", 0) > 0:
            parts.append(f"{col_name}: min={col_stat.get('min')}, max={col_stat.get('max')}, mean={col_stat.get('mean')}")
        elif col_type in ("categorical", "text") and col_stat.get("count", 0) > 0:
            parts.append(f"{col_name}: most common='{col_stat.get('most_common', '')}' ({col_stat.get('most_common_count', 0)} times), {col_stat.get('unique_count', 0)} unique values")
        elif col_type == "date" and col_stat.get("count", 0) > 0:
            parts.append(f"{col_name}: from {col_stat.get('earliest', '')} to {col_stat.get('latest', '')}")
    parts.append("")

    if df is not None and len(df) > 0:
        parts.append("=== FULL DATASET CONTENT ===")
        parts.append(df.to_string(index=False, max_rows=None, max_cols=None))
        parts.append("")

    return "\n".join(parts)


SYSTEM_PROMPT = """You are an expert data analyst AI assistant. Your job is to analyze the ACTUAL DATA provided and give meaningful insights.

CRITICAL RULES:
1. You MUST ONLY use data from the dataset context provided. NEVER invent, fabricate, or guess numbers.
2. If a value is not in the data context, say "I don't have that information in the current dataset."
3. Always reference specific numbers and values from the actual data.
4. Respond in the SAME LANGUAGE the user uses (English or Bahasa Melayu).
5. Be concise but thorough. Use bullet points for lists.
6. Focus on WHAT THE DATA SHOWS, not on spreadsheet technicalities.

NEVER say things like:
- "Your Excel file contains X rows and Y columns"
- "There are X numeric columns and Y text columns"
- "Total cells: X"

ALWAYS say things like:
- "The data shows that [category] is the highest with [value]"
- "Most items are in [category], accounting for [percentage]"
- "There is a trend of [description] over time"
- "[Column A] has the strongest relationship with [Column B]"
- "The most common value in [column] is [value]"

When the user asks about the data, analyze:
- What are the most common values?
- What are the highest and lowest values?
- Are there any trends over time?
- What categories dominate?
- Are there any unusual patterns?
- What relationships exist between columns?
- What are the key distributions?

If the user asks to create a chart, respond with a JSON chart configuration:
CHART_REQUEST:{"chart_type":"bar","x_column":"ColumnName","y_column":"ColumnName","aggregation":"sum"}
Supported chart types: bar, line, pie, scatter, doughnut, area
Supported aggregations: sum, mean, count, min, max

You have access to calculation tools:
- sum(column): Calculate sum
- average(column): Calculate average
- count(column?): Count values
- min(column): Find minimum
- max(column): Find maximum
- median(column): Find median
- groupby(group_column, agg_column, agg_func): Group and aggregate
- sort(column, ascending, limit): Sort values
- filter(column, operator, value): Filter rows
- top_n(column, n): Top N values
- percentage(column, value): Calculate percentage
- correlation(col1, col2): Calculate correlation
- unique(column): Count unique values
- value_counts(column): Show distribution
- missing(column?): Missing data info
- describe(column): Full description

When a calculation is needed, include it as:
CALC:tool_name:{"param1":"value1","param2":"value2"}

The system will execute and append results."""


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
            "maxOutputTokens": 8192,
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
