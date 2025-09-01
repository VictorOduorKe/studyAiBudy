from flask import Flask, Blueprint, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import os, requests, json, re
from mysql.connector import pooling, Error

# Load env variables
load_dotenv()

# Flask app
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

CORS(
    app,
    origins=["https://studyaibudy.netlify.app"],
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Connection pool
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="studyplan_pool",
        pool_size=5,
        pool_reset_session=True,
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )
except Error as e:
    print(f"❌ Failed to create connection pool: {e}")
    raise

def get_connection():
    try:
        return connection_pool.get_connection()
    except Error as e:
        print(f"❌ Error getting connection: {e}")
        return None

def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    conn = None
    cursor = None
    result = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("No database connection available")
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())
        if fetchone:
            result = cursor.fetchone()
        elif fetchall:
            result = cursor.fetchall()
        if commit:
            conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ DB query failed: {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
    return result

def get_username(user_id):
    try:
        result = execute_query(
            "SELECT name FROM users WHERE id = %s", params=(user_id,), fetchone=True
        )
        return result["name"] if result else None
    except Exception as e:
        print(f"❌ Failed to fetch username: {e}")
        return None

# Blueprint
study_bp = Blueprint("study", __name__)

@study_bp.route("/api/generate_plan", methods=["POST"])
def generate_plan():
    if "user_id" not in session:
        return jsonify({"error": "User not logged in"}), 401

    try:
        user_id = session["user_id"]
        username = get_username(user_id)
        data = request.get_json()
        subject = data.get("subject")
        level = data.get("level")

        if not subject or not level:
            return jsonify({"error": "Subject and level are required"}), 400

        # Get subject_id
        subject_row = execute_query(
            "SELECT id FROM subjects WHERE subject_name = %s AND education_level = %s AND user_id = %s",
            params=(subject, level, user_id),
            fetchone=True,
        )
        if not subject_row:
            return jsonify({"error": "Subject not found for this user"}), 404

        subject_id = subject_row["id"]

        # Check existing plan
        existing_plan = execute_query(
            "SELECT summary, roadmap, quiz_questions FROM study_plans WHERE subject_id = %s",
            params=(subject_id,),
            fetchone=True,
        )
        if existing_plan:
            existing_plan_id = execute_query(
                "SELECT id FROM study_plans WHERE subject_id = %s",
                params=(subject_id,),
                fetchone=True,
            )["id"]
            return jsonify({
                "id": existing_plan_id,
                "subject": subject,
                "level": level,
                "summary": existing_plan["summary"],
                "roadmap": json.loads(existing_plan["roadmap"]) if isinstance(existing_plan["roadmap"], str) else existing_plan["roadmap"],
                "quiz_questions": json.loads(existing_plan["quiz_questions"]) if isinstance(existing_plan["quiz_questions"], str) else existing_plan["quiz_questions"],
            })

        # AI Prompt
        prompt = f"""
        Create a study plan for '{subject}' at '{level}' level...
        """

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "topP": 0.9, "maxOutputTokens": 1200},
        }

        headers = {"Content-Type": "application/json"}

        response = requests.post(os.getenv("GEMINI_API_URL"), json=payload, headers=headers)
        if response.status_code != 200:
            return jsonify({"error": "Gemini API failed", "details": response.text}), response.status_code

        plan_data = json.loads(response.json()["candidates"][0]["content"]["parts"][0]["text"])
        summary = plan_data.get("summary", "")
        roadmap = plan_data.get("roadmap", [])
        quiz_questions = plan_data.get("quiz_questions", [])

        # Save plan
        execute_query(
            "INSERT INTO study_plans (subject_id, user_id, summary, roadmap, quiz_questions) VALUES (%s, %s, %s, %s, %s)",
            params=(subject_id, user_id, summary, json.dumps(roadmap), json.dumps(quiz_questions)),
            commit=True,
        )
        new_plan_id = execute_query("SELECT LAST_INSERT_ID() as id", fetchone=True)["id"]

        return jsonify({
            "id": new_plan_id,
            "subject": subject,
            "level": level,
            "summary": summary,
            "roadmap": roadmap,
            "quiz_questions": quiz_questions,
        })
    except Exception as e:
        print(f"❌ generate_plan failed: {e}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# Register blueprint
app.register_blueprint(study_bp)
