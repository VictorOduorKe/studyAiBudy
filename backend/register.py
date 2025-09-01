from flask import Blueprint, request, jsonify
from extensions import bcrypt
from db import execute_query
import re

register_bp = Blueprint("register", __name__)

# 🔧 Validation Helpers
def is_valid_email(email):
    if not email:
        return False
    # Basic email regex
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

def is_strong_password(password):
    if not password:
        return False
    # At least 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
    if len(password) < 8:
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

def is_valid_name(name):
    if not name or len(name.strip()) == 0:
        return False
    if len(name.strip()) < 2 or len(name.strip()) > 100:
        return False
    # Allow letters, spaces, hyphens, apostrophes
    name_regex = r"^[a-zA-Z\s\-']+$"
    return re.match(name_regex, name.strip()) is not None


@register_bp.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()

        # 🧾 Extract fields
        username = data.get("fullname")
        email = data.get("email")
        password = data.get("password")

        # -------------------------------------
        # 🔎 Step 1: Validate All Inputs
        # -------------------------------------

        errors = []

        if not username:
            errors.append("Full name is required")
        elif not is_valid_name(username):
            errors.append("Name must be 2–100 characters and contain only letters, spaces, hyphens, or apostrophes")

        if not email:
            errors.append("Email is required")
        elif not is_valid_email(email):
            errors.append("Invalid email format")

        if not password:
            errors.append("Password is required")
        elif not is_strong_password(password):
            errors.append(
                "Password must be at least 8 characters long and include: "
                "1 uppercase, 1 lowercase, 1 digit, and 1 special character (!@#$%^&* etc.)"
            )

        # Return all errors at once
        if errors:
            return jsonify({"error": "Validation failed", "details": errors}), 400

        # -------------------------------------
        # 🔍 Step 2: Check if email already exists
        # -------------------------------------
        existing_user = execute_query(
            "SELECT id FROM users WHERE email = %s",
            (email,),
            fetchone=True
        )
        if existing_user:
            return jsonify({"error": "Email already registered"}), 409

        # -------------------------------------
        # 🔐 Step 3: Hash password and save
        # -------------------------------------
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

        result = execute_query(
            "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
            (username.strip(), email.lower(), hashed_password),
            commit=True
        )

        # ✅ Success
        return jsonify({
            "message": "User registered successfully ✅",
            "user": {"name": username.strip(), "email": email.lower()}
        }), 201

    except Exception as e:
        # Log the error server-side (optional)
        print(f"Unexpected error during signup: {e}")
        return jsonify({"error": "Internal server error. Please try again later."}), 500