import io
import pytest
from fastapi.testclient import TestClient
from app.main import app, active_db_target

client = TestClient(app)


def test_multi_upload_requires_at_least_two_files():
    file1 = ("file1.csv", io.BytesIO(b"id,val\n1,a"), "text/csv")
    resp = client.post("/api/upload-multiple", files=[("files", file1)])
    assert resp.status_code == 400
    assert "at least 2 files" in resp.json()["detail"]


def test_multi_upload_max_six_files():
    files = [
        ("files", (f"file{i}.csv", io.BytesIO(b"id,val\n1,a"), "text/csv"))
        for i in range(7)
    ]
    resp = client.post("/api/upload-multiple", files=files)
    assert resp.status_code == 400
    assert "maximum of 6 files" in resp.json()["detail"].lower()


def test_multi_upload_creates_unified_workspace_db():
    customers_csv = (
        "id,name,city\n"
        "1,Alice,New York\n"
        "2,Bob,London\n"
        "3,Charlie,Paris\n"
        "4,Diana,Tokyo\n"
    ).encode("utf-8")

    orders_csv = (
        "order_id,customer_id,amount\n"
        "101,1,250.0\n"
        "102,2,120.5\n"
        "103,1,75.0\n"
        "104,3,310.0\n"
    ).encode("utf-8")

    files = [
        ("files", ("customers.csv", io.BytesIO(customers_csv), "text/csv")),
        ("files", ("orders.csv", io.BytesIO(orders_csv), "text/csv")),
    ]

    resp = client.post("/api/upload-multiple", files=files)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["success"] is True
    assert "workspace_" in data["db_path"]
    assert "customers" in data["tables"]
    assert "orders" in data["tables"]
    assert len(data["relationships"]) >= 1

    rel = data["relationships"][0]
    # Check that either orders.customer_id -> customers.id or customers.id -> orders.customer_id was found
    cols = {rel["left_column"], rel["right_column"]}
    assert "customer_id" in cols or "id" in cols

    # Verify /api/profile works on the created workspace
    profile_resp = client.get(f"/api/profile?db_path={data['db_path']}")
    assert profile_resp.status_code == 200
    p_data = profile_resp.json()
    assert p_data["total_tables"] == 2
    assert "relationships" in p_data


def test_multi_upload_duplicate_table_names():
    csv1 = ("id,val\n1,a\n2,b\n3,c\n").encode("utf-8")
    csv2 = ("id,val\n1,x\n2,y\n3,z\n").encode("utf-8")

    files = [
        ("files", ("sales.csv", io.BytesIO(csv1), "text/csv")),
        ("files", ("sales.csv", io.BytesIO(csv2), "text/csv")),
    ]

    resp = client.post("/api/upload-multiple", files=files)
    assert resp.status_code == 200, resp.text
    tables = resp.json()["tables"]
    assert "sales" in tables
    assert "sales_2" in tables


def test_multi_upload_no_common_fields_returns_422():
    animals_csv = (
        "species,legs\n"
        "dog,4\n"
        "bird,2\n"
        "spider,8\n"
    ).encode("utf-8")

    finance_csv = (
        "ticker,stock_price\n"
        "AAPL,180.5\n"
        "GOOGL,140.2\n"
        "MSFT,370.0\n"
    ).encode("utf-8")

    files = [
        ("files", ("animals.csv", io.BytesIO(animals_csv), "text/csv")),
        ("files", ("finance.csv", io.BytesIO(finance_csv), "text/csv")),
    ]

    resp = client.post("/api/upload-multiple", files=files)
    assert resp.status_code == 422
    err = resp.json()["detail"]
    assert "cannot be queried together" in err["message"]
    assert "animals" in err["table_columns"]
    assert "finance" in err["table_columns"]


def test_confirm_relationships_endpoint():
    # Attempting to confirm on non-existent column returns 400
    customers_csv = "id,name\n1,Alice\n2,Bob\n".encode("utf-8")
    orders_csv = "order_id,cust_id\n1,1\n2,2\n".encode("utf-8")

    files = [
        ("files", ("customers.csv", io.BytesIO(customers_csv), "text/csv")),
        ("files", ("orders.csv", io.BytesIO(orders_csv), "text/csv")),
    ]

    upload_resp = client.post("/api/upload-multiple", files=files)
    db_path = upload_resp.json().get("db_path") or upload_resp.json()["detail"]["db_path"]

    # Invalid column
    bad_req = {
        "db_path": db_path,
        "relationships": [
            {"left_table": "customers", "left_column": "nonexistent", "right_table": "orders", "right_column": "cust_id"}
        ]
    }
    bad_resp = client.post("/api/confirm-relationships", json=bad_req)
    assert bad_resp.status_code == 400

    # Valid manual link
    good_req = {
        "db_path": db_path,
        "relationships": [
            {"left_table": "customers", "left_column": "id", "right_table": "orders", "right_column": "cust_id"}
        ]
    }
    good_resp = client.post("/api/confirm-relationships", json=good_req)
    assert good_resp.status_code == 200
    assert good_resp.json()["success"] is True
    assert len(good_resp.json()["relationships"]) == 1


def test_single_file_upload_remains_intact():
    single_csv = "id,color\n1,red\n2,blue\n".encode("utf-8")
    file_payload = ("test_single.csv", io.BytesIO(single_csv), "text/csv")
    resp = client.post("/api/upload-db", files={"file": file_payload})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_workspace_join_and_table_security(monkeypatch):
    import app.briefing
    monkeypatch.setattr(app.briefing, "llm", None)
    from app.schemas import run_user_sql
    from app.query_engine import format_relationships_context

    customers_csv = "customer_id,name,city\n1,Alice,Berlin\n2,Bob,Paris\n3,Charlie,Rome\n4,David,London\n".encode("utf-8")
    orders_csv = "order_id,customer_id,amount\n101,1,250\n102,2,450\n103,1,100\n104,3,300\n".encode("utf-8")

    files = [
        ("files", ("customers.csv", io.BytesIO(customers_csv), "text/csv")),
        ("files", ("orders.csv", io.BytesIO(orders_csv), "text/csv")),
    ]

    upload_resp = client.post("/api/upload-multiple", files=files)
    assert upload_resp.status_code == 200
    db_path = upload_resp.json()["db_path"]

    # 1. Successful JOIN query
    join_sql = "SELECT c.name, c.city, o.amount FROM customers c JOIN orders o ON c.customer_id = o.customer_id"
    res = run_user_sql(join_sql, db_path)
    assert res["success"] is True
    assert len(res["data"]) == 4
    assert res["data"][0]["name"] in ("Alice", "Bob", "Charlie", "David")

    # 2. Reject query accessing table outside workspace
    bad_sql = "SELECT * FROM passwords"
    bad_res = run_user_sql(bad_sql, db_path)
    assert bad_res["success"] is False
    assert "does not exist in the active workspace" in bad_res["error"]

    # 3. Format relationships context
    rels = upload_resp.json()["relationships"]
    ctx = format_relationships_context(rels)
    assert "RELATIONSHIPS (JOIN keys between tables):" in ctx
    assert "customers.customer_id" in ctx or "orders.customer_id" in ctx
    assert "Multi-Table Guidelines:" in ctx

    # 4. Profile endpoint returns per-table profiles, sample_rows, overview and relationships
    prof_resp = client.get(f"/api/profile?db_path={db_path}")
    assert prof_resp.status_code == 200
    prof_data = prof_resp.json()
    assert prof_data["total_tables"] == 2
    assert len(prof_data["tables"]) == 2
    assert "sample_rows" in prof_data["tables"][0]
    assert len(prof_data["relationships"]) == 1
    assert "overview" in prof_data
    assert "Relationships" in [p["label"] for p in prof_data["overview"]["points"]]

    # 5. Briefing endpoint returns cross-table starter queries
    brief_resp = client.get(f"/api/briefing?db_path={db_path}&refresh=true")
    assert brief_resp.status_code == 200
    brief_data = brief_resp.json()
    assert len(brief_data["starter_queries"]) >= 5
    # Verify at least one query contains JOIN
    all_tags = [tag for q in brief_data["starter_queries"] for tag in q["tags"]]
    assert any("JOIN" in tag for tag in all_tags)
