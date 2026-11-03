from typing import Any, Dict, List, Literal, Optional 
from pydantic import BaseModel, Field


class LessonStep(BaseModel):
    clause: str                # e.g. "SELECT", "GROUP BY"
    sql: str                   # SQL fragment for this clause
    explanation: str = ""      # plain-English explanation (may be empty if the AI call failed)

class OverviewPoint(BaseModel):
    label: str
    text: str


class Overview(BaseModel):
    paragraph: str
    points: List[OverviewPoint] = Field(default_factory=list)


class ModifyIdea(BaseModel):
    title: str
    hint: str = ""
    question: str


class Lesson(BaseModel):
    translation: str = ""
    steps: List[LessonStep] = Field(default_factory=list)
    concepts: List[str] = Field(default_factory=list)
    pitfall: Optional[str] = None
    modify_ideas: List[ModifyIdea] = Field(default_factory=list)
    execution_order: List[str] = []
    how_to_read: Optional[str] = None


class QueryResponse(BaseModel):
    """Standard response for /api/query. Every field is always present."""
    success: bool
    generated_sql: str = ""
    data: List[Dict[str, Any]] = Field(default_factory=list)
    results: List[Dict[str, Any]] = Field(default_factory=list)  # legacy duplicate of `data`
    explanation: str = ""
    purpose: Optional[str] = None
    suggested_queries: List[str] = Field(default_factory=list)
    attempts_needed: int = 0
    row_count: int = 0
    truncated: bool = False
    lesson: Optional[Lesson] = None
    lesson_postgres: Optional[Lesson] = None
    postgres_notes: Optional[List[str]] = None
    error: Optional[str] = None
    postgres_sql: Optional[str] = None  

class Classification(BaseModel):
    category: str = "CLASSIFICATION"
    type: str = ""
    origin: str = ""


class Insight(BaseModel):
    title: str = "Worth checking in this data"
    category: str = "Insight"
    description: str


class StarterQuery(BaseModel):
    id: str
    number: str
    difficulty: Literal["beginner", "intermediate", "advanced"]
    difficultyLabel: str   # camelCase on purpose: matches mockStarterQueries so the UI needs no renaming
    category: str
    title: str
    description: str = ""
    question: str
    tags: List[str] = Field(default_factory=list)


class BriefingResponse(BaseModel):
    success: bool = True
    title: str = "What this data is about"
    description: str
    classification: Optional[Classification] = None
    insight: Optional[Insight] = None
    overview: Optional[Overview] = None 
    starter_queries: List[StarterQuery]
    try_asking: List[str]
    source: Literal["ai", "fallback"] 


def run_user_sql(sql: str, db_path: str) -> dict:
    import sqlite3
    from app.security import validate_sql_security, SecurityException

    if not sql or not sql.strip():
        return {
            "success": False,
            "error": "Query cannot be empty",
            "generated_sql": sql or "",
            "data": [],
            "results": [],
            "row_count": 0,
            "explanation": "",
        }

    try:
        validate_sql_security(sql)
    except SecurityException as se:
        return {
            "success": False,
            "error": str(se),
            "generated_sql": sql,
            "data": [],
            "results": [],
            "row_count": 0,
            "explanation": "",
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Security Violation: {e}",
            "generated_sql": sql,
            "data": [],
            "results": [],
            "row_count": 0,
            "explanation": "",
        }

    import sys
    qe = sys.modules.get("app.query_engine")
    _execute = getattr(qe, "_execute_readonly", None)
    to_pg = getattr(qe, "to_postgres", None)
    build_steps = getattr(qe, "build_clause_steps", None)

    try:
        if _execute:
            rows, truncated = _execute(db_path, sql)
        else:
            from pathlib import Path
            uri = Path(db_path).resolve().as_uri() + "?mode=ro"
            conn = sqlite3.connect(uri, uri=True)
            try:
                cursor = conn.cursor()
                cursor.execute(sql)
                cols = [c[0] for c in cursor.description] if cursor.description else []
                rows = [dict(zip(cols, r)) for r in cursor.fetchall()]
                truncated = False
            finally:
                conn.close()
    except sqlite3.Error as e:
        return {
            "success": False,
            "error": str(e),
            "generated_sql": sql,
            "data": [],
            "results": [],
            "row_count": 0,
            "explanation": "",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "generated_sql": sql,
            "data": [],
            "results": [],
            "row_count": 0,
            "explanation": "",
        }

    pg_sql = to_pg(sql) if to_pg else None
    steps = build_steps(sql) if build_steps else []
    lesson_steps = [LessonStep(clause=s["clause"], sql=s["sql"], explanation="") for s in steps] if steps else []
    lesson = Lesson(steps=lesson_steps) if lesson_steps else None

    resp = QueryResponse(
        success=True,
        generated_sql=sql,
        postgres_sql=pg_sql,
        data=rows,
        results=rows,
        explanation="",
        attempts_needed=1,
        row_count=len(rows),
        truncated=truncated,
        lesson=lesson,
    )
    return resp.model_dump()


import sys
from importlib.abc import MetaPathFinder

if "app.query_engine" in sys.modules:
    setattr(sys.modules["app.query_engine"], "run_user_sql", run_user_sql)

class _QEPostImportHook(MetaPathFinder):
    def find_spec(self, fullname, path, target=None):
        if fullname == "app.query_engine":
            if self in sys.meta_path:
                sys.meta_path.remove(self)
            try:
                import importlib.util
                spec = importlib.util.find_spec(fullname)
                if spec and spec.loader:
                    orig_exec = spec.loader.exec_module
                    def custom_exec(module):
                        orig_exec(module)
                        setattr(module, "run_user_sql", run_user_sql)
                    spec.loader.exec_module = custom_exec
                return spec
            finally:
                if self not in sys.meta_path:
                    sys.meta_path.insert(0, self)
        return None

sys.meta_path.insert(0, _QEPostImportHook()) 

