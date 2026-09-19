import os
import sys
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models.models import User
from app.utils.security import hash_password, create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hash_password("password123"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def sample_xlsx(tmp_path):
    import pandas as pd

    filepath = tmp_path / "test_data.xlsx"
    df = pd.DataFrame({
        "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
        "Age": [25, 30, 35, 28, 42],
        "Department": ["Engineering", "Marketing", "Engineering", "HR", "Marketing"],
        "Salary": [70000.0, 55000.0, 80000.0, 60000.0, 58000.0],
        "Start Date": pd.to_datetime(["2020-01-15", "2019-06-01", "2018-03-20", "2021-09-10", "2020-11-05"]),
        "Active": [True, True, False, True, True],
    })
    df2 = pd.DataFrame({
        "Product": ["Widget", "Gadget", "Doohickey"],
        "Price": [9.99, 24.99, 4.99],
        "Stock": [100, 50, 200],
    })
    with pd.ExcelWriter(str(filepath), engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Employees", index=False)
        df2.to_excel(writer, sheet_name="Products", index=False)

    return filepath


@pytest.fixture
def sample_csv(tmp_path):
    import pandas as pd

    filepath = tmp_path / "test_data.csv"
    df = pd.DataFrame({
        "City": ["New York", "London", "Tokyo", "Paris", "Sydney"],
        "Population": [8300000, 8900000, 13900000, 2100000, 5300000],
        "Country": ["USA", "UK", "Japan", "France", "Australia"],
        "Avg Temp": [12.3, 11.1, 15.4, 11.7, 18.3],
    })
    df.to_csv(str(filepath), index=False)
    return filepath


@pytest.fixture
def invalid_file(tmp_path):
    filepath = tmp_path / "test.txt"
    filepath.write_text("This is not an Excel or CSV file")
    return filepath
