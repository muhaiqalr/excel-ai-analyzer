import os
import sys
import json
import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.data_analysis_tools import (
    execute_tool,
    TOOLS_MAP,
    sum_value,
    average_value,
    count_value,
    min_value,
    max_value,
    median_value,
    std_value,
    groupby_value,
    sort_values,
    filter_rows,
    top_n,
    bottom_n,
    percentage,
    correlation_between,
    unique_values,
    value_counts,
    missing_data,
    describe_column,
)
from app.services.ai_service import (
    build_rich_context,
    build_automatic_analysis,
    call_ai_api,
    parse_chart_request,
    SYSTEM_PROMPT,
)
from app.services.stats_service import calculate_statistics, calculate_full_statistics


@pytest.fixture
def sample_df():
    return pd.DataFrame({
        "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
        "Age": [25, 30, 35, 28, 42],
        "Department": ["Engineering", "Marketing", "Engineering", "HR", "Marketing"],
        "Salary": [70000.0, 55000.0, 80000.0, 60000.0, 58000.0],
        "Score": [88.5, 92.3, 76.1, 95.0, 81.7],
    })


@pytest.fixture
def df_with_missing():
    return pd.DataFrame({
        "A": [1, np.nan, 3, np.nan, 5],
        "B": ["x", "y", None, "w", "z"],
        "C": [10.0, 20.0, np.nan, 40.0, 50.0],
    })


@pytest.fixture
def empty_df():
    return pd.DataFrame(columns=["A", "B", "C"])


class TestToolsMap:
    def test_all_tools_registered(self):
        expected_tools = [
            "sum", "average", "count", "min", "max", "median", "std",
            "groupby", "sort", "filter", "top_n", "bottom_n", "percentage",
            "correlation", "unique", "value_counts", "missing", "describe",
        ]
        for tool in expected_tools:
            assert tool in TOOLS_MAP

    def test_all_tools_are_callable(self):
        for tool_name, tool_func in TOOLS_MAP.items():
            assert callable(tool_func)


class TestBasicTools:
    def test_sum(self, sample_df):
        result = sum_value(sample_df, "Salary")
        assert result["result"] == 323000.0
        assert result["column"] == "Salary"

    def test_average(self, sample_df):
        result = average_value(sample_df, "Age")
        assert result["result"] == pytest.approx(32.0)

    def test_count_all(self, sample_df):
        result = count_value(sample_df)
        assert result["result"] == 5

    def test_count_column(self, sample_df):
        result = count_value(sample_df, "Name")
        assert result["result"] == 5

    def test_min_value(self, sample_df):
        result = min_value(sample_df, "Age")
        assert result["result"] == 25

    def test_max_value(self, sample_df):
        result = max_value(sample_df, "Age")
        assert result["result"] == 42

    def test_median_value(self, sample_df):
        result = median_value(sample_df, "Score")
        assert result["result"] == pytest.approx(88.5)

    def test_std_value(self, sample_df):
        result = std_value(sample_df, "Age")
        assert result["result"] > 0


class TestGroupbyTool:
    def test_groupby_sum(self, sample_df):
        result = groupby_value(sample_df, "Department", "Salary", "sum")
        assert result["group_column"] == "Department"
        assert result["agg_column"] == "Salary"
        assert result["agg_function"] == "sum"
        assert "Engineering" in result["result"]
        assert result["result"]["Engineering"] == 150000.0
        assert result["result"]["Marketing"] == 113000.0

    def test_groupby_mean(self, sample_df):
        result = groupby_value(sample_df, "Department", "Age", "mean")
        assert result["result"]["Engineering"] == pytest.approx(30.0)


class TestSortTool:
    def test_sort_ascending(self, sample_df):
        result = sort_values(sample_df, "Age", ascending=True)
        assert result["result"][0]["Age"] in (25, 25.0, "25")
        assert result["result"][-1]["Age"] in (42, 42.0, "42")

    def test_sort_descending(self, sample_df):
        result = sort_values(sample_df, "Salary", ascending=False)
        assert result["result"][0]["Salary"] in (80000.0, "80000.0")

    def test_sort_with_limit(self, sample_df):
        result = sort_values(sample_df, "Age", ascending=True, limit=3)
        assert len(result["result"]) == 3


class TestFilterTool:
    def test_filter_equals(self, sample_df):
        result = filter_rows(sample_df, "Department", "eq", "Engineering")
        assert result["count"] == 2
        assert result["operation"] == "filter"

    def test_filter_greater_than(self, sample_df):
        result = filter_rows(sample_df, "Age", "gt", "30")
        assert result["count"] == 2

    def test_filter_less_than(self, sample_df):
        result = filter_rows(sample_df, "Salary", "lt", "60000")
        assert result["count"] == 2


class TestTopBottomTool:
    def test_top_n(self, sample_df):
        result = top_n(sample_df, "Salary", 2)
        assert len(result["result"]) == 2
        assert result["result"][0]["value"] == 80000.0

    def test_bottom_n(self, sample_df):
        result = bottom_n(sample_df, "Salary", 2)
        assert len(result["result"]) == 2
        assert result["result"][0]["value"] == 55000.0


class TestPercentageTool:
    def test_percentage(self, sample_df):
        result = percentage(sample_df, "Department", "Engineering")
        assert result["result"] == pytest.approx(40.0)

    def test_percentage_numeric(self, sample_df):
        result = percentage(sample_df, "Age", "25")
        assert result["result"] == pytest.approx(20.0)


class TestCorrelationTool:
    def test_correlation(self, sample_df):
        result = correlation_between(sample_df, "Age", "Salary")
        assert "result" in result
        assert -1 <= result["result"] <= 1
        assert result["column1"] == "Age"
        assert result["column2"] == "Salary"


class TestUniqueTool:
    def test_unique_count(self, sample_df):
        result = unique_values(sample_df, "Department")
        assert result["result"] == 3

    def test_unique_with_nan(self, df_with_missing):
        result = unique_values(df_with_missing, "A")
        assert result["result"] == 3


class TestValueCountsTool:
    def test_value_counts(self, sample_df):
        result = value_counts(sample_df, "Department")
        assert result["result"]["Engineering"] == 2
        assert result["result"]["Marketing"] == 2
        assert result["result"]["HR"] == 1


class TestMissingTool:
    def test_missing_no_missing(self, sample_df):
        result = missing_data(sample_df, "Name")
        assert result["result"]["missing"] == 0
        assert result["result"]["percentage"] == 0.0

    def test_missing_with_missing(self, df_with_missing):
        result = missing_data(df_with_missing, "A")
        assert result["result"]["missing"] == 2
        assert result["result"]["percentage"] == pytest.approx(40.0)

    def test_missing_all_columns(self, df_with_missing):
        result = missing_data(df_with_missing)
        assert "result" in result
        assert "total_missing" in result


class TestDescribeTool:
    def test_describe_numeric(self, sample_df):
        result = describe_column(sample_df, "Age")
        assert result["column"] == "Age"
        assert result["result"]["type"] == "numeric"
        assert result["result"]["count"] == 5
        assert result["result"]["mean"] == pytest.approx(32.0)

    def test_describe_text(self, sample_df):
        result = describe_column(sample_df, "Name")
        assert result["column"] == "Name"
        assert result["result"]["type"] in ("text", "categorical")
        assert result["result"]["count"] == 5
        assert result["result"]["unique_count"] == 5


class TestExecuteTool:
    def test_execute_sum(self, sample_df):
        result = execute_tool(sample_df, "sum", {"column": "Salary"})
        assert result["result"] == 323000.0

    def test_execute_unknown_tool(self, sample_df):
        result = execute_tool(sample_df, "nonexistent_tool", {})
        assert "error" in result

    def test_execute_with_invalid_column(self, sample_df):
        result = execute_tool(sample_df, "sum", {"column": "Nonexistent"})
        assert "error" in result


class TestBuildContext:
    def test_build_rich_context_basic(self, sample_df):
        col_types = {"Name": "text", "Age": "numeric", "Department": "categorical", "Salary": "numeric", "Score": "numeric"}
        stats = calculate_statistics(sample_df)
        full_stats = calculate_full_statistics(sample_df)

        ctx = build_rich_context(sample_df, col_types, stats, full_stats)
        assert "DATASET OVERVIEW" in ctx
        assert "Total rows: 5" in ctx
        assert "Total columns: 5" in ctx
        assert "COLUMN DETAILS" in ctx
        assert "Name" in ctx
        assert "Age" in ctx

    def test_build_rich_context_with_file_info(self, sample_df):
        col_types = {"Name": "text", "Age": "numeric", "Department": "categorical", "Salary": "numeric", "Score": "numeric"}
        stats = calculate_statistics(sample_df)
        file_info = {"filename": "test.xlsx", "sheet_name": "Sheet1"}

        ctx = build_rich_context(sample_df, col_types, stats, file_info=file_info)
        assert "FILE INFORMATION" in ctx
        assert "test.xlsx" in ctx
        assert "Sheet1" in ctx

    def test_build_automatic_analysis(self, sample_df):
        col_types = {"Name": "text", "Age": "numeric", "Department": "categorical", "Salary": "numeric", "Score": "numeric"}
        stats = calculate_statistics(sample_df)
        full_stats = calculate_full_statistics(sample_df)

        ctx = build_automatic_analysis(sample_df, col_types, stats, full_stats)
        assert "DATASET OVERVIEW" in ctx
        assert "COLUMN STATISTICS" in ctx


class TestParseChartRequest:
    def test_parse_valid_chart_request(self):
        response = "Here is a chart.\nCHART_REQUEST:{\"chart_type\":\"bar\",\"x_column\":\"Department\",\"y_column\":\"Salary\",\"aggregation\":\"sum\"}"
        result = parse_chart_request(response)
        assert result is not None
        assert result["chart_type"] == "bar"
        assert result["x_column"] == "Department"
        assert result["y_column"] == "Salary"
        assert result["aggregation"] == "sum"

    def test_parse_no_chart_request(self):
        response = "This is just a normal response without any chart request."
        result = parse_chart_request(response)
        assert result is None

    def test_parse_invalid_json(self):
        response = "CHART_REQUEST:not valid json"
        result = parse_chart_request(response)
        assert result is None

    def test_parse_missing_required_fields(self):
        response = "CHART_REQUEST:{\"chart_type\":\"bar\"}"
        result = parse_chart_request(response)
        assert result is None


class TestCallAiApi:
    @patch.dict(os.environ, {}, clear=True)
    def test_no_api_key_returns_helpful_message(self):
        from app.config import settings
        original = settings.AI_API_KEY
        settings.AI_API_KEY = None
        try:
            result = call_ai_api("context", "question", [])
            assert "AI_API_KEY" in result
            assert "not configured" in result
        finally:
            settings.AI_API_KEY = original

    @patch("app.services.ai_service.httpx.post")
    def test_api_success(self, mock_post):
        from app.config import settings
        original = settings.AI_API_KEY
        settings.AI_API_KEY = "test_key"
        try:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_response.json.return_value = {
                "candidates": [{
                    "content": {
                        "parts": [{"text": "Test AI response"}]
                    }
                }]
            }
            mock_post.return_value = mock_response

            result = call_ai_api("context", "question", [])
            assert result == "Test AI response"
            mock_post.assert_called_once()
        finally:
            settings.AI_API_KEY = original

    @patch("app.services.ai_service.httpx.post")
    def test_api_timeout(self, mock_post):
        import httpx
        from app.config import settings
        original = settings.AI_API_KEY
        settings.AI_API_KEY = "test_key"
        try:
            mock_post.side_effect = httpx.TimeoutException("timeout")
            result = call_ai_api("context", "question", [])
            assert "timed out" in result
        finally:
            settings.AI_API_KEY = original

    @patch("app.services.ai_service.httpx.post")
    def test_api_401_error(self, mock_post):
        import httpx
        from app.config import settings
        original = settings.AI_API_KEY
        settings.AI_API_KEY = "test_key"
        try:
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "Unauthorized", request=MagicMock(), response=mock_response
            )
            mock_post.return_value = mock_response

            result = call_ai_api("context", "question", [])
            assert "Invalid API key" in result
        finally:
            settings.AI_API_KEY = original

    @patch("app.services.ai_service.httpx.post")
    def test_api_empty_response(self, mock_post):
        from app.config import settings
        original = settings.AI_API_KEY
        settings.AI_API_KEY = "test_key"
        try:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_response.json.return_value = {"candidates": []}
            mock_post.return_value = mock_response

            result = call_ai_api("context", "question", [])
            assert "empty response" in result
        finally:
            settings.AI_API_KEY = original
