import os
import sys
import pytest
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestAutoProfile:
    def test_basic_profile(self):
        from app.services.advanced_analysis import auto_profile
        df = pd.DataFrame({
            "Name": ["Alice", "Bob", "Charlie"],
            "Age": [25, 30, 35],
            "Salary": [50000.0, 60000.0, 70000.0],
        })
        result = auto_profile(df)
        assert result["rows"] == 3
        assert result["columns"] == 3
        assert "Name" in result["column_profiles"]
        assert result["column_profiles"]["Name"]["type"] == "categorical"
        assert result["column_profiles"]["Age"]["type"] == "numeric"
        assert result["duplicate_rows"] == 0

    def test_profile_with_missing(self):
        from app.services.advanced_analysis import auto_profile
        df = pd.DataFrame({"A": [1, 2, np.nan, 4], "B": ["x", None, "z", "w"]})
        result = auto_profile(df)
        assert result["missing_cells"] > 0

    def test_profile_empty_df(self):
        from app.services.advanced_analysis import auto_profile
        df = pd.DataFrame()
        result = auto_profile(df)
        assert result["rows"] == 0


class TestInsights:
    def test_basic_insights(self):
        from app.services.advanced_analysis import generate_insights
        df = pd.DataFrame({
            "Product": ["A", "B", "C", "D", "E"],
            "Sales": [100, 200, 150, 300, 50],
        })
        result = generate_insights(df)
        assert "overview" in result
        assert "key_findings" in result
        assert "recommendations" in result

    def test_insights_with_correlations(self):
        from app.services.advanced_analysis import generate_insights
        df = pd.DataFrame({
            "X": [1, 2, 3, 4, 5],
            "Y": [2, 4, 6, 8, 10],
        })
        result = generate_insights(df)
        assert "correlations" in result


class TestTrends:
    def test_detect_increasing_trend(self):
        from app.services.advanced_analysis import detect_trends
        dates = pd.date_range("2024-01-01", periods=12, freq="MS")
        df = pd.DataFrame({
            "Date": dates,
            "Sales": [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210],
        })
        result = detect_trends(df, "Date", "Sales")
        assert result["trend_direction"] == "increasing"

    def test_trends_auto_detect_columns(self):
        from app.services.advanced_analysis import detect_trends
        dates = pd.date_range("2024-01-01", periods=6, freq="MS")
        df = pd.DataFrame({
            "Date": dates,
            "Revenue": [100, 120, 110, 140, 130, 160],
        })
        result = detect_trends(df)
        assert "trend_direction" in result


class TestCompare:
    def test_compare_groups(self):
        from app.services.advanced_analysis import compare_groups
        df = pd.DataFrame({
            "Branch": ["A", "A", "B", "B", "C", "C"],
            "Sales": [100, 150, 200, 250, 50, 75],
        })
        result = compare_groups(df, "Branch", "Sales")
        assert "groups" in result
        assert len(result["groups"]) == 3
        assert result["highest_group"] is not None
        assert result["lowest_group"] is not None


class TestTopBottom:
    def test_top_n(self):
        from app.services.advanced_analysis import top_bottom
        df = pd.DataFrame({
            "Product": ["A", "B", "C", "D", "E"],
            "Sales": [100, 200, 150, 300, 50],
        })
        result = top_bottom(df, "Sales", n=3, ascending=False)
        assert len(result["items"]) == 3
        assert result["items"][0]["Sales"] == 300

    def test_bottom_n(self):
        from app.services.advanced_analysis import top_bottom
        df = pd.DataFrame({
            "Product": ["A", "B", "C", "D", "E"],
            "Sales": [100, 200, 150, 300, 50],
        })
        result = top_bottom(df, "Sales", n=2, ascending=True)
        assert len(result["items"]) == 2
        assert result["items"][0]["Sales"] == 50


class TestAnomalies:
    def test_detect_anomalies(self):
        from app.services.advanced_analysis import detect_anomalies
        df = pd.DataFrame({
            "Value": [10, 12, 11, 13, 100, 12, 11, 10, 1000],
        })
        result = detect_anomalies(df, "Value")
        assert "anomalies" in result
        assert len(result["anomalies"]) > 0

    def test_no_anomalies(self):
        from app.services.advanced_analysis import detect_anomalies
        df = pd.DataFrame({"Value": [10, 10, 10, 10, 10]})
        result = detect_anomalies(df, "Value")
        assert len(result["anomalies"]) == 0


class TestForecast:
    def test_simple_forecast(self):
        from app.services.advanced_analysis import forecast_simple
        dates = pd.date_range("2024-01-01", periods=12, freq="MS")
        df = pd.DataFrame({
            "Date": dates,
            "Sales": [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210],
        })
        result = forecast_simple(df, "Date", "Sales", periods=3)
        assert "forecast" in result
        assert len(result["forecast"]) == 3
        assert result["trend_direction"] == "increasing"

    def test_insufficient_data(self):
        from app.services.advanced_analysis import forecast_simple
        df = pd.DataFrame({"Date": [1, 2], "Value": [10, 20]})
        result = forecast_simple(df, "Date", "Value", periods=3)
        assert "error" in result or "insufficient" in str(result).lower()


class TestChartRecommend:
    def test_bar_chart_recommendation(self):
        from app.services.advanced_analysis import auto_chart_recommend
        df = pd.DataFrame({
            "Category": ["A", "B", "C"],
            "Value": [10, 20, 30],
        })
        result = auto_chart_recommend(df)
        assert len(result) > 0
        chart_types = [r["chart_type"] for r in result]
        assert "bar" in chart_types

    def test_scatter_recommendation(self):
        from app.services.advanced_analysis import auto_chart_recommend
        df = pd.DataFrame({"X": [1, 2, 3], "Y": [4, 5, 6]})
        result = auto_chart_recommend(df)
        chart_types = [r["chart_type"] for r in result]
        assert "scatter" in chart_types


class TestReport:
    def test_generate_report(self):
        from app.services.advanced_analysis import generate_report
        df = pd.DataFrame({
            "Product": ["A", "B", "C"],
            "Sales": [100, 200, 150],
            "Region": ["North", "South", "North"],
        })
        result = generate_report(df, "Test Dataset")
        assert "title" in result
        assert "sections" in result
        assert "executive_summary" in result["sections"]
        assert "dataset_overview" in result["sections"]
        assert "key_statistics" in result["sections"]
        assert "recommendations" in result["sections"]
