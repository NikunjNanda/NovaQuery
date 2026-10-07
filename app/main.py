import os 
import re 
from pathlib import Path 
import shutil  
from typing import Optional 
from fastapi import FastAPI, HTTPException, File, UploadFile 
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel 
from sqlalchemy import create_engine, inspect, text 
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
      
    target_db = payload.db_path if payload.db_path else active_db_target["path"]

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


@app.get("/api/profile")
async def profile_dataset(db_path: Optional[str] = None):
    """Calculates dataset summary metrics (rows, cols, null values, schema types)."""
    target = db_path if db_path else active_db_target["path"]

    if not target or (active_db_target["type"] == "file" and not os.path.exists(target)):
        raise HTTPException(status_code=404, detail="No active database found for profiling.")

    try:
        # Determine connection engine (SQLite file or URI string)
        if target.startswith(("postgresql://", "mysql://", "sqlite:///")):
            engine = create_engine(target)
        else:
            engine = create_engine(f"sqlite:///{os.path.abspath(target)}")

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if not tables:
            raise HTTPException(status_code=400, detail="No tables found in target database.")

        primary_table = tables[0]
        df = pd.read_sql_table(primary_table, con=engine)

        total_rows = len(df)
        total_cols = len(df.columns)
        total_missing = int(df.isnull().sum().sum())

        columns_profile = []
        for col in df.columns:
            missing_count = int(df[col].isnull().sum())
            missing_pct = round((missing_count / total_rows) * 100, 1) if total_rows > 0 else 0
            
            col_info = {
                "name": col,
                "type": str(df[col].dtype),
                "missing": missing_count,
                "missing_pct": missing_pct,
                "unique_values": int(df[col].nunique())
            }

            if pd.api.types.is_numeric_dtype(df[col]):
                col_info["min"] = float(df[col].min()) if not df[col].empty else None
                col_info["max"] = float(df[col].max()) if not df[col].empty else None
                col_info["mean"] = round(float(df[col].mean()), 2) if not df[col].empty else None

            columns_profile.append(col_info)

        return {
            "success": True,
            "table_name": primary_table,
            "total_tables": len(tables),
            "total_rows": total_rows,
            "total_columns": total_cols,
            "total_missing_values": total_missing,
            "columns": columns_profile
        }

    except Exception as e:
        print(f"Profiling error details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Profiling error: {str(e)}") 