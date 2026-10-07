from typing import Any, Dict, List, Literal, Optional 
from pydantic import BaseModel, Field


class LessonStep(BaseModel):
    clause: str                # e.g. "SELECT", "GROUP BY"
    sql: str                   # SQL fragment for this clause
    explanation: str = ""      # plain-English explanation (may be empty if the AI call failed)


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
    error: Optional[str] = None

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
    starter_queries: List[StarterQuery]
    try_asking: List[str]
    source: Literal["ai", "fallback"] 
