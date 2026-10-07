import os 
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
    try:
        filename = file.filename.lower()
        temp_path = os.path.join(UPLOAD_DIR, file.filename)
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        target_sqlite_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{os.path.splitext(file.filename)[0]}.db"))
        engine = create_engine(f"sqlite:///{target_sqlite_path}")

        # 1. Native SQLite Files
        if filename.endswith((".db", ".sqlite", ".sqlite3")):
            final_path = os.path.abspath(temp_path)

        # 2. CSV Files
        elif filename.endswith(".csv"):
            df = pd.read_csv(temp_path)
            table_name = os.path.splitext(file.filename)[0].replace(" ", "_").replace("-", "_").lower()
            df.to_sql(table_name, con=engine, if_exists="replace", index=False)
            final_path = target_sqlite_path

        # 3. Excel Files (.xlsx, .xls)
        elif filename.endswith((".xlsx", ".xls")):
            excel_file = pd.ExcelFile(temp_path)
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(temp_path, sheet_name=sheet_name)
                clean_table_name = sheet_name.strip().replace(" ", "_").replace("-", "_").lower()
                df.to_sql(clean_table_name, con=engine, if_exists="replace", index=False)
            final_path = target_sqlite_path

        # 4. JSON Files (.json)
        elif filename.endswith(".json"):
            df = pd.read_json(temp_path)
            table_name = os.path.splitext(file.filename)[0].replace(" ", "_").replace("-", "_").lower()
            df.to_sql(table_name, con=engine, if_exists="replace", index=False)
            final_path = target_sqlite_path

        # 5. Parquet Files (.parquet)
        elif filename.endswith(".parquet"):
            df = pd.read_parquet(temp_path)
            table_name = os.path.splitext(file.filename)[0].replace(" ", "_").replace("-", "_").lower()
            df.to_sql(table_name, con=engine, if_exists="replace", index=False)
            final_path = target_sqlite_path

        # 6. SQL Dumps (.sql)
        elif filename.endswith(".sql"):
            with open(temp_path, "r", encoding="utf-8") as f:
                sql_script = f.read()
            with engine.connect() as conn:
                for statement in sql_script.split(";"):
                    if statement.strip():
                        try:
                            conn.execute(text(statement))
                        except Exception:
                            pass
            final_path = target_sqlite_path

        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")

        # Track uploaded database path
        active_db_target["type"] = "file"
        active_db_target["path"] = final_path

        return {
            "success": True, 
            "filename": os.path.basename(final_path), 
            "db_path": final_path, 
            "type": "converted"
        }
    except Exception as e:
        print(f"Error uploading database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")

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