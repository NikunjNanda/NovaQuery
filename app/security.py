import sqlglot
from sqlglot import exp


class SecurityException(Exception):
    """Raised when a query fails AST security validation."""
    pass


ALLOWED_ROOTS = (exp.Select, exp.Union, exp.Intersect, exp.Except)
FORBIDDEN_NODES = (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create, exp.Alter)
FORBIDDEN_FUNCTIONS = {"load_extension"}   # <-- added


BLOCKED_SYSTEM_TABLES = {"sqlite_master", "sqlite_temp_master", "sqlite_sequence", "sqlite_stat1"}


def validate_tables_in_workspace(sql_query: str, allowed_tables: set) -> bool:
    """
    Verifies that every table referenced in the SQL query exists in the active workspace
    and blocks internal SQLite tables.
    """
    if not sql_query or not sql_query.strip():
        raise SecurityException("Security Violation: Empty query provided.")
    try:
        expression = sqlglot.parse_one(sql_query, read="sqlite")
    except Exception as e:
        raise SecurityException(f"Invalid SQL syntax: {e}")

    # Extract CTE aliases so they are not treated as physical database tables
    cte_names = {c.alias_or_name.lower() for c in expression.find_all(exp.CTE)}

    norm_allowed = {t.lower() for t in allowed_tables} if allowed_tables else set()

    for table_node in expression.find_all(exp.Table):
        table_name = table_node.name.lower()
        if not table_name:
            continue
        if table_name in cte_names:
            continue
        if table_name in BLOCKED_SYSTEM_TABLES or table_name.startswith("sqlite_"):
            raise SecurityException(f"Security Violation: Access to system table '{table_name}' is forbidden.")
        if norm_allowed and table_name not in norm_allowed:
            raise SecurityException(f"Security Violation: Table '{table_name}' does not exist in the active workspace (no such table: {table_name}).")

    return True


def validate_sql_security(sql_query: str) -> bool:
    """Allow only a single read-only SELECT (including CTEs and UNION/INTERSECT/EXCEPT)."""
    if not sql_query or not sql_query.strip():
        raise SecurityException("Security Violation: Empty query provided.")

    try:
        parsed = sqlglot.parse(sql_query, read="sqlite")
    except sqlglot.errors.SqlglotError as e:   # covers ParseError and TokenError
        raise SecurityException(f"Invalid SQL syntax generated: {e}")

    statements = [s for s in parsed if s is not None]
    if not statements:
        raise SecurityException("Security Violation: Empty query provided.")
    if len(statements) > 1:
        raise SecurityException("Security Violation: Multiple statements are not allowed.")

    expression = statements[0]

    if not isinstance(expression, ALLOWED_ROOTS):
        stmt_type = type(expression).__name__.upper()
        raise SecurityException(
            f"Security Violation: Query type '{stmt_type}' is not allowed. "
            "Only SELECT queries are permitted."
        )

    for node in expression.walk():
        if isinstance(node, FORBIDDEN_NODES):
            raise SecurityException(
                f"Security Violation: Forbidden statement '{type(node).__name__.upper()}' detected inside query."
            )
        # <-- added
        if isinstance(node, exp.Anonymous) and str(node.this).lower() in FORBIDDEN_FUNCTIONS:
            raise SecurityException(
                f"Security Violation: Function '{node.this}' is not allowed."
            )

    return True 
