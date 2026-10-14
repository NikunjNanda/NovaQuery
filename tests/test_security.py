import pytest
from app.security import validate_sql_security


def is_blocked(sql: str) -> bool:
    """True if the validator rejects the query (raises, or returns a falsy/error result)."""
    try:
        result = validate_sql_security(sql)
    except Exception:
        return True
    # Adjust if your function returns something else, e.g. (ok, msg) or a dict
    if isinstance(result, tuple):
        return not result[0]
    if isinstance(result, dict):
        return not result.get("valid", result.get("success", True))
    return result is False


ALLOWED = [
    "SELECT * FROM iris",
    "SELECT species, AVG(sepal_length) FROM iris GROUP BY species",
    "SELECT * FROM iris WHERE petal_length > 1.5 ORDER BY petal_width DESC LIMIT 10",
    "WITH t AS (SELECT * FROM iris) SELECT * FROM t",
    "SELECT a.species FROM iris a JOIN iris b ON a.id = b.id",
    "SELECT species FROM iris WHERE species IN (SELECT species FROM iris)",
]

BLOCKED = [
    "DROP TABLE iris",
    "DELETE FROM iris",
    "DELETE FROM iris WHERE species = 'setosa'",
    "UPDATE iris SET species = 'x'",
    "INSERT INTO iris (species) VALUES ('x')",
    "CREATE TABLE t (id INT)",
    "ALTER TABLE iris ADD COLUMN x INT",
    "SELECT 1; DROP TABLE iris",                 # stacked statements
    "select 1; delete from iris",                # lowercase + stacked
    "/* hi */ DROP TABLE iris",                  # leading comment
    "-- note\nDROP TABLE iris",                  # line comment
    "DrOp TaBlE iris",                           # mixed case
    "PRAGMA table_info(iris)",                   # non-SELECT
    "ATTACH DATABASE 'x.db' AS x",               # non-SELECT
    "",                                          # empty
    "not sql at all",                            # garbage
]


@pytest.mark.parametrize("sql", ALLOWED)
def test_allowed(sql):
    assert not is_blocked(sql), f"Should be allowed: {sql}"


@pytest.mark.parametrize("sql", BLOCKED)
def test_blocked(sql):
    assert is_blocked(sql), f"Should be blocked: {sql}"


# Edge cases worth knowing about. These print the outcome so you can decide
# whether the behaviour is what you want.
@pytest.mark.parametrize("sql", [
    "SELECT species FROM iris UNION SELECT species FROM iris",
    "SELECT * FROM iris WHERE species = 'a; DROP TABLE iris'",   # semicolon inside a string
])
def test_probe(sql):
    print(f"\nblocked={is_blocked(sql)}  ->  {sql}") 
