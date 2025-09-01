from flask import Blueprint, request, jsonify, session
from db import get_connection
import bcrypt

login_bp = Blueprint("login", __name__)

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
        return jsonify({"error":"Connection error try again later"})
    cursor = conn.cursor(dictionary=True)
      
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    # validate password
    if bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        # ✅ store session
        session["user_id"] = user["id"]
        session["username"] = user["name"]  # keep key consistent

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
    print("Session data:", dict(session))  # Debug: check session content
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized","redirectUrl":"../index.html"}), 401
    return jsonify({
        "id": session["user_id"],
        "username": session["username"]
    }), 200




# -----------------------------
# Logout
# -----------------------------
@login_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


