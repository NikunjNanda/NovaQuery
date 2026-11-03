"""
Tests for direct user SQL execution (run_user_sql) without AI/LLM involvement.
"""
import sqlite3
import pytest
from app import query_engine
from app.query_engine import run_user_sql


class ExplodingLLM:
    """Mock object that raises if any LLM interaction is attempted."""
    def __getattr__(self, name):
        raise RuntimeError("LLM must never be called during run_user_sql!")

    def __call__(self, *args, **kwargs):
        raise RuntimeError("LLM must never be called during run_user_sql!")

    def invoke(self, *args, **kwargs):
        raise RuntimeError("LLM must never be called during run_user_sql!")


@pytest.fixture(autouse=True)
def guard_no_llm(monkeypatch):
    """Ensure every test runs with an exploding LLM mock."""
    monkeypatch.setattr(query_engine, "llm", ExplodingLLM())


@pytest.fixture
def temp_db(tmp_path):
    """Build a small temporary SQLite DB (isolated from company.db)."""
    db_file = tmp_path / "test_user_sql.db"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);")
    cursor.executemany(
        "INSERT INTO products (id, name, price) VALUES (?, ?, ?);",
        [
            (1, "Widget", 19.99),
            (2, "Gadget", 29.99),
            (3, "Doohickey", 9.99),
        ],
    )
    conn.commit()
    conn.close()
    return str(db_file)


def test_valid_select_returns_rows_and_success_true(temp_db):
    sql = "SELECT id, name, price FROM products ORDER BY id"
    result = run_user_sql(sql, temp_db)
    assert result["success"] is True
    assert result["error"] is None
    assert result["row_count"] == 3
    assert len(result["data"]) == 3
    assert result["data"][0] == {"id": 1, "name": "Widget", "price": 19.99}
    assert result["data"][1] == {"id": 2, "name": "Gadget", "price": 29.99}
    assert result["data"][2] == {"id": 3, "name": "Doohickey", "price": 9.99}
    assert result["generated_sql"] == sql
    assert result["postgres_sql"] is not None
    assert result["explanation"] == ""
    assert result["attempts_needed"] == 1
    assert result["lesson"] is not None
    assert len(result["lesson"]["steps"]) >= 2


def test_union_select_works(temp_db):
    sql = "SELECT name FROM products WHERE id = 1 UNION SELECT name FROM products WHERE id = 2"
    result = run_user_sql(sql, temp_db)
    assert result["success"] is True
    assert result["error"] is None
    names = {row["name"] for row in result["data"]}
    assert names == {"Widget", "Gadget"}


DANGEROUS_STATEMENTS = [
    "DROP TABLE products",
    "DELETE FROM products",
    "DELETE FROM products WHERE id = 1",
    "UPDATE products SET price = 0",
    "INSERT INTO products (id, name, price) VALUES (4, 'Malicious', 999)",
    "CREATE TABLE backdoor (id INT)",
    "ALTER TABLE products ADD COLUMN leaked TEXT",
    "SELECT 1; DROP TABLE products",
]


@pytest.mark.parametrize("bad_sql", DANGEROUS_STATEMENTS)
def test_dangerous_statements_blocked_and_table_intact(temp_db, bad_sql):
    result = run_user_sql(bad_sql, temp_db)
    assert result["success"] is False
    assert result.get("error") is not None
    assert "Security Violation" in result["error"]

    # Verify table remains completely intact
    conn = sqlite3.connect(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, price FROM products ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    assert rows == [
        (1, "Widget", 19.99),
        (2, "Gadget", 29.99),
        (3, "Doohickey", 9.99),
    ]


def test_syntax_error_returns_clean_error_no_exception(temp_db):
    result = run_user_sql("SELECT FROM WHERE", temp_db)
    assert result["success"] is False
    assert result.get("error") is not None
    assert len(result["error"]) > 0


def test_unknown_table_returns_clean_error_no_exception(temp_db):
    result = run_user_sql("SELECT * FROM non_existent_table", temp_db)
    assert result["success"] is False
    assert result.get("error") is not None
    assert "no such table" in result["error"].lower()


@pytest.mark.parametrize("empty_sql", ["", "   ", "\n\t  "])
def test_empty_string_returns_success_false(temp_db, empty_sql):
    result = run_user_sql(empty_sql, temp_db)
    assert result["success"] is False
    assert result.get("error") is not None


def test_no_llm_called_assertion(temp_db, monkeypatch):
    """Explicitly verify that attempting to use LLM would crash, but run_user_sql succeeds."""
    called = False

    class CrashIfCalled:
        def __getattr__(self, item):
            nonlocal called
            called = True
            raise AssertionError("LLM attribute accessed!")

        def __call__(self, *args, **kwargs):
            nonlocal called
            called = True
            raise AssertionError("LLM called!")

    monkeypatch.setattr(query_engine, "llm", CrashIfCalled())
    result = run_user_sql("SELECT name FROM products", temp_db)
    assert result["success"] is True
    assert not called


def test_api_run_sql_empty_string_returns_400():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.post("/api/run-sql", json={"sql": ""})
    assert response.status_code == 400
    assert "cannot be empty" in response.json()["detail"].lower()

    response_ws = client.post("/api/run-sql", json={"sql": "   "})
    assert response_ws.status_code == 400
    assert "cannot be empty" in response_ws.json()["detail"].lower()


def test_api_run_sql_valid_query(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    import app.main as main_mod

    client = TestClient(app)
    # Target the default DB or mock run_user_sql
    monkeypatch.setattr(main_mod, "run_user_sql", lambda sql, db_path: {
        "success": True,
        "generated_sql": sql,
        "data": [{"id": 1}],
        "error": None,
    })
    response = client.post("/api/run-sql", json={"sql": "SELECT 1"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["generated_sql"] == "SELECT 1"
