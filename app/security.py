import sqlglot
from sqlglot import exp


class SecurityException(Exception):
    """Raised when a query fails AST security validation."""
    pass


ALLOWED_ROOTS = (exp.Select, exp.Union, exp.Intersect, exp.Except)
FORBIDDEN_NODES = (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create, exp.Alter)


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

    return True 