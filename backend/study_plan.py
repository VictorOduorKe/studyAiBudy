# study_bp.py
from flask import Blueprint, request, jsonify, session
from db import execute_query
import os
import requests
import json
import re

study_bp = Blueprint("study", __name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = f"{os.getenv('GEMINI_API_URL')}:generateContent?key={GEMINI_API_KEY}"

def get_username(user_id):
    result = execute_query("SELECT name FROM users WHERE id = %s", params=(user_id,), fetchone=True)
    return result["name"] if result else None


# -----------------------------
# Generate Study Plan
# -----------------------------
@study_bp.route("/api/generate_plan", methods=["POST"])
def generate_plan():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    data = request.get_json()
    subject = data.get("subject")
    level = data.get("level")

    if not subject or not level:
        return jsonify({"error": "Subject and level are required"}), 400

    try:
        # Get subject_id
        subject_row = execute_query(
            "SELECT id FROM subjects WHERE subject_name=%s AND education_level=%s AND user_id=%s",
            params=(subject, level, user_id),
            fetchone=True,
        )
        if not subject_row:
            return jsonify({"error": "Subject not found for this user"}), 404

        subject_id = subject_row["id"]

        # Check if plan exists
        existing_plan = execute_query(
            "SELECT id, summary, roadmap, quiz_questions FROM study_plans WHERE subject_id=%s",
            params=(subject_id,), fetchone=True
        )
        if existing_plan:
            return jsonify({
                "id": existing_plan["id"],
                "subject": subject,
                "level": level,
                "summary": existing_plan["summary"],
                "roadmap": json.loads(existing_plan["roadmap"]),
                "quiz_questions": json.loads(existing_plan["quiz_questions"])
            })

        # 🔥 Use original full prompt from first script
        prompt = f"""
        Create a comprehensive study plan for '{subject}' at '{level}' level.
        Include:
        1. A short summary.
        2. A 7-week roadmap: week, topicShortNotes, goal.
        3. 10 multiple-choice questions with 4 options and correct answer.

        Return only a valid JSON object:
        {{
          "summary": "...",
          "roadmap": [{{"week": "1", "topicShotNotes": "...", "goal": "..."}}],
          "quiz_questions": [{{"question": "...", "options": ["A","B","C","D"], "answer": "A"}}]
        }}
        Only raw JSON. No markdown.
        """

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.9,
                "maxOutputTokens": 1200
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"}
            ]
        }

        headers = {"Content-Type": "application/json"}
        response = requests.post(GEMINI_API_URL, json=payload, headers=headers, timeout=20)
        if response.status_code != 200:
            return jsonify({"error": "Gemini API failed", "details": response.text}), 502

        raw_text = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text","")
        cleaned_text = re.sub(r"^```(?:json)?\s*|```$", "", raw_text.strip())
        plan_data = json.loads(cleaned_text)

        summary = plan_data.get("summary","")
        roadmap = plan_data.get("roadmap",[])
        quiz_questions = plan_data.get("quiz_questions",[])

        # Save to DB
        execute_query(
            "INSERT INTO study_plans (subject_id,user_id,summary,roadmap,quiz_questions) VALUES (%s,%s,%s,%s,%s)",
            params=(subject_id,user_id,summary,json.dumps(roadmap),json.dumps(quiz_questions)),
            commit=True
        )
        new_plan_id = execute_query("SELECT LAST_INSERT_ID() as id", fetchone=True)["id"]

        return jsonify({
            "id": new_plan_id,
            "subject": subject,
            "level": level,
            "summary": summary,
            "roadmap": roadmap,
            "quiz_questions": quiz_questions
        })

    except Exception as e:
        print(f"Error generating plan: {e}")
        return jsonify({"error":"Server error","details":str(e)}), 500



# -----------------------------
# Get Saved Plan by ID
# -----------------------------
@study_bp.route("/api/plan/<int:plan_id>", methods=["GET"])
def get_saved_plan(plan_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    try:
        query = """
        SELECT sp.id, sp.summary, sp.roadmap, sp.quiz_questions,
               s.subject_name, s.education_level
        FROM study_plans sp
        JOIN subjects s ON sp.subject_id = s.id
        WHERE sp.id=%s AND s.user_id=%s
        """
        plan_data = execute_query(query, params=(plan_id,user_id), fetchone=True)
        if not plan_data:
            return jsonify({"error": "Plan not found or access denied"}), 404

        return jsonify({
            "id": plan_data["id"],
            "subject": plan_data["subject_name"],
            "level": plan_data["education_level"],
            "summary": plan_data["summary"],
            "roadmap": json.loads(plan_data["roadmap"]),
            "quiz_questions": json.loads(plan_data["quiz_questions"])
        })
    except Exception as e:
        print(f"Error fetching plan: {e}")
        return jsonify({"error":"Server error","details":str(e)}), 500


# -----------------------------
# Get Quiz Result
# -----------------------------
@study_bp.route("/api/quiz/result/<int:plan_id>", methods=["GET"])
def get_quiz_result(plan_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    try:
        result = execute_query(
            "SELECT id FROM quiz_attempts WHERE user_id=%s AND plan_id=%s",
            params=(user_id, plan_id),
            fetchone=True
        )
        return jsonify({"attempted": bool(result)})
    except Exception as e:
        print(f"Error checking quiz result: {e}")
        return jsonify({"error":"Server error","details":str(e)}), 500


# -----------------------------
# Submit Quiz
# -----------------------------
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

    if not all([plan_id, answers is not None, score is not None, total]):
        return jsonify({"error":"Missing required fields"}), 400

    try:
        existing = execute_query(
            "SELECT id FROM quiz_attempts WHERE user_id=%s AND plan_id=%s",
            params=(user_id, plan_id),
            fetchone=True
        )
        if existing:
            return jsonify({"error":"Quiz already submitted","status":"duplicate"}), 409

        execute_query(
            """
            INSERT INTO quiz_attempts (user_id, plan_id, answers, score, total_questions)
            VALUES (%s,%s,%s,%s,%s)
            """,
            params=(user_id, plan_id, json.dumps(answers), score, total),
            commit=True
        )

        return jsonify({"message":"Quiz submitted successfully","score":score,"total":total})
    except Exception as e:
        print(f"Error submitting quiz: {e}")
        return jsonify({"error":"Failed to save quiz results","details":str(e)}), 500
