"""
Fills the answer cache with your demo questions, so the demo still works if the Gemini quota is gone.
Run it ONCE while you still have quota (it spends a few Gemini calls), after uploading the dataset in the app.

Run from the project root:
    python benchmark/demo_warmup.py --db uploads/benchmark.db

Important: use the same file the app uses (the one in uploads/). If you upload a different or changed file,
run this again. Questions marked follow-up are sent with the previous question as history, like the app does.
"""
import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# (question, is_follow_up)
DEMO_QUESTIONS = [
    ("How many customers are there in each city?", False),
    ("Which cities have more than 3 customers?", True),
    ("What is the total revenue across all orders, where revenue is product price times quantity?", False),
    ("Show the names and total spending of the top 5 customers by total spending, highest first.", False),
    ("Which customers have never placed an order? Show their names.", False),
    ("Which product category generates the most revenue? Show the category and its total revenue.", False),
    ("How many orders were placed in each month? Show the month as YYYY-MM and the number of orders.", False),
]


def warm(db_path, questions, delay, runner):
    history, done, failed = [], 0, []
    for i, (q, follow_up) in enumerate(questions, 1):
        resp = runner(q, db_path, history[-1:] if follow_up and history else None)
        ok = bool(resp.get("success"))
        print(f"[{i}/{len(questions)}] {'OK    ' if ok else 'FAILED'} {q[:75]}")
        if ok:
            done += 1
            history.append({"question": q, "sql": resp.get("generated_sql", "")})
        else:
            failed.append((q, str(resp.get("error", ""))[:200]))
            if any(m in str(resp.get("error", "")).lower() for m in ("quota", "429", "limit")):
                print("\nGemini quota reached - stopping. Run this again later; finished questions are already saved.")
                break
        if i < len(questions):
            time.sleep(delay)
    return done, failed


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="path of the uploaded database, e.g. uploads/benchmark.db")
    ap.add_argument("--delay", type=float, default=8.0)
    args = ap.parse_args(argv)
    db = Path(args.db)
    if not db.exists():
        sys.exit(f"Database not found: {db}")

    from app.query_engine import run_natural_language_query

    def runner(q, db_path, history):
        return run_natural_language_query(q, db_path=str(Path(db_path).resolve()), history=history)

    done, failed = warm(str(db), DEMO_QUESTIONS, args.delay, runner)
    print(f"\n{done}/{len(DEMO_QUESTIONS)} demo answers saved in query_cache/.")
    for q, err in failed:
        print(f"  not saved: {q[:60]} -> {err}")


if __name__ == "__main__":
    main() 
