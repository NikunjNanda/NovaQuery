"""
Generates a benchmark (question + expected SQL pairs) for ANY database with Gemini,
using that database's own schema and sample rows. Works on whatever the user uploads.

Every generated pair is checked before it is kept:
  - the SQL must pass NovaQuery's own security validator (read-only SELECT),
  - it must run on the database without errors,
  - it must return at least one row (and not an absurd number),
  - duplicate questions are dropped.
Pairs that fail are discarded and the missing ones are requested again once.

Run from the project root:
    python benchmark/generate_questions.py --db uploads/mydata.db
    python benchmark/generate_questions.py --db uploads/mydata.db --per-level 10 --out benchmark/generated_questions.json

Then score the pipeline on them:
    python benchmark/run_benchmark.py --db uploads/mydata.db --questions benchmark/generated_questions.json

IMPORTANT: the expected SQL here is written by an AI, so it is not guaranteed ground truth.
Read the printed review list and delete any pair that looks wrong before you trust the numbers.
"""
import argparse
import json
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

LEVELS = ["Beginner", "Intermediate", "Advanced"]
MAX_RESULT_ROWS = 200

PROMPT = """You are building an accuracy benchmark for a natural-language-to-SQL system.
Write {n} question + SQL pairs for EACH of these three difficulty levels, for the SQLite database below.

Beginner: one table; simple filters, COUNT / SUM / AVG / MIN / MAX, DISTINCT.
Intermediate: GROUP BY with aggregates, HAVING, ORDER BY with LIMIT, simple JOINs, date or text filters.
Advanced: multi-table JOINs, subqueries, CTEs, ratios or percentages, "above average" comparisons, anti-joins (rows with no match).
If the database has only one table, use that table for every level and make Advanced questions use subqueries, CTEs or ratios.

Database schema (with sample rows):
{schema}

Rules:
- Use ONLY tables and columns that exist in the schema. Use SQLite syntax.
- Each question must be answerable and must name exactly which columns to show
  (for example "Show the name and the total"), so there is one clearly correct result.
- If a question asks for a top-N or sorted list, make the ordering deterministic (add a tie-breaker column).
- No question may modify data. Every SQL statement must be a single SELECT.
- Questions must be natural English a business user would ask, not SQL in disguise.
- Vary the questions; do not repeat the same idea.
{extra}
Return ONLY valid JSON (no markdown), a list of objects in exactly this format:
[{"level": "Beginner", "question": "...", "expected_sql": "SELECT ..."}]"""


# ---------- helpers ----------

def run_sql(db_path, sql):
    uri = Path(db_path).resolve().as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        return conn.execute(sql).fetchall()
    finally:
        conn.close()


def has_order_by(sql):
    try:
        import sqlglot
        from sqlglot import exp
        tree = sqlglot.parse_one(sql, read="sqlite")
        return isinstance(tree, exp.Select) and tree.args.get("order") is not None
    except Exception:
        return False


def get_schema(db_path):
    from langchain_community.utilities import SQLDatabase
    return SQLDatabase.from_uri(f"sqlite:///{Path(db_path).resolve()}").get_table_info()


def ask_llm(prompt):
    """Calls the same Gemini model NovaQuery uses. Separate function so it is easy to stub in tests."""
    from app.query_engine import llm, _text, _extract_json  # noqa: F401
    if llm is None:
        sys.exit("No Gemini API key found. Set GOOGLE_API_KEY in your .env file first.")
    raw = _text(llm.invoke(prompt).content)
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("["), cleaned.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("Model did not return a JSON list")
    return json.loads(cleaned[start:end + 1])


def validate_pair(item, db_path, seen_questions):
    """Returns (clean_pair, None) or (None, reason)."""
    from app.security import SecurityException, validate_sql_security

    if not isinstance(item, dict):
        return None, "not an object"
    level = str(item.get("level", "")).strip().title()
    question = str(item.get("question", "")).strip()
    sql = str(item.get("expected_sql", "")).strip().rstrip(";").strip()
    if level not in LEVELS or not question or not sql:
        return None, "missing level, question or SQL"
    if question.lower() in seen_questions:
        return None, "duplicate question"
    try:
        validate_sql_security(sql)
    except SecurityException as e:
        return None, f"security: {e}"
    try:
        rows = run_sql(db_path, sql)
    except Exception as e:
        return None, f"SQL error: {e}"
    if not rows:
        return None, "returned no rows"
    if len(rows) > MAX_RESULT_ROWS:
        return None, f"returned {len(rows)} rows (too many to compare reliably)"
    return {"level": level, "question": question, "expected_sql": sql,
            "ordered": has_order_by(sql), "_rows": len(rows)}, None


def generate(db_path, per_level, out_path):
    schema = get_schema(db_path)
    kept, seen, rejected = [], set(), []

    for round_no in range(2):  # first request, then one top-up for whatever is missing
        missing = {lvl: per_level - sum(1 for k in kept if k["level"] == lvl) for lvl in LEVELS}
        if all(v <= 0 for v in missing.values()):
            break
        n = max(missing.values()) + (2 if round_no == 0 else 1)  # ask for spares, some will be rejected
        extra = ""
        if kept:
            extra = "Do NOT repeat these existing questions:\n" + "\n".join(f"- {k['question']}" for k in kept) + "\n"
        prompt = PROMPT.replace("{n}", str(n)).replace("{schema}", schema).replace("{extra}", extra)
        try:
            items = ask_llm(prompt)
        except Exception as e:
            print(f"Generation round {round_no + 1} failed: {e}")
            continue

        for item in items:
            pair, reason = validate_pair(item, db_path, seen)
            if reason:
                rejected.append((item, reason))
                continue
            if sum(1 for k in kept if k["level"] == pair["level"]) >= per_level:
                continue  # level already full
            seen.add(pair["question"].lower())
            kept.append(pair)

    kept.sort(key=lambda k: LEVELS.index(k["level"]))
    final = []
    for i, k in enumerate(kept, 1):
        entry = {"id": i, "level": k["level"], "question": k["question"], "expected_sql": k["expected_sql"]}
        if k["ordered"]:
            entry["ordered"] = True
        final.append(entry)
    Path(out_path).write_text(json.dumps(final, indent=2), encoding="utf-8")

    print(f"\nKept {len(final)} pair(s), rejected {len(rejected)}.")
    for lvl in LEVELS:
        print(f"  {lvl}: {sum(1 for f in final if f['level'] == lvl)}/{per_level}")
    if rejected:
        print("\nRejected (for information):")
        for item, reason in rejected:
            print(f"  - {reason}: {str(item.get('question', item))[:80] if isinstance(item, dict) else item}")
    print("\nREVIEW THESE BEFORE TRUSTING THE BENCHMARK (delete any pair that looks wrong):")
    for f, k in zip(final, kept):
        print(f"\n[{f['id']}] {f['level']}: {f['question']}\n    SQL: {f['expected_sql']}\n    -> {k['_rows']} row(s)"
              + ("  (ordered)" if f.get("ordered") else ""))
    print(f"\nSaved to {out_path}")
    return final


def main(argv=None):
    ap = argparse.ArgumentParser(description="Generate a benchmark for any SQLite database with Gemini")
    ap.add_argument("--db", required=True, help="path to the uploaded .db file, e.g. uploads/mydata.db")
    ap.add_argument("--per-level", type=int, default=10)
    ap.add_argument("--out", default=str(HERE / "generated_questions.json"))
    args = ap.parse_args(argv)
    if not Path(args.db).exists():
        sys.exit(f"Database not found: {args.db}")
    generate(args.db, args.per_level, args.out)


if __name__ == "__main__":
    main() 