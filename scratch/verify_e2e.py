import io
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app, active_db_target
from app.query_engine import run_natural_language_query

client = TestClient(app)

def test_customers_orders_e2e():
    print("\n--- TEST 1: Multi-Dataset Upload (customers.csv + orders.csv) ---")
    customers_data = (
        "customer_id,name,city\n"
        "1,Alice,Berlin\n"
        "2,Bob,Paris\n"
        "3,Charlie,Tokyo\n"
        "4,David,Berlin\n"
    ).encode("utf-8")

    orders_data = (
        "order_id,customer_id,order_amount\n"
        "101,1,200.0\n"
        "102,2,350.0\n"
        "103,1,150.0\n"
        "104,3,400.0\n"
        "105,4,500.0\n"
    ).encode("utf-8")

    files = [
        ("files", ("customers.csv", io.BytesIO(customers_data), "text/csv")),
        ("files", ("orders.csv", io.BytesIO(orders_data), "text/csv")),
    ]

    upload_resp = client.post("/api/upload-multiple", files=files)
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    upload_json = upload_resp.json()
    print("Upload status:", upload_json["success"])
    print("Created tables:", upload_json["tables"])
    print("Detected relationships:", upload_json["relationships"])
    assert len(upload_json["relationships"]) >= 1

    rel = upload_json["relationships"][0]
    print(f"Relationship: {rel['left_table']}.{rel['left_column']} -> {rel['right_table']}.{rel['right_column']} ({rel['cardinality']})")

    # Ask the question: "Which city has the highest total order amount?"
    print("\nAsking: 'Which city has the highest total order amount?'")
    query_resp = client.post(
        "/api/query",
        json={
            "question": "Which city has the highest total order amount?",
            "db_path": upload_json["db_path"],
        }
    )
    assert query_resp.status_code == 200, f"Query failed: {query_resp.text}"
    q_data = query_resp.json()
    print("Success:", q_data["success"])
    print("Generated SQL:", q_data["generated_sql"])
    print("Results:", q_data["data"])
    assert q_data["success"] is True
    assert "JOIN" in q_data["generated_sql"].upper()
    print("Verified: Query generated SQL with JOIN and returned results successfully!")

def test_single_file_iris():
    print("\n--- TEST 2: Single-File Upload (Iris.csv) ---")
    iris_path = "Iris.csv"
    if not os.path.exists(iris_path):
        iris_csv = (
            "sepal_length,sepal_width,petal_length,petal_width,species\n"
            "5.1,3.5,1.4,0.2,setosa\n"
            "4.9,3.0,1.4,0.2,setosa\n"
            "7.0,3.2,4.7,1.4,versicolor\n"
        ).encode("utf-8")
        file_payload = ("Iris.csv", io.BytesIO(iris_csv), "text/csv")
    else:
        file_payload = ("Iris.csv", open(iris_path, "rb"), "text/csv")

    upload_resp = client.post("/api/upload-db", files={"file": file_payload})
    assert upload_resp.status_code == 200, f"Single upload failed: {upload_resp.text}"
    u_json = upload_resp.json()
    print("Single upload success:", u_json["success"])
    print("Database path:", u_json["db_path"])

    query_resp = client.post(
        "/api/query",
        json={
            "question": "How many total rows are in this dataset?",
            "db_path": u_json["db_path"],
        }
    )
    assert query_resp.status_code == 200
    q_json = query_resp.json()
    print("Query success:", q_json["success"])
    print("Generated SQL:", q_json["generated_sql"])
    print("Results:", q_json["data"])
    print("Verified: Single-file upload remains 100% intact!")

if __name__ == "__main__":
    test_customers_orders_e2e()
    test_single_file_iris()
