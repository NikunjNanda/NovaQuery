import sqlglot
from sqlglot import exp

class SecurityException(Exception):
    """Custom exception raised when a query fails AST security validation."""
    pass 

def validate_sql_security(sql_query: str) -> bool:
    """
    Parses a SQL string into an Abstract Syntax Tree (AST) using SQLGlot 
    and verifies that it contains ONLY read-only SELECT operations. 
    """
    try:
        # Parse the SQL string into AST expression nodes
        parsed_expressions = sqlglot.parse(sql_query, read="sqlite")
        
        if not parsed_expressions:
            raise SecurityException("Security Violation: Empty query provided.")

        for expression in parsed_expressions:
            if expression is None:
                continue

            # Check root statement type: Only allow SELECT
            if not isinstance(expression, exp.Select):
                stmt_type = type(expression).__name__.upper()
                raise SecurityException(
                    f"Security Violation: Query type '{stmt_type}' is not allowed. Only SELECT queries are permitted."
                )

            # Deep inspection: Scan all sub-nodes to prevent nested modification statements
            # Removed exp.Truncate (does not exist in sqlglot.expressions)
            forbidden_nodes = (
                exp.Insert, exp.Update, exp.Delete, exp.Drop, 
                exp.Create, exp.Alter
            )
            
            for node in expression.walk():
                if isinstance(node, forbidden_nodes):
                    node_type = type(node).__name__.upper()
                    raise SecurityException(
                        f"Security Violation: Forbidden statement '{node_type}' detected inside query."
                    )

        return True

    except sqlglot.errors.ParseError as e:
        raise SecurityException(f"Invalid SQL syntax generated: {str(e)}")