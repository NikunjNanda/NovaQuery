/**
 * Single source of mock data for NovaQuery.
 * 
 * BACKEND CONTRACT DOCUMENTATION:
 * The backend developer should mirror these clean JSON shapes when expanding
 * endpoints for dataset briefings, starter queries, query lesson breakdowns,
 * and execution history.
 */

/**
 * Expected shape for Dataset Briefing & Insights.
 * // TODO(backend): Endpoint like `GET /api/dataset-briefing?db_path=...` will return this shape.
 * 
 * {
 *   title: string,
 *   description: string,
 *   classification: {
 *     category: string,
 *     type: string,
 *     origin: string
 *   },
 *   insight: {
 *     title: string,
 *     category: string,
 *     description: string
 *   }
 * }
 */
export const mockDatasetBriefing = {
  title: "What this data is about",
  description:
    "The Iris dataset contains 150 physical measurements of three iris flower species: setosa, versicolor, and virginica. It is commonly used to explore classification, grouping, and continuous numerical distributions.",
  classification: {
    category: "CLASSIFICATION",
    type: "Multivariate",
    origin: "Fisher, 1936",
  },
  insight: {
    title: "Worth checking in this data",
    category: "Distribution Insight",
    description:
      "Petal dimensions show sharp separation between Setosa and the other two species, making GROUP BY and WHERE filters particularly demonstrative. Sepal measurements have significant overlap.",
  },
};

/**
 * Expected shape for Recommended Curriculum Starter Queries.
 * // TODO(backend): Endpoint like `GET /api/starter-queries?db_path=...` will return an array of this shape.
 * 
 * Array of:
 * {
 *   id: string,
 *   number: string,
 *   difficulty: 'beginner' | 'intermediate' | 'advanced',
 *   difficultyLabel: string,
 *   category: string,
 *   title: string,
 *   description: string,
 *   question: string,
 *   tags: string[]
 * }
 */
export const mockStarterQueries = [
  // Beginner (Fundamentals)
  {
    id: "sq-1",
    number: "01",
    difficulty: "beginner",
    difficultyLabel: "Fundamentals",
    category: "Preview",
    title: "Count total rows and preview the first 5 records",
    description:
      "Inspect table structure and check schema alignment without pulling full dataset.",
    question: "Count total rows and preview the first 5 records",
    tags: ["SELECT", "LIMIT"],
  },
  {
    id: "sq-2",
    number: "02",
    difficulty: "beginner",
    difficultyLabel: "Fundamentals",
    category: "Filter",
    title: "Find all flowers with petal length under 2.0 cm",
    description:
      "Isolate compact Setosa specimens using numerical thresholds and operators.",
    question: "Find all flowers with petal length under 2.0 cm",
    tags: ["WHERE", "<"],
  },
  {
    id: "sq-3",
    number: "03",
    difficulty: "beginner",
    difficultyLabel: "Fundamentals",
    category: "Deduplication",
    title: "List unique flower species in the dataset",
    description:
      "Extract unique categorical values cleanly without duplicate row clutter.",
    question: "List unique flower species in the dataset",
    tags: ["DISTINCT"],
  },

  // Intermediate (Aggregation)
  {
    id: "sq-4",
    number: "04",
    difficulty: "intermediate",
    difficultyLabel: "Aggregation",
    category: "Group Summary",
    title: "Average petal length for each species",
    description:
      "Calculate cluster centerpoints across categorical dimensions using group functions.",
    question: "Show average petal length for each species",
    tags: ["GROUP BY", "AVG()"],
  },
  {
    id: "sq-5",
    number: "05",
    difficulty: "intermediate",
    difficultyLabel: "Aggregation",
    category: "Range Extremes",
    title: "Find the min & max sepal width per species",
    description:
      "Determine boundary distributions and spread across columns within one query.",
    question: "Find the min and max sepal width per species",
    tags: ["MIN()", "MAX()"],
  },
  {
    id: "sq-6",
    number: "06",
    difficulty: "intermediate",
    difficultyLabel: "Aggregation",
    category: "Filtered Groups",
    title: "Count flowers by species where sepal > 5.5",
    description:
      "Learn execution order: discarding row candidates prior to group aggregation.",
    question: "Count flowers by species where sepal length is greater than 5.5",
    tags: ["WHERE", "GROUP BY"],
  },

  // Advanced (Filtering & Ranking)
  {
    id: "sq-7",
    number: "07",
    difficulty: "advanced",
    difficultyLabel: "Filtering & Ranking",
    category: "Post-Agg Filter",
    title: "Species with avg petal length > 4.0",
    description:
      "Master the difference between row filters and post-aggregation conditions.",
    question: "Show species with average petal length greater than 4.0",
    tags: ["HAVING", "AVG()"],
  },
  {
    id: "sq-8",
    number: "08",
    difficulty: "advanced",
    difficultyLabel: "Filtering & Ranking",
    category: "Window Analysis",
    title: "Rank flower by petal area within species",
    description:
      "Apply analytical partitions to rank rows within subsets without collapsing rows.",
    question: "Rank flowers by petal area within each species",
    tags: ["RANK() OVER", "PARTITION BY"],
  },
  {
    id: "sq-9",
    number: "09",
    difficulty: "advanced",
    difficultyLabel: "Filtering & Ranking",
    category: "Feature Engineering",
    title: "Find outliers with extreme aspect ratios",
    description:
      "Combine dynamic ratio expressions with conditional categorization rules.",
    question: "Find flowers with extreme sepal-to-petal aspect ratios",
    tags: ["CASE WHEN", "EXPRESSIONS"],
  },
];

/**
 * Expected shape for Lesson Breakdown ("How this query works").
 * // TODO(backend): The `/api/query` response will optionally return a `lesson` object with this exact shape:
 * 
 * {
 *   translation: string,
 *   steps: Array<{
 *     clause: string,        // e.g. "SELECT", "FROM", "WHERE", "GROUP BY"
 *     sql: string,           // SQL fragment, e.g. "species, ROUND(AVG(petal_length), 3)"
 *     explanation: string    // Plain explanation of what this clause accomplishes
 *   }>,
 *   concepts: string[],      // e.g. ["#aggregation", "#GROUP_BY", "#alias (AS)"]
 *   pitfall: string | null,  // Educational pitfall warning or null
 *   modify_ideas: Array<{
 *     title: string,         // e.g. "Filter before grouping"
 *     hint: string,          // e.g. "Add: WHERE sepal_length > 5.0"
 *     question: string       // Follow-up question to load into the input
 *   }>
 * }
 */
export const mockLessonsByQuestion = {
  // 01 • Preview: Count total rows and preview the first 5 records
  "Count total rows and preview the first 5 records": {
    translation:
      "This query inspects the table structure by retrieving all columns for the first 5 records in the dataset.",
    steps: [
      {
        clause: "SELECT",
        sql: "*",
        explanation: "Picks all available columns in the dataset without filtering specific fields.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Identifies the source table containing plant observation records.",
      },
      {
        clause: "LIMIT",
        sql: "5",
        explanation: "Constrains the output to the first 5 rows to provide a rapid preview.",
      },
    ],
    concepts: ["#SELECT", "#LIMIT", "#schema_preview"],
    pitfall:
      "Running SELECT * without a LIMIT on production tables containing millions of rows can cause memory exhaustion and slow downstream clients.",
    modify_ideas: [
      {
        title: "Preview 10 records",
        hint: "Change LIMIT 5 to LIMIT 10",
        question: "Preview the first 10 rows from iris",
      },
      {
        title: "Select specific columns",
        hint: "Select only species and sepal dimensions",
        question: "Show species and sepal length for the first 5 rows",
      },
    ],
  },

  // 02 • Filter: Find all flowers with petal length under 2.0 cm
  "Find all flowers with petal length under 2.0 cm": {
    translation:
      "This query isolates compact flower specimens whose petal length is strictly less than 2.0 centimeters.",
    steps: [
      {
        clause: "SELECT",
        sql: "*",
        explanation: "Extracts all attributes of the qualifying flower observations.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Points to the iris dataset table.",
      },
      {
        clause: "WHERE",
        sql: "petal_length < 2.0",
        explanation: "Filters out any row whose petal length is 2.0 or higher prior to returning results.",
      },
    ],
    concepts: ["#WHERE", "#comparison_operators", "#row_filtering"],
    pitfall:
      "Be mindful of strict inequality (<) vs inclusive inequality (<=), as boundary values can alter classification counts.",
    modify_ideas: [
      {
        title: "Include boundary (<= 2.0)",
        hint: "Change < to <=",
        question: "Find all flowers with petal length less than or equal to 2.0 cm",
      },
      {
        title: "Add species filter",
        hint: "Combine with AND species = 'setosa'",
        question: "Find all setosa flowers with petal length under 2.0 cm",
      },
    ],
  },

  // 03 • Deduplication: List unique flower species in the dataset
  "List unique flower species in the dataset": {
    translation:
      "This query scans the dataset and returns each distinct categorical species name exactly once.",
    steps: [
      {
        clause: "SELECT",
        sql: "DISTINCT species",
        explanation: "Eliminates duplicate values and extracts unique categorical names.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Scans the iris flower dataset table.",
      },
    ],
    concepts: ["#DISTINCT", "#deduplication", "#cardinality"],
    pitfall:
      "Using DISTINCT across many columns forces the database to sort or hash all rows, which can be computationally expensive.",
    modify_ideas: [
      {
        title: "Count distinct species",
        hint: "Wrap inside COUNT(DISTINCT species)",
        question: "Count the number of distinct flower species in the dataset",
      },
    ],
  },

  // 04 • Group Summary: Average petal length for each species (and variants)
  "Show average petal length for each species": {
    translation:
      "This query groups all 150 Iris flower rows into 3 distinct botanical categories, calculates the mean petal length for each group, and arranges them from shortest to longest.",
    steps: [
      {
        clause: "SELECT",
        sql: "species, ROUND(AVG(petal_length), 3) AS avg_petal_length",
        explanation:
          "Picks the categorical label and runs mathematical average aggregation, rounding the result to 3 decimal places.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Identifies the target dataset table containing the 150 plant observation records.",
      },
      {
        clause: "GROUP BY",
        sql: "species",
        explanation: "Buckets dataset rows into 3 unique species buckets before computing any aggregate math functions.",
      },
      {
        clause: "ORDER BY",
        sql: "avg_petal_length ASC",
        explanation: "Sorts the summarized rows in ascending order (smallest value first) for clean inspection.",
      },
    ],
    concepts: ["#aggregation", "#GROUP_BY", "#alias (AS)", "#ROUND()"],
    pitfall:
      "Selecting non-aggregated columns that are not included in the GROUP BY clause causes SQLite to pick an arbitrary row value, and throws an error in strict engines like PostgreSQL.",
    modify_ideas: [
      {
        title: "Filter before grouping",
        hint: "Add: WHERE sepal_length > 5.0",
        question: "Average petal length for each species where sepal length > 5.0",
      },
      {
        title: "Reverse sorting order",
        hint: "Change to: ORDER BY avg_petal_length DESC",
        question: "Average petal length for each species sorted from highest to lowest",
      },
      {
        title: "Count rows in each group",
        hint: "Add: COUNT(*) AS flower_count",
        question: "Average petal length and total flower count for each species",
      },
    ],
  },
  "Average petal length for each species": {
    translation:
      "This query groups all 150 Iris flower rows into 3 distinct botanical categories, calculates the mean petal length for each group, and arranges them from shortest to longest.",
    steps: [
      {
        clause: "SELECT",
        sql: "species, ROUND(AVG(petal_length), 3) AS avg_petal_length",
        explanation:
          "Picks the categorical label and runs mathematical average aggregation, rounding the result to 3 decimal places.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Identifies the target dataset table containing the 150 plant observation records.",
      },
      {
        clause: "GROUP BY",
        sql: "species",
        explanation: "Buckets dataset rows into 3 unique species buckets before computing any aggregate math functions.",
      },
      {
        clause: "ORDER BY",
        sql: "avg_petal_length ASC",
        explanation: "Sorts the summarized rows in ascending order (smallest value first) for clean inspection.",
      },
    ],
    concepts: ["#aggregation", "#GROUP_BY", "#alias (AS)", "#ROUND()"],
    pitfall:
      "Selecting non-aggregated columns that are not included in the GROUP BY clause causes SQLite to pick an arbitrary row value, and throws an error in strict engines like PostgreSQL.",
    modify_ideas: [
      {
        title: "Filter before grouping",
        hint: "Add: WHERE sepal_length > 5.0",
        question: "Average petal length for each species where sepal length > 5.0",
      },
      {
        title: "Reverse sorting order",
        hint: "Change to: ORDER BY avg_petal_length DESC",
        question: "Average petal length for each species sorted from highest to lowest",
      },
      {
        title: "Count rows in each group",
        hint: "Add: COUNT(*) AS flower_count",
        question: "Average petal length and total flower count for each species",
      },
    ],
  },

  // 05 • Range Extremes: Find the min & max sepal width per species
  "Find the min and max sepal width per species": {
    translation:
      "This query calculates the lower and upper bounds of sepal width across each flower species group.",
    steps: [
      {
        clause: "SELECT",
        sql: "species, MIN(sepal_width) AS min_width, MAX(sepal_width) AS max_width",
        explanation: "Computes both minimum and maximum boundary metrics within each category.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Targets the iris flower dataset table.",
      },
      {
        clause: "GROUP BY",
        sql: "species",
        explanation: "Partitions records into independent categorical species buckets.",
      },
    ],
    concepts: ["#MIN()", "#MAX()", "#distribution_range", "#GROUP_BY"],
    pitfall:
      "NULL values are skipped by aggregate functions like MIN() and MAX(); ensure missing records don't inadvertently distort sample sizes.",
    modify_ideas: [
      {
        title: "Calculate spread difference",
        hint: "Add: (MAX(sepal_width) - MIN(sepal_width)) AS width_spread",
        question: "Difference between max and min sepal width for each species",
      },
    ],
  },

  // 06 • Filtered Groups: Count flowers by species where sepal > 5.5
  "Count flowers by species where sepal length is greater than 5.5": {
    translation:
      "This query discards individual flower records where sepal length is 5.5 or less, then counts how many specimens remain per species.",
    steps: [
      {
        clause: "SELECT",
        sql: "species, COUNT(*) AS flower_count",
        explanation: "Counts qualifying rows remaining in each species cluster.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Specifies the iris dataset table.",
      },
      {
        clause: "WHERE",
        sql: "sepal_length > 5.5",
        explanation: "Filters rows BEFORE grouping. Only flowers with sepal > 5.5 enter aggregation.",
      },
      {
        clause: "GROUP BY",
        sql: "species",
        explanation: "Aggregates the pre-filtered rows by species category.",
      },
    ],
    concepts: ["#execution_order", "#WHERE_vs_HAVING", "#COUNT(*)"],
    pitfall:
      "Row filters go in WHERE, not HAVING. Filtering rows in HAVING after grouping causes unnecessary computation.",
    modify_ideas: [
      {
        title: "Add post-aggregation HAVING",
        hint: "Add: HAVING flower_count >= 10",
        question: "Species with at least 10 flowers where sepal length is greater than 5.5",
      },
    ],
  },

  // 07 • Post-Agg Filter: Species with avg petal length > 4.0
  "Show species with average petal length greater than 4.0": {
    translation:
      "This query calculates the average petal length per species and filters the final group results to only show species exceeding 4.0 cm.",
    steps: [
      {
        clause: "SELECT",
        sql: "species, ROUND(AVG(petal_length), 2) AS avg_petal",
        explanation: "Computes the mean petal length per category.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Reads from the iris table.",
      },
      {
        clause: "GROUP BY",
        sql: "species",
        explanation: "Aggregates the rows by species.",
      },
      {
        clause: "HAVING",
        sql: "AVG(petal_length) > 4.0",
        explanation: "Filters group summaries AFTER aggregation, keeping only groups where average > 4.0.",
      },
    ],
    concepts: ["#HAVING", "#post_aggregation", "#group_filtering"],
    pitfall:
      "You cannot use WHERE to filter aggregated metrics like AVG() because WHERE evaluates rows before groups exist.",
    modify_ideas: [
      {
        title: "Lower threshold to 3.0",
        hint: "Change HAVING threshold to 3.0",
        question: "Show species with average petal length greater than 3.0",
      },
    ],
  },

  // 08 • Window Analysis: Rank flower by petal area within species
  "Rank flowers by petal area within each species": {
    translation:
      "This query computes an estimated petal area and uses an analytical window function to rank flowers within each species without collapsing rows.",
    steps: [
      {
        clause: "SELECT",
        sql: "species, petal_length, petal_width, RANK() OVER (PARTITION BY species ORDER BY (petal_length * petal_width) DESC) AS area_rank",
        explanation: "Partitions calculation by species and assigns ranking from largest petal area to smallest.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Reads from iris records.",
      },
    ],
    concepts: ["#window_functions", "#RANK()", "#PARTITION_BY", "#OVER"],
    pitfall:
      "Window functions do not collapse rows like GROUP BY does. Every original observation record is preserved in the output.",
    modify_ideas: [
      {
        title: "Use DENSE_RANK()",
        hint: "Replace RANK() with DENSE_RANK() to prevent rank gaps on ties",
        question: "Dense rank flowers by petal area within each species",
      },
    ],
  },

  // 09 • Feature Engineering: Find outliers with extreme aspect ratios
  "Find flowers with extreme sepal-to-petal aspect ratios": {
    translation:
      "This query computes dimensional ratios and tags observations using conditional CASE logic to identify atypical proportions.",
    steps: [
      {
        clause: "SELECT",
        sql: "id, species, ROUND(sepal_length / petal_length, 2) AS aspect_ratio, CASE WHEN (sepal_length / petal_length) > 3.0 THEN 'High Sepal Bias' ELSE 'Balanced' END AS classification",
        explanation: "Generates custom mathematical ratios and assigns categorical labels with conditional branch rules.",
      },
      {
        clause: "FROM",
        sql: "iris",
        explanation: "Reads from the iris table.",
      },
    ],
    concepts: ["#CASE_WHEN", "#feature_engineering", "#conditional_logic"],
    pitfall:
      "In division expressions like sepal_length / petal_length, guard against potential division by zero if petal_length could be 0.",
    modify_ideas: [
      {
        title: "Filter for high bias only",
        hint: "Add WHERE (sepal_length / petal_length) > 3.0",
        question: "Find flowers where sepal to petal ratio is greater than 3.0",
      },
    ],
  },
};

/**
 * Returns mock lesson data matching exact question text if available, or null.
 * // TODO(backend): Replace with real `lesson` object returned by `/api/query`.
 */
export function getMockLessonForQuestion(questionText) {
  if (!questionText) return null;
  const trimmed = questionText.trim();
  return mockLessonsByQuestion[trimmed] || null;
}

/**
 * Expected shape for Query Execution History.
 * // TODO(backend): Endpoint like `GET /api/history` will return array of this shape.
 * 
 * Array of:
 * {
 *   id: string,
 *   question: string,
 *   sql: string,
 *   status: 'executed' | 'error',
 *   executedAt: string, // ISO format for real relative time derivation
 *   executionTimeMs: number,
 *   rowCount: number
 * }
 */
export const mockHistory = [
  {
    id: "hist-1",
    question: "Average petal length for each species",
    sql: "SELECT species, ROUND(AVG(petal_length), 3) AS avg_petal_length FROM iris GROUP BY species ORDER BY avg_petal_length ASC;",
    status: "executed",
    executedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    executionTimeMs: 1.4,
    rowCount: 3,
  },
  {
    id: "hist-2",
    question: "Count of species where sepal length > 5.0",
    sql: "SELECT species, COUNT(*) as count FROM iris WHERE sepal_length > 5.0 GROUP BY species;",
    status: "executed",
    executedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    executionTimeMs: 2.1,
    rowCount: 3,
  },
  {
    id: "hist-3",
    question: "Distribution of petal width",
    sql: "SELECT petal_width, COUNT(*) as count FROM iris GROUP BY petal_width ORDER BY petal_width ASC;",
    status: "executed",
    executedAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 1 hour ago
    executionTimeMs: 1.8,
    rowCount: 22,
  },
  {
    id: "hist-4",
    question: "Find 5 longest petals",
    sql: "SELECT * FROM iris ORDER BY petal_length DESC LIMIT 5;",
    status: "executed",
    executedAt: new Date(Date.now() - 190 * 60 * 1000).toISOString(), // 3 hours ago
    executionTimeMs: 1.2,
    rowCount: 5,
  },
];

/**
 * Fallback dataset profile matching exact `GET /api/profile` schema.
 * Enables rich UI demonstration if backend server is not running during review.
 */
export const mockDefaultProfile = {
  success: true,
  table_name: "iris",
  total_tables: 1,
  total_rows: 150,
  total_columns: 6,
  total_missing_values: 0,
  columns: [
    {
      name: "id",
      type: "INT PK",
      missing: 0,
      missing_pct: 0,
      unique_values: 150,
      min: 1,
      max: 150,
      mean: 75.5,
    },
    {
      name: "sepal_length",
      type: "REAL",
      missing: 0,
      missing_pct: 0,
      unique_values: 35,
      min: 4.3,
      max: 7.9,
      mean: 5.84,
    },
    {
      name: "sepal_width",
      type: "REAL",
      missing: 0,
      missing_pct: 0,
      unique_values: 23,
      min: 2.0,
      max: 4.4,
      mean: 3.06,
    },
    {
      name: "petal_length",
      type: "REAL",
      missing: 0,
      missing_pct: 0,
      unique_values: 43,
      min: 1.0,
      max: 6.9,
      mean: 3.76,
    },
    {
      name: "petal_width",
      type: "REAL",
      missing: 0,
      missing_pct: 0,
      unique_values: 22,
      min: 0.1,
      max: 2.5,
      mean: 1.2,
    },
    {
      name: "species",
      type: "TEXT",
      missing: 0,
      missing_pct: 0,
      unique_values: 3,
      min: null,
      max: null,
      mean: null,
    },
  ],
};

/**
 * Expected shape for Initial Suggestion Chips ("TRY ASKING:").
 * // TODO(backend): Returned as suggested follow-ups or initial prompt starters by the query/profile engine.
 */
export const mockTryAskingSuggestions = [
  "Which species has the widest petals?",
  "Show average sepal length grouped by species",
  "Count rows where petal length is under 2.0",
];
