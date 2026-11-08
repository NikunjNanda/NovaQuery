import re
from typing import List, Dict, Any, Optional, Set
from sqlalchemy import inspect, text


def simplify_type(raw_type) -> str:
    """Maps SQL type to broad categories: INT, REAL, BOOL, DATE, TEXT."""
    t = str(raw_type).upper()
    if "BOOL" in t:
        return "BOOL"
    if "INT" in t:
        return "INT"
    if any(k in t for k in ("REAL", "FLOA", "DOUB", "NUM", "DEC")):
        return "REAL"
    if "DATE" in t or "TIME" in t:
        return "DATE"
    return "TEXT"


def are_types_compatible(type1: str, type2: str) -> bool:
    """Checks if two broad column types can participate in a join."""
    t1 = simplify_type(type1)
    t2 = simplify_type(type2)
    if t1 == t2:
        return True
    # Compatible numeric types (e.g. integer IDs vs float IDs due to pandas NaN handling)
    if t1 in ("INT", "REAL") and t2 in ("INT", "REAL"):
        return True
    return False


def normalize_col_name(name: str) -> str:
    """Normalizes a column name by lowercasing and stripping non-alphanumeric chars."""
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def are_names_matching_or_similar(table1: str, col1: str, table2: str, col2: str) -> tuple[bool, bool]:
    """
    Checks if col1 and col2 match or are similar.
    Returns (exact_match, similar_match).
    Examples:
      customer_id == CustomerID -> exact_match = True
      customers.id == orders.customer_id -> exact_match = True
    """
    n1 = normalize_col_name(col1)
    n2 = normalize_col_name(col2)

    if not n1 or not n2:
        return False, False

    if n1 == n2:
        return True, True

    # Check table prefix patterns: e.g. customers.id matching orders.customer_id
    tbl1 = normalize_col_name(table1)
    tbl2 = normalize_col_name(table2)
    tbl1_stem = re.sub(r"s$", "", tbl1)
    tbl2_stem = re.sub(r"s$", "", tbl2)

    # col1 is 'id', col2 is '<table1>_id'
    if n1 == "id" and (n2 == f"{tbl1}id" or n2 == f"{tbl1_stem}id"):
        return True, True
    if n2 == "id" and (n1 == f"{tbl2}id" or n1 == f"{tbl2_stem}id"):
        return True, True

    # Similarity checks: one ends with the other or contains the other
    if len(n1) >= 3 and len(n2) >= 3:
        if n1 in n2 or n2 in n1:
            return False, True
        if (n1.endswith("id") and n2.endswith("id")) or (n1.endswith("code") and n2.endswith("code")):
            return False, True

    return False, False


def normalize_value(val: Any) -> Any:
    """Normalizes scalar values for consistent overlap comparison."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # Normalize whole floats like 1.0 to int 1
        if isinstance(val, float) and val.is_integer():
            return int(val)
        return val
    # String representation trimmed and lowercased
    s = str(val).strip().lower()
    # Try converting string representation of integer
    if s.isdigit():
        return int(s)
    return s


def sample_column_values(conn, engine, table: str, column: str, limit: int = 10000) -> tuple[Set[Any], int, int]:
    """
    Queries distinct non-null values for a column up to limit.
    Returns (set_of_values, total_count, distinct_count).
    """
    quote = engine.dialect.identifier_preparer.quote
    qt = quote(table)
    qc = quote(column)

    try:
        count_row = conn.execute(
            text(f"SELECT COUNT({qc}), COUNT(DISTINCT {qc}) FROM {qt} WHERE {qc} IS NOT NULL")
        ).fetchone()
        total_non_null = int(count_row[0]) if count_row else 0
        distinct_count = int(count_row[1]) if count_row else 0

        if distinct_count <= 2:
            return set(), total_non_null, distinct_count

        rows = conn.execute(
            text(f"SELECT DISTINCT {qc} FROM {qt} WHERE {qc} IS NOT NULL LIMIT {limit}")
        ).fetchall()

        values = {normalize_value(r[0]) for r in rows if r[0] is not None}
        return values, total_non_null, distinct_count
    except Exception as e:
        print(f"Error sampling values for {table}.{column}: {e}")
        return set(), 0, 0


def determine_cardinality(left_total: int, left_distinct: int, right_total: int, right_distinct: int) -> str:
    """
    Classifies relationship cardinality:
    one_to_one, one_to_many, many_to_one, many_to_many
    """
    left_is_unique = (left_distinct > 0 and left_distinct == left_total)
    right_is_unique = (right_distinct > 0 and right_distinct == right_total)

    if left_is_unique and right_is_unique:
        return "one_to_one"
    if left_is_unique and not right_is_unique:
        return "one_to_many"
    if not left_is_unique and right_is_unique:
        return "many_to_one"
    return "many_to_many"


def detect_relationships(engine, tables: List[str]) -> List[Dict[str, Any]]:
    """
    For every pair of tables, finds candidate join columns using:
      a) Name match (normalized)
      b) Type compatibility
      c) Value overlap >= 0.5 with name match, or >= 0.9 with similarity.
    Returns list of relationship objects.
    """
    if len(tables) < 2:
        return []

    inspector = inspect(engine)
    table_meta = {}

    # Inspect columns and types for each table
    for table in tables:
        try:
            cols = inspector.get_columns(table)
            table_meta[table] = {
                c["name"]: {
                    "name": c["name"],
                    "type": str(c["type"]),
                    "kind": simplify_type(c["type"]),
                }
                for c in cols
            }
        except Exception:
            table_meta[table] = {}

    detected_links = []
    seen_pairs = set()

    with engine.connect() as conn:
        for i in range(len(tables)):
            for j in range(i + 1, len(tables)):
                t1 = tables[i]
                t2 = tables[j]
                cols1 = table_meta.get(t1, {})
                cols2 = table_meta.get(t2, {})

                for c1_name, c1_info in cols1.items():
                    for c2_name, c2_info in cols2.items():
                        # 1. Type compatibility check
                        if not are_types_compatible(c1_info["type"], c2_info["type"]):
                            continue

                        # 2. Name match or similarity check
                        exact_match, similar_match = are_names_matching_or_similar(t1, c1_name, t2, c2_name)
                        if not (exact_match or similar_match):
                            continue

                        # 3. Sample values & compute overlap
                        vals1, total1, dist1 = sample_column_values(conn, engine, t1, c1_name)
                        vals2, total2, dist2 = sample_column_values(conn, engine, t2, c2_name)

                        # Skip columns with too few distinct values (e.g. <= 2 distinct)
                        if len(vals1) <= 2 or len(vals2) <= 2:
                            continue

                        intersection = vals1.intersection(vals2)
                        if not intersection:
                            continue

                        smaller_size = min(len(vals1), len(vals2))
                        overlap = len(intersection) / smaller_size if smaller_size > 0 else 0.0

                        # Accept criteria:
                        # - Name matches and overlap >= 0.50
                        # - Or overlap >= 0.90 and names are similar
                        accepted = False
                        if exact_match and overlap >= 0.50:
                            accepted = True
                        elif similar_match and overlap >= 0.90:
                            accepted = True

                        if not accepted:
                            continue

                        cardinality = determine_cardinality(total1, dist1, total2, dist2)

                        # Calculate confidence
                        if exact_match and overlap >= 0.90:
                            confidence = 0.95
                        elif exact_match and overlap >= 0.70:
                            confidence = 0.85
                        elif exact_match:
                            confidence = 0.75
                        else:
                            confidence = 0.80

                        pair_key = tuple(sorted([f"{t1}.{c1_name}", f"{t2}.{c2_name}"]))
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)

                        detected_links.append({
                            "left_table": t1,
                            "left_column": c1_name,
                            "right_table": t2,
                            "right_column": c2_name,
                            "overlap_pct": round(overlap * 100.0, 1),
                            "cardinality": cardinality,
                            "confidence": round(confidence, 2),
                        })

    # Sort relationships by confidence and overlap descending
    detected_links.sort(key=lambda r: (r["confidence"], r["overlap_pct"]), reverse=True)
    return detected_links

