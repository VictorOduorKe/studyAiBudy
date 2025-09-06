from flask import Blueprint, request, jsonify, session
from db import get_connection
from flask_bcrypt import Bcrypt
from datetime import datetime

login_bp = Blueprint("login", __name__)
bcrypt = Bcrypt()  # ✅ Create instance here

# -----------------------------
# Login route
# -----------------------------
@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or "email" not in data or "password" not in data:
        return jsonify({"error": "Email and password are required"}), 400

    email = data["email"]
    password = data["password"]

    conn = get_connection()
    if not conn:
        return jsonify({"error":"Connection error. Try again later"}), 500

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    # ✅ validate password using Flask-Bcrypt
    if bcrypt.check_password_hash(user["password"], password):
        # store session
        session["user_id"] = user["id"]
        session["username"] = user["name"]

        return jsonify({
            "message": "Login successful",
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
        }), 200
    else:
        return jsonify({"error": "Invalid email or password"}), 401


# -----------------------------
# Get current user
# -----------------------------
@login_bp.route("/api/user", methods=["GET"])
def get_current_user():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized", "redirectUrl": "../index.html"}), 401

    user_id = session["user_id"]
    current_timestamp = datetime.now()

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Update last_login for the current user
        cursor.execute(
            "UPDATE users SET last_login = %s WHERE id = %s",
            (current_timestamp, user_id)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({
        "id": user_id,
        "username": session["username"]
    }), 200


# -----------------------------
# Logout
# -----------------------------
@login_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200
