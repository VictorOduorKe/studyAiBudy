# subjects.py
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from db import get_connection
from datetime import datetime

subjects_bp = Blueprint("subjects", __name__)


def get_username(user_id):
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name FROM users WHERE id = %s", (user_id,))
        result = cursor.fetchone()
        cursor.close()
        return result["name"] if result else None
    except Exception as e:
        print("Error fetching username:", e)
        return None
    finally:
        if conn:
            conn.close()

# API to fetch all subjects
@subjects_bp.route("/subjects", methods=["GET"])
def get_subjects():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    username = get_username(user_id)

    conn = None
    cursor = None
    subjects = []
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # 🔽 Join with study_plans to get plan_id if exists
        query = """
        SELECT 
            s.id, 
            s.subject_name, 
            s.education_level, 
            s.updated_at,
            sp.id as plan_id
        FROM subjects s
        LEFT JOIN study_plans sp ON s.id = sp.subject_id
        WHERE s.user_id = %s
        ORDER BY s.updated_at DESC
        """
        cursor.execute(query, (user_id,))
        subjects = cursor.fetchall()

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return jsonify({
        "username": username,
        "subjects": subjects  # ✅ Now includes 'plan_id' (None if no plan)
    })


# API to add subject
@subjects_bp.route("/api/subjects", methods=["POST"])
def add_subject():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        subject_name = data.get("name", "").strip()
        education_level = data.get("level", "General").strip()
        user_id = session["user_id"]

        if not subject_name:
            return jsonify({"error": "Subject name required"}), 400

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Check if subject already exists
        cursor.execute(
            "SELECT id FROM subjects WHERE user_id=%s AND subject_name=%s",
            (user_id, subject_name)
        )
        existing = cursor.fetchone()
        if existing:
            return jsonify({"error": "Subject already exists"}), 400

        # Insert new subject
        cursor.execute(
            "INSERT INTO subjects (user_id, subject_name, education_level) VALUES (%s, %s, %s)",
            (user_id, subject_name, education_level)
        )
        conn.commit()
        return jsonify({"message": "Subject added successfully"}), 201

    except Exception as e:
        print("Add subject error:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# API to delete subject
@subjects_bp.route("/api/subjects/<int:subject_id>", methods=["DELETE"])
def delete_subject(subject_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = None
    cursor = None
    try:
        user_id = session["user_id"]
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM subjects WHERE id = %s AND user_id = %s",
            (subject_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Subject deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# API to edit subject
@subjects_bp.route("/api/subjects/<int:subject_id>", methods=["PUT"])
def edit_subject(subject_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = None
    cursor = None
    try:
        data = request.get_json()
        new_name = data.get("name")

        if not new_name:
            return jsonify({"error": "Name required"}), 400

        user_id = session["user_id"]
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE subjects SET subject_name=%s, last_studied=%s WHERE id=%s AND user_id=%s",
            (new_name, datetime.now(), subject_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Subject updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
