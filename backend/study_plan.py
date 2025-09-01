# app.py
from flask import Flask, Blueprint, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import json
import re

# 🔽 Import DB functions
from mysql.connector import pooling

# 🔐 Load environment variables
load_dotenv()

# 🔧 Secret key
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

# ✅ Enable CORS for your frontend
CORS(
    app,
    origins=["http://127.0.0.1:5500"],
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# 🔁 Connection pool
connection_pool = pooling.MySQLConnectionPool(
    pool_name="studyplan_pool", pool_size=5, pool_reset_session=True
)


def get_connection():
    return connection_pool.get_connection()


def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    result = None
    try:
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
        raise e
    finally:
        cursor.close()
        conn.close()
    return result


def get_username(user_id):
    result = execute_query(
        "SELECT name FROM users WHERE id = %s", params=(user_id,), fetchone=True
    )
    return result["name"] if result else None


# 🔥 Gemini API Setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in .env file")

# ✅ FIX: Remove extra spaces in URL
GEMINI_API_URL = f"{os.getenv('GEMINI_API_URL')}:generateContent?key={GEMINI_API_KEY}"

# ✅ Create Blueprint ONCE
study_bp = Blueprint("study", __name__)


# --------------------------------------------------
# ✅ Route 1: Generate Study Plan
# --------------------------------------------------
@study_bp.route("/api/generate_plan", methods=["POST"])
def generate_plan():
    if "user_id" not in session:
        return jsonify({"error": "User not logged in"}), 401

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
        return jsonify({f"error": "Subject not found for this user"}), 404

    subject_id = subject_row["id"]

    # Check if plan already exists
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
        return jsonify(
            {
                "id": existing_plan_id,
                "subject": subject,
                "level": level,
                "summary": existing_plan["summary"],
                "roadmap": (
                    json.loads(existing_plan["roadmap"])
                    if isinstance(existing_plan["roadmap"], str)
                    else existing_plan["roadmap"]
                ),
                "quiz_questions": (
                    json.loads(existing_plan["quiz_questions"])
                    if isinstance(existing_plan["quiz_questions"], str)
                    else existing_plan["quiz_questions"]
                ),
            }
        )

    # AI Prompt
    prompt = f"""
    Create a comprehensive study plan for '{subject}' at '{level}' level.
    Include:
    1. A short summary.
    2. A 7-week roadmap: week, topic, goal.
    3. 10 multiple-choice questions with 4 options and correct answer.

    Return only a valid JSON object:
    {{
      "summary": "...",
      "roadmap": [{{"week": "1", "topic": "...", "goal": "..."}}],
      "quiz_questions": [{{"question": "...", "options": ["A","B","C","D"], "answer": "A"}}]
    }}
    Only raw JSON. No markdown.
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "topP": 0.9, "maxOutputTokens": 1200},
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_ONLY_HIGH",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_ONLY_HIGH",
            },
        ],
    }

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(GEMINI_API_URL, json=payload, headers=headers)
        if response.status_code != 200:
            return (
                jsonify({"error": "Gemini API failed", "details": response.text}),
                response.status_code,
            )

        raw_text = response.json()["candidates"][0]["content"]["parts"][0][
            "text"
        ].strip()
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        cleaned_text = re.sub(r"```$\s*", "", cleaned_text)
        cleaned_text = cleaned_text.strip()

        plan_data = json.loads(cleaned_text)

        summary = plan_data.get("summary", "")
        roadmap = plan_data.get("roadmap", [])
        quiz_questions = plan_data.get("quiz_questions", [])

        # Save to DB
        execute_query(
            "INSERT INTO study_plans (subject_id, user_id, summary, roadmap, quiz_questions) VALUES (%s, %s, %s, %s, %s)",
            params=(
                subject_id,
                user_id,
                summary,
                json.dumps(roadmap),
                json.dumps(quiz_questions),
            ),
            commit=True,
        )
        new_plan_id = execute_query("SELECT LAST_INSERT_ID() as id", fetchone=True)[
            "id"
        ]

        return jsonify(
            {
                "id": new_plan_id,
                "subject": subject,
                "level": level,
                "summary": summary,
                "roadmap": roadmap,
                "quiz_questions": quiz_questions,
            }
        )

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500


# --------------------------------------------------
# ✅ Route 2: Get Saved Plan by ID
# --------------------------------------------------
@study_bp.route("/api/plan/<int:plan_id>", methods=["GET"])
def get_saved_plan(plan_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    query = """
    SELECT 
        sp.id, sp.summary, sp.roadmap, sp.quiz_questions,
        s.subject_name, s.education_level
    FROM study_plans sp
    JOIN subjects s ON sp.subject_id = s.id
    WHERE sp.id = %s AND s.user_id = %s
    """
    plan_data = execute_query(query, params=(plan_id, user_id), fetchone=True)

    if not plan_data:
        return jsonify({"error": "Plan not found or access denied"}), 404

    return jsonify(
        {
            "id": plan_data["id"],
            "subject": plan_data["subject_name"],
            "level": plan_data["education_level"],
            "summary": plan_data["summary"],
            "roadmap": (
                json.loads(plan_data["roadmap"])
                if isinstance(plan_data["roadmap"], str)
                else plan_data["roadmap"]
            ),
            "quiz_questions": (
                json.loads(plan_data["quiz_questions"])
                if isinstance(plan_data["quiz_questions"], str)
                else plan_data["quiz_questions"]
            ),
        }
    )


@study_bp.route("/api/quiz/result/<int:plan_id>", methods=["GET"])
def get_quiz_result(plan_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    result = execute_query(
        "SELECT id FROM quiz_attempts WHERE user_id = %s AND plan_id = %s",
        params=(session["user_id"], plan_id),
        fetchone=True,
    )
    return (
        jsonify({"attempted": bool(result)})
        if result
        else jsonify({"attempted": False})
    )


# --------------------------------------------------
# ✅ Route 3: Submit Quiz (Prevent Duplicates)
# --------------------------------------------------
@study_bp.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    data = request.get_json()

    plan_id = data.get("plan_id")
    answers = data.get("answers")
    score = data.get("score")
    total = data.get("total_questions") or data.get("total")

    if not all([plan_id, answers, score is not None, total]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        # 🔍 Check if already submitted
        existing = execute_query(
            "SELECT id FROM quiz_attempts WHERE user_id = %s AND plan_id = %s",
            params=(user_id, plan_id),
            fetchone=True,
        )

        if existing:
            return (
                jsonify(
                    {
                        "error": "Quiz already submitted",
                        "message": "You have already completed this quiz.",
                        "status": "duplicate",
                    }
                ),
                409,
            )  # 409 Conflict

        # ✅ Insert new attempt
        execute_query(
            """
            INSERT INTO quiz_attempts (user_id, plan_id, answers, score, total_questions)
            VALUES (%s, %s, %s, %s, %s)
            """,
            params=(user_id, plan_id, json.dumps(answers), score, total),
            commit=True,
        )

        return (
            jsonify(
                {
                    "message": "Quiz submitted successfully!",
                    "score": score,
                    "total": total,
                }
            ),
            200,
        )

    except Exception as e:
        print("Error saving quiz:", str(e))
        return jsonify({"error": "Failed to save quiz results"}), 500


# ✅ Register Blueprint
app.register_blueprint(study_bp)


# 🏠 Home route
@app.route("/")
def index():
    return """
    <html>
    <head><title>📚 Study Plan Generator</title></head>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>📘 Study Plan Generator (MySQL + Gemini)</h2>
        <p><strong>Send a POST request to:</strong> <code>/api/generate_plan</code></p>
        <pre>{
  "subject": "Math",
  "level": "High School"
}</pre>
    </body>
    </html>
    """


# ✅ Run the app
if __name__ == "__main__":
    print("🚀 Starting Study Plan Generator on http://localhost:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
