import os
import json
import re
import google.generativeai as genai
from flask import Blueprint, request, jsonify
from db import execute_query

plan_bp = Blueprint("plan", __name__)

# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


def clean_json_output(raw_text: str) -> str:
    """Clean Gemini output to try to extract valid JSON."""
    # Remove code fences like ```json ... ```
    cleaned = re.sub(r"```.*?```", "", raw_text, flags=re.S)

    # Keep only content between first { and last }
    if "{" in cleaned and "}" in cleaned:
        cleaned = cleaned[cleaned.find("{"): cleaned.rfind("}") + 1]

    # Remove trailing commas before ] or }
    cleaned = re.sub(r",(\s*[\]}])", r"\1", cleaned)

    return cleaned.strip()


def try_parse_json(raw_text: str):
    """Try cleaning & parsing JSON safely."""
    try:
        return json.loads(clean_json_output(raw_text))
    except Exception:
        return None


def generate_plan(subject, level, user_id, subject_id):
    prompt = f"""
Create a comprehensive study plan for '{subject}' at '{level}' level.
Include:

1. A concise but clear summary (3–5 sentences).
2. A 7-week roadmap where each week has:
   - "week": the week number
   - "topicShortNotes": 3–5 short bullet points
   - "goal": a measurable learning outcome
3. 10 multiple-choice questions with 4 options (A, B, C, D) and the correct answer.

Return ONLY a valid JSON object. No markdown, no explanation.
"""

    # First attempt
    response = model.generate_content(prompt)
    parsed = try_parse_json(response.text)

    # Retry if parsing failed
    if not parsed:
        retry_prompt = prompt + "\nIMPORTANT: Output ONLY raw valid JSON, no text or explanation."
        retry_response = model.generate_content(retry_prompt)
        parsed = try_parse_json(retry_response.text)

    if not parsed:
        # Final fallback: return raw output for debugging
        return {
            "error": "Invalid JSON from Gemini",
            "raw_output": response.text[:500]  # truncate long junk
        }

    summary = parsed.get("summary", "")
    roadmap = parsed.get("roadmap", [])
    quiz_questions = parsed.get("quiz_questions", [])

    # Save to DB
    try:
        execute_query(
            """
            INSERT INTO study_plans (subject_id, user_id, summary, roadmap, quiz_questions)
            VALUES (%s, %s, %s, %s, %s)
            """,
            params=(subject_id, user_id, summary, json.dumps(roadmap), json.dumps(quiz_questions)),
            commit=True,
        )
    except Exception as e:
        return {"error": f"Database insert failed: {str(e)}"}

    return {"summary": summary, "roadmap": roadmap, "quiz_questions": quiz_questions}


@plan_bp.route("/api/generate_plan", methods=["POST"])
def create_plan():
    try:
        data = request.json
        subject = data.get("subject")
        level = data.get("level")
        user_id = data.get("user_id")
        subject_id = data.get("subject_id")

        if not all([subject, level, user_id, subject_id]):
            return jsonify({"error": "Missing required fields"}), 400

        result = generate_plan(subject, level, user_id, subject_id)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500
