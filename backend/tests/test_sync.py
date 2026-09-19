import os
import sys
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestDatasetVersionTracking:
    def test_upload_returns_dataset_version(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        assert response.status_code == 201
        data = response.json()
        assert "dataset_version" in data
        assert data["dataset_version"] == 1

    def test_get_file_returns_dataset_version(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            upload_res = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        file_id = upload_res.json()["id"]
        response = client.get(f"/api/files/{file_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["dataset_version"] == 1

    def test_get_version_endpoint(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            upload_res = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        file_id = upload_res.json()["id"]
        response = client.get(f"/api/files/{file_id}/version", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["dataset_version"] == 1
        assert data["file_id"] == file_id


class TestSaveWithVersion:
    def _upload_file(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            res = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        return res.json()["id"]

    def test_save_with_correct_version(self, client, auth_headers, sample_xlsx):
        file_id = self._upload_file(client, auth_headers, sample_xlsx)
        response = client.put(
            f"/api/files/{file_id}/data/save",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Age", "value": 99}
                ],
                "structural": [],
                "dataset_version": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["dataset_version"] == 2
        assert "saved" in data["message"].lower()

    def test_save_with_wrong_version_conflict(self, client, auth_headers, sample_xlsx):
        file_id = self._upload_file(client, auth_headers, sample_xlsx)

        client.put(
            f"/api/files/{file_id}/data/save",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Age", "value": 99}
                ],
                "structural": [],
                "dataset_version": 1,
            },
        )

        response = client.put(
            f"/api/files/{file_id}/data/save",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Age", "value": 100}
                ],
                "structural": [],
                "dataset_version": 1,
            },
        )
        assert response.status_code == 409
        data = response.json()
        assert "version" in data["detail"].lower()

    def test_version_increments_on_save(self, client, auth_headers, sample_xlsx):
        file_id = self._upload_file(client, auth_headers, sample_xlsx)

        for expected_version in range(2, 5):
            res = client.put(
                f"/api/files/{file_id}/data/save",
                headers=auth_headers,
                json={
                    "changes": [
                        {"sheet_name": "Employees", "row": 0, "column": "Age", "value": 20 + expected_version}
                    ],
                    "structural": [],
                    "dataset_version": expected_version - 1,
                },
            )
            assert res.status_code == 200
            assert res.json()["dataset_version"] == expected_version

    def test_save_no_changes(self, client, auth_headers, sample_xlsx):
        file_id = self._upload_file(client, auth_headers, sample_xlsx)
        response = client.put(
            f"/api/files/{file_id}/data/save",
            headers=auth_headers,
            json={
                "changes": [],
                "structural": [],
                "dataset_version": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestDiscardChanges:
    def _upload_file(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            res = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        return res.json()["id"]

    def test_discard_returns_success(self, client, auth_headers, sample_xlsx):
        file_id = self._upload_file(client, auth_headers, sample_xlsx)
        response = client.delete(f"/api/files/{file_id}/data/discard", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "dataset_version" in data

    def test_discard_preserves_version(self, client, auth_headers, sample_xlsx):
        file_id = self._upload_file(client, auth_headers, sample_xlsx)
        response = client.delete(f"/api/files/{file_id}/data/discard", headers=auth_headers)
        assert response.json()["dataset_version"] == 1


class TestChatWithInlineData:
    def _upload_file(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            res = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        return res.json()["id"]

    @patch("app.services.ai_service.httpx.post")
    def test_chat_with_inline_data(self, mock_post, client, auth_headers, sample_xlsx):
        from unittest.mock import MagicMock
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "The highest age is 99."}]}}]
        }
        mock_post.return_value = mock_response

        file_id = self._upload_file(client, auth_headers, sample_xlsx)
        response = client.post(
            f"/api/analysis/{file_id}/chat",
            headers=auth_headers,
            json={
                "content": "What is the highest age?",
                "columns": ["Name", "Age", "Department", "Salary"],
                "rows": [
                    ["Alice", 99, "Engineering", 70000],
                    ["Bob", 30, "Marketing", 55000],
                ],
                "dataset_version": 2,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "assistant"
        assert "99" in data["content"]

    @patch("app.services.ai_service.httpx.post")
    def test_chat_without_inline_data_uses_file(self, mock_post, client, auth_headers, sample_xlsx):
        from unittest.mock import MagicMock
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "The data shows 5 employees."}]}}]
        }
        mock_post.return_value = mock_response

        file_id = self._upload_file(client, auth_headers, sample_xlsx)
        response = client.post(
            f"/api/analysis/{file_id}/chat",
            headers=auth_headers,
            json={
                "content": "How many employees are there?",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "assistant"


class TestLiveStatisticsRecalculation:
    def test_inline_stats_with_modified_data(self, client, auth_headers):
        columns = ["Name", "Sales", "Region"]
        rows = [
            ["Alice", 1000, "North"],
            ["Bob", 2000, "South"],
            ["Charlie", 3000, "North"],
        ]
        response = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["overview"]["total_rows"] == 3
        assert data["columns"]["Sales"]["sum"] == 6000

    def test_inline_stats_after_value_change(self, client, auth_headers):
        columns = ["Name", "Sales"]
        rows_before = [["Alice", 1000], ["Bob", 2000]]
        rows_after = [["Alice", 5000], ["Bob", 2000]]

        res_before = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_before},
        )
        res_after = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_after},
        )
        assert res_before.json()["columns"]["Sales"]["sum"] == 3000
        assert res_after.json()["columns"]["Sales"]["sum"] == 7000

    def test_inline_stats_after_row_added(self, client, auth_headers):
        columns = ["Name", "Sales"]
        rows_before = [["Alice", 1000]]
        rows_after = [["Alice", 1000], ["Bob", 2000]]

        res_before = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_before},
        )
        res_after = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_after},
        )
        assert res_before.json()["overview"]["total_rows"] == 1
        assert res_after.json()["overview"]["total_rows"] == 2

    def test_inline_stats_after_row_deleted(self, client, auth_headers):
        columns = ["Name", "Sales"]
        rows_before = [["Alice", 1000], ["Bob", 2000], ["Charlie", 3000]]
        rows_after = [["Alice", 1000], ["Charlie", 3000]]

        res_before = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_before},
        )
        res_after = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_after},
        )
        assert res_before.json()["overview"]["total_rows"] == 3
        assert res_after.json()["overview"]["total_rows"] == 2
        assert res_after.json()["columns"]["Sales"]["sum"] == 4000

    def test_inline_stats_after_column_deleted(self, client, auth_headers):
        columns_before = ["Name", "Sales", "Region"]
        rows_before = [["Alice", 1000, "North"], ["Bob", 2000, "South"]]
        columns_after = ["Name", "Sales"]
        rows_after = [["Alice", 1000], ["Bob", 2000]]

        res_before = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns_before, "rows": rows_before},
        )
        res_after = client.post(
            "/api/analysis/statistics",
            headers=auth_headers,
            json={"columns": columns_after, "rows": rows_after},
        )
        assert "Region" in res_before.json()["columns"]
        assert "Region" not in res_after.json()["columns"]

    def test_inline_charts_with_modified_data(self, client, auth_headers):
        columns = ["Month", "Sales"]
        rows = [["Jan", 100], ["Feb", 200], ["Mar", 300]]
        response = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={"columns": columns, "rows": rows},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) > 0

    def test_inline_charts_after_value_change(self, client, auth_headers):
        columns = ["Month", "Sales"]
        rows_before = [["Jan", 100], ["Feb", 200]]
        rows_after = [["Jan", 500], ["Feb", 200]]

        res_before = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_before},
        )
        res_after = client.post(
            "/api/analysis/charts",
            headers=auth_headers,
            json={"columns": columns, "rows": rows_after},
        )
        assert res_before.status_code == 200
        assert res_after.status_code == 200
