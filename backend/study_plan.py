from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
import json
import re
from datetime import datetime
from connection import execute_query

app = Flask(__name__)
CORS(app)

# Load Gemini API key
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ----------- Helper: Extract and fix JSON ----------------
def extract_json(text):
    """
    Extract the first JSON object from the text and try to repair minor issues.
    """
    # Grab text between first { and last }
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model response")
    
    json_str = match.group(0)

    # Common cleanup: remove trailing commas
    json_str = re.sub(r",\s*([}\]])", r"\1", json_str)

    return json_str


# ----------- Route: Generate study plan ----------------
@app.route('/api/generate_plan', methods=['POST'])
def generate_plan():
    data = request.get_json()
    subject = data.get("subject")
    level = data.get("level")
    subject_id = data.get("subject_id")
    user_id = data.get("user_id")

    if not subject or not level:
        return jsonify({"error": "Missing subject or level"}), 400

    # The prompt
    prompt = f"""
Create a comprehensive study plan for '{subject}' at '{level}' level.
Include:

1. A concise but clear summary (3–5 sentences).
2. A 7-week roadmap where each week has:
   - "week": the week number
   - "topicShortNotes": 3–5 short bullet points (as a JSON array of strings, not just one line)
   - "goal": a measurable learning outcome
3. 10 multiple-choice questions with 4 options (A, B, C, D) and the correct answer.

Return only a valid JSON object in this format:
{{
  "summary": "...",
  "roadmap": [
    {{
      "week": "1",
      "topicShortNotes": ["point1", "point2", "point3"],
      "goal": "..."
    }}
  ],
  "quiz_questions": [
    {{
      "question": "...",
      "options": ["A","B","C","D"],
      "answer": "A"
    }}
  ]
}}
Only raw JSON. No markdown, no explanations, no code fences.
"""

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        raw_text = response.text

        # Try to extract and fix JSON
        try:
            cleaned = extract_json(raw_text)
            result = json.loads(cleaned)
        except Exception as e:
            return jsonify({"error": "Invalid JSON from Gemini", "raw": raw_text, "details": str(e)}), 500

        summary = result.get("summary", "")
        roadmap = result.get("roadmap", [])
        quiz_questions = result.get("quiz_questions", [])

        # Save to DB
        execute_query(
            "INSERT INTO study_plans (subject_id, user_id, summary, roadmap, quiz_questions) VALUES (%s, %s, %s, %s, %s)",
            params=(subject_id, user_id, summary, json.dumps(roadmap), json.dumps(quiz_questions)),
            commit=True
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ----------- Route: Get saved plan ----------------
@app.route('/api/plan/<int:plan_id>', methods=['GET'])
def get_saved_plan(plan_id):
    try:
        rows = execute_query("SELECT * FROM study_plans WHERE id=%s", params=(plan_id,))
        if not rows:
            return jsonify({"error": "Plan not found"}), 404

        plan = rows[0]

        return jsonify({
            "id": plan["id"],
            "subject_id": plan["subject_id"],
            "user_id": plan["user_id"],
            "summary": plan["summary"],
            "roadmap": json.loads(plan["roadmap"]),
            "quiz_questions": json.loads(plan["quiz_questions"]),
            "created_at": plan["created_at"].isoformat() if isinstance(plan["created_at"], datetime) else str(plan["created_at"])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
