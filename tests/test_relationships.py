import pytest
from sqlalchemy import create_engine
import pandas as pd
from app.relationships import (
    detect_relationships,
    are_names_matching_or_similar,
    normalize_col_name,
    are_types_compatible,
    determine_cardinality,
)


def test_name_variant_matching():
    # CustomerID vs customer_id
    exact, sim = are_names_matching_or_similar("customers", "CustomerID", "orders", "customer_id")
    assert exact is True
    assert sim is True

    # customer_id vs id
    exact, sim = are_names_matching_or_similar("customers", "id", "orders", "customer_id")
    assert exact is True
    assert sim is True

    # products.id vs orders.product_id
    exact, sim = are_names_matching_or_similar("products", "id", "orders", "product_id")
    assert exact is True
    assert sim is True

    # Totally unrelated names
    exact, sim = are_names_matching_or_similar("animals", "species", "orders", "amount")
    assert exact is False
    assert sim is False


def test_type_compatibility():
    assert are_types_compatible("INTEGER", "BIGINT") is True
    assert are_types_compatible("INT", "REAL") is True
    assert are_types_compatible("TEXT", "VARCHAR(255)") is True
    assert are_types_compatible("DATE", "DATETIME") is True
    assert are_types_compatible("TEXT", "INTEGER") is False


def test_cardinality_classification():
    # Left unique (3 distinct / 3 rows), Right non-unique (3 distinct / 10 rows)
    assert determine_cardinality(3, 3, 10, 3) == "one_to_many"
    # Left non-unique, Right unique
    assert determine_cardinality(10, 3, 3, 3) == "many_to_one"
    # Both unique
    assert determine_cardinality(5, 5, 5, 5) == "one_to_one"
    # Neither unique
    assert determine_cardinality(10, 3, 10, 3) == "many_to_many"


def test_relationship_detection_with_dataframe_tables():
    engine = create_engine("sqlite:///:memory:")

    # Table 1: customers
    customers_df = pd.DataFrame({
        "customer_id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "Diana", "Evan"],
    })
    customers_df.to_sql("customers", con=engine, index=False)

    # Table 2: orders with matching values
    orders_df = pd.DataFrame({
        "order_id": [101, 102, 103, 104, 105, 106],
        "CustomerID": [1, 1, 2, 3, 4, 5],  # mixed casing
        "amount": [10.5, 20.0, 15.0, 30.0, 25.5, 40.0],
    })
    orders_df.to_sql("orders", con=engine, index=False)

    rels = detect_relationships(engine, ["customers", "orders"])
    assert len(rels) >= 1

    rel = rels[0]
    cols = {rel["left_column"], rel["right_column"]}
    assert "customer_id" in cols
    assert "CustomerID" in cols
    assert rel["overlap_pct"] == 100.0
    assert rel["confidence"] >= 0.90


def test_relationship_detection_skips_trivial_columns():
    engine = create_engine("sqlite:///:memory:")

    # Table 1: has a boolean-like status column with only 2 distinct values
    t1 = pd.DataFrame({
        "id": [1, 2, 3, 4, 5, 6],
        "status": ["active", "inactive", "active", "active", "inactive", "active"],
    })
    t1.to_sql("t1", con=engine, index=False)

    # Table 2: also has status
    t2 = pd.DataFrame({
        "id": [10, 20, 30, 40],
        "status": ["active", "inactive", "active", "active"],
    })
    t2.to_sql("t2", con=engine, index=False)

    rels = detect_relationships(engine, ["t1", "t2"])
    # status has only 2 distinct values, so it must not be detected as join column
    status_rels = [r for r in rels if r["left_column"] == "status" or r["right_column"] == "status"]
    assert len(status_rels) == 0


def test_no_relationship_detected():
    engine = create_engine("sqlite:///:memory:")

    t1 = pd.DataFrame({"animal": ["cat", "dog", "mouse", "elephant", "bear"], "weight": [5, 20, 0.1, 5000, 300]})
    t2 = pd.DataFrame({"country": ["USA", "UK", "Canada", "Germany", "France"], "population": [330, 67, 38, 83, 67]})

    t1.to_sql("t1", con=engine, index=False)
    t2.to_sql("t2", con=engine, index=False)

    rels = detect_relationships(engine, ["t1", "t2"])
    assert len(rels) == 0

