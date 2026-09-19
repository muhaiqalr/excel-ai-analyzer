import os
import sys
import pytest
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.stats_service import (
    calculate_statistics,
    calculate_full_statistics,
    calculate_dataset_overview,
    calculate_correlation,
    detect_outliers,
    generate_insights,
)


class TestDatasetOverview:
    def test_basic_overview(self):
        df = pd.DataFrame({
            "A": [1, 2, 3],
            "B": ["x", "y", "z"],
        })
        overview = calculate_dataset_overview(df)
        assert overview["total_rows"] == 3
        assert overview["total_columns"] == 2
        assert overview["total_cells"] == 6
        assert overview["numeric_columns"] == 1
        assert overview["categorical_columns"] == 1
        assert overview["missing_cells"] == 0
        assert overview["missing_percentage"] == 0.0

    def test_overview_with_missing(self):
        df = pd.DataFrame({
            "A": [1, np.nan, 3],
            "B": ["x", None, "z"],
        })
        overview = calculate_dataset_overview(df)
        assert overview["missing_cells"] == 2
        assert overview["missing_percentage"] > 0

    def test_overview_empty_dataset(self):
        df = pd.DataFrame(columns=["A", "B", "C"])
        overview = calculate_dataset_overview(df)
        assert overview["total_rows"] == 0
        assert overview["total_columns"] == 3
        assert overview["total_cells"] == 0
        assert overview["missing_cells"] == 0

    def test_overview_boolean_column(self):
        df = pd.DataFrame({
            "flag": [True, False, True, True],
        })
        overview = calculate_dataset_overview(df)
        assert overview["boolean_columns"] == 1

    def test_overview_date_column(self):
        df = pd.DataFrame({
            "date": pd.to_datetime(["2020-01-01", "2020-06-15", "2021-03-20"]),
        })
        overview = calculate_dataset_overview(df)
        assert overview["date_columns"] == 1


class TestCorrelation:
    def test_strong_positive_correlation(self):
        df = pd.DataFrame({
            "A": [1, 2, 3, 4, 5],
            "B": [2, 4, 6, 8, 10],
        })
        corr = calculate_correlation(df)
        assert len(corr["numeric_columns"]) == 2
        assert len(corr["strong_correlations"]) == 1
        assert corr["strong_correlations"][0]["correlation"] == 1.0
        assert "strong positive" in corr["strong_correlations"][0]["strength"]

    def test_strong_negative_correlation(self):
        df = pd.DataFrame({
            "A": [1, 2, 3, 4, 5],
            "B": [10, 8, 6, 4, 2],
        })
        corr = calculate_correlation(df)
        assert len(corr["strong_correlations"]) == 1
        assert corr["strong_correlations"][0]["correlation"] == -1.0
        assert "strong negative" in corr["strong_correlations"][0]["strength"]

    def test_weak_correlation(self):
        np.random.seed(42)
        df = pd.DataFrame({
            "A": np.random.randn(100),
            "B": np.random.randn(100),
        })
        corr = calculate_correlation(df)
        assert len(corr["strong_correlations"]) == 0

    def test_insufficient_numeric_columns(self):
        df = pd.DataFrame({
            "A": ["x", "y", "z"],
        })
        corr = calculate_correlation(df)
        assert corr["matrix"] == {}
        assert len(corr["numeric_columns"]) == 0

    def test_single_numeric_column(self):
        df = pd.DataFrame({
            "A": [1, 2, 3],
        })
        corr = calculate_correlation(df)
        assert len(corr["numeric_columns"]) == 0
        assert len(corr["strong_correlations"]) == 0


class TestOutlierDetection:
    def test_outliers_detected(self):
        df = pd.DataFrame({
            "A": [1, 2, 3, 4, 5, 100],
        })
        outliers = detect_outliers(df)
        assert "A" in outliers
        assert outliers["A"]["outlier_count"] >= 1

    def test_no_outliers(self):
        df = pd.DataFrame({
            "A": [1, 2, 3, 4, 5],
        })
        outliers = detect_outliers(df)
        assert "A" in outliers
        assert outliers["A"]["outlier_count"] == 0

    def test_bounds_calculation(self):
        df = pd.DataFrame({
            "A": [10, 20, 30, 40, 50],
        })
        outliers = detect_outliers(df)
        assert outliers["A"]["q1"] == 20.0
        assert outliers["A"]["q3"] == 40.0
        assert outliers["A"]["iqr"] == 20.0
        assert outliers["A"]["lower_bound"] == -10.0
        assert outliers["A"]["upper_bound"] == 70.0

    def test_insufficient_data_for_outliers(self):
        df = pd.DataFrame({
            "A": [1, 2],
        })
        outliers = detect_outliers(df)
        assert "A" not in outliers

    def test_no_numeric_columns(self):
        df = pd.DataFrame({
            "A": ["x", "y", "z"],
        })
        outliers = detect_outliers(df)
        assert len(outliers) == 0


class TestInsights:
    def test_size_insight(self):
        df = pd.DataFrame({"A": [1, 2], "B": ["x", "y"]})
        stats = calculate_statistics(df)
        corr = calculate_correlation(df)
        outliers = detect_outliers(df)
        insights = generate_insights(df, stats["columns"], corr, outliers)
        size_insights = [i for i in insights if i["title"] == "Dataset Size"]
        assert len(size_insights) == 1
        assert "2 rows" in size_insights[0]["message"]

    def test_missing_data_insight(self):
        df = pd.DataFrame({"A": [1, np.nan, np.nan, 4, 5]})
        stats = calculate_statistics(df)
        corr = calculate_correlation(df)
        outliers = detect_outliers(df)
        insights = generate_insights(df, stats["columns"], corr, outliers)
        missing_insights = [i for i in insights if i["title"] == "Missing Data"]
        assert len(missing_insights) == 1

    def test_duplicate_rows_insight(self):
        df = pd.DataFrame({"A": [1, 2, 1], "B": ["x", "y", "x"]})
        stats = calculate_statistics(df)
        corr = calculate_correlation(df)
        outliers = detect_outliers(df)
        insights = generate_insights(df, stats["columns"], corr, outliers)
        dup_insights = [i for i in insights if i["title"] == "Duplicate Rows"]
        assert len(dup_insights) == 1
        assert "1 duplicate" in dup_insights[0]["message"]

    def test_empty_dataset_insight(self):
        df = pd.DataFrame(columns=["A", "B"])
        stats = calculate_statistics(df)
        corr = calculate_correlation(df)
        outliers = detect_outliers(df)
        insights = generate_insights(df, stats["columns"], corr, outliers)
        empty_insights = [i for i in insights if i["title"] == "Empty Dataset"]
        assert len(empty_insights) == 1

    def test_outlier_insight(self):
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5, 100]})
        stats = calculate_statistics(df)
        corr = calculate_correlation(df)
        outliers = detect_outliers(df)
        insights = generate_insights(df, stats["columns"], corr, outliers)
        outlier_insights = [i for i in insights if i["title"] == "Outliers Detected"]
        assert len(outlier_insights) == 1

    def test_correlation_insight(self):
        df = pd.DataFrame({
            "A": [1, 2, 3, 4, 5],
            "B": [2, 4, 6, 8, 10],
        })
        stats = calculate_statistics(df)
        corr = calculate_correlation(df)
        outliers = detect_outliers(df)
        insights = generate_insights(df, stats["columns"], corr, outliers)
        corr_insights = [i for i in insights if i["title"] == "Strong Correlation"]
        assert len(corr_insights) == 1
        assert corr_insights[0]["note"] == "Correlation does not imply causation."


class TestFullStatistics:
    def test_returns_all_sections(self):
        df = pd.DataFrame({
            "A": [1, 2, 3, 4, 5],
            "B": [10, 20, 30, 40, 50],
            "C": ["x", "y", "x", "y", "x"],
        })
        result = calculate_full_statistics(df)
        assert "overview" in result
        assert "columns" in result
        assert "correlation" in result
        assert "outliers" in result
        assert "insights" in result
        assert result["overview"]["total_rows"] == 5
        assert len(result["columns"]) == 3
        assert len(result["correlation"]["numeric_columns"]) == 2
        assert len(result["insights"]) > 0

    def test_empty_dataframe(self):
        df = pd.DataFrame(columns=["A", "B"])
        result = calculate_full_statistics(df)
        assert result["overview"]["total_rows"] == 0
        assert len(result["insights"]) >= 1


class TestInlineStatisticsAPI:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_inline_statistics(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        response = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={
                "columns": ["A", "B", "C"],
                "rows": [
                    [1, 10, "x"],
                    [2, 20, "y"],
                    [3, 30, "x"],
                    [4, 40, "y"],
                    [5, 50, "x"],
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "overview" in data
        assert "columns" in data
        assert "correlation" in data
        assert "outliers" in data
        assert "insights" in data
        assert data["overview"]["total_rows"] == 5
        assert data["overview"]["total_columns"] == 3
        assert len(data["correlation"]["numeric_columns"]) == 2

    def test_inline_statistics_empty(self, client, auth_headers):
        response = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": [], "rows": []},
        )
        assert response.status_code == 400

    def test_inline_statistics_no_auth(self, client):
        response = client.post(
            "/api/analysis/statistics",
            json={
                "columns": ["A"],
                "rows": [[1], [2], [3]],
            },
        )
        assert response.status_code == 401

    def test_inline_statistics_with_missing(self, client, auth_headers):
        response = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={
                "columns": ["A", "B"],
                "rows": [
                    [1, 10],
                    [None, 20],
                    [3, None],
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["overview"]["missing_cells"] == 2

    def test_inline_statistics_categorical(self, client, auth_headers):
        response = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={
                "columns": ["Color", "Count"],
                "rows": [
                    ["Red", 10],
                    ["Blue", 20],
                    ["Red", 15],
                    ["Green", 5],
                    ["Blue", 25],
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["columns"]["Color"]["type"] == "categorical"
        assert data["columns"]["Color"]["unique_count"] == 3


class TestStatisticsAfterEdit:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_statistics_reflect_edit(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        # Get initial stats
        response = client.get(
            f"/api/files/{file_id}/statistics",
            headers=auth_headers,
            params={"sheet_name": "Employees"},
        )
        assert response.status_code == 200
        initial_stats = response.json()
        initial_age_mean = initial_stats["columns"]["Age"]["mean"]

        # Edit a cell: change all ages to high values
        for i in range(5):
            client.put(
                f"/api/files/{file_id}/data",
                headers=auth_headers,
                json={
                    "changes": [
                        {"sheet_name": "Employees", "row": i, "column": "Age", "value": 100}
                    ]
                },
            )

        # Get updated stats
        response = client.get(
            f"/api/files/{file_id}/statistics",
            headers=auth_headers,
            params={"sheet_name": "Employees"},
        )
        assert response.status_code == 200
        updated_stats = response.json()
        assert updated_stats["columns"]["Age"]["mean"] == 100.0
        assert updated_stats["columns"]["Age"]["min"] == 100.0
        assert updated_stats["columns"]["Age"]["max"] == 100.0


class TestInlineChartsAPI:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_auto_charts(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        response = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={
                "columns": ["Department", "Age", "Salary"],
                "rows": [
                    ["Engineering", 25, 70000],
                    ["Marketing", 30, 55000],
                    ["Engineering", 35, 80000],
                    ["HR", 28, 60000],
                    ["Marketing", 42, 58000],
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert "columns" in data
        assert len(data["suggestions"]) >= 1
        chart_types = [c["chart_type"] for c in data["suggestions"]]
        assert "bar" in chart_types

    def test_custom_bar_chart(self, client, auth_headers):
        response = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={
                "columns": ["City", "Population"],
                "rows": [
                    ["New York", 8300000],
                    ["London", 8900000],
                    ["Tokyo", 13900000],
                ],
                "chart_type": "bar",
                "x_column": "City",
                "y_column": "Population",
                "aggregation": "sum",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) == 1
        assert data["suggestions"][0]["chart_type"] == "bar"
        assert data["suggestions"][0]["title"] == "Population by City (Sum)"

    def test_custom_scatter_chart(self, client, auth_headers):
        response = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={
                "columns": ["X", "Y"],
                "rows": [[1, 10], [2, 20], [3, 30], [4, 40]],
                "chart_type": "scatter",
                "x_column": "X",
                "y_column": "Y",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) == 1
        assert data["suggestions"][0]["chart_type"] == "scatter"

    def test_empty_charts(self, client, auth_headers):
        response = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={"columns": [], "rows": []},
        )
        assert response.status_code == 400

    def test_no_auth(self, client):
        response = client.post(
            "/api/analysis/charts",
            json={"columns": ["A"], "rows": [[1]]},
        )
        assert response.status_code == 401

    def test_col_types_detected(self, client, auth_headers):
        response = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={
                "columns": ["Name", "Age", "Active", "Date"],
                "rows": [
                    ["Alice", 25, True, "2020-01-01"],
                    ["Bob", 30, False, "2021-06-15"],
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["columns"]["Name"] == "categorical"
        assert data["columns"]["Age"] == "numeric"


class TestChartService:
    def test_bar_chart_generation(self):
        from app.services.chart_service import generate_inline_charts

        result = generate_inline_charts(
            columns=["Category", "Value"],
            rows=[["A", 10], ["B", 20], ["A", 15], ["B", 25]],
        )
        assert len(result["suggestions"]) >= 1
        bar_charts = [c for c in result["suggestions"] if c["chart_type"] == "bar"]
        assert len(bar_charts) >= 1

    def test_scatter_chart_generation(self):
        from app.services.chart_service import generate_inline_charts

        result = generate_inline_charts(
            columns=["X", "Y"],
            rows=[[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]],
        )
        scatter_charts = [c for c in result["suggestions"] if c["chart_type"] == "scatter"]
        assert len(scatter_charts) == 1

    def test_pie_chart_generation(self):
        from app.services.chart_service import generate_inline_charts

        result = generate_inline_charts(
            columns=["Color", "Count"],
            rows=[["Red", 10], ["Blue", 20], ["Red", 15], ["Green", 5]],
        )
        pie_charts = [c for c in result["suggestions"] if c["chart_type"] == "pie"]
        assert len(pie_charts) >= 1

    def test_empty_data(self):
        from app.services.chart_service import generate_inline_charts

        result = generate_inline_charts(columns=[], rows=[])
        assert result["suggestions"] == []
        assert result["columns"] == {}

    def test_single_column_numeric(self):
        from app.services.chart_service import generate_inline_charts

        result = generate_inline_charts(
            columns=["Value"],
            rows=[[10], [20], [30], [40], [50]],
        )
        assert len(result["suggestions"]) >= 1
        assert result["columns"]["Value"] == "numeric"

    def test_aggregation_mean(self):
        from app.services.chart_service import generate_inline_charts

        result = generate_inline_charts(
            columns=["Cat", "Val"],
            rows=[["A", 10], ["A", 20], ["B", 30], ["B", 40]],
            chart_type="bar",
            x_column="Cat",
            y_column="Val",
            aggregation="mean",
        )
        assert len(result["suggestions"]) == 1
        chart = result["suggestions"][0]
        a_val = next(d["value"] for d in chart["data"] if d["name"] == "A")
        assert a_val == 15.0
