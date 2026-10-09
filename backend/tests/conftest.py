import os
import shutil
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///./storage/test_app.db")
os.environ.setdefault("AI_PROVIDER", "demo")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db.init_db import init_db  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]


def pytest_sessionstart(session):  # noqa: ARG001
    storage = ROOT / "storage"
    if storage.exists():
        shutil.rmtree(storage)
    storage.mkdir(parents=True, exist_ok=True)
    init_db()


def pytest_sessionfinish(session, exitstatus):  # noqa: ARG001
    db_file = ROOT / "storage" / "test_app.db"
    if db_file.exists():
        db_file.unlink()


import pytest  # noqa: E402


@pytest.fixture
def client():
    return TestClient(app)
