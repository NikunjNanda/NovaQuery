import json 
import os
import time 
import hashlib 
from pathlib import Path 

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
_fail_cache: dict = {}
FAIL_TTL_SECONDS = 300  # after an AI failure, reuse the fallback for 5 minutes 

CACHE_DIR = Path("briefing_cache")


def _schema_key(schema: list) -> str:
    return hashlib.sha256(
        json.dumps(schema, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()


def _load_disk(key: str):
    try:
        path = CACHE_DIR / f"{key}.json"
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Briefing disk cache read failed: {e}")
    return None


def _save_disk(key: str, result: dict):
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        (CACHE_DIR / f"{key}.json").write_text(
            json.dumps(result), encoding="utf-8"
        )
    except Exception as e:
        print(f"Briefing disk cache write failed: {e}") 

BRIEFING_PROMPT = PromptTemplate.from_template(
    """You are a friendly data teacher helping a beginner understand an uploaded dataset and learn SQL from it.

    Dataset (JSON; includes statistics, top values of category columns, and a few sample rows per table): {schema_json}

    Return ONLY valid JSON (no markdown, no commentary) in exactly this format:
    {{
        "description": "2-3 plain sentences describing what this data contains.",
        "overview": {{
            "paragraph": "A detailed paragraph of 5-7 plain sentences: what the data appears to be about, what kind of information the columns record, and notable ranges, categories or data quality.",
            "explore": "One sentence on the kinds of questions this data can answer."
        }},
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
    - In the overview paragraph, use ONLY facts and numbers from the statistics above (min, max, avg, top values, missing counts).
      Do NOT invent background facts (source, author, year, purpose).
    - Set "classification" to null, unless this is clearly a well-known public dataset; then use
      {{"type": "...", "origin": "..."}}.
    - Never repeat personal details such as names or emails from the sample rows.
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
def _num(value):
    return round(float(value), 2) if value is not None else None


def _date_str(value):
    return None if value is None else str(value)[:19].replace(" 00:00:00", "")


def collect_schema(engine) -> list:
    """Structure, row counts, per-column statistics, top values of category columns, and sample rows."""
    inspector = inspect(engine)
    quote = engine.dialect.identifier_preparer.quote
    tables = []

    with engine.connect() as conn:
        for table in inspector.get_table_names()[:MAX_TABLES]:
            q_table = quote(table)
            all_columns = inspector.get_columns(table)
            columns = all_columns[:MAX_COLUMNS]
            pk_names = set(inspector.get_pk_constraint(table).get("constrained_columns") or [])

            # One aggregate query per table
            parts = ["COUNT(*)"]
            meta = []
            for col in columns:
                q = quote(col["name"])
                kind = simplify_type(col["type"])
                parts.append(f"COUNT({q})")
                if kind == "TEXT":
                    parts.append(f"COUNT(DISTINCT {q})")
                elif kind in ("INT", "REAL"):
                    parts += [f"MIN({q})", f"MAX({q})", f"AVG({q})"]
                elif kind == "DATE":
                    parts += [f"MIN({q})", f"MAX({q})"]
                meta.append((col, kind))

            row = conn.execute(text(f"SELECT {', '.join(parts)} FROM {q_table}")).fetchone()
            row_count = int(row[0])

            idx = 1
            cols = []
            for col, kind in meta:
                non_null = int(row[idx])
                idx += 1
                info = {
                    "name": col["name"],
                    "kind": kind,
                    "is_pk": col["name"] in pk_names,
                    "missing": row_count - non_null,
                    "distinct": None,
                }
                if kind == "TEXT":
                    info["distinct"] = int(row[idx])
                    idx += 1
                    if 1 <= info["distinct"] <= 8:
                        top = conn.execute(text(
                            f"SELECT {quote(col['name'])}, COUNT(*) FROM {q_table} "
                            f"GROUP BY {quote(col['name'])} ORDER BY COUNT(*) DESC LIMIT 8"
                        )).fetchall()
                        info["top_values"] = [
                            {"value": str(v)[:CELL_MAX_CHARS], "count": int(c)}
                            for v, c in top if v is not None
                        ]
                elif kind in ("INT", "REAL"):
                    info["min"], info["max"], info["avg"] = _num(row[idx]), _num(row[idx + 1]), _num(row[idx + 2])
                    idx += 3
                elif kind == "DATE":
                    info["min"], info["max"] = _date_str(row[idx]), _date_str(row[idx + 1])
                    idx += 2
                cols.append(info)

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

def _fmt(n):
    if n is None:
        return "n/a"
    return f"{n:,.2f}".rstrip("0").rstrip(".") if isinstance(n, float) else f"{n:,}"


def _names(items, limit=8):
    names = [c["name"] for c in items[:limit]]
    extra = len(items) - limit
    return ", ".join(names) + (f" and {extra} more" if extra > 0 else "")


def _facts_overview(schema: list) -> dict:
    """Detailed paragraph and key-fact points built only from computed statistics."""
    main = schema[0]
    t, cols, rows = main["name"], main["columns"], main["rows"]

    by_kind = {"TEXT": [], "INT": [], "REAL": [], "DATE": [], "BOOL": []}
    for c in cols:
        by_kind.setdefault(c["kind"], []).append(c)

    numeric_cols = by_kind["INT"] + by_kind["REAL"]
    ids = [c for c in cols if _is_id_like(c)]
    measures = [c for c in numeric_cols if not _is_id_like(c)]
    dates = by_kind["DATE"]
    cats = [c for c in cols if c.get("top_values")]
    missing_cols = [c for c in cols if c.get("missing")]
    total_missing = sum(c.get("missing", 0) for c in cols)

    # ---- paragraph ----
    sentences = []
    first = (f"This dataset has {len(schema)} table(s); the main table, '{t}', holds {rows:,} rows "
             f"and {main['total_columns']} columns.")
    if len(schema) > 1:
        first += f" The other tables are {', '.join(x['name'] for x in schema[1:])}."
    sentences.append(first)

    kinds = []
    if by_kind["TEXT"]:
        kinds.append(f"{len(by_kind['TEXT'])} text")
    if numeric_cols:
        kinds.append(f"{len(numeric_cols)} numeric")
    if dates:
        kinds.append(f"{len(dates)} date/time")
    if by_kind["BOOL"]:
        kinds.append(f"{len(by_kind['BOOL'])} true/false")
    if kinds:
        sentences.append("Its columns break down into " + ", ".join(kinds) + ".")

    for c in measures[:2]:
        sentences.append(
            f"'{c['name']}' ranges from {_fmt(c.get('min'))} to {_fmt(c.get('max'))}, "
            f"averaging {_fmt(c.get('avg'))}."
        )
    for c in dates[:1]:
        if c.get("min") and c.get("max"):
            sentences.append(f"'{c['name']}' covers the period from {c['min']} to {c['max']}.")
    for c in cats[:1]:
        top = c["top_values"][0]
        sentences.append(
            f"'{c['name']}' is a category column with {c['distinct']} distinct value(s), "
            f"the most common being '{top['value']}' ({top['count']:,} rows)."
        )
    sentences.append(
        "There are no missing values." if not total_missing
        else f"{total_missing:,} values are missing across {len(missing_cols)} column(s)."
    )

    # ---- points ----
    size = f"{rows:,} rows x {main['total_columns']} columns in '{t}'"
    if len(schema) > 1:
        size += f" (plus {len(schema) - 1} more table(s))"
    points = [{"label": "Size", "text": size}]

    groups = []
    if by_kind["TEXT"]:
        groups.append("Text: " + _names(by_kind["TEXT"]))
    if numeric_cols:
        groups.append("Numeric: " + _names(numeric_cols))
    if dates:
        groups.append("Date/time: " + _names(dates))
    if by_kind["BOOL"]:
        groups.append("True/false: " + _names(by_kind["BOOL"]))
    if groups:
        points.append({"label": "Columns", "text": "; ".join(groups)})

    if ids:
        points.append({"label": "Identifiers", "text": f"{_names(ids)} (used to tell rows apart)"})

    if measures:
        points.append({"label": "Numeric measures", "text": "; ".join(
            f"{c['name']}: {_fmt(c.get('min'))} to {_fmt(c.get('max'))} (avg {_fmt(c.get('avg'))})"
            for c in measures[:4]
        )})

    dated = [c for c in dates if c.get("min") and c.get("max")]
    if dated:
        points.append({"label": "Time coverage", "text": "; ".join(
            f"{c['name']}: {c['min']} to {c['max']}" for c in dated[:2]
        )})

    if cats:
        points.append({"label": "Categories", "text": "; ".join(
            f"{c['name']}: " + ", ".join(f"{v['value']} ({v['count']:,})" for v in c["top_values"][:3])
            for c in cats[:3]
        )})

    if not total_missing:
        quality = f"Complete: no missing values in any of the {len(cols)} columns"
    else:
        quality = "Missing values in " + ", ".join(f"{c['name']} ({c['missing']:,})" for c in missing_cols[:5])
    points.append({"label": "Data quality", "text": quality})

    uses = ["previewing and filtering rows"]
    if cats:
        uses.append("grouping and counting by category")
    if cats and measures:
        uses.append("comparing averages across groups")
    elif measures:
        uses.append("finding minimums, maximums and rankings")
    if dates:
        uses.append("looking at activity over time")
    points.append({"label": "Good for", "text": ", ".join(uses)})

    return {"paragraph": " ".join(sentences), "points": points}

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
        "overview": _facts_overview(schema),
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

    overview = _facts_overview(schema)
    raw_overview = data.get("overview") if isinstance(data.get("overview"), dict) else {}
    ai_paragraph = str(raw_overview.get("paragraph") or "").strip()
    if len(ai_paragraph) >= 80:
        overview["paragraph"] = ai_paragraph
    explore = str(raw_overview.get("explore") or "").strip()
    if explore:
        overview["points"] = [p for p in overview["points"] if p["label"] != "Good for"]
        overview["points"].append({"label": "What you can explore", "text": explore})
    return {
        "success": True,
        "title": "What this data is about",
        "description": description,
        "classification": classification,
        "insight": insight,
        "overview": overview, 
        "starter_queries": cards,
        "try_asking": try_asking,
        "source": "ai",
    } 

# ---------- public entry point ----------

def get_briefing(target: str, refresh: bool = False) -> dict:
    engine = create_engine(target) if "://" in target else create_engine(f"sqlite:///{os.path.abspath(target)}")
    try:
        schema = collect_schema(engine)
    finally:
        engine.dispose()

    if not schema:
        raise ValueError("No tables found in this database.")

    key = _schema_key(schema)

    if not refresh:
        if key in _cache:
            print("Briefing: memory cache hit")
            return _cache[key]

        saved = _load_disk(key)
        if saved:
            print("Briefing: disk cache hit")
            _cache[key] = saved
            return saved

        if key in _fail_cache:
            failed_at, failed_result = _fail_cache[key]
            if time.time() - failed_at < FAIL_TTL_SECONDS:
                print("Briefing: using recent fallback (AI failed recently)")
                return failed_result

    print("Briefing: generating")
    result = _ai_briefing(schema) if llm else None
    if result is None:
        result = _fallback_briefing(schema)

    if result["source"] == "ai":
        _cache[key] = result
        _save_disk(key, result)
        _fail_cache.pop(key, None)
    elif not llm:
        _cache[key] = result
    else:
        _fail_cache[key] = (time.time(), result)

    return result 
