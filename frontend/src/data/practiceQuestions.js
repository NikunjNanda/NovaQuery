/**
 * Predefined SQL and Database Practice Lab Question Bank.
 * 
 * Contains exactly 15 factually accurate questions, 5 at each difficulty level:
 * - Beginner: SELECT, WHERE, DISTINCT, ORDER BY, LIMIT
 * - Intermediate: GROUP BY, HAVING, aggregate functions, and JOINs
 * - Advanced: subqueries, indexes, transactions, NULL handling, and PostgreSQL concepts
 */

export const PRACTICE_QUESTIONS = [
  // ==========================================
  // BEGINNER (5 Questions)
  // ==========================================
  {
    id: 'q-beg-select',
    category: 'SELECT',
    difficulty: 'beginner',
    question: 'Which SQL clause specifies the specific columns to retrieve from a table?',
    sqlSnippet: 'SELECT first_name, last_name\nFROM employees;',
    options: [
      'EXTRACT',
      'SELECT',
      'FETCH',
      'CHOOSE',
    ],
    correctIndex: 1,
    explanation: 'The SELECT clause defines the projection of expressions and columns to return in a query result set. FROM specifies the target table.',
    hint: 'It is typically the very first keyword written in standard SQL query statements.',
  },
  {
    id: 'q-beg-where',
    category: 'WHERE',
    difficulty: 'beginner',
    question: 'Which operator is used in a WHERE clause to filter text against a wildcard pattern in SQL?',
    sqlSnippet: "SELECT * FROM customers\nWHERE email LIKE '%@company.com';",
    options: [
      'CONTAINS',
      'MATCHES',
      'LIKE',
      'SIMILAR',
    ],
    correctIndex: 2,
    explanation: "The LIKE operator compares column values with pattern strings using wildcards such as '%' (matches zero or more characters) and '_' (matches exactly one character).",
    hint: 'This operator is frequently paired with percent signs (%) or underscores (_).',
  },
  {
    id: 'q-beg-distinct',
    category: 'DISTINCT',
    difficulty: 'beginner',
    question: 'What is the primary effect of placing DISTINCT directly after SELECT in a SQL query?',
    sqlSnippet: 'SELECT DISTINCT department\nFROM employees;',
    options: [
      'It eliminates duplicate rows from the query output.',
      'It sorts rows in ascending alphabetical order automatically.',
      'It restricts results to only non-null values.',
      'It returns only the first unique record found in the table.',
    ],
    correctIndex: 0,
    explanation: 'SELECT DISTINCT filters out duplicate tuples across the projected columns, ensuring each combination of returned values appears only once in the result set.',
    hint: 'It removes identical repeated entries from the result set.',
  },
  {
    id: 'q-beg-orderby',
    category: 'ORDER BY',
    difficulty: 'beginner',
    question: 'How does an ORDER BY clause sort records if neither ASC nor DESC is explicitly specified?',
    sqlSnippet: 'SELECT product_name, price\nFROM products\nORDER BY price;',
    options: [
      'Descending order (highest to lowest)',
      'Random table insertion order',
      'Ascending order (lowest to highest)',
      'Primary key index order',
    ],
    correctIndex: 2,
    explanation: 'In ANSI SQL, ascending order (ASC) is the default sorting direction whenever an ORDER BY clause omits a direction specifier.',
    hint: 'Numbers default from lowest to highest, and text from A to Z.',
  },
  {
    id: 'q-beg-limit',
    category: 'LIMIT',
    difficulty: 'beginner',
    question: 'What does the LIMIT clause accomplish in SQLite and PostgreSQL queries?',
    sqlSnippet: 'SELECT title, release_year\nFROM movies\nORDER BY release_year DESC\nLIMIT 5;',
    options: [
      'It sets a maximum query execution timeout in milliseconds.',
      'It restricts the maximum number of rows returned by the query.',
      'It restricts memory usage during intermediate sorting.',
      'It limits the number of columns returned in the SELECT statement.',
    ],
    correctIndex: 1,
    explanation: 'The LIMIT clause caps the number of rows returned by the result set, making it invaluable for pagination and previewing top records.',
    hint: 'Combined with ORDER BY, it is commonly used to find top N records.',
  },

  // ==========================================
  // INTERMEDIATE (5 Questions)
  // ==========================================
  {
    id: 'q-int-groupby',
    category: 'GROUP BY',
    difficulty: 'intermediate',
    question: 'When using a GROUP BY clause, which rule applies to non-aggregated columns in standard SQL SELECT statements?',
    sqlSnippet: 'SELECT department, AVG(salary)\nFROM employees\nGROUP BY department;',
    options: [
      'Any table column may be selected without restriction.',
      'All selected columns not in aggregate functions must appear in the GROUP BY clause.',
      'Non-aggregated columns must have unique indexes.',
      'GROUP BY requires at least three aggregated columns in the projection.',
    ],
    correctIndex: 1,
    explanation: 'Standard SQL requires that every column in the SELECT clause that is not wrapped in an aggregate function must be listed in the GROUP BY clause to guarantee unambiguous results per group.',
    hint: "If a column isn't aggregated with SUM, AVG, COUNT, etc., the database needs to know which grouping bucket it belongs to.",
  },
  {
    id: 'q-int-having',
    category: 'HAVING',
    difficulty: 'intermediate',
    question: 'What is the fundamental difference between the WHERE and HAVING clauses?',
    sqlSnippet: "SELECT department, COUNT(*)\nFROM employees\nWHERE status = 'active'\nGROUP BY department\nHAVING COUNT(*) >= 5;",
    options: [
      'WHERE can only filter numbers, while HAVING filters strings.',
      'WHERE filters rows before grouping; HAVING filters aggregated groups after grouping.',
      'HAVING executes before table joins, while WHERE executes after table joins.',
      'WHERE is only used in subqueries, while HAVING is only used in main queries.',
    ],
    correctIndex: 1,
    explanation: 'WHERE evaluates and filters individual rows before grouping and aggregation occur. HAVING evaluates aggregate values and filters groups after the GROUP BY phase.',
    hint: 'Consider the logical query execution order: row filtering happens before group aggregation.',
  },
  {
    id: 'q-int-aggregate',
    category: 'Aggregate Functions',
    difficulty: 'intermediate',
    question: 'How does the standard aggregate function COUNT(column_name) treat NULL values?',
    sqlSnippet: 'SELECT COUNT(bonus)\nFROM employee_compensation;',
    options: [
      'It converts NULL values to 0 and counts them.',
      'It throws a run-time SQL exception if a NULL is encountered.',
      'It ignores NULL values and counts only non-null occurrences.',
      'It terminates the query and returns NULL as the result.',
    ],
    correctIndex: 2,
    explanation: 'COUNT(column_name) ignores rows where column_name IS NULL. In contrast, COUNT(*) counts all rows regardless of column values.',
    hint: 'COUNT(*) counts all rows, but COUNT(column_name) evaluates only values in the specified column.',
  },
  {
    id: 'q-int-leftjoin',
    category: 'JOINs',
    difficulty: 'intermediate',
    question: 'Which type of JOIN returns all records from the left table and only matching records from the right table?',
    sqlSnippet: 'SELECT orders.id, customers.name\nFROM orders\nLEFT JOIN customers ON orders.customer_id = customers.id;',
    options: [
      'INNER JOIN',
      'CROSS JOIN',
      'LEFT JOIN (or LEFT OUTER JOIN)',
      'FULL OUTER JOIN',
    ],
    correctIndex: 2,
    explanation: 'A LEFT OUTER JOIN preserves all rows from the left table. If no match exists on the right table, columns from the right table are filled with NULLs.',
    hint: "The table on the 'left' side of the join operator is fully preserved.",
  },
  {
    id: 'q-int-crossjoin',
    category: 'JOINs',
    difficulty: 'intermediate',
    question: 'What result is produced if two tables with 10 rows and 5 rows are joined using a CROSS JOIN without a filter?',
    sqlSnippet: 'SELECT *\nFROM table_a\nCROSS JOIN table_b;',
    options: [
      'A Cartesian product of 50 rows',
      'A union of 15 rows',
      'An intersection of 5 rows',
      'An empty result set with 0 rows',
    ],
    correctIndex: 0,
    explanation: 'A CROSS JOIN computes the Cartesian product of two tables, pairing each row of the first table with every row of the second table (10 × 5 = 50 rows).',
    hint: 'Multiply the row count of the first table by the row count of the second table.',
  },

  // ==========================================
  // ADVANCED (5 Questions)
  // ==========================================
  {
    id: 'q-adv-subqueries',
    category: 'Subqueries',
    difficulty: 'advanced',
    question: 'What distinguishes a correlated subquery from a standard independent subquery?',
    sqlSnippet: "SELECT e1.name, e1.salary\nFROM employees e1\nWHERE e1.salary > (\n  SELECT AVG(e2.salary)\n  FROM employees e2\n  WHERE e2.department_id = e1.department_id\n);",
    options: [
      'A correlated subquery runs exactly once and caches its result in memory.',
      'A correlated subquery references columns from the outer query and evaluates for each outer row candidate.',
      'A correlated subquery can only return multiple tables simultaneously.',
      'A correlated subquery must be written entirely inside an INSERT statement.',
    ],
    correctIndex: 1,
    explanation: 'A correlated subquery depends on values from the outer query (in this example, e1.department_id) and logically evaluates in the context of each candidate row processed by the outer statement.',
    hint: 'Notice how the inner query refers directly to an alias defined in the outer FROM clause.',
  },
  {
    id: 'q-adv-indexes',
    category: 'Indexes',
    difficulty: 'advanced',
    question: 'How does a B-Tree index accelerate an equality or range query in relational database engines?',
    sqlSnippet: 'CREATE INDEX idx_orders_created\nON orders (created_at);',
    options: [
      'It keeps a balanced search tree of ordered keys, enabling logarithmic O(log N) lookup time instead of a full table scan.',
      'It compresses the entire underlying table onto disk into a single block.',
      'It duplicates all database table rows into random hash slots.',
      'It pre-executes and caches all future SELECT statements on that table.',
    ],
    correctIndex: 0,
    explanation: 'A B-Tree index maintains a self-balancing tree structure where keys are kept in sorted order. This allows the query engine to traverse from root to leaf in O(log N) operations rather than scanning every page of the table (O(N)).',
    hint: 'Think about binary or balanced tree search complexity compared to scanning every row.',
  },
  {
    id: 'q-adv-transactions',
    category: 'Transactions',
    difficulty: 'advanced',
    question: "In the ACID model of database transactions, what does the 'I' (Isolation) property guarantee?",
    sqlSnippet: 'BEGIN TRANSACTION;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nCOMMIT;',
    options: [
      'Transactions are immediately synced to remote replica disks.',
      'Concurrent transactions execute without undesirable interference, behaving as if executed sequentially according to the isolation level.',
      'All database constraints and foreign keys are permanently disabled during writes.',
      'Once committed, transaction changes survive power failures and crashes.',
    ],
    correctIndex: 1,
    explanation: 'Isolation guarantees that concurrent transactions operate independently and do not observe uncommitted or inconsistent intermediate states of other concurrent transactions, as determined by the configured isolation level.',
    hint: "It prevents concurrent transactions from seeing each other's intermediate or uncommitted modifications.",
  },
  {
    id: 'q-adv-null',
    category: 'NULL Handling',
    difficulty: 'advanced',
    question: 'In three-valued SQL logic, what is the boolean outcome of the comparison (NULL = NULL)?',
    sqlSnippet: "SELECT CASE\n  WHEN NULL = NULL THEN 'EQUAL'\n  ELSE 'NOT EQUAL / UNKNOWN'\nEND AS result;",
    options: [
      'TRUE',
      'FALSE',
      'UNKNOWN (which evaluates as falsy in conditional WHERE filters)',
      'An arithmetic syntax error',
    ],
    correctIndex: 2,
    explanation: "In ANSI SQL three-valued logic, NULL represents an unknown value. Comparing NULL to anything—even another NULL using '='—yields UNKNOWN rather than TRUE. To test for nullity, you must use 'IS NULL' or 'IS NOT NULL'.",
    hint: 'NULL signifies an unknown value, so two unknown values cannot be confirmed equal.',
  },
  {
    id: 'q-adv-postgres',
    category: 'PostgreSQL Concepts',
    difficulty: 'advanced',
    question: 'In PostgreSQL, what is the primary role of the VACUUM operation?',
    sqlSnippet: 'VACUUM (ANALYZE, VERBOSE) orders;',
    options: [
      'To encrypt table storage and rotate credentials',
      'To reclaim storage occupied by dead row versions (tuples) left by UPDATE and DELETE operations and update optimizer statistics',
      'To drop unused schema tables and purge transaction logs',
      'To convert tables from row-oriented storage into columnar Parquet format',
    ],
    correctIndex: 1,
    explanation: 'PostgreSQL uses Multi-Version Concurrency Control (MVCC), where UPDATEs and DELETEs leave dead tuples behind. VACUUM reclaims this space so it can be reused by future rows, and when run with ANALYZE, updates table statistics for the query planner.',
    hint: "Because of PostgreSQL's MVCC architecture, updated and deleted rows remain on disk as dead tuples until cleaned.",
  },
];
