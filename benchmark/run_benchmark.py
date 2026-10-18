"""
NovaQuery accuracy benchmark.

For every question in questions.json it:
  1. runs the question through the real NovaQuery pipeline (Gemini -> SQL -> validate -> execute),
  2. runs the hand-written expected SQL on the same database,
  3. compares the two RESULT SETS (not the SQL text: different SQL can be equally correct).

Run from the project root:
    python benchmark/seed_benchmark_db.py        # once, creates benchmark/benchmark.db
    python benchmark/run_benchmark.py --check    # no AI calls: confirms every expected SQL runs
    python benchmark/run_benchmark.py            # the real benchmark (uses Gemini quota)

Useful options:
    --level Beginner      run only one level (handy if you hit the daily Gemini quota)
    --limit 5             run only the first 5 questions
    --delay 6             seconds to wait between questions (default 6, avoids rate limits)
    --resume              skip questions that already have a correct/wrong result; re-run only the rest
                          (use this after the Gemini quota stops a run - results from earlier runs are kept)

How results are compared (so harmless differences are not counted as mistakes):
  - column names / aliases are ignored
  - column ORDER is ignored (values inside each row are sorted before comparing)
  - 5, 5.0 and 5.00 are the same number (numbers are rounded to 2 decimals)
  - text is compared ignoring case and surrounding spaces
  - row order is ignored, except for questions marked "ordered": true (top-N / sorted lists)
Extra or missing columns, extra or missing rows, and wrong values all count as WRONG.
"""
import argparse
import csv
import json
import sqlite3
import sys
import time
from collections import OrderedDict
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))  # so "from app.query_engine import ..." works from anywhere

LEVELS = ["Beginner", "Intermediate", "Advanced"]


# ---------- comparing result sets ----------

def run_sql(db_path, sql):
    """Runs SQL on a read-only connection and returns the rows."""
    uri = Path(db_path).resolve().as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        return conn.execute(sql).fetchall()
    finally:
        conn.close()


def norm_value(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        v = int(v)
    if isinstance(v, (int, float)):
        return f"{round(float(v), 2):.2f}"
    return str(v).strip().lower()


def norm_row(row):
    return tuple(sorted(norm_value(v) for v in row))


def results_match(expected_rows, got_rows, ordered=False):
    exp = [norm_row(r) for r in expected_rows]
    got = [norm_row(r) for r in got_rows]
    return exp == got if ordered else sorted(exp) == sorted(got)


# ---------- the real pipeline ----------

def ask_pipeline(question, db_path):
    from app.query_engine import run_natural_language_query  # imported late so --check needs no API key
    db = str(Path(db_path).resolve())
    try:
        # the benchmark only needs the SQL and the data, so skip the explanation call (halves Gemini usage)
        return run_natural_language_query(question, db_path=db, include_teaching=False)
    except TypeError:  # query_engine.py has not been updated with include_teaching yet
        return run_natural_language_query(question, db_path=db)


QUOTA_MARKERS = ("quota", "429", "resource_exhausted", "daily limit")


def is_quota_error(text):
    t = str(text).lower()
    return any(m in t for m in QUOTA_MARKERS)


def results_path_for(questions_path, override=None):
    """questions.json -> results.json ; anything else -> results_<name>.json (so sets never mix)."""
    if override:
        return Path(override)
    stem = Path(questions_path).stem
    return HERE / ("results.json" if stem == "questions" else f"results_{stem}.json")


def load_previous(path):
    try:
        return {r["id"]: r for r in json.loads(Path(path).read_text(encoding="utf-8"))}
    except Exception:
        return {}


# ---------- main ----------

def main(argv=None):
    ap = argparse.ArgumentParser(description="NovaQuery accuracy benchmark")
    ap.add_argument("--db", default=str(HERE / "benchmark.db"))
    ap.add_argument("--questions", default=str(HERE / "questions.json"))
    ap.add_argument("--level", choices=LEVELS)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--delay", type=float, default=6.0)
    ap.add_argument("--check", action="store_true", help="only validate the expected SQL (no AI calls)")
    ap.add_argument("--resume", action="store_true", help="skip questions that already have a correct/wrong result")
    ap.add_argument("--results", help="where to keep results (default: derived from the questions file name)")
    args = ap.parse_args(argv)

    if not Path(args.db).exists():
        sys.exit(f"Database not found: {args.db}\nCreate it first: python benchmark/seed_benchmark_db.py")

    questions = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    all_ids = {q["id"] for q in questions}  # whole set, so results from other levels/days are kept and summarised
    if args.level:
        questions = [q for q in questions if q["level"] == args.level]
    if args.limit:
        questions = questions[: args.limit]

    # ----- --check mode: no AI, just prove the expected SQL is valid -----
    if args.check:
        bad = 0
        for q in questions:
            try:
                rows = run_sql(args.db, q["expected_sql"])
                flag = "  <-- EMPTY RESULT, check this question" if not rows else ""
                print(f"[{q['id']:>2}] {q['level']:<12} {len(rows):>3} row(s){flag}")
            except Exception as e:
                bad += 1
                print(f"[{q['id']:>2}] {q['level']:<12} SQL ERROR: {e}")
        print("\nAll expected SQL runs." if not bad else f"\n{bad} expected query(ies) failed.")
        return 1 if bad else 0

    # ----- real benchmark -----
    results_path = results_path_for(args.questions, args.results)
    previous = load_previous(results_path)
    to_run = [q for q in questions
              if not (args.resume and previous.get(q["id"], {}).get("status") in ("correct", "wrong"))]
    if len(to_run) < len(questions):
        print(f"Resuming: {len(questions) - len(to_run)} question(s) already done, {len(to_run)} to run.")

    merged = dict(previous)
    stopped_by_quota = False
    ran = 0
    for i, q in enumerate(to_run, 1):
        record = {"id": q["id"], "level": q["level"], "question": q["question"],
                  "expected_sql": q["expected_sql"], "generated_sql": "", "status": "",
                  "attempts_needed": None, "detail": ""}
        try:
            expected = run_sql(args.db, q["expected_sql"])
            resp = ask_pipeline(q["question"], args.db)
            record["generated_sql"] = resp.get("generated_sql", "")
            record["attempts_needed"] = resp.get("attempts_needed")
            if not resp.get("success"):
                record["status"] = "error"
                record["detail"] = str(resp.get("error", ""))[:300]
            else:
                got = [tuple(d.values()) for d in (resp.get("data") or [])]
                ok = results_match(expected, got, q.get("ordered", False))
                record["status"] = "correct" if ok else "wrong"
                if not ok:
                    if len(got) != len(expected):
                        record["detail"] = f"expected {len(expected)} row(s), got {len(got)}"
                    else:
                        record["detail"] = f"{len(got)} row(s) as expected, but values, columns or order differ"
        except Exception as e:
            record["status"] = "error"
            record["detail"] = f"{type(e).__name__}: {e}"[:300]

        ran += 1
        merged[q["id"]] = record
        mark = {"correct": "OK   ", "wrong": "WRONG", "error": "ERROR"}[record["status"]]
        print(f"[{i:>2}/{len(to_run)}] {mark} {q['level']:<12} {q['question'][:70]}")

        if record["status"] == "error" and is_quota_error(record["detail"]):
            stopped_by_quota = True
            print("\nGemini quota reached - stopping so the remaining questions are not wasted.")
            break
        if i < len(to_run):
            time.sleep(args.delay)

    final = [merged[i] for i in sorted(merged) if i in all_ids]
    if final:
        summarize_and_save(final, results_path)
    if stopped_by_quota:
        left = len(to_run) - ran
        print(f"\n{left} question(s) were not run. Run the same command again later with --resume "
              f"(add --level to pick a level); finished results are kept.")
    return 0


def summarize_and_save(results, results_path):
    by_level = OrderedDict((lvl, [r for r in results if r["level"] == lvl]) for lvl in LEVELS)
    print("\n" + "=" * 64)
    print(f"{'Level':<14}{'Correct':>8}{'Wrong':>8}{'Error':>8}{'Total':>8}{'Accuracy':>11}")
    print("-" * 64)
    for lvl, rs in by_level.items():
        if not rs:
            continue
        c = sum(r["status"] == "correct" for r in rs)
        w = sum(r["status"] == "wrong" for r in rs)
        e = sum(r["status"] == "error" for r in rs)
        print(f"{lvl:<14}{c:>8}{w:>8}{e:>8}{len(rs):>8}{100 * c / len(rs):>10.1f}%")
    c = sum(r["status"] == "correct" for r in results)
    e = sum(r["status"] == "error" for r in results)
    answered = len(results) - e
    print("-" * 64)
    print(f"{'Overall':<14}{c:>8}{len(results) - c - e:>8}{e:>8}{len(results):>8}{100 * c / len(results):>10.1f}%")
    if e:
        print(f"\n{e} question(s) errored (usually the Gemini quota; rerun them with --resume). "
              f"Accuracy on answered questions only: {100 * c / answered:.1f}%"
              if answered else "\nAll questions errored.")
    healed = sum(1 for r in results if (r["attempts_needed"] or 1) > 1)
    print(f"Self-healing: {healed} of {len(results)} queries needed an automatic correction.")

    failures = [r for r in results if r["status"] != "correct"]
    if failures:
        print("\nFailures to look at:")
        for r in failures:
            print(f"  #{r['id']} [{r['status']}] {r['question']}")
            if r["generated_sql"]:
                print(f"      generated: {r['generated_sql']}")
            print(f"      expected : {r['expected_sql']}")
            if r["detail"]:
                print(f"      note     : {r['detail']}")

    results_path = Path(results_path)
    csv_path = results_path.with_suffix(".csv")
    results_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)
    print(f"\nSaved {results_path} and {csv_path}")


if __name__ == "__main__":
    sys.exit(main()) 
