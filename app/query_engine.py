import os
import re
import time
import json
import random
import hashlib
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
import sqlite3
from pathlib import Path

import sqlglot
from sqlglot import exp
from dotenv import load_dotenv

from langchain_classic.chains import create_sql_query_chain
from langchain_community.utilities import SQLDatabase
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from app.schemas import Lesson, LessonStep, ModifyIdea, QueryResponse
from app.security import SecurityException, validate_sql_security, validate_tables_in_workspace

load_dotenv()

DEFAULT_DB_PATH = "company.db"
MAX_ROWS = 1000  # cap rows sent to the browser

def format_relationships_context(relationships: Optional[list]) -> str:
    """Formats detected relationships and JOIN guidelines for LLM prompting."""
    if not relationships:
        return ""
    lines = ["RELATIONSHIPS (JOIN keys between tables):"]
    for r in relationships:
        if isinstance(r, dict):
            left_tbl = r.get("left_table")
            left_col = r.get("left_column")
            right_tbl = r.get("right_table")
            right_col = r.get("right_column")
            card = r.get("cardinality", "")
            card_str = f" ({card})" if card else ""
            lines.append(f"- {left_tbl}.{left_col} -> {right_tbl}.{right_col}{card_str}")
    lines.append("")
    lines.append("Multi-Table Guidelines:")
    lines.append("- Use JOINs along the listed relationships ONLY.")
    lines.append("- Always qualify column names with table names (e.g., table.column) to prevent ambiguous column errors.")
    lines.append("- Avoid cartesian products (never use comma-separated FROM tables without an explicit JOIN ON).")
    return "\n".join(lines)

# Initialize Gemini LLM
# (no temperature setting: gemini-3.6-flash ignores it and prints a warning)
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    google_api_key=api_key,
) if api_key else None

# Correction prompt used when SQLite execution fails
CORRECTION_PROMPT = PromptTemplate.from_template(
    """You generated an invalid SQL query for SQLite that resulted in an execution error.

    Original User Question: {question}
    Failed SQL Query: {failed_sql}
    SQLite Error Message: {error_message}

    Database schema:
    {schema}

    {context}

    Please inspect the error and regenerate a corrected SQL query that matches the actual database schema.
    If joining tables, ensure you only use the explicit relationships listed above, qualify column names with table names, and avoid cartesian products.
    Return ONLY the raw SQL query with no markdown formatting or commentary."""
)

# One call returns the explanation, purpose, suggestions and the full lesson (SQLite, and PostgreSQL when it differs)
EXPLANATION_PROMPT = PromptTemplate.from_template(
    """You are a friendly, thorough database teacher helping a beginner learn SQL.

    User Question: {question}
    Generated SQL (SQLite): {sql_query}
    Database Schema Context: {schema}
    Clauses of the query, in order (JSON): {clauses_json}
    {postgres_context}

    Return ONLY valid JSON (no markdown, no commentary) in exactly this format:
    {{
        "explanation": "3-5 sentences: what the query does in plain English, step by step, naming the real tables and columns, and what the answer will look like.",
        "purpose": "1-2 sentences on why someone would run this query in real life.",
        "suggested_queries": ["Follow-up question 1?", "Follow-up question 2?", "Follow-up question 3?"],
        "lesson": {{
            "translation": "One or two plain-English sentences translating the whole query.",
            "step_explanations": ["For each clause, in the SAME order and count as the clauses above: 2-4 sentences covering what the clause does, WHY it is needed in this query, and what happens to the rows at this point. For JOIN clauses, explain in plain English which tables are joined and on which columns, and why."],
            "execution_order": ["Short numbered steps (for example '1. FROM sheet1: read every row of the table') describing the order in which the database actually runs the clauses of THIS query. Only mention clauses that exist."],
            "how_to_read": "2-3 sentences on how to read the result: what each returned column means and what one row represents.",
            "concepts": ["#aggregation", "#GROUP_BY"],
            "pitfall": "1-2 sentences on one common mistake related to this query, or null if none applies.",
            "modify_ideas": [
                {{"title": "Short title", "hint": "What to add or change in the SQL", "question": "A natural-language question that applies this change"}}
            ]
        }}{postgres_fields}
    }}

    Rules: use only columns and tables from the schema, and use their real names in the explanations.
    Define each SQL term the first time you use it (for example aggregate, group, alias, join) in simple words.
    Give 2-3 modify_ideas and 2-4 concepts. Do not use markdown formatting inside the text values."""
)

# Added to the prompt only when the PostgreSQL version of the query is written differently
POSTGRES_FIELDS = """,
        "postgres_step_explanations": ["One explanation per PostgreSQL clause, in the SAME order and count as the PostgreSQL clauses above, with the same level of detail as step_explanations."],
        "postgres_differences": ["At most 5 short bullets: what is written differently in PostgreSQL than in SQLite, and why (for example a date function or a quoting rule)."]"""

# Turns a follow-up like "now only for setosa" into a complete question
REWRITE_PROMPT = PromptTemplate.from_template(
    """Rewrite the user's new question as a single standalone question, using the
    previous conversation only if the new question depends on it (for example
    "now only for setosa" or "sort that by price").
    If the new question is already complete on its own, return it unchanged.

    Previous conversation:
    {history_text}

    New question: {question}

    Return ONLY the standalone question, with no quotes or commentary."""
)

# Multiple-choice quiz about the dataset and the query that was just run
QUIZ_PROMPT = PromptTemplate.from_template(
    """You are a friendly SQL teacher. Write {n} multiple-choice questions for a beginner
    who just ran the query below. Every question MUST be about THIS dataset and THIS query.

    Database Schema: {schema}
    User Question: {question}
    Generated SQL: {sql_query}
    Result columns: {columns}
    Sample result rows (first 5): {rows}
    Total rows returned: {row_count}

    Return ONLY valid JSON (no markdown, no commentary) in exactly this format:
    {{
        "questions": [
            {{
                "question": "...",
                "options": ["A", "B", "C", "D"],
                "correct_index": 0,
                "explanation": "1-2 sentences on why the answer is right.",
                "topic": "clause"
            }}
        ]
    }}

    Rules:
    - Mix topics: at least one about what a specific clause in this SQL does ("clause"),
      one about interpreting the actual result using real values shown above ("result"),
      and one about how the SQL would change for a small variation of the question ("variation").
    - Use only real table and column names from the schema and real values from the sample rows.
    - Exactly 4 options, exactly one correct, with plausible wrong answers.
    - Do not ask anything that needs data you were not shown.
    - Keep everything short and beginner-friendly."""
)


# ---------- helpers ----------

def _text(content) -> str:
    """Gemini responses can be a string or a list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", ""))
        return "".join(parts)
    return str(content)


def _extract_json(raw: str) -> dict:
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")
    return json.loads(cleaned[start:end + 1])


# ---------- data facts + query tips (help the model use real spellings, formats and patterns) ----------

HINT_MAX_VALUES = 15     # list a text column's values only if it has at most this many distinct values
HINT_MAX_COLUMNS = 80
HINT_MAX_CHARS = 3000
_HINT_CACHE: dict = {}
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")

QUERY_TIPS = """Query-writing tips:
- Use ONLY tables and columns that exist. Write SQLite syntax (strftime, substr, LIKE; there is no ILIKE).
- Return only the columns the question asks for, in the order it mentions them.
- For text filters use the exact spelling from the facts below; if a value is not listed, compare with LOWER(column) = LOWER('value').
- Dates are stored as text: filter them with LIKE, substr or strftime, matching the format shown in the facts.
- For "top N", "highest" or "lowest" questions use ORDER BY with LIMIT, and add a tie-breaker column.
- For "never" or "no matching rows" questions use NOT IN or a LEFT JOIN ... IS NULL.
- For percentages use 100.0 * part / total so the division is not rounded down."""


def _hints_enabled() -> bool:
    return os.getenv("NOVAQUERY_HINTS", "on").lower() != "off"


def build_value_hints(db_path: str) -> str:
    """Short facts about the data: exact values of small text columns and date ranges. Costs no Gemini call."""
    try:
        p = Path(db_path).resolve()
        st = p.stat()
        key = (str(p), st.st_size, st.st_mtime_ns)
    except Exception:
        return ""
    if key in _HINT_CACHE:
        return _HINT_CACHE[key]

    lines = []
    try:
        conn = sqlite3.connect(p.as_uri() + "?mode=ro", uri=True)
    except Exception:
        return ""
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")][:12]
        columns_seen = 0
        for table in tables:
            qt = '"' + table.replace('"', '""') + '"'
            for col in conn.execute(f"PRAGMA table_info({qt})").fetchall():
                if columns_seen >= HINT_MAX_COLUMNS:
                    break
                name, ctype = col[1], (col[2] or "").upper()
                if any(k in ctype for k in ("INT", "REAL", "FLOA", "DOUB", "NUM", "DEC", "BOOL")):
                    continue  # numeric columns need no spelling hints
                columns_seen += 1
                qc = '"' + name.replace('"', '""') + '"'
                try:
                    vals = [r[0] for r in conn.execute(
                        f"SELECT DISTINCT {qc} FROM {qt} WHERE {qc} IS NOT NULL LIMIT {HINT_MAX_VALUES + 1}")]
                    if not vals:
                        continue
                    sample = str(vals[0])
                    if _DATE_RE.match(sample):
                        mn, mx = conn.execute(f"SELECT MIN({qc}), MAX({qc}) FROM {qt}").fetchone()
                        lines.append(f"- {table}.{name} holds dates as text like '{sample}', from '{mn}' to '{mx}'")
                    elif len(vals) <= HINT_MAX_VALUES:
                        shown = ", ".join("'" + str(v)[:30].replace("'", "''") + "'" for v in vals)
                        lines.append(f"- {table}.{name} values: {shown}")
                except Exception:
                    continue
    finally:
        conn.close()

    text = ""
    if lines:
        text = "Facts about the data (use these exact spellings and formats):\n" + "\n".join(lines)
        text = text[:HINT_MAX_CHARS]
    _HINT_CACHE[key] = text
    return text


def _query_context(db_path: str) -> str:
    """Tips + data facts added to every question. Empty when NOVAQUERY_HINTS=off (used for a baseline run)."""
    if not _hints_enabled():
        return ""
    facts = build_value_hints(db_path)
    return QUERY_TIPS + ("\n\n" + facts if facts else "")


# ---------- quota handling (Gemini rate limits) ----------

MAX_QUOTA_RETRIES = 2


def _is_quota_error(e: Exception) -> bool:
    msg = str(e)
    return "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower() or re.search(r"\b429\b", msg) is not None


def _is_daily_quota(e: Exception) -> bool:
    """Daily limits do not recover within seconds, so they are never retried."""
    return re.search(r"per\s*day|daily", str(e), re.I) is not None


def _retry_delay(e: Exception, attempt: int) -> float:
    """Uses the wait time Gemini asks for ("retry in 28s") when present, else 5s then 15s."""
    m = re.search(r"retry(?: in|Delay)\W{0,6}([\d.]+)\s*s", str(e), re.I)
    if m:
        return min(float(m.group(1)) + 1, 30.0)
    return [5.0, 15.0][min(attempt, 1)]


def _with_retry(call):
    """Runs an LLM call; retries short per-minute rate limits, never daily ones."""
    for attempt in range(MAX_QUOTA_RETRIES + 1):
        try:
            return call()
        except Exception as e:
            if not _is_quota_error(e) or _is_daily_quota(e) or attempt == MAX_QUOTA_RETRIES:
                raise
            wait = _retry_delay(e, attempt)
            print(f"Gemini rate limit hit, retrying in {wait:.0f}s (retry {attempt + 1}/{MAX_QUOTA_RETRIES})")
            time.sleep(wait)


# ---------- answer cache (same question on the same dataset = no Gemini call) ----------

CACHE_DIR = Path(__file__).resolve().parent.parent / "query_cache"
CACHE_VERSION = 3  # bump this when you change the prompts, so old cached answers are not reused


def _cache_enabled() -> bool:
    return os.getenv("NOVAQUERY_CACHE", "on").lower() != "off"


def _cache_key(question: str, db_path: str, include_teaching: bool) -> Optional[str]:
    """Key = question + database file identity (path, size, modified time) + options."""
    try:
        p = Path(db_path).resolve()
        st = p.stat()
        raw = json.dumps([CACHE_VERSION, str(p), st.st_size, st.st_mtime_ns,
                          " ".join(question.lower().split()), include_teaching])
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()
    except Exception:
        return None


def _cache_get(key: str) -> Optional[dict]:
    try:
        return json.loads((CACHE_DIR / f"{key}.json").read_text(encoding="utf-8"))
    except Exception:
        return None


def _cache_put(key: str, response: dict) -> None:
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        (CACHE_DIR / f"{key}.json").write_text(json.dumps(response, default=str), encoding="utf-8")
    except Exception as e:
        print(f"Could not write answer cache: {e}")


def _standalone_question(question: str, history: Optional[list]) -> str:
    """Resolves follow-ups using the last couple of turns. Falls back to the original question."""
    if not history or not llm:
        return question
    history_text = "\n".join(
        f"Q: {h.get('question', '')}\nSQL: {h.get('sql', '')}" for h in history[-2:]
    )
    try:
        res = (REWRITE_PROMPT | llm).invoke({"history_text": history_text, "question": question})
        rewritten = _text(res.content).strip().strip('"')
        return rewritten if rewritten and len(rewritten) < 500 else question
    except Exception as e:
        print(f"Follow-up rewrite failed: {e}")
        return question


def _error_response(message: str, sql: str = "", attempts: int = 0) -> dict:
    return QueryResponse(
        success=False,
        generated_sql=sql,
        attempts_needed=attempts,
        error=message,
    ).model_dump()


def build_clause_steps(sql: str, dialect: str = "sqlite") -> list:
    """Splits a SELECT query into clause fragments using sqlglot (always accurate). dialect: sqlite or postgres."""
    try:
        tree = sqlglot.parse_one(sql, read=dialect)
    except Exception:
        return []
    if not isinstance(tree, exp.Select):
        return []

    steps = []

    def add(clause, fragment):
        if fragment:
            steps.append({"clause": clause, "sql": fragment})

    select_sql = ", ".join(e.sql(dialect=dialect) for e in tree.expressions)
    if tree.args.get("distinct"):
        select_sql = f"DISTINCT {select_sql}"
    add("SELECT", select_sql)

    from_clause = tree.args.get("from") or tree.args.get("from_")  # key name differs between sqlglot versions
    if from_clause is not None:
        add("FROM", from_clause.this.sql(dialect=dialect))

    for join in tree.args.get("joins") or []:
        add("JOIN", join.sql(dialect=dialect))

    where = tree.args.get("where")
    if where is not None:
        add("WHERE", where.this.sql(dialect=dialect))

    group = tree.args.get("group")
    if group is not None:
        add("GROUP BY", ", ".join(e.sql(dialect=dialect) for e in group.expressions))

    having = tree.args.get("having")
    if having is not None:
        add("HAVING", having.this.sql(dialect=dialect))

    order = tree.args.get("order")
    if order is not None:
        add("ORDER BY", ", ".join(e.sql(dialect=dialect) for e in order.expressions))

    limit = tree.args.get("limit")
    if limit is not None and limit.args.get("expression") is not None:
        add("LIMIT", limit.args["expression"].sql(dialect=dialect))

    return steps


def to_postgres(sql: str) -> Optional[str]:
    """Converts the SQLite query to PostgreSQL. Returns None if conversion fails."""
    try:
        return sqlglot.transpile(sql, read="sqlite", write="postgres")[0]
    except Exception:
        return None


def _execute_readonly(db_path: str, sql: str):
    """Runs SQL on a read-only SQLite connection and always closes it."""
    uri = Path(db_path).resolve().as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = cursor.fetchmany(MAX_ROWS + 1)
    finally:
        conn.close()
    truncated = len(rows) > MAX_ROWS
    return [dict(r) for r in rows[:MAX_ROWS]], truncated


# ---------- teacher / lesson ----------

def _make_lesson(raw_lesson: dict, steps: list) -> Lesson:
    """Builds a Lesson from the model's JSON. Missing parts stay empty instead of failing."""
    modify_ideas = []
    for idea in raw_lesson.get("modify_ideas") or []:
        if isinstance(idea, dict) and idea.get("title") and idea.get("question"):
            modify_ideas.append(ModifyIdea(
                title=str(idea["title"]),
                hint=str(idea.get("hint", "")),
                question=str(idea["question"]),
            ))
    pitfall = raw_lesson.get("pitfall")
    how_to_read = raw_lesson.get("how_to_read")
    order = raw_lesson.get("execution_order")
    return Lesson(
        translation=str(raw_lesson.get("translation") or ""),
        steps=steps,
        concepts=[str(c) for c in (raw_lesson.get("concepts") or []) if c],
        pitfall=str(pitfall) if pitfall else None,
        modify_ideas=modify_ideas,
        execution_order=[str(x) for x in order if x] if isinstance(order, list) else [],
        how_to_read=str(how_to_read) if how_to_read else None,
    )


def _format_step_explanation(clause: str, sql_frag: str, expl: str) -> str:
    if expl:
        return expl
    if clause == "JOIN":
        return f"Joins data matching on {sql_frag}, combining related records between tables."
    return ""


def generate_teacher_content(question: str, sql_query: str, schema: str, postgres_sql: Optional[str] = None) -> dict:
    """Returns explanation, purpose, suggestions and lessons (SQLite + PostgreSQL). Never raises."""
    steps = build_clause_steps(sql_query)
    pg_sql = postgres_sql if postgres_sql is not None else to_postgres(sql_query)
    pg_steps = build_clause_steps(pg_sql, "postgres") if pg_sql else []
    # same clause fragments -> the SQLite explanations apply word for word
    pg_differs = bool(pg_steps) and [x["sql"] for x in pg_steps] != [x["sql"] for x in steps]
    default_suggestions = ["Show top 5 rows", "Count total records", "Show column names"]

    fallback = {
        "degraded": True,  # generic content: the caller must not cache an answer that uses it
        "explanation": f"Translated '{question}' into a SQL query for your dataset.",
        "purpose": None,
        "suggested_queries": default_suggestions,
        "lesson": Lesson(
            steps=[
                LessonStep(
                    clause=x["clause"],
                    sql=x["sql"],
                    explanation=_format_step_explanation(x["clause"], x["sql"], ""),
                )
                for x in steps
            ]
        ) if steps else None,
        "lesson_postgres": Lesson(
            steps=[
                LessonStep(
                    clause=x["clause"],
                    sql=x["sql"],
                    explanation=_format_step_explanation(x["clause"], x["sql"], ""),
                )
                for x in pg_steps
            ]
        ) if pg_steps else None,
        "postgres_notes": None,
    }
    if not llm:
        return fallback

    try:
        chain = EXPLANATION_PROMPT | llm
        res = chain.invoke({
            "question": question,
            "sql_query": sql_query,
            "schema": schema,
            "clauses_json": json.dumps(steps),
            "postgres_context": (
                f"The same query converted to PostgreSQL: {pg_sql}\n"
                f"Its PostgreSQL clauses, in order (JSON): {json.dumps(pg_steps)}"
            ) if pg_differs else "",
            "postgres_fields": POSTGRES_FIELDS if pg_differs else "",
        })
        data = _extract_json(_text(res.content))
    except Exception as e:
        print(f"Teacher content generation failed: {e}")
        return fallback

    raw_lesson = data.get("lesson") if isinstance(data.get("lesson"), dict) else {}
    step_texts = raw_lesson.get("step_explanations")
    step_texts = step_texts if isinstance(step_texts, list) else []

    def text_at(texts, i):
        return str(texts[i]) if i < len(texts) and texts[i] else ""

    lesson_steps = [
        LessonStep(
            clause=x["clause"],
            sql=x["sql"],
            explanation=_format_step_explanation(x["clause"], x["sql"], text_at(step_texts, i)),
        )
        for i, x in enumerate(steps)
    ]
    lesson = _make_lesson(raw_lesson, lesson_steps)

    # ----- PostgreSQL version of the lesson -----
    lesson_pg, notes = None, None
    if pg_steps and not pg_differs:
        lesson_pg = _make_lesson(raw_lesson, [
            LessonStep(
                clause=x["clause"],
                sql=x["sql"],
                explanation=_format_step_explanation(x["clause"], x["sql"], text_at(step_texts, i)),
            )
            for i, x in enumerate(pg_steps)
        ])
        notes = ["This query needs no changes in PostgreSQL: exactly the same SQL works in both databases."]
    elif pg_steps:
        pg_texts = data.get("postgres_step_explanations")
        pg_texts = pg_texts if isinstance(pg_texts, list) else []
        same_shape = len(pg_steps) == len(steps)  # then a missing PostgreSQL explanation can reuse the SQLite one
        lesson_pg = _make_lesson(raw_lesson, [
            LessonStep(
                clause=x["clause"],
                sql=x["sql"],
                explanation=_format_step_explanation(
                    x["clause"],
                    x["sql"],
                    text_at(pg_texts, i) or (text_at(step_texts, i) if same_shape else ""),
                ),
            )
            for i, x in enumerate(pg_steps)
        ])
        diffs = data.get("postgres_differences")
        notes = [str(d) for d in diffs if d][:6] if isinstance(diffs, list) else []
        notes = notes or ["The SQL was converted to PostgreSQL syntax."]

    suggested = data.get("suggested_queries")
    suggested = [str(q) for q in suggested] if isinstance(suggested, list) and suggested else default_suggestions

    return {
        "explanation": str(data.get("explanation") or fallback["explanation"]),
        "purpose": str(data["purpose"]) if data.get("purpose") else None,
        "suggested_queries": suggested,
        "lesson": lesson,
        "lesson_postgres": lesson_pg,
        "postgres_notes": notes,
    }


# ---------- quiz ----------

class QuizQuestion(BaseModel):
    question: str
    options: List[str] = Field(min_length=4, max_length=4)
    correct_index: int
    explanation: str
    topic: str = "query"  # clause | result | schema | variation

    @field_validator("correct_index")
    @classmethod
    def _in_range(cls, v):
        if not 0 <= v <= 3:
            raise ValueError("correct_index must be 0-3")
        return v


def generate_quiz(question: str, sql_query: str, db_path: str, static_questions: list, n: int = 5) -> dict:
    """Returns {"source": "ai"|"static", "questions": [...]}. Never raises."""
    fallback = {"source": "static", "questions": static_questions}
    if not llm or "://" in str(db_path):
        return fallback

    try:
        validate_sql_security(sql_query)  # never trust SQL sent from the browser
        rows, _ = _execute_readonly(db_path, sql_query)
        db = SQLDatabase.from_uri(f"sqlite:///{db_path}")
        columns = list(rows[0].keys()) if rows else []

        res = (QUIZ_PROMPT | llm).invoke({
            "n": n,
            "schema": db.get_table_info(),
            "question": question,
            "sql_query": sql_query,
            "columns": columns,
            "rows": json.dumps(rows[:5], default=str),
            "row_count": len(rows),
        })
        raw = _extract_json(_text(res.content)).get("questions") or []
    except Exception as e:
        print(f"Quiz generation failed: {e}")
        return fallback

    good, seen = [], set()
    for item in raw:
        try:
            q = QuizQuestion(**item)
        except Exception:
            continue  # drop malformed questions
        if len(set(q.options)) != 4 or q.question in seen:
            continue
        seen.add(q.question)
        # LLMs tend to put the right answer first; shuffle and remap the index
        correct_text = q.options[q.correct_index]
        random.shuffle(q.options)
        q.correct_index = q.options.index(correct_text)
        good.append(q.model_dump())

    return {"source": "ai", "questions": good} if good else fallback


def _friendly_error(e: Exception) -> str:
    if _is_quota_error(e):
        if _is_daily_quota(e):
            return ("The AI service has reached its daily limit (quota exceeded, 429). It resets once a day, "
                    "so please try again later. Questions you already asked still work from saved answers.")
        return ("The AI service is busy right now (rate limit, quota exceeded, 429). "
                "Please wait about a minute and try again.")
    return str(e)


# ---------- main pipeline ----------

def run_natural_language_query(
    user_question: str,
    db_path: str = DEFAULT_DB_PATH,
    dialect: str = "SQLite",  # accepted for compatibility; execution is SQLite-only for now
    max_retries: int = 2,
    history: Optional[list] = None,   # previous [{"question", "sql"}] turns, used for follow-up questions
    include_teaching: bool = True,    # False skips the explanation/lesson call (used by the benchmark)
    use_cache: bool = True,           # False always asks Gemini (used by the benchmark)
    relationships: Optional[list] = None,
):
    """
    Generates, validates, and executes a SQL query against a SQLite database.
    Always returns the standard QueryResponse shape (success or failure).
    """

    # Reject live database connections for query execution
    if "://" in str(db_path):
        return _error_response(
            "Live database connections are not supported for queries yet. Please upload a file."
        )

    last_error = None
    cleaned_sql = ""
    attempts = 0

    # 1. Check DB connection / schema
    try:
        db = SQLDatabase.from_uri(f"sqlite:///{db_path}")
        usable_tables = set(db.get_usable_table_names())
    except Exception as db_init_error:
        return _error_response(f"Failed to initialize database schema at '{db_path}': {db_init_error}")

    # Auto-detect relationships if not supplied and workspace has multiple tables
    if relationships is None and len(usable_tables) > 1:
        try:
            from app.relationships import detect_relationships
            from sqlalchemy import create_engine
            eng = create_engine(f"sqlite:///{Path(db_path).resolve()}")
            try:
                relationships = detect_relationships(eng, list(usable_tables))
            finally:
                eng.dispose()
        except Exception as e:
            print(f"Relationship auto-detection fallback failed: {e}")

    # 2. Turn follow-ups ("now only for setosa") into complete questions (no call without history)
    user_question = _standalone_question(user_question, history)

    # 3. Saved answer for this exact question on this exact dataset? Return it without calling Gemini.
    cache_key = _cache_key(user_question, db_path, include_teaching) if (use_cache and _cache_enabled()) else None
    if cache_key:
        cached = _cache_get(cache_key)
        if cached:
            return cached

    # 4. No API key: schema-aware fallback
    if not llm:
        return handle_fallback_query(user_question, db_path)

    # 5. Tips, data facts, and multi-table relationships so the model writes better SQL
    extra_context = _query_context(db_path)
    rel_context = format_relationships_context(relationships)
    if rel_context:
        extra_context = (rel_context + "\n\n" + extra_context).strip() if extra_context else rel_context

    generation_question = f"{user_question}\n\n{extra_context}" if extra_context else user_question

    chain = create_sql_query_chain(llm, db, k=100)

    while attempts <= max_retries:
        try:
            # Generate SQL
            if attempts == 0:
                generated_sql = _with_retry(lambda: chain.invoke({"question": generation_question}))
            else:
                correction_chain = CORRECTION_PROMPT | llm
                response = _with_retry(lambda: correction_chain.invoke({
                    "question": user_question,
                    "failed_sql": cleaned_sql,
                    "error_message": last_error,
                    "schema": db.get_table_info(),
                    "context": extra_context,
                }))
                generated_sql = _text(response.content)

            cleaned_sql = (
                generated_sql.replace("```sql", "")
                .replace("```", "")
                .strip()
            )
            if cleaned_sql.lower().startswith("sqlquery:"):
                cleaned_sql = cleaned_sql[len("sqlquery:"):].strip()

            # Security AST check BEFORE execution
            validate_sql_security(cleaned_sql)
            validate_tables_in_workspace(cleaned_sql, allowed_tables=usable_tables)

            # Execute (read-only, connection always closed)
            rows, truncated = _execute_readonly(db_path, cleaned_sql)

            pg_sql = to_postgres(cleaned_sql)

            # Teacher content (never raises). Skipped when include_teaching=False (used by the benchmark)
            if include_teaching:
                teacher = generate_teacher_content(user_question, cleaned_sql, db.get_table_info(), postgres_sql=pg_sql)
            else:
                teacher = {"explanation": "", "purpose": None, "suggested_queries": [], "lesson": None,
                           "lesson_postgres": None, "postgres_notes": None}

            response_dict = QueryResponse(
                success=True,
                generated_sql=cleaned_sql,
                postgres_sql=pg_sql,
                data=rows,
                results=rows,
                explanation=teacher["explanation"],
                purpose=teacher["purpose"],
                suggested_queries=teacher["suggested_queries"],
                attempts_needed=attempts + 1,
                row_count=len(rows),
                truncated=truncated,
                lesson=teacher["lesson"],
                lesson_postgres=teacher.get("lesson_postgres"),
                postgres_notes=teacher.get("postgres_notes"),
            ).model_dump()

            if cache_key and not teacher.get("degraded"):
                _cache_put(cache_key, response_dict)
            return response_dict

        except SecurityException as se:
            return _error_response(str(se), sql=cleaned_sql, attempts=attempts + 1)

        except sqlite3.Error as db_error:
            last_error = str(db_error)
            attempts += 1
            if attempts > max_retries:
                return _error_response(
                    f"Failed after {max_retries} auto-correction retries. Last error: {last_error}",
                    sql=cleaned_sql,
                    attempts=attempts,
                )

        except Exception as e:
            return _error_response(_friendly_error(e), sql=cleaned_sql, attempts=attempts + 1)


def handle_fallback_query(question: str, db_path: str) -> dict:
    """Fallback runner when no Gemini API key is configured."""
    try:
        uri = Path(db_path).resolve().as_uri() + "?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
        finally:
            conn.close()

        table_name = tables[0][0] if tables else None
        if not table_name:
            return _error_response("No tables found in this database.")

        quoted = '"' + table_name.replace('"', '""') + '"'
        sql_query = f"SELECT * FROM {quoted} LIMIT 10;"
        rows, truncated = _execute_readonly(db_path, sql_query)

        return QueryResponse(
            success=True,
            generated_sql=sql_query,
            data=rows,
            results=rows,
            explanation=f"API key missing. Defaulting to fetching the first 10 rows from table '{table_name}'.",
            suggested_queries=[
                f"Count the rows in {table_name}",
                f"Show the first 5 rows of {table_name}",
            ],
            attempts_needed=1,
            row_count=len(rows),
            truncated=truncated,
        ).model_dump()
    except Exception as e:
        return _error_response(f"Fallback execution failed: {e}") 
