import os 
import re 
from pathlib import Path 
import shutil  
from typing import Optional 
from fastapi import FastAPI, HTTPException, File, UploadFile 
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel 
from sqlalchemy import create_engine, inspect, text 
from app.briefing import get_briefing
from app.schemas import BriefingResponse 
import pandas as pd  
import sqlite3  

from app.query_engine import run_natural_language_query, DEFAULT_DB_PATH 

app = FastAPI(title="NovaQuery AI Engine") 

# Configure CORS Middleware explicitly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)  

UPLOAD_DIR = os.path.abspath("uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True) 

UPLOAD_ROOT = Path(UPLOAD_DIR).resolve()
ALLOWED_EXTENSIONS = {
    ".db", ".sqlite", ".sqlite3",
    ".csv", ".xlsx", ".xls", ".json", ".parquet", ".sql",
}
NATIVE_SQLITE_EXTENSIONS = {".db", ".sqlite", ".sqlite3"}
MAX_UPLOAD_MB = 50
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


def safe_filename(raw_name: Optional[str]) -> str:
    """Keeps only the bare file name, so folders and '..' from the client are ignored."""
    name = Path((raw_name or "").replace("\\", "/")).name.strip()
    if not name or name in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid file name.")
    return name


def clean_identifier(raw: str) -> str:
    """Turns any text into a safe SQL table/file name: letters, digits, underscores."""
    cleaned = re.sub(r"\W+", "_", raw.strip().lower()).strip("_")
    if not cleaned:
        cleaned = "data"
    if cleaned[0].isdigit():
        cleaned = f"t_{cleaned}"
    return cleaned 


# State tracker for active database target
active_db_target = {"type": "file", "path": os.path.abspath(DEFAULT_DB_PATH)}

DEFAULT_DB_RESOLVED = Path(DEFAULT_DB_PATH).resolve()


def resolve_target(db_path: Optional[str]) -> str:
    """
    Returns the database to use for a request.
    - No db_path sent: the active database (unchanged behaviour).
    - db_path sent: only accepted if it is an existing file inside uploads/ (or the default DB).
    """
    if not db_path:
        return active_db_target["path"]

    try:
        candidate = Path(db_path).resolve()
    except (OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid database path.")

    inside_uploads = UPLOAD_ROOT in candidate.parents
    is_default = candidate == DEFAULT_DB_RESOLVED

    if not (inside_uploads or is_default) or not candidate.is_file():
        raise HTTPException(
            status_code=400,
            detail="Database not found. Please upload your dataset again.",
        )
    return str(candidate) 


class QueryRequest(BaseModel):
    question: Optional[str] = None
    query: Optional[str] = None  # Fallback field for frontend compatibility
    db_path: Optional[str] = None
    dialect: Optional[str] = "SQLite"

class ConnectionRequest(BaseModel):
    connection_string: str

@app.get("/")
async def read_root():
    return {"status": "online", "message": "NovaQuery AI Engine API running"}

@app.post("/api/connect-uri")
async def connect_uri(payload: ConnectionRequest):
    """Validates and inspects a live PostgreSQL, MySQL, or remote DB connection URI"""
    try:
        engine = create_engine(payload.connection_string, connect_args={"connect_timeout": 5})
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        schema_summary = []
        for table in table_names:
            columns = inspector.get_columns(table)
            cols_str = ", ".join([f"{col['name']} ({col['type']})" for col in columns])
            schema_summary.append(f"Table {table}: {cols_str}")
            
        # Set remote connection as primary active target
        active_db_target["type"] = "uri"
        active_db_target["path"] = payload.connection_string
        active_db_target["original_filename"] = None 

        return {
            "success": True,
            "message": f"Connected successfully! Found {len(table_names)} tables.",
            "tables": table_names,
            "schema": schema_summary
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")

@app.post("/api/query")
async def process_query(payload: QueryRequest):
    # Accept either 'question' or 'query' field from request body
    user_question = payload.question or payload.query
    if not user_question or not user_question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
      
    target_db = resolve_target(payload.db_path) 

    try:
        response = run_natural_language_query(
            user_question=user_question,
            db_path=target_db,
            dialect=payload.dialect
        ) 
        return response  
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@app.post("/api/upload-db")
async def upload_database(file: UploadFile = File(...)):
    engine = None
    try:
        original_name = safe_filename(file.filename)
        stem, ext = os.path.splitext(original_name)
        ext = ext.lower()

        if ext not in ALLOWED_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext or 'none'}'. Allowed: {allowed}",
            )

        temp_path = (UPLOAD_ROOT / original_name).resolve()
        if temp_path.parent != UPLOAD_ROOT:
            raise HTTPException(status_code=400, detail="Invalid file name.")

        # Stream the file to disk in 1 MB chunks, stopping if it gets too big
        written = 0
        too_large = False
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    too_large = True
                    break
                buffer.write(chunk)

        if too_large:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=413,
                detail=f"File is too large. Maximum size is {MAX_UPLOAD_MB} MB.",
            )

        base_table_name = clean_identifier(stem)
        target_sqlite_path = (UPLOAD_ROOT / f"{base_table_name}.db").resolve()

        # 1. Native SQLite files are used as they are
        if ext in NATIVE_SQLITE_EXTENSIONS:
            final_path = temp_path

        else:
            engine = create_engine(f"sqlite:///{target_sqlite_path}")

            # 2. CSV
            if ext == ".csv":
                df = pd.read_csv(temp_path)
                df.to_sql(base_table_name, con=engine, if_exists="replace", index=False)

            # 3. Excel (one table per sheet)
            elif ext in {".xlsx", ".xls"}:
                excel_file = pd.ExcelFile(temp_path)
                for sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(temp_path, sheet_name=sheet_name)
                    df.to_sql(clean_identifier(sheet_name), con=engine, if_exists="replace", index=False)

            # 4. JSON
            elif ext == ".json":
                df = pd.read_json(temp_path)
                df.to_sql(base_table_name, con=engine, if_exists="replace", index=False)

            # 5. Parquet
            elif ext == ".parquet":
                df = pd.read_parquet(temp_path)
                df.to_sql(base_table_name, con=engine, if_exists="replace", index=False)

            # 6. SQL dumps (engine.begin() commits when the block finishes)
            elif ext == ".sql":
                with open(temp_path, "r", encoding="utf-8") as f:
                    sql_script = f.read()
                with engine.begin() as conn:
                    for statement in sql_script.split(";"):
                        if statement.strip():
                            try:
                                conn.execute(text(statement))
                            except Exception:
                                pass

            final_path = target_sqlite_path

        # Track the uploaded database as the active target
        active_db_target["type"] = "file"
        active_db_target["path"] = str(final_path)
        active_db_target["original_filename"] = original_name        

        return {
            "success": True,
            "filename": final_path.name,
            "original_filename": original_name,
            "db_path": str(final_path),
            "type": "converted",
        }

    except HTTPException:
        raise  # keep real 400 / 413 errors instead of turning them into 500s
    except Exception as e:
        print(f"Error uploading database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")
    finally:
        if engine is not None:
            engine.dispose()  # releases the SQLite file (important on Windows/OneDrive) 


def simplify_type(raw_type) -> str:
    """Maps any SQL type name to one of: INT, REAL, BOOL, DATE, TEXT."""
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


def _to_float(value):
    return float(value) if value is not None else None


def profile_table(conn, engine, inspector, table: str) -> dict:
    """Profiles one table using a single SQL query (nothing is loaded into memory)."""
    quote = engine.dialect.identifier_preparer.quote
    columns = inspector.get_columns(table)
    pk_names = set(inspector.get_pk_constraint(table).get("constrained_columns") or [])

    select_parts = ["COUNT(*)"]
    meta = []
    for col in columns:
        q = quote(col["name"])
        kind = simplify_type(col["type"])
        numeric = kind in ("INT", "REAL")
        select_parts += [f"COUNT({q})", f"COUNT(DISTINCT {q})"]
        if numeric:
            select_parts += [f"MIN({q})", f"MAX({q})", f"AVG({q})"]
        meta.append({
            "name": col["name"],
            "kind": kind,
            "sql_type": str(col["type"]),
            "numeric": numeric,
            "is_pk": col["name"] in pk_names,
        })

    row = conn.execute(text(f"SELECT {', '.join(select_parts)} FROM {quote(table)}")).fetchone()

    total_rows = int(row[0])
    idx = 1
    columns_profile = []
    total_missing = 0
    for m in meta:
        non_null = int(row[idx])
        distinct = int(row[idx + 1])
        idx += 2
        info = {
            "name": m["name"],
            "type": f"{m['kind']} PK" if m["is_pk"] else m["kind"],
            "sql_type": m["sql_type"],
            "is_pk": m["is_pk"],
            "missing": total_rows - non_null,
            "missing_pct": round(((total_rows - non_null) / total_rows) * 100, 1) if total_rows else 0,
            "unique_values": distinct,
        }
        if m["numeric"]:
            info["min"] = _to_float(row[idx])
            info["max"] = _to_float(row[idx + 1])
            mean = _to_float(row[idx + 2])
            info["mean"] = round(mean, 2) if mean is not None else None
            idx += 3
        total_missing += total_rows - non_null
        columns_profile.append(info)

    return {
        "table_name": table,
        "total_rows": total_rows,
        "total_columns": len(columns_profile),
        "total_missing_values": total_missing,
        "columns": columns_profile,
    }


@app.get("/api/profile")
async def profile_dataset(db_path: Optional[str] = None):
    """Profiles every table: row/column counts, SQL types, primary keys, missing values, stats."""
    target = resolve_target(db_path)

    if not target or (active_db_target["type"] == "file" and not os.path.exists(target)):
        raise HTTPException(status_code=404, detail="No active database found for profiling.")

    engine = None
    try:
        if "://" in target:
            engine = create_engine(target)
        else:
            engine = create_engine(f"sqlite:///{os.path.abspath(target)}")

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if not tables:
            raise HTTPException(status_code=400, detail="No tables found in target database.")

        with engine.connect() as conn:
            table_profiles = [profile_table(conn, engine, inspector, t) for t in tables]

        primary = table_profiles[0]
        source_filename = (
            active_db_target.get("original_filename")
            if target == active_db_target["path"] else None
        )

        return {
            "success": True,
            # legacy fields (primary table), so the current frontend keeps working
            "table_name": primary["table_name"],
            "total_tables": len(table_profiles),
            "total_rows": primary["total_rows"],
            "total_columns": primary["total_columns"],
            "total_missing_values": primary["total_missing_values"],
            "columns": primary["columns"],
            # new fields
            "source_filename": source_filename,
            "tables": table_profiles,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Profiling error details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Profiling error: {str(e)}")
    finally:
        if engine is not None:
            engine.dispose() 

@app.get("/api/briefing", response_model=BriefingResponse)
def dataset_briefing(db_path: Optional[str] = None, refresh: bool = False):
    """Dataset description, insight and starter queries for the active dataset (cached per file)."""
    target = resolve_target(db_path)
    if not target or ("://" not in target and not os.path.exists(target)):
        raise HTTPException(status_code=404, detail="No active database found.")

    try:
        return get_briefing(target, refresh=refresh)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Briefing error details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Briefing error: {str(e)}") 

