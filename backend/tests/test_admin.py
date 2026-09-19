import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import User
from app.utils.security import hash_password, create_access_token


@pytest.fixture
def regular_user(db_session):
    user = User(
        username="testregular",
        email="testregular@test.com",
        hashed_password=hash_password("password123"),
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    user = User(
        username="testadmin",
        email="testadmin@test.com",
        hashed_password=hash_password("password123"),
        role="admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_headers(regular_user):
    token = create_access_token(regular_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    token = create_access_token(admin_user.id)
    return {"Authorization": f"Bearer {token}"}


class TestAdminAuthorization:
    def test_normal_user_cannot_access_dashboard(self, client, user_headers):
        resp = client.get("/api/admin/dashboard", headers=user_headers)
        assert resp.status_code == 403

    def test_admin_can_access_dashboard(self, client, admin_headers):
        resp = client.get("/api/admin/dashboard", headers=admin_headers)
        assert resp.status_code == 200

    def test_normal_user_cannot_access_users(self, client, user_headers):
        resp = client.get("/api/admin/users", headers=user_headers)
        assert resp.status_code == 403

    def test_admin_can_access_users(self, client, admin_headers):
        resp = client.get("/api/admin/users", headers=admin_headers)
        assert resp.status_code == 200

    def test_normal_user_cannot_access_datasets(self, client, user_headers):
        resp = client.get("/api/admin/datasets", headers=user_headers)
        assert resp.status_code == 403

    def test_admin_can_access_datasets(self, client, admin_headers):
        resp = client.get("/api/admin/datasets", headers=admin_headers)
        assert resp.status_code == 200

    def test_normal_user_cannot_access_health(self, client, user_headers):
        resp = client.get("/api/admin/health", headers=user_headers)
        assert resp.status_code == 403

    def test_admin_can_access_health(self, client, admin_headers):
        resp = client.get("/api/admin/health", headers=admin_headers)
        assert resp.status_code == 200

    def test_unauthenticated_cannot_access_admin(self, client):
        resp = client.get("/api/admin/dashboard")
        assert resp.status_code == 401


class TestAdminDashboard:
    def test_dashboard_returns_stats(self, client, admin_headers):
        resp = client.get("/api/admin/dashboard", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_users" in data
        assert "total_datasets" in data
        assert "total_analyses" in data
        assert "ai_requests" in data
        assert "system_status" in data
        assert "db_status" in data
        assert "ai_configured" in data

    def test_dashboard_has_real_user_count(self, client, admin_headers, regular_user, admin_user):
        resp = client.get("/api/admin/dashboard", headers=admin_headers)
        data = resp.json()
        assert data["total_users"] >= 2


class TestAdminUserManagement:
    def test_list_users(self, client, admin_headers, regular_user):
        resp = client.get("/api/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_get_user(self, client, admin_headers, regular_user):
        resp = client.get(f"/api/admin/users/{regular_user.id}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testregular"
        assert data["role"] == "user"

    def test_update_user_role(self, client, admin_headers, regular_user):
        resp = client.patch(
            f"/api/admin/users/{regular_user.id}",
            headers=admin_headers,
            json={"role": "admin"},
        )
        assert resp.status_code == 200

    def test_admin_cannot_remove_own_admin_role(self, client, admin_headers, admin_user):
        resp = client.patch(
            f"/api/admin/users/{admin_user.id}",
            headers=admin_headers,
            json={"role": "user"},
        )
        assert resp.status_code == 400

    def test_admin_cannot_disable_own_account(self, client, admin_headers, admin_user):
        resp = client.patch(
            f"/api/admin/users/{admin_user.id}",
            headers=admin_headers,
            json={"is_active": False},
        )
        assert resp.status_code == 400

    def test_user_search(self, client, admin_headers, regular_user):
        resp = client.get("/api/admin/users", headers=admin_headers, params={"search": "testregular"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1


class TestAdminDatasets:
    def test_list_datasets(self, client, admin_headers):
        resp = client.get("/api/admin/datasets", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "datasets" in data
        assert "total" in data


class TestAdminAnalyses:
    def test_list_analyses(self, client, admin_headers):
        resp = client.get("/api/admin/analyses", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "analyses" in data
        assert "total" in data


class TestAdminUsage:
    def test_list_usage(self, client, admin_headers):
        resp = client.get("/api/admin/usage", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "usages" in data
        assert "total" in data
        assert "total_errors" in data


class TestAdminLogs:
    def test_list_logs(self, client, admin_headers):
        resp = client.get("/api/admin/logs", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "logs" in data
        assert "total" in data


class TestAdminHealth:
    def test_health_status(self, client, admin_headers):
        resp = client.get("/api/admin/health", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "backend" in data
        assert "database" in data
        assert "ai_provider" in data
        assert "storage" in data
