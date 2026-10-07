import os
import json
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
from app.security import SecurityException, validate_sql_security

load_dotenv()

DEFAULT_DB_PATH = "company.db"
MAX_ROWS = 1000  # cap rows sent to the browser

# Initialize Gemini LLM
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    google_api_key=api_key,
    temperature=0,
) if api_key else None

# Correction prompt used when SQLite execution fails
CORRECTION_PROMPT = PromptTemplate.from_template(
    """You generated an invalid SQL query for SQLite that resulted in an execution error.

    Original User Question: {question}
    Failed SQL Query: {failed_sql}
    SQLite Error Message: {error_message}

    Please inspect the error and regenerate a corrected SQL query that matches the actual database schema.
    Return ONLY the raw SQL query with no markdown formatting or commentary."""
)

# One call returns the explanation, purpose, suggestions, and the full lesson text
EXPLANATION_PROMPT = PromptTemplate.from_template(
    """You are a friendly database teacher helping a beginner learn SQL.

    User Question: {question}
    Generated SQL: {sql_query}
    Database Schema Context: {schema}
    Clauses of the query, in order (JSON): {clauses_json}

    Return ONLY valid JSON (no markdown, no commentary) in exactly this format:
    {{
        "explanation": "1-2 simple sentences describing what the query does.",
        "purpose": "One short sentence on why someone would run this query.",
        "suggested_queries": ["Follow-up question 1?", "Follow-up question 2?", "Follow-up question 3?"],
        "lesson": {{ 
            "translation": "One plain-English sentence translating the whole query.",
            "step_explanations": ["One short explanation per clause, in the SAME order and count as the clauses above."],
            "concepts": ["#aggregation", "#GROUP_BY"],
            "pitfall": "One common mistake related to this query, or null if none applies.",
            "modify_ideas": [
                {{"title": "Short title", "hint": "What to add or change in the SQL", "question": "A natural-language question that applies this change"}}
            ]
        }}
    }}

    Rules: use only columns and tables from the schema. Give 2-3 modify_ideas and 2-4 concepts.
    Keep every text short and beginner-friendly."""
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


def _error_response(message: str, sql: str = "", attempts: int = 0) -> dict:
    return QueryResponse(
        success=False,
        generated_sql=sql,
        attempts_needed=attempts,
        error=message,
    ).model_dump()


def build_clause_steps(sql: str) -> list:
    """Splits a SELECT query into clause fragments using sqlglot (always accurate)."""
    try:
        tree = sqlglot.parse_one(sql, read="sqlite")
    except Exception:
        return []
    if not isinstance(tree, exp.Select):
        return []

    steps = []

    def add(clause, fragment):
        if fragment:
            steps.append({"clause": clause, "sql": fragment})

    select_sql = ", ".join(e.sql(dialect="sqlite") for e in tree.expressions)
    if tree.args.get("distinct"):
        select_sql = f"DISTINCT {select_sql}"
    add("SELECT", select_sql)

    from_clause = tree.args.get("from") or tree.args.get("from_")  # key name differs between sqlglot versions
    if from_clause is not None:
        add("FROM", from_clause.this.sql(dialect="sqlite"))

    for join in tree.args.get("joins") or []:
        add("JOIN", join.sql(dialect="sqlite"))

    where = tree.args.get("where")
    if where is not None:
        add("WHERE", where.this.sql(dialect="sqlite"))

    group = tree.args.get("group")
    if group is not None:
        add("GROUP BY", ", ".join(e.sql(dialect="sqlite") for e in group.expressions))

    having = tree.args.get("having")
    if having is not None:
        add("HAVING", having.this.sql(dialect="sqlite"))

    order = tree.args.get("order")
    if order is not None:
        add("ORDER BY", ", ".join(e.sql(dialect="sqlite") for e in order.expressions))

    limit = tree.args.get("limit")
    if limit is not None and limit.args.get("expression") is not None:
        add("LIMIT", limit.args["expression"].sql(dialect="sqlite"))

    return steps


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

def generate_teacher_content(question: str, sql_query: str, schema: str) -> dict:
    """Returns explanation, purpose, suggestions and lesson. Never raises."""
    steps = build_clause_steps(sql_query)
    default_suggestions = ["Show top 5 rows", "Count total records", "Show column names"]

    fallback = {
        "explanation": f"Translated '{question}' into a SQL query for your dataset.",
        "purpose": None,
        "suggested_queries": default_suggestions,
        "lesson": Lesson(
            steps=[LessonStep(clause=s["clause"], sql=s["sql"]) for s in steps]
        ) if steps else None,
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
        })
        data = _extract_json(_text(res.content))
    except Exception as e:
        print(f"Teacher content generation failed: {e}")
        return fallback

    raw_lesson = data.get("lesson") if isinstance(data.get("lesson"), dict) else {}
    step_texts = raw_lesson.get("step_explanations")
    step_texts = step_texts if isinstance(step_texts, list) else []

    lesson_steps = [
        LessonStep(
            clause=s["clause"],
            sql=s["sql"],
            explanation=str(step_texts[i]) if i < len(step_texts) else "",
        )
        for i, s in enumerate(steps)
    ]

    modify_ideas = []
    for idea in raw_lesson.get("modify_ideas") or []:
        if isinstance(idea, dict) and idea.get("title") and idea.get("question"):
            modify_ideas.append(ModifyIdea(
                title=str(idea["title"]),
                hint=str(idea.get("hint", "")),
                question=str(idea["question"]),
            ))

    concepts = [str(c) for c in (raw_lesson.get("concepts") or []) if c]
    pitfall = raw_lesson.get("pitfall")

    suggested = data.get("suggested_queries")
    suggested = [str(q) for q in suggested] if isinstance(suggested, list) and suggested else default_suggestions

    return {
        "explanation": str(data.get("explanation") or fallback["explanation"]),
        "purpose": str(data["purpose"]) if data.get("purpose") else None,
        "suggested_queries": suggested,
        "lesson": Lesson(
            translation=str(raw_lesson.get("translation") or ""),
            steps=lesson_steps,
            concepts=concepts,
            pitfall=str(pitfall) if pitfall else None,
            modify_ideas=modify_ideas,
        ),
    }


# ---------- main pipeline ----------

def run_natural_language_query(
    user_question: str,
    db_path: str = DEFAULT_DB_PATH,
    dialect: str = "SQLite",  # accepted for compatibility; execution is SQLite-only for now
    max_retries: int = 2,
):
    """
    Generates, validates, and executes a SQL query against a SQLite database.
    Always returns the standard QueryResponse shape (success or failure).
    """
    last_error = None
    cleaned_sql = ""
    attempts = 0

    # 1. Check DB connection / schema
    try:
        db = SQLDatabase.from_uri(f"sqlite:///{db_path}")
    except Exception as db_init_error:
        return _error_response(f"Failed to initialize database schema at '{db_path}': {db_init_error}")

    # 2. No API key: schema-aware fallback
    if not llm:
        return handle_fallback_query(user_question, db_path)

    chain = create_sql_query_chain(llm, db)

    while attempts <= max_retries:
        try:
            # Generate SQL
            if attempts == 0:
                generated_sql = chain.invoke({"question": user_question})
            else:
                correction_chain = CORRECTION_PROMPT | llm
                response = correction_chain.invoke({
                    "question": user_question,
                    "failed_sql": cleaned_sql,
                    "error_message": last_error,
                })
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

            # Execute (read-only, connection always closed)
            rows, truncated = _execute_readonly(db_path, cleaned_sql)

            # Teacher content (never raises)
            teacher = generate_teacher_content(user_question, cleaned_sql, db.get_table_info())

            return QueryResponse(
                success=True,
                generated_sql=cleaned_sql,
                data=rows,
                results=rows,
                explanation=teacher["explanation"],
                purpose=teacher["purpose"],
                suggested_queries=teacher["suggested_queries"],
                attempts_needed=attempts + 1,
                row_count=len(rows),
                truncated=truncated,
                lesson=teacher["lesson"],
            ).model_dump()

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
            return _error_response(str(e), sql=cleaned_sql, attempts=attempts + 1)


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