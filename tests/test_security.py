"""
Security tests for validate_sql_security().

Run from the project root:
    python -m pytest tests/test_security.py -q
"""
import pytest
from app.security import SecurityException, validate_sql_security


# ---------- read-only queries that MUST be allowed ----------
ALLOWED = [
    "SELECT * FROM iris",
    "SELECT * FROM iris;",                                            # trailing semicolon
    "select species, avg(sepal_length) from iris group by species having avg(sepal_length) > 1 order by 2 desc limit 5",
    "SELECT * FROM iris WHERE petal_length > 1.5 ORDER BY petal_width DESC LIMIT 10",
    "SELECT * FROM (SELECT * FROM iris) t",                           # subquery in FROM
    "SELECT species FROM iris WHERE species IN (SELECT species FROM iris)",
    "WITH t AS (SELECT * FROM iris) SELECT * FROM t",                 # CTE
    "SELECT a.species FROM iris a JOIN iris b ON a.id = b.id",        # join
    "SELECT 'DROP TABLE iris' AS note",                               # dangerous words inside a string are just text
    "SELECT * FROM iris WHERE species = 'a; DROP TABLE iris'",        # semicolon inside a string
    "SELECT species FROM iris UNION SELECT species FROM iris",        # set operations are read-only
    "SELECT species FROM iris INTERSECT SELECT species FROM iris",
    "SELECT species FROM iris EXCEPT SELECT species FROM iris",
]


@pytest.mark.parametrize("sql", ALLOWED)
def test_read_only_queries_are_allowed(sql):
    assert validate_sql_security(sql) is True


# ---------- write / admin statements that MUST be blocked ----------
BLOCKED = [
    "INSERT INTO iris (species) VALUES ('x')",
    "UPDATE iris SET species = 'x'",
    "DELETE FROM iris",
    "DELETE FROM iris WHERE species = 'setosa'",
    "delete from iris",                                               # lowercase
    "DrOp TaBlE iris",                                                # mixed case
    "DROP TABLE iris",
    "CREATE TABLE t (id INT)",
    "ALTER TABLE iris ADD COLUMN x INT",
    "REPLACE INTO iris (species) VALUES ('x')",
    "PRAGMA table_info(iris)",
    "ATTACH DATABASE 'other.db' AS o",
    "VACUUM",
    "BEGIN",
    "EXPLAIN SELECT 1",
    "/* hi */ DROP TABLE iris",                                       # leading block comment
    "-- note\nDROP TABLE iris",                                       # leading line comment
    "WITH a AS (SELECT 1) DELETE FROM iris",                          # write hidden behind a CTE
]


@pytest.mark.parametrize("sql", BLOCKED)
def test_write_and_admin_statements_are_blocked(sql):
    with pytest.raises(SecurityException):
        validate_sql_security(sql)


# ---------- tricks ----------
TRICKS = [
    "SELECT 1; DROP TABLE iris",                                      # stacked statements
    "select 1; delete from iris",                                     # lowercase + stacked
    "SELECT 1; /* hi */ DELETE FROM iris",                            # comment between statements
    "SELECT 1; SELECT 2",                                             # even two harmless statements: one at a time
    "SELECT load_extension('evil.dll')",                              # would load native code
]


@pytest.mark.parametrize("sql", TRICKS)
def test_tricky_inputs_are_blocked(sql):
    with pytest.raises(SecurityException):
        validate_sql_security(sql)


# ---------- junk input must fail CLEANLY (as SecurityException, never a raw crash) ----------
JUNK = [
    "",
    "   ",
    ";",
    "-- just a comment",
    "not sql at all",
    "hello world",
    "SELECT 'unterminated",
]


@pytest.mark.parametrize("sql", JUNK)
def test_empty_or_invalid_input_is_rejected_cleanly(sql):
    with pytest.raises(SecurityException):
        validate_sql_security(sql) 
