import os 
import sqlite3 
import json
from dotenv import load_dotenv 

from langchain_classic.chains import create_sql_query_chain
from langchain_community.utilities import SQLDatabase
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI 

from app.security import SecurityException, validate_sql_security

load_dotenv()

DEFAULT_DB_PATH = "company.db" 

# Initialize Gemini LLM using Gemini 3.6 Flash
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash", 
    google_api_key=api_key,
    temperature=0
) if api_key else None 

# Correction prompt used when SQLite execution fails
CORRECTION_PROMPT = PromptTemplate.from_template(
    """You generated an invalid SQL query for SQLite that resulted in an execution error.

    Original User Question: {question}
    Failed SQL Query: {failed_sql}
    SQLite Error Message: {error_message}

    Please inspect the error and regenerate a corrected SQL query that matches the actual database schema. 
    Return ONLY the raw SQL query with no markdown formatting or commentary.""" 
)

# Educational explanation prompt for non-technical users
EXPLANATION_PROMPT = PromptTemplate.from_template(
    """You are a helpful database teacher. Explain this SQL query in 1-2 simple sentences for a non-technical user.
    Also generate 3 useful follow-up natural language questions they could ask about this database.

    User Question: {question}
    Generated SQL: {sql_query}
    Database Schema Context: {schema}

    Return JSON strictly in this format:
    {{
        "explanation": "Simple clear explanation here...",
        "suggested_queries": ["Question 1?", "Question 2?", "Question 3?"]
    }}"""
)

def run_natural_language_query(
    user_question: str, 
    db_path: str = DEFAULT_DB_PATH, 
    dialect: str = "SQLite",  # Added dialect default to match main.py calls
    max_retries: int = 2
):
    """
    Generates, validates, and executes a SQL query against a dynamic SQLite database.
    Includes AST security validation, auto-correction loop, and educational explanations.
    """
    last_error = None
    cleaned_sql = ""
    attempts = 0 

    # 1. Check DB Connection
    try:
        db = SQLDatabase.from_uri(f"sqlite:///{db_path}") 
    except Exception as db_init_error:
        return {
            "success": False,
            "error": f"Failed to initialize database schema at '{db_path}': {str(db_init_error)}" 
        }

    # 2. Handle missing LLM key with a smart schema-aware fallback
    if not llm:
        return handle_fallback_query(user_question, db_path)

    chain = create_sql_query_chain(llm, db)

    while attempts <= max_retries:
        try:
            # Generate SQL
            if attempts == 0:
                generated_sql = chain.invoke({"question": user_question})
            else:
                correction_chain = CORRECTION_PROMPT | llm
                response = correction_chain.invoke(
                    {
                        "question": user_question,
                        "failed_sql": cleaned_sql,
                        "error_message": last_error,
                    }
                )
                generated_sql = response.content

            # Clean markdown code block formatting
            cleaned_sql = (
                generated_sql.replace("```sql", "")
                .replace("```", "")
                .strip()
            )

            # Security AST Check
            validate_sql_security(cleaned_sql)

            # Attempt SQLite Execution
            conn = sqlite3.connect(db_path) 
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(cleaned_sql)
            rows = cursor.fetchall()
            result = [dict(row) for row in rows]
            conn.close()

            # Generate Teacher Explanation & Follow-up Suggestions
            explanation_data = generate_teacher_explanation(user_question, cleaned_sql, db.get_table_info())

            # Return normalized dictionary matching frontend expectations
            return {
                "success": True,
                "generated_sql": cleaned_sql,
                "data": result,
                "results": result,
                "explanation": explanation_data.get("explanation", "Successfully executed query."),
                "suggested_queries": explanation_data.get("suggested_queries", []),
                "attempts_needed": attempts + 1,
            }

        except SecurityException as se:
            return {"success": False, "error": str(se)}

        except sqlite3.Error as db_error:
            last_error = str(db_error)
            attempts += 1
            if attempts > max_retries:
                return {
                    "success": False,
                    "error": f"Failed after {max_retries} auto-correction retries. Last error: {last_error}",
                }

        except Exception as e:
            return {"success": False, "error": str(e)}


def generate_teacher_explanation(question: str, sql_query: str, schema: str) -> dict:
    """Generates simple explanations and follow-up prompts for non-techies."""
    if not llm:
        return {
            "explanation": f"Translated '{question}' into SQL to query your dataset.",
            "suggested_queries": ["Show top 5 rows", "Count total records", "Show column names"]
        }
    
    try:
        chain = EXPLANATION_PROMPT | llm
        res = chain.invoke({"question": question, "sql_query": sql_query, "schema": schema})
        clean_res = res.content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_res)
    except Exception:
        return {
            "explanation": f"Translated '{question}' into a standard SQL query.",
            "suggested_queries": ["Show top 5 rows", "Count total items", "Select distinct values"]
        }


def handle_fallback_query(question: str, db_path: str) -> dict:
    """Fallback runner when GEMINI_API_KEY is not configured in .env."""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        table_name = tables[0][0] if tables else "data"

        sql_query = f"SELECT * FROM {table_name} LIMIT 10;"
        cursor.execute(sql_query)
        result = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return {
            "success": True,
            "generated_sql": sql_query,
            "data": result,
            "results": result,
            "explanation": f"API key missing. Defaulting to fetching the first 10 rows from table '{table_name}'.",
            "suggested_queries": [
                f"SELECT * FROM {table_name} LIMIT 5;",
                f"SELECT COUNT(*) FROM {table_name};"
            ]
        }
    except Exception as e:
        return {"success": False, "error": f"Fallback execution failed: {str(e)}"}  
