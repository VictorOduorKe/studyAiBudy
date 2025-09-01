# db.py
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv
import os

# Load environment
load_dotenv()

# Read DB config
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DB_PORT = int(os.getenv("DB_PORT", 3306))

# Validate required vars
required = {"DB_HOST": DB_HOST, "DB_USER": DB_USER, "DB_PASSWORD": DB_PASSWORD, "DB_NAME": DB_NAME}
missing = [k for k, v in required.items() if not v]
if missing:
    raise RuntimeError(f"Missing .env vars: {', '.join(missing)}")

# DB config
DB_CONFIG = {
    "host": DB_HOST,
    "user": DB_USER,
    "password": DB_PASSWORD,
    "database": DB_NAME,
    "port": DB_PORT,
    "autocommit": False
}

# Connection pool
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="studyplan_pool",
        pool_size=5,
        pool_reset_session=True,
        **DB_CONFIG
    )
    print("✅ Database connection pool created successfully")
except mysql.connector.Error as e:
    raise RuntimeError(f"❌ Failed to create connection pool: {e}")


# ✅ MUST INCLUDE THESE FUNCTIONS

def get_connection():
    """Get a connection from the pool"""
    try:
        return connection_pool.get_connection()
    except mysql.connector.Error as e:
        print(f"❌ Failed to get connection: {e}")
        raise


def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    """
    Execute a query and return results.
    Use fetchone=True for one row, fetchall=True for list, commit=True for INSERT/UPDATE/DELETE
    """
    conn = None
    cursor = None
    result = None

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())

        if fetchone:
            result = cursor.fetchone()
        elif fetchall:
            result = cursor.fetchall()

        if commit:
            conn.commit()

    except mysql.connector.Error as e:
        if conn:
            conn.rollback()
        print(f"❌ Database error: {e}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return result