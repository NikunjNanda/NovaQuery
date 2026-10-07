import json
import os

from langchain_core.prompts import PromptTemplate
from sqlalchemy import create_engine, inspect, text

from app.query_engine import llm, _extract_json, _text

MAX_TABLES = 5
MAX_COLUMNS = 30
SAMPLE_ROWS = 3
CELL_MAX_CHARS = 40
# Set to False to send ONLY table/column structure to Gemini (no cell values).
SEND_SAMPLE_ROWS = True

DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"]
DIFFICULTY_LABELS = {
    "beginner": "Fundamentals",
    "intermediate": "Aggregation",
    "advanced": "Filtering & Ranking",
}

_cache: dict = {}

BRIEFING_PROMPT = PromptTemplate.from_template(
    """You are a friendly data teacher helping a beginner understand an uploaded dataset and learn SQL from it.

    Dataset (JSON; includes a few sample rows per table): {schema_json}

    Return ONLY valid JSON (no markdown, no commentary) in exactly this format:
    {{
        "description": "2-3 plain sentences describing what this data contains.",
        "insight": {{
            "category": "Short label, e.g. Distribution Insight",
            "description": "1-2 sentences about something worth checking, using only columns and values shown above."
        }},
        "classification": null,
        "starter_queries": [
            {{
                "difficulty": "beginner",
                "category": "Short label, e.g. Preview",
                "title": "Short card title",
                "description": "One sentence on what the learner practices.",
                "question": "A natural-language question about this data",
                "tags": ["SELECT", "LIMIT"]
            }}
        ],
        "try_asking": ["Short question 1?", "Short question 2?", "Short question 3?"]
    }}

    Rules:
    - Give exactly 9 starter_queries: 3 beginner, 3 intermediate, 3 advanced.
    - Beginner: SELECT, WHERE, DISTINCT, LIMIT, ORDER BY.
      Intermediate: GROUP BY, COUNT, AVG, MIN, MAX (a simple JOIN only if there are several related tables).
      Advanced: HAVING, subqueries, window functions such as RANK() OVER, CASE WHEN.
    - Use ONLY tables and columns that exist above. Each question must be answerable with a single SELECT.
    - Describe only what the data itself shows. Do NOT invent background facts (source, author, year, purpose).
    - Set "classification" to null, unless this is clearly a well-known public dataset; then use
      {{"type": "...", "origin": "..."}}.
    - Never quote sample values at length, and never repeat personal details such as emails.
    - tags: 1-3 SQL keywords per card. try_asking: exactly 3 short questions."""
)


def simplify_type(raw_type) -> str:
    t = str(raw_type).upper()
    if "BOOL" in t:
        return "BOOL"
    if "INT" in t:
        return "INT"
    if any(k in t for k in ("REAL", "FLOA", "DOUB", "NUM", "DEC")):
        return "REAL"
    if "DATE" in t or "TIME" in t:
        return "DATE"
    return "TEXT"


# ---------- reading the dataset ----------

def collect_schema(engine) -> list:
    """Structure, row counts, distinct counts for text columns, and a few sample rows."""
    inspector = inspect(engine)
    quote = engine.dialect.identifier_preparer.quote
    tables = []

    with engine.connect() as conn:
        for table in inspector.get_table_names()[:MAX_TABLES]:
            q_table = quote(table)
            all_columns = inspector.get_columns(table)
            columns = all_columns[:MAX_COLUMNS]
            pk_names = set(inspector.get_pk_constraint(table).get("constrained_columns") or [])
            row_count = int(conn.execute(text(f"SELECT COUNT(*) FROM {q_table}")).scalar() or 0)

            cols = []
            for col in columns:
                kind = simplify_type(col["type"])
                distinct = None
                if kind == "TEXT":
                    distinct = int(conn.execute(
                        text(f"SELECT COUNT(DISTINCT {quote(col['name'])}) FROM {q_table}")
                    ).scalar() or 0)
                cols.append({
                    "name": col["name"],
                    "kind": kind,
                    "is_pk": col["name"] in pk_names,
                    "distinct": distinct,
                })

            sample = []
            if SEND_SAMPLE_ROWS and row_count:
                col_names = {c["name"] for c in cols}
                result = conn.execute(text(f"SELECT * FROM {q_table} LIMIT {SAMPLE_ROWS}"))
                keys = list(result.keys())
                for r in result.fetchall():
                    sample.append({
                        k: (None if v is None else str(v)[:CELL_MAX_CHARS])
                        for k, v in zip(keys, r) if k in col_names
                    })

            tables.append({
                "name": table,
                "rows": row_count,
                "total_columns": len(all_columns),
                "columns": cols,
                "sample_rows": sample,
            })
    return tables


# ---------- cards ----------

def _finalize_cards(by_diff: dict) -> list:
    """Adds ids, numbers and labels. Keeps at most 3 cards per difficulty."""
    cards, n = [], 0
    for diff in DIFFICULTY_ORDER:
        for c in by_diff[diff][:3]:
            n += 1
            cards.append({
                "id": f"sq-{n}",
                "number": f"{n:02d}",
                "difficulty": diff,
                "difficultyLabel": DIFFICULTY_LABELS[diff],
                "category": c["category"],
                "title": c["title"],
                "description": c["description"],
                "question": c["question"],
                "tags": c["tags"],
            })
    return cards


def _normalize_ai_cards(raw_cards) -> dict:
    by_diff = {d: [] for d in DIFFICULTY_ORDER}
    for item in raw_cards if isinstance(raw_cards, list) else []:
        if not isinstance(item, dict):
            continue
        diff = str(item.get("difficulty", "")).lower().strip()
        question = str(item.get("question") or "").strip()
        if diff not in by_diff or not question:
            continue
        tags = item.get("tags") if isinstance(item.get("tags"), list) else []
        by_diff[diff].append({
            "category": str(item.get("category") or "Query"),
            "title": str(item.get("title") or question),
            "description": str(item.get("description") or ""),
            "question": question,
            "tags": [str(t) for t in tags][:3],
        })
    return by_diff


def _derive_try_asking(cards: list) -> list:
    picks = []
    for diff in DIFFICULTY_ORDER:
        for c in cards:
            if c["difficulty"] == diff:
                picks.append(c["question"])
                break
    return picks[:3]


def _is_id_like(col: dict) -> bool:
    name = col["name"].lower().replace(" ", "_")
    return col["is_pk"] or name == "id" or name.endswith("_id")


# ---------- fallback (no Gemini) ----------

def _fallback_briefing(schema: list) -> dict:
    table = schema[0]
    t = table["name"]
    cols = table["columns"]
    nums = [c["name"] for c in cols if c["kind"] in ("INT", "REAL") and not _is_id_like(c)]
    cats = [
        c["name"] for c in cols
        if c["kind"] == "TEXT" and c["distinct"] is not None
        and 2 <= c["distinct"] < max(table["rows"], 1) and c["distinct"] <= 20
    ]
    num = nums[0] if nums else None
    cat = cats[0] if cats else None
    first_col = cols[0]["name"] if cols else None

    by_diff = {d: [] for d in DIFFICULTY_ORDER}

    def add(diff, category, title, description, tags):
        by_diff[diff].append({
            "category": category, "title": title, "description": description,
            "question": title, "tags": tags,
        })

    add("beginner", "Preview", f"Show the first 5 rows of {t}",
        "Preview the table without pulling every row.", ["SELECT", "LIMIT"])
    add("beginner", "Counting", f"Count the total number of rows in {t}",
        "Find out how big the table is.", ["COUNT()"])
    if cat:
        add("beginner", "Deduplication", f"List the unique values of {cat}",
            "See each category once, without repeats.", ["DISTINCT"])
    elif first_col:
        add("beginner", "Sorting", f"Show the first 10 rows of {t} sorted by {first_col}",
            "Practice sorting results.", ["ORDER BY", "LIMIT"])

    if cat and num:
        add("intermediate", "Group Summary", f"Average {num} for each {cat}",
            "Compare the typical value of each group.", ["GROUP BY", "AVG()"])
    if cat:
        add("intermediate", "Group Counts", f"Count the rows for each {cat}",
            "See how the rows are spread across categories.", ["GROUP BY", "COUNT()"])
    if num:
        add("intermediate", "Range Extremes", f"Find the minimum and maximum {num}",
            "Find the smallest and largest values in one query.", ["MIN()", "MAX()"])

    if cat:
        add("advanced", "Post-Agg Filter", f"Which {cat} values appear more than once?",
            "Filter groups after counting them.", ["HAVING", "COUNT()"])
    if cat and num:
        add("advanced", "Window Analysis", f"Rank rows by {num} within each {cat}",
            "Rank rows inside each group without collapsing them.", ["RANK() OVER", "PARTITION BY"])
    if num:
        add("advanced", "Subquery", f"Find rows where {num} is above the average",
            "Compare each row against a value calculated from the whole table.", ["SUBQUERY", "AVG()"])

    cards = _finalize_cards(by_diff)
    shown = ", ".join(c["name"] for c in cols[:6])
    more = ", and more" if table["total_columns"] > 6 else ""
    description = (
        f"This dataset has {len(schema)} table(s). The main table, '{t}', has {table['rows']} rows "
        f"and {table['total_columns']} columns: {shown}{more}."
    )
    return {
        "success": True,
        "title": "What this data is about",
        "description": description,
        "classification": None,
        "insight": None,
        "starter_queries": cards,
        "try_asking": _derive_try_asking(cards),
        "source": "fallback",
    }


# ---------- Gemini ----------

def _ai_briefing(schema: list):
    """Returns the briefing dict, or None if anything goes wrong (caller uses the fallback)."""
    try:
        chain = BRIEFING_PROMPT | llm
        res = chain.invoke({"schema_json": json.dumps(schema, default=str)})
        data = _extract_json(_text(res.content))
    except Exception as e:
        print(f"Briefing generation failed: {e}")
        return None

    cards = _finalize_cards(_normalize_ai_cards(data.get("starter_queries")))
    description = str(data.get("description") or "").strip()
    if len(cards) < 3 or not description:
        print(f"Briefing rejected: {len(cards)} valid cards, description present: {bool(description)}")
        print(f"Raw model keys: {list(data.keys())}")
        return None 

    insight = None
    raw_insight = data.get("insight")
    if isinstance(raw_insight, dict) and raw_insight.get("description"):
        insight = {
            "title": "Worth checking in this data",
            "category": str(raw_insight.get("category") or "Insight"),
            "description": str(raw_insight["description"]),
        }

    classification = None
    raw_class = data.get("classification")
    if isinstance(raw_class, dict) and (raw_class.get("type") or raw_class.get("origin")):
        classification = {
            "category": "CLASSIFICATION",
            "type": str(raw_class.get("type") or ""),
            "origin": str(raw_class.get("origin") or ""),
        }

    raw_try = data.get("try_asking")
    try_asking = [str(q) for q in raw_try if q][:3] if isinstance(raw_try, list) else []
    if not try_asking:
        try_asking = _derive_try_asking(cards)

    return {
        "success": True,
        "title": "What this data is about",
        "description": description,
        "classification": classification,
        "insight": insight,
        "starter_queries": cards,
        "try_asking": try_asking,
        "source": "ai",
    }


# ---------- public entry point ----------

def _cache_key(target: str):
    if "://" in target:
        return target
    stat = os.stat(target)
    return (os.path.abspath(target), stat.st_mtime_ns, stat.st_size)


def get_briefing(target: str, refresh: bool = False) -> dict:
    key = _cache_key(target)
    if not refresh and key in _cache:
        print("Briefing: cache hit")
        return _cache[key]

    engine = create_engine(target) if "://" in target else create_engine(f"sqlite:///{os.path.abspath(target)}")
    try:
        schema = collect_schema(engine)
    finally:
        engine.dispose()

    if not schema:
        raise ValueError("No tables found in this database.")

    print("Briefing: generating")
    result = _ai_briefing(schema) if llm else None
    if result is None:
        result = _fallback_briefing(schema)

    # Don't cache a fallback that only happened because Gemini failed temporarily
    if result["source"] == "ai" or not llm:
        _cache[key] = result
    return result 