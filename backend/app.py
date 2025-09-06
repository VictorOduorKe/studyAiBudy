from flask import Flask, jsonify, session
from flask_cors import CORS  # ✅ Import directly
from dotenv import load_dotenv
import os
from flask_bcrypt import Bcrypt

from register import register_bp
from login import login_bp
from subjects import subjects_bp

# 🔁 Important: Import study_plan LAST if it uses db.execute_query
from study_plan import study_bp 

# 🔐 Load environment
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY")
bcrypt = Bcrypt(app)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = True        # HTTPS only
app.config["SESSION_COOKIE_SAMESITE"] = "None"    # Important for cross-site

# ✅ STEP 1: Initialize CORS FIRST — before any blueprints
CORS(app,
     origins=["https://studyaibudy.netlify.app"],  # 👈 Your frontend
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type"],
     supports_credentials=True,
     max_age=3600)

# ✅ STEP 2: Now import and register blueprints
# (Avoid circular imports by importing after CORS setup)

 # This should define /api/generate_plan

app.register_blueprint(register_bp)
app.register_blueprint(login_bp, url_prefix="/auth")
app.register_blueprint(subjects_bp)
app.register_blueprint(study_bp)

@app.route("/")
def home():
    return jsonify({"message": "Server running ✅"})

if __name__ == "__main__":
    print("🚀 Starting server on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)