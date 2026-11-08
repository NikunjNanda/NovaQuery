import os 
import re 
from pathlib import Path 
import shutil  
import uuid
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, File, UploadFile 
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel , Field 
from sqlalchemy import create_engine, inspect, text 
from app.briefing import get_briefing
from app.schemas import BriefingResponse 
from app.relationships import detect_relationships
import pandas as pd  
import sqlite3  

from app.query_engine import run_natural_language_query, DEFAULT_DB_PATH , generate_quiz, run_user_sql 

app = FastAPI(title="NovaQuery AI Engine") 

# Configure CORS Middleware explicitly
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)   

from app.image_pipeline import (
    process_zip_dataset,
    ZipSlipException,
    ZipLimitException,
    MAX_ZIP_BYTES,
)

UPLOAD_DIR = os.path.abspath("uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True) 

UPLOAD_ROOT = Path(UPLOAD_DIR).resolve()
ALLOWED_EXTENSIONS = {
    ".db", ".sqlite", ".sqlite3",
    ".csv", ".xlsx", ".xls", ".json", ".parquet", ".sql", ".zip",
}
NATIVE_SQLITE_EXTENSIONS = {".db", ".sqlite", ".sqlite3"}
MAX_UPLOAD_MB = 50
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_ZIP_UPLOAD_MB = 100
MAX_ZIP_UPLOAD_BYTES = MAX_ZIP_UPLOAD_MB * 1024 * 1024


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


def clean_column_name(raw: str) -> str:
    """Sanitizes a column name to a safe SQL identifier."""
    cleaned = re.sub(r"\W+", "_", str(raw).strip().lower()).strip("_")
    if not cleaned:
        cleaned = "col"
    if cleaned[0].isdigit():
        cleaned = f"c_{cleaned}"
    return cleaned


def sanitize_dataframe_columns(columns) -> list:
    """Sanitizes all column names in a dataframe, avoiding duplicates and invalid identifiers."""
    cleaned = []
    seen = set()
    for i, col in enumerate(columns):
        base = clean_column_name(col)
        candidate = base
        count = 2
        while candidate in seen:
            candidate = f"{base}_{count}"
            count += 1
        seen.add(candidate)
        cleaned.append(candidate)
    return cleaned


def generate_unique_table_name(stem: str, existing_tables: set) -> str:
    """Generates a safe, unique SQL table name from a file stem or table name."""
    base = clean_identifier(stem)
    candidate = base
    counter = 2
    while candidate in existing_tables:
        candidate = f"{base}_{counter}"
        counter += 1
    existing_tables.add(candidate)
    return candidate


async def stream_upload_file(file: UploadFile, dest_path: Path) -> int:
    """Streams an UploadFile to disk in 1 MB chunks and enforces the size limit."""
    is_zip = dest_path.suffix.lower() == ".zip"
    limit_bytes = MAX_ZIP_UPLOAD_BYTES if is_zip else MAX_UPLOAD_BYTES
    limit_mb = MAX_ZIP_UPLOAD_MB if is_zip else MAX_UPLOAD_MB

    written = 0
    with open(dest_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > limit_bytes:
                dest_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File '{file.filename}' is too large. Maximum size is {limit_mb} MB.",
                )
            buffer.write(chunk)
    return written


def load_file_into_sqlite(
    file_path: Path,
    ext: str,
    stem: str,
    engine,
    existing_tables: set,
    workspace_id: Optional[str] = None,
) -> list:
    """
    Loads a single tabular file, SQLite database, or ZIP archive into an existing SQLite engine.
    Returns the list of table names created.
    """
    tables_created = []

    if ext == ".zip":
        ws_id = workspace_id or uuid.uuid4().hex[:12]
        zip_result = process_zip_dataset(file_path, ws_id, UPLOAD_ROOT)

        for meta in zip_result.get("metadata_entries", []):
            meta_name = meta["filename"]
            meta_stem, meta_ext = os.path.splitext(meta_name)
            temp_meta_path = UPLOAD_ROOT / f"tmp_{ws_id}_{meta_name}"
            temp_meta_path.write_bytes(meta["data"])
            try:
                sub_created = load_file_into_sqlite(
                    temp_meta_path, meta_ext.lower(), meta_stem, engine, existing_tables, ws_id
                )
                tables_created.extend(sub_created)
            finally:
                temp_meta_path.unlink(missing_ok=True)

        if not tables_created and zip_result.get("images"):
            t_name = generate_unique_table_name(stem, existing_tables)
            df = pd.DataFrame([
                {
                    "image_id": idx + 1,
                    "filename": img["stored_name"],
                    "format": img["format"],
                    "size_kb": round(img["size_bytes"] / 1024, 1),
                }
                for idx, img in enumerate(zip_result["images"])
            ])
            df.to_sql(t_name, con=engine, if_exists="replace", index=False)
            tables_created.append(t_name)

    if ext == ".csv":
        t_name = generate_unique_table_name(stem, existing_tables)
        df = pd.read_csv(file_path)
        df.columns = sanitize_dataframe_columns(df.columns)
        df.to_sql(t_name, con=engine, if_exists="replace", index=False)
        tables_created.append(t_name)

    elif ext in {".xlsx", ".xls"}:
        excel_file = pd.ExcelFile(file_path)
        for sheet_name in excel_file.sheet_names:
            suffix = f"_{sheet_name}" if len(excel_file.sheet_names) > 1 else ""
            t_name = generate_unique_table_name(f"{stem}{suffix}", existing_tables)
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = sanitize_dataframe_columns(df.columns)
            df.to_sql(t_name, con=engine, if_exists="replace", index=False)
            tables_created.append(t_name)

    elif ext == ".json":
        t_name = generate_unique_table_name(stem, existing_tables)
        df = pd.read_json(file_path)
        df.columns = sanitize_dataframe_columns(df.columns)
        df.to_sql(t_name, con=engine, if_exists="replace", index=False)
        tables_created.append(t_name)

    elif ext == ".parquet":
        t_name = generate_unique_table_name(stem, existing_tables)
        df = pd.read_parquet(file_path)
        df.columns = sanitize_dataframe_columns(df.columns)
        df.to_sql(t_name, con=engine, if_exists="replace", index=False)
        tables_created.append(t_name)

    elif ext == ".sql":
        with open(file_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
        inspector_before = inspect(engine)
        tables_before = set(inspector_before.get_table_names())
        with engine.begin() as conn:
            for statement in sql_script.split(";"):
                stmt = statement.strip()
                if stmt:
                    try:
                        conn.execute(text(stmt))
                    except Exception:
                        pass
        inspector_after = inspect(engine)
        new_tables = [t for t in inspector_after.get_table_names() if t not in tables_before]
        for t in new_tables:
            existing_tables.add(t)
            tables_created.append(t)

    elif ext in NATIVE_SQLITE_EXTENSIONS:
        src_engine = create_engine(f"sqlite:///{file_path}")
        try:
            src_inspector = inspect(src_engine)
            for t in src_inspector.get_table_names():
                t_name = generate_unique_table_name(t, existing_tables)
                df = pd.read_sql_table(t, con=src_engine)
                df.columns = sanitize_dataframe_columns(df.columns)
                df.to_sql(t_name, con=engine, if_exists="replace", index=False)
                tables_created.append(t_name)
        finally:
            src_engine.dispose()

    return tables_created


# State tracker for active database target
active_db_target = {
    "type": "file",
    "path": os.path.abspath(DEFAULT_DB_PATH),
    "original_filename": "company.db",
    "relationships": [],
    "tables": ["customers", "orders", "products"],
}

# In-memory store for workspaces and their relationships
workspaces_state: Dict[str, Dict[str, Any]] = {}

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

class RunSqlRequest(BaseModel):
    sql: str
    db_path: Optional[str] = None

class ConnectionRequest(BaseModel):
    connection_string: str 

class ConfirmRelationshipsRequest(BaseModel):
    db_path: Optional[str] = None
    workspace_id: Optional[str] = None
    relationships: List[Dict[str, Any]] = Field(default_factory=list)

class QuizRequest(BaseModel):
    question: str
    generated_sql: str
    db_path: Optional[str] = None
    num_questions: int = Field(5, ge=3, le=10)

# Backend fallback. Keep this empty if your 15 static questions live in the frontend.
STATIC_QUESTIONS: list = [] 


@app.get("/")
async def read_root():
    return {"status": "online", "message": "NovaQuery AI Engine API running"}

@app.post("/api/connect-uri")
async def connect_uri(payload: ConnectionRequest):
    """Checks that a live database is reachable and lists its tables. Querying it is not enabled yet."""
    engine = None
    try:
        engine = create_engine(payload.connection_string, connect_args={"connect_timeout": 5})
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        schema_summary = []
        for table in table_names:
            columns = inspector.get_columns(table)
            cols_str = ", ".join(f"{col['name']} ({col['type']})" for col in columns)
            schema_summary.append(f"Table {table}: {cols_str}")

        return {
            "success": True,
            "message": (
                f"Connection verified. Found {len(table_names)} tables. "
                "Running queries on live databases is planned for a future release; "
                "upload a file to query it now."
            ),
            "tables": table_names,
            "schema": schema_summary,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")
    finally:
        if engine is not None:
            engine.dispose() 

@app.post("/api/query")
def process_query(payload: QueryRequest):
    # Accept either 'question' or 'query' field from request body
    user_question = payload.question or payload.query
    if not user_question or not user_question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
      
    target_db = resolve_target(payload.db_path) 

    rel = None
    if target_db in workspaces_state:
        rel = workspaces_state[target_db].get("relationships")
    elif target_db == active_db_target.get("path"):
        rel = active_db_target.get("relationships")

    try:
        response = run_natural_language_query(
            user_question=user_question,
            db_path=target_db,
            dialect=payload.dialect,
            relationships=rel,
        ) 
        return response  
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@app.post("/api/run-sql")
def run_sql(payload: RunSqlRequest):
    if not payload.sql or not payload.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")

    target_db = resolve_target(payload.db_path)

    try:
        return run_user_sql(sql=payload.sql, db_path=target_db)
    except Exception as e:
        print(f"Error executing user SQL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@app.post("/api/quiz")
def generate_quiz_endpoint(payload: QuizRequest):  # plain def: runs the blocking LLM call in a threadpool
    if not payload.question.strip() or not payload.generated_sql.strip():
        raise HTTPException(status_code=400, detail="Question and SQL are required.")

    target_db = resolve_target(payload.db_path)

    try:
        result = generate_quiz(
            question=payload.question,
            sql_query=payload.generated_sql,
            db_path=target_db,
            static_questions=STATIC_QUESTIONS,
            n=payload.num_questions,
        )
        return {"success": True, **result}
    except Exception as e:
        print(f"Quiz endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}") 


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
        is_zip = ext == ".zip"
        limit_bytes = MAX_ZIP_UPLOAD_BYTES if is_zip else MAX_UPLOAD_BYTES
        limit_mb = MAX_ZIP_UPLOAD_MB if is_zip else MAX_UPLOAD_MB

        written = 0
        too_large = False
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > limit_bytes:
                    too_large = True
                    break
                buffer.write(chunk)

        if too_large:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=413,
                detail=f"File is too large. Maximum size is {limit_mb} MB.",
            )

        base_table_name = clean_identifier(stem)
        target_sqlite_path = (UPLOAD_ROOT / f"{base_table_name}.db").resolve()

        # 1. Native SQLite files are used as they are
        if ext in NATIVE_SQLITE_EXTENSIONS:
            final_path = temp_path

        elif ext == ".zip":
            workspace_id = uuid.uuid4().hex[:12]
            target_sqlite_path = (UPLOAD_ROOT / f"workspace_{workspace_id}.db").resolve()
            engine = create_engine(f"sqlite:///{target_sqlite_path}")
            tables_created = load_file_into_sqlite(temp_path, ext, stem, engine, set(), workspace_id)
            final_path = target_sqlite_path
            base_table_name = tables_created[0] if tables_created else "images"

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

    except (ZipSlipException, ZipLimitException) as ze:
        status_code = 400 if isinstance(ze, ZipSlipException) else 413
        raise HTTPException(status_code=status_code, detail=str(ze))
    except HTTPException:
        raise  # keep real 400 / 413 errors instead of turning them into 500s
    except Exception as e:
        print(f"Error uploading database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")
    finally:
        if engine is not None:
            engine.dispose()  # releases the SQLite file (important on Windows/OneDrive) 


@app.post("/api/upload-multiple")
async def upload_multiple_databases(files: List[UploadFile] = File(...)):
    """
    Uploads 2 to 6 tabular files or SQLite databases into ONE shared workspace SQLite database.
    Auto-detects relationships across tables.
    If no relationships are found, returns HTTP 422 with the per-file column lists.
    """
    if len(files) < 2:
        raise HTTPException(
            status_code=400,
            detail="Multi-dataset upload requires at least 2 files. For a single file, please use single upload.",
        )
    if len(files) > 6:
        raise HTTPException(
            status_code=400,
            detail="A maximum of 6 files can be uploaded at once.",
        )

    workspace_id = uuid.uuid4().hex[:12]
    workspace_db_path = (UPLOAD_ROOT / f"workspace_{workspace_id}.db").resolve()
    temp_files = []
    workspace_engine = None

    try:
        # 1. Stream all files to temporary disk storage and check extensions/sizes
        for f in files:
            original_name = safe_filename(f.filename)
            stem, ext = os.path.splitext(original_name)
            ext = ext.lower()
            if ext not in ALLOWED_EXTENSIONS:
                allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format '{ext or 'none'}' in '{original_name}'. Allowed: {allowed}",
                )
            temp_path = (UPLOAD_ROOT / f"tmp_{workspace_id}_{original_name}").resolve()
            await stream_upload_file(f, temp_path)
            temp_files.append((temp_path, stem, ext, original_name))

        # 2. Create the unified SQLite workspace database and populate tables
        workspace_engine = create_engine(f"sqlite:///{workspace_db_path}")
        existing_tables = set()
        file_to_tables = {}
        all_created_tables = []

        for temp_path, stem, ext, original_name in temp_files:
            created = load_file_into_sqlite(
                temp_path, ext, stem, workspace_engine, existing_tables, workspace_id
            )
            file_to_tables[original_name] = created
            all_created_tables.extend(created)

        # 3. Collect columns for each table
        inspector = inspect(workspace_engine)
        table_columns = {}
        for t in all_created_tables:
            table_columns[t] = [c["name"] for c in inspector.get_columns(t)]

        # 4. Auto-detect relationships using app.relationships
        relationships = detect_relationships(workspace_engine, all_created_tables)

        # Record in workspaces_state
        file_names = [f[3] for f in temp_files]
        summary_name = f"{len(file_names)} datasets (" + ", ".join(file_names[:2]) + (", ..." if len(file_names) > 2 else "") + ")"

        workspaces_state[str(workspace_db_path)] = {
            "workspace_id": workspace_id,
            "db_path": str(workspace_db_path),
            "original_filename": summary_name,
            "files": file_names,
            "file_to_tables": file_to_tables,
            "tables": all_created_tables,
            "table_columns": table_columns,
            "relationships": relationships,
        }

        # Enforce "must share fields": if no relationships found, return HTTP 422
        if not relationships:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "These datasets do not share any common column, so they cannot be queried together.",
                    "workspace_id": workspace_id,
                    "db_path": str(workspace_db_path),
                    "tables": all_created_tables,
                    "table_columns": table_columns,
                    "file_to_tables": file_to_tables,
                },
            )

        # Activate the workspace
        active_db_target["type"] = "workspace"
        active_db_target["path"] = str(workspace_db_path)
        active_db_target["original_filename"] = summary_name
        active_db_target["tables"] = all_created_tables
        active_db_target["relationships"] = relationships

        return {
            "success": True,
            "workspace_id": workspace_id,
            "filename": workspace_db_path.name,
            "original_filename": summary_name,
            "db_path": str(workspace_db_path),
            "tables": all_created_tables,
            "file_to_tables": file_to_tables,
            "table_columns": table_columns,
            "relationships": relationships,
            "type": "workspace",
        }

    except (ZipSlipException, ZipLimitException) as ze:
        status_code = 400 if isinstance(ze, ZipSlipException) else 413
        raise HTTPException(status_code=status_code, detail=str(ze))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in multi-upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Multi-file upload error: {str(e)}")
    finally:
        for temp_path, _, _, _ in temp_files:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass
        if workspace_engine is not None:
            workspace_engine.dispose()


@app.post("/api/confirm-relationships")
async def confirm_relationships(payload: ConfirmRelationshipsRequest):
    """
    Confirms, adds, or removes relationships for a workspace SQLite database.
    Validates that each table and column exists in the database.
    Activates the workspace with the confirmed relationships.
    """
    target = resolve_target(payload.db_path)
    engine = None
    try:
        engine = create_engine(f"sqlite:///{os.path.abspath(target)}")
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        columns_by_table = {
            t: {c["name"] for c in inspector.get_columns(t)}
            for t in existing_tables
        }

        validated_relationships = []
        for rel in payload.relationships:
            left_t = rel.get("left_table")
            left_c = rel.get("left_column")
            right_t = rel.get("right_table")
            right_c = rel.get("right_column")

            if not left_t or left_t not in existing_tables:
                raise HTTPException(status_code=400, detail=f"Table '{left_t}' does not exist in workspace.")
            if not right_t or right_t not in existing_tables:
                raise HTTPException(status_code=400, detail=f"Table '{right_t}' does not exist in workspace.")
            if not left_c or left_c not in columns_by_table.get(left_t, set()):
                raise HTTPException(status_code=400, detail=f"Column '{left_c}' does not exist in table '{left_t}'.")
            if not right_c or right_c not in columns_by_table.get(right_t, set()):
                raise HTTPException(status_code=400, detail=f"Column '{right_c}' does not exist in table '{right_t}'.")

            validated_relationships.append({
                "left_table": left_t,
                "left_column": left_c,
                "right_table": right_t,
                "right_column": right_c,
                "overlap_pct": rel.get("overlap_pct", 100.0),
                "cardinality": rel.get("cardinality", "many_to_one"),
                "confidence": rel.get("confidence", 1.0),
            })

        # Update workspace state
        if target in workspaces_state:
            workspaces_state[target]["relationships"] = validated_relationships

        # Activate the workspace
        active_db_target["type"] = "workspace"
        active_db_target["path"] = str(target)
        active_db_target["tables"] = list(existing_tables)
        active_db_target["relationships"] = validated_relationships

        return {
            "success": True,
            "db_path": str(target),
            "tables": list(existing_tables),
            "relationships": validated_relationships,
            "message": f"Workspace activated with {len(validated_relationships)} confirmed relationships.",
        }
    finally:
        if engine is not None:
            engine.dispose() 


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

    sample_rows = []
    try:
        sample_res = conn.execute(text(f"SELECT * FROM {quote(table)} LIMIT 3"))
        keys = list(sample_res.keys())
        for r in sample_res.fetchall():
            sample_rows.append({k: (None if v is None else str(v)[:40]) for k, v in zip(keys, r)})
    except Exception:
        pass

    return {
        "table_name": table,
        "total_rows": total_rows,
        "total_columns": len(columns_profile),
        "total_missing_values": total_missing,
        "columns": columns_profile,
        "sample_rows": sample_rows,
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
        relationships = (
            active_db_target.get("relationships", [])
            if target == active_db_target["path"]
            else workspaces_state.get(target, {}).get("relationships", [])
        )

        overview_paragraph = f"Workspace containing {len(table_profiles)} table(s) and {sum(t['total_rows'] for t in table_profiles):,} total rows."
        if relationships:
            rel_desc = "; ".join(f"'{r['left_table']}' joins '{r['right_table']}' on {r['left_column']}={r['right_column']}" for r in relationships[:3])
            overview_paragraph += f" Tables are linked: {rel_desc}."

        overview_points = [
            {"label": "Tables", "text": ", ".join(f"{t['table_name']} ({t['total_rows']:,} rows)" for t in table_profiles)},
        ]
        if relationships:
            overview_points.append({
                "label": "Relationships",
                "text": "; ".join(f"{r['left_table']}.{r['left_column']} ⟷ {r['right_table']}.{r['right_column']} ({r.get('cardinality', 'link').replace('_', ' ')})" for r in relationships)
            })

        overview = {
            "paragraph": overview_paragraph,
            "points": overview_points,
        }

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
            "relationships": relationships,
            "overview": overview,
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

    rel = None
    if target in workspaces_state:
        rel = workspaces_state[target].get("relationships")
    elif target == active_db_target.get("path"):
        rel = active_db_target.get("relationships")

    try:
        return get_briefing(target, refresh=refresh, relationships=rel)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Briefing error details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Briefing error: {str(e)}") 

