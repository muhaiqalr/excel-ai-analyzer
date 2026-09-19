import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestHealthCheck:
    def test_health(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestFileUpload:
    def test_upload_xlsx(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test_data.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["original_filename"] == "test_data.xlsx"
        assert data["total_sheets"] == 2
        assert data["total_rows"] == 8
        assert len(data["sheets"]) == 2
        assert data["sheets"][0]["sheet_name"] == "Employees"
        assert data["sheets"][1]["sheet_name"] == "Products"
        assert data["sheets"][0]["row_count"] == 5
        assert data["sheets"][1]["row_count"] == 3

    def test_upload_csv(self, client, auth_headers, sample_csv):
        with open(sample_csv, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test_data.csv", f, "text/csv")},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["original_filename"] == "test_data.csv"
        assert data["total_sheets"] == 1
        assert data["total_rows"] == 5
        assert len(data["sheets"]) == 1
        assert data["sheets"][0]["row_count"] == 5
        assert data["sheets"][0]["column_count"] == 4

    def test_upload_invalid_extension(self, client, auth_headers, invalid_file):
        with open(invalid_file, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": ("test.txt", f, "text/plain")},
            )
        assert response.status_code == 400
        assert ".xlsx, .xls, and .csv" in response.json()["detail"]

    def test_upload_no_file(self, client, auth_headers):
        response = client.post(
            "/api/files/upload",
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_upload_unauthenticated(self, client, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            response = client.post(
                "/api/files/upload",
                files={"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
        assert response.status_code == 401


class TestSheetAnalysis:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_analyze_xlsx_sheet(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]
        sheet_name = "Employees"

        response = client.get(
            f"/api/files/{file_id}/sheets/{sheet_name}/analysis",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sheet_name"] == "Employees"
        assert data["row_count"] == 5
        assert data["column_count"] == 6
        assert "Name" in data["column_names"]
        assert "Age" in data["column_names"]
        assert data["detected_types"]["Age"] == "numeric"
        assert len(data["preview"]) == 5
        assert len(data["column_details"]) == 6

    def test_analyze_csv_sheet(self, client, auth_headers, sample_csv):
        file_data = self._upload_file(
            client, auth_headers, sample_csv, "test.csv", "text/csv"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/sheets/Sheet1/analysis",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sheet_name"] == "Sheet1"
        assert data["row_count"] == 5
        assert data["column_count"] == 4
        assert "City" in data["column_names"]
        assert len(data["preview"]) == 5

    def test_analyze_nonexistent_sheet(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/sheets/NonExistent/analysis",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_analyze_nonexistent_file(self, client, auth_headers):
        response = client.get(
            "/api/files/nonexistent-id/sheets/Sheet1/analysis",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestFileData:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_read_xlsx_data(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sheet_name"] == "Employees"
        assert len(data["rows"]) == 3
        assert len(data["columns"]) == 6
        assert data["total_rows"] == 5
        assert data["total_pages"] == 2

    def test_read_csv_data(self, client, auth_headers, sample_csv):
        file_data = self._upload_file(
            client, auth_headers, sample_csv, "test.csv", "text/csv"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"page": 1, "page_size": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 5
        assert len(data["rows"]) == 5

    def test_read_data_default_sheet(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"page": 1, "page_size": 100},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sheet_name"] == "Employees"


class TestFileManagement:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_list_files(self, client, auth_headers, sample_xlsx):
        self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response = client.get("/api/files/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_get_file(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response = client.get(f"/api/files/{file_data['id']}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["original_filename"] == "test.xlsx"

    def test_delete_file(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response = client.delete(f"/api/files/{file_data['id']}", headers=auth_headers)
        assert response.status_code == 204

        response = client.get(f"/api/files/{file_data['id']}", headers=auth_headers)
        assert response.status_code == 404

    def test_statistics(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/statistics",
            headers=auth_headers,
            params={"sheet_name": "Employees"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "Age" in data["columns"]
        assert data["columns"]["Age"]["type"] == "numeric"

    def test_charts(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.get(
            f"/api/files/{file_id}/charts",
            headers=auth_headers,
            params={"sheet_name": "Employees"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0


class TestCellEditing:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_edit_single_cell(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Name", "value": "ALICE_MODIFIED"}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["rows"][0][0] == "ALICE_MODIFIED"

    def test_edit_multiple_cells(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Name", "value": "Test1"},
                    {"sheet_name": "Employees", "row": 1, "column": "Name", "value": "Test2"},
                    {"sheet_name": "Employees", "row": 0, "column": "Age", "value": 99},
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["rows"][0][0] == "Test1"
        assert data["rows"][1][0] == "Test2"
        assert data["rows"][0][1] == 99

    def test_edit_creates_version(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Name", "value": "Versioned"}
                ]
            },
        )

        response = client.get(
            f"/api/files/{file_id}/versions",
            headers=auth_headers,
        )
        assert response.status_code == 200
        versions = response.json()
        assert len(versions) >= 2

    def test_edit_original_file_preserved(self, client, auth_headers, sample_xlsx):
        with open(sample_xlsx, "rb") as f:
            original_content = f.read()

        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Name", "value": "Changed"}
                ]
            },
        )

        response = client.get(
            f"/api/files/{file_id}/versions",
            headers=auth_headers,
        )
        versions = response.json()
        initial_version = [v for v in versions if v["change_description"] == "Initial upload"]
        assert len(initial_version) == 1


class TestStructuralChanges:
    def _upload_file(self, client, auth_headers, filepath, filename, mime_type):
        with open(filepath, "rb") as f:
            response = client.post(
                "/api/files/upload",
                headers=auth_headers,
                files={"file": (filename, f, mime_type)},
            )
        assert response.status_code == 201
        return response.json()

    def test_add_row(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "structural": [
                    {"operation": "add_row", "sheet_name": "Employees", "index": 5}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 6

    def test_delete_row(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "structural": [
                    {"operation": "delete_row", "sheet_name": "Employees", "index": 4}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 4

    def test_add_column(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "structural": [
                    {"operation": "add_column", "sheet_name": "Employees", "column_name": "NewCol"}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert "NewCol" in data["columns"]

    def test_delete_column(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "structural": [
                    {"operation": "delete_column", "sheet_name": "Employees", "column_name": "Active"}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert "Active" not in data["columns"]

    def test_rename_column(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "structural": [
                    {"operation": "rename_column", "sheet_name": "Employees", "column_name": "Name", "new_name": "FullName"}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert "FullName" in data["columns"]
        assert "Name" not in data["columns"]

    def test_combined_changes_and_structural(self, client, auth_headers, sample_xlsx):
        file_data = self._upload_file(
            client, auth_headers, sample_xlsx, "test.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "changes": [
                    {"sheet_name": "Employees", "row": 0, "column": "Name", "value": "Combined"}
                ],
                "structural": [
                    {"operation": "add_row", "sheet_name": "Employees", "index": 5}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"sheet_name": "Employees", "page": 1, "page_size": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 6
        assert data["rows"][0][0] == "Combined"

    def test_add_row_csv(self, client, auth_headers, sample_csv):
        file_data = self._upload_file(
            client, auth_headers, sample_csv, "test.csv", "text/csv"
        )
        file_id = file_data["id"]

        response = client.put(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            json={
                "structural": [
                    {"operation": "add_row", "sheet_name": "Sheet1", "index": 5}
                ]
            },
        )
        assert response.status_code == 200

        response = client.get(
            f"/api/files/{file_id}/data",
            headers=auth_headers,
            params={"page": 1, "page_size": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 6
