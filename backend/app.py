import os
import re
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import database
from models import sanitize_user, format_skill, format_request, format_message, format_notification

app = Flask(__name__)
# Enable CORS for all API routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Uploads directory
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_DIR
ALLOWED_VIDEO_EXTS = {".mp4", ".webm", ".mov", ".ogg", ".avi"}
ALLOWED_CERT_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

# Initialize database tables on startup
database.init_db()

EMAIL_REGEX = r"^[^@]+@[^@]+\.[^@]+$"

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"success": False, "message": str(e.description if hasattr(e, "description") else "Bad request")}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "message": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"success": False, "message": "Internal server error. Please try again."}), 500

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "name": "Talent Exchange REST API",
        "version": "1.1.0",
        "status": "online",
        "tagline": "Learn. Teach. Connect."
    })

@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file part in request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "message": "No selected file"}), 400

    orig_name = secure_filename(file.filename)
    _, ext = os.path.splitext(orig_name.lower())

    is_video = ext in ALLOWED_VIDEO_EXTS
    is_cert = ext in ALLOWED_CERT_EXTS

    if not is_video and not is_cert:
        return jsonify({
            "success": False,
            "message": f"Unsupported file extension '{ext}'. Allowed: MP4, WebM, PDF, JPG, PNG, WEBP"
        }), 400

    file_category = "video" if is_video else "certificate"
    saved_filename = f"{uuid.uuid4().hex[:12]}_{orig_name}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    file.save(file_path)

    relative_url = f"uploads/{saved_filename}"

    return jsonify({
        "success": True,
        "message": f"{file_category.capitalize()} uploaded successfully",
        "url": relative_url,
        "filename": saved_filename,
        "type": file_category
    }), 201

# -------------------------------------------------------------
# AUTHENTICATION
# -------------------------------------------------------------

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    department = data.get("department", "").strip()
    semester = data.get("semester", "").strip()
    teach_skill = data.get("teach_skill", "").strip()
    learn_skill = data.get("learn_skill", "").strip()
    bio = data.get("bio", "").strip()
    profile_image = data.get("profile_image", "").strip()
    certificate_url = data.get("certificate_url", "").strip()
    certificate_title = data.get("certificate_title", "").strip()
    video_url = data.get("video_url", "").strip()

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400

    if not re.match(EMAIL_REGEX, email):
        return jsonify({"success": False, "message": "Please provide a valid email address"}), 400

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters"}), 400

    # Duplicate check
    existing = database.execute_query("SELECT id FROM users WHERE email = ?", (email,), fetchone=True)
    if existing and existing["result"]:
        return jsonify({"success": False, "message": "An account with this email already exists"}), 400

    password_hash = generate_password_hash(password)
    if not profile_image:
        profile_image = "assets/avatar-default.svg"

    verification_status = "pending" if certificate_url else "unverified"
    is_verified = 0

    insert_res = database.execute_query(
        """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, certificate_url, verification_status, is_verified)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, email, password_hash, department, semester, bio, profile_image, certificate_url, verification_status, is_verified),
        commit=True
    )
    user_id = insert_res["lastrowid"]
    if not user_id:
        user_row = database.execute_query("SELECT id FROM users WHERE email = ?", (email,), fetchone=True)
        user_id = user_row["result"]["id"]

    # Save initial skill if provided
    if teach_skill or learn_skill or video_url or certificate_url:
        database.execute_query(
            """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, teach_skill or "General Knowledge", "General", "Intermediate", learn_skill,
             f"Can teach {teach_skill}. Wants to learn {learn_skill}.",
             video_url, certificate_url, certificate_title, verification_status, is_verified),
            commit=True
        )

    new_user = database.execute_query("SELECT * FROM users WHERE id = ?", (user_id,), fetchone=True)
    sanitized = sanitize_user(new_user["result"])
    sanitized["teach_skill"] = teach_skill
    sanitized["learn_skill"] = learn_skill
    sanitized["video_url"] = video_url
    sanitized["certificate_url"] = certificate_url
    sanitized["certificate_title"] = certificate_title

    return jsonify({
        "success": True,
        "message": "Account created successfully! Welcome to Talent Exchange.",
        "data": sanitized
    }), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    user_res = database.execute_query("SELECT * FROM users WHERE email = ?", (email,), fetchone=True)
    if not user_res or not user_res["result"]:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    user_data = user_res["result"]
    if not check_password_hash(user_data["password_hash"], password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    user_id = user_data["id"]
    skill_res = database.execute_query("SELECT * FROM skills WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,), fetchone=True)
    
    sanitized = sanitize_user(user_data)
    if skill_res and skill_res["result"]:
        sk = skill_res["result"]
        sanitized["teach_skill"] = sk["skill_name"]
        sanitized["learn_skill"] = sk["learning_skill"]
        sanitized["skill_level"] = sk["skill_level"]
        sanitized["skill_category"] = sk["skill_category"]
        sanitized["video_url"] = sk.get("video_url") or ""
        sanitized["certificate_url"] = sk.get("certificate_url") or sanitized.get("certificate_url", "")
        sanitized["certificate_title"] = sk.get("certificate_title") or ""
        sanitized["verification_status"] = sk.get("verification_status") or sanitized.get("verification_status", "unverified")
        sanitized["is_verified"] = bool(sk.get("is_verified", False) or sanitized.get("is_verified", False))
    else:
        sanitized["teach_skill"] = ""
        sanitized["learn_skill"] = ""
        sanitized["video_url"] = ""
        sanitized["certificate_title"] = ""

    return jsonify({
        "success": True,
        "message": "Login successful! Welcome back.",
        "data": sanitized
    }), 200

@app.route("/api/logout", methods=["POST"])
def logout():
    return jsonify({"success": True, "message": "Logged out successfully"}), 200

# -------------------------------------------------------------
# CERTIFICATE VERIFICATION ENDPOINT
# -------------------------------------------------------------

@app.route("/api/verify-certificate", methods=["POST"])
def verify_certificate():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    certificate_url = data.get("certificate_url", "").strip()
    certificate_title = data.get("certificate_title", "").strip()
    status = data.get("status", "verified").strip().lower()

    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400

    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid user_id"}), 400

    user_check = database.execute_query("SELECT * FROM users WHERE id = ?", (user_id,), fetchone=True)
    if not user_check or not user_check["result"]:
        return jsonify({"success": False, "message": "User not found"}), 404

    is_verified_val = 1 if status == "verified" else 0

    database.execute_query(
        """UPDATE users 
           SET certificate_url = COALESCE(NULLIF(?, ''), certificate_url),
               verification_status = ?,
               is_verified = ?
           WHERE id = ?""",
        (certificate_url, status, is_verified_val, user_id),
        commit=True
    )

    database.execute_query(
        """UPDATE skills 
           SET certificate_url = COALESCE(NULLIF(?, ''), certificate_url),
               certificate_title = COALESCE(NULLIF(?, ''), certificate_title),
               verification_status = ?,
               is_verified = ?
           WHERE user_id = ?""",
        (certificate_url, certificate_title, status, is_verified_val, user_id),
        commit=True
    )

    status_msg = "Your skill certificate has been successfully verified! 🛡️ You now display the Verified Mentor badge." if status == "verified" else "Your skill certificate is pending review."
    database.execute_query(
        "INSERT INTO notifications (user_id, type, message) VALUES (?, 'certificate_verification', ?)",
        (user_id, status_msg),
        commit=True
    )

    updated_u = database.execute_query("SELECT * FROM users WHERE id = ?", (user_id,), fetchone=True)
    sanitized = sanitize_user(updated_u["result"])
    sanitized["certificate_title"] = certificate_title
    sanitized["is_verified"] = bool(is_verified_val)

    return jsonify({
        "success": True,
        "message": "Certificate status updated successfully",
        "data": sanitized
    }), 200

# -------------------------------------------------------------
# USERS & PROFILES
# -------------------------------------------------------------

@app.route("/api/users", methods=["GET"])
def get_users():
    q = request.args.get("q", "").strip()
    skill_filter = request.args.get("skill", "").strip()
    department = request.args.get("department", "").strip()
    semester = request.args.get("semester", "").strip()
    exclude_user_id = request.args.get("exclude_user_id", "")
    only_verified = request.args.get("only_verified", "").lower() in ["true", "1", "yes"]

    query = """
        SELECT u.id, u.name, u.email, u.department, u.semester, u.bio, u.profile_image, u.role, u.created_at,
               u.certificate_url as user_cert_url, u.verification_status as user_ver_status, u.is_verified as user_is_verified,
               s.skill_name as teach_skill, s.learning_skill as learn_skill, s.skill_category, s.skill_level,
               s.video_url, s.certificate_url as skill_cert_url, s.certificate_title,
               s.verification_status as skill_ver_status, s.is_verified as skill_is_verified
        FROM users u
        LEFT JOIN (
            SELECT user_id, skill_name, learning_skill, skill_category, skill_level,
                   video_url, certificate_url, certificate_title, verification_status, is_verified,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id DESC) as rn
            FROM skills
        ) s ON u.id = s.user_id AND s.rn = 1
        WHERE 1=1
    """
    params = []

    if exclude_user_id and exclude_user_id.isdigit():
        query += " AND u.id != ?"
        params.append(int(exclude_user_id))

    if only_verified:
        query += " AND (u.is_verified = 1 OR s.is_verified = 1)"

    if department:
        query += " AND LOWER(u.department) LIKE ?"
        params.append(f"%{department.lower()}%")

    if semester:
        query += " AND LOWER(u.semester) LIKE ?"
        params.append(f"%{semester.lower()}%")

    if q:
        query += " AND (LOWER(u.name) LIKE ? OR LOWER(u.bio) LIKE ?)"
        params.extend([f"%{q.lower()}%", f"%{q.lower()}%"])

    if skill_filter:
        query += " AND (LOWER(s.skill_name) LIKE ? OR LOWER(s.learning_skill) LIKE ?)"
        params.extend([f"%{skill_filter.lower()}%", f"%{skill_filter.lower()}%"])

    query += " ORDER BY (u.is_verified = 1 OR s.is_verified = 1) DESC, u.id DESC"
    res = database.execute_query(query, params, fetchall=True)

    users = []
    for row in res["result"] or []:
        u = sanitize_user(row)
        u["video_url"] = row.get("video_url") or ""
        u["certificate_url"] = row.get("skill_cert_url") or row.get("user_cert_url") or ""
        u["certificate_title"] = row.get("certificate_title") or ""
        u["verification_status"] = row.get("skill_ver_status") or row.get("user_ver_status") or "unverified"
        u["is_verified"] = bool(row.get("skill_is_verified") or row.get("user_is_verified"))
        users.append(u)

    return jsonify({"success": True, "data": users}), 200

@app.route("/api/users/<int:user_id>", methods=["GET"])
@app.route("/api/profile/<int:user_id>", methods=["GET"])
def get_user_profile(user_id):
    user_res = database.execute_query("SELECT * FROM users WHERE id = ?", (user_id,), fetchone=True)
    if not user_res or not user_res["result"]:
        return jsonify({"success": False, "message": "User not found"}), 404

    user = sanitize_user(user_res["result"])
    
    # Fetch skills
    skills_res = database.execute_query("SELECT * FROM skills WHERE user_id = ? ORDER BY id DESC", (user_id,), fetchall=True)
    skills = [format_skill(s) for s in skills_res["result"] or []]
    user["skills"] = skills
    if skills:
        latest = skills[0]
        user["teach_skill"] = latest["skill_name"]
        user["learn_skill"] = latest["learning_skill"]
        user["skill_level"] = latest["skill_level"]
        user["skill_category"] = latest["skill_category"]
        user["video_url"] = latest.get("video_url") or ""
        user["certificate_url"] = latest.get("certificate_url") or user.get("certificate_url", "")
        user["certificate_title"] = latest.get("certificate_title") or ""
        user["verification_status"] = latest.get("verification_status") or user.get("verification_status", "unverified")
        user["is_verified"] = bool(latest.get("is_verified") or user.get("is_verified"))

    conn_res = database.execute_query(
        "SELECT COUNT(*) as count FROM connections WHERE user1_id = ? OR user2_id = ?",
        (user_id, user_id),
        fetchone=True
    )
    user["connections_count"] = conn_res["result"]["count"] if conn_res and conn_res["result"] else 0

    return jsonify({"success": True, "data": user}), 200

@app.route("/api/profile/<int:user_id>", methods=["PUT"])
def update_profile(user_id):
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    department = data.get("department", "").strip()
    semester = data.get("semester", "").strip()
    bio = data.get("bio", "").strip()
    profile_image = data.get("profile_image", "").strip()
    teach_skill = data.get("teach_skill", "").strip()
    learn_skill = data.get("learn_skill", "").strip()
    video_url = data.get("video_url", "").strip()
    certificate_url = data.get("certificate_url", "").strip()
    certificate_title = data.get("certificate_title", "").strip()

    user_check = database.execute_query("SELECT id FROM users WHERE id = ?", (user_id,), fetchone=True)
    if not user_check or not user_check["result"]:
        return jsonify({"success": False, "message": "User not found"}), 404

    database.execute_query(
        """UPDATE users 
           SET name = COALESCE(NULLIF(?, ''), name),
               department = COALESCE(NULLIF(?, ''), department),
               semester = COALESCE(NULLIF(?, ''), semester),
               bio = ?,
               profile_image = COALESCE(NULLIF(?, ''), profile_image),
               certificate_url = COALESCE(NULLIF(?, ''), certificate_url)
           WHERE id = ?""",
        (name, department, semester, bio, profile_image, certificate_url, user_id),
        commit=True
    )

    if teach_skill or learn_skill or video_url or certificate_url:
        existing_skill = database.execute_query("SELECT id FROM skills WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,), fetchone=True)
        if existing_skill and existing_skill["result"]:
            database.execute_query(
                """UPDATE skills 
                   SET skill_name = COALESCE(NULLIF(?, ''), skill_name),
                       learning_skill = COALESCE(NULLIF(?, ''), learning_skill),
                       video_url = COALESCE(NULLIF(?, ''), video_url),
                       certificate_url = COALESCE(NULLIF(?, ''), certificate_url),
                       certificate_title = COALESCE(NULLIF(?, ''), certificate_title)
                   WHERE id = ?""",
                (teach_skill, learn_skill, video_url, certificate_url, certificate_title, existing_skill["result"]["id"]),
                commit=True
            )
        else:
            database.execute_query(
                """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title)
                   VALUES (?, ?, 'General', 'Intermediate', ?, ?, ?, ?, ?)""",
                (user_id, teach_skill or "Skill", learn_skill, f"Offers {teach_skill}", video_url, certificate_url, certificate_title),
                commit=True
            )

    updated_user = database.execute_query("SELECT * FROM users WHERE id = ?", (user_id,), fetchone=True)
    sanitized = sanitize_user(updated_user["result"])
    sanitized["teach_skill"] = teach_skill
    sanitized["learn_skill"] = learn_skill
    sanitized["video_url"] = video_url
    sanitized["certificate_url"] = certificate_url
    sanitized["certificate_title"] = certificate_title

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "data": sanitized
    }), 200

# -------------------------------------------------------------
# SKILLS
# -------------------------------------------------------------

@app.route("/api/skills", methods=["POST"])
def add_skill():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    skill_name = data.get("skill_name", "").strip()
    skill_category = data.get("skill_category", "General").strip()
    skill_level = data.get("skill_level", "Intermediate").strip()
    learning_skill = data.get("learning_skill", "").strip()
    description = data.get("description", "").strip()
    video_url = data.get("video_url", "").strip()
    certificate_url = data.get("certificate_url", "").strip()
    certificate_title = data.get("certificate_title", "").strip()

    if not user_id or not skill_name:
        return jsonify({"success": False, "message": "User ID and skill name are required"}), 400

    user_check = database.execute_query("SELECT id FROM users WHERE id = ?", (user_id,), fetchone=True)
    if not user_check or not user_check["result"]:
        return jsonify({"success": False, "message": "User not found"}), 404

    existing = database.execute_query("SELECT id, is_verified, verification_status FROM skills WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,), fetchone=True)
    if existing and existing["result"]:
        prev = existing["result"]
        ver_status = "pending" if certificate_url and prev["verification_status"] == "unverified" else prev["verification_status"]
        database.execute_query(
            """UPDATE skills 
               SET skill_name = ?, skill_category = ?, skill_level = ?, learning_skill = ?, description = ?,
                   video_url = ?, certificate_url = ?, certificate_title = ?, verification_status = ?
               WHERE id = ?""",
            (skill_name, skill_category, skill_level, learning_skill, description,
             video_url, certificate_url, certificate_title, ver_status, prev["id"]),
            commit=True
        )
        skill_id = prev["id"]
    else:
        ver_status = "pending" if certificate_url else "unverified"
        ins = database.execute_query(
            """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, ver_status),
            commit=True
        )
        skill_id = ins["lastrowid"]

    if certificate_url:
        database.execute_query("UPDATE users SET certificate_url = ? WHERE id = ?", (certificate_url, user_id), commit=True)

    return jsonify({
        "success": True,
        "message": "Skill details saved successfully",
        "data": {
            "id": skill_id,
            "user_id": user_id,
            "skill_name": skill_name,
            "skill_category": skill_category,
            "skill_level": skill_level,
            "learning_skill": learning_skill,
            "description": description,
            "video_url": video_url,
            "certificate_url": certificate_url,
            "certificate_title": certificate_title
        }
    }), 201

@app.route("/api/skills/<int:skill_id>", methods=["PUT"])
def update_skill(skill_id):
    data = request.get_json() or {}
    skill_name = data.get("skill_name", "").strip()
    skill_category = data.get("skill_category", "General").strip()
    skill_level = data.get("skill_level", "Intermediate").strip()
    learning_skill = data.get("learning_skill", "").strip()
    description = data.get("description", "").strip()

    database.execute_query(
        """UPDATE skills 
           SET skill_name = COALESCE(NULLIF(?, ''), skill_name),
               skill_category = ?, skill_level = ?,
               learning_skill = COALESCE(NULLIF(?, ''), learning_skill),
               description = ?
           WHERE id = ?""",
        (skill_name, skill_category, skill_level, learning_skill, description, skill_id),
        commit=True
    )
    return jsonify({"success": True, "message": "Skill updated successfully"}), 200

@app.route("/api/skills/<int:user_id>", methods=["GET"])
def get_user_skills(user_id):
    skills_res = database.execute_query("SELECT * FROM skills WHERE user_id = ? ORDER BY id DESC", (user_id,), fetchall=True)
    skills = [format_skill(s) for s in skills_res["result"] or []]
    return jsonify({"success": True, "data": skills}), 200

# -------------------------------------------------------------
# EXCHANGE REQUESTS
# -------------------------------------------------------------

@app.route("/api/requests", methods=["POST"])
def create_request():
    data = request.get_json() or {}
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    offered_skill = data.get("offered_skill", "").strip()
    requested_skill = data.get("requested_skill", "").strip()

    if not sender_id or not receiver_id or not offered_skill or not requested_skill:
        return jsonify({"success": False, "message": "sender_id, receiver_id, offered_skill, and requested_skill are required"}), 400

    try:
        sender_id = int(sender_id)
        receiver_id = int(receiver_id)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid sender or receiver ID"}), 400

    if sender_id == receiver_id:
        return jsonify({"success": False, "message": "You cannot send an exchange request to yourself"}), 400

    # Sender & receiver verification
    sender_res = database.execute_query("SELECT id, name FROM users WHERE id = ?", (sender_id,), fetchone=True)
    receiver_res = database.execute_query("SELECT id, name FROM users WHERE id = ?", (receiver_id,), fetchone=True)

    if not sender_res or not sender_res["result"]:
        return jsonify({"success": False, "message": "Sender not found"}), 404
    if not receiver_res or not receiver_res["result"]:
        return jsonify({"success": False, "message": "Receiver not found"}), 404

    # Prevent duplicate pending request
    dup_check = database.execute_query(
        "SELECT id FROM exchange_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'Pending'",
        (sender_id, receiver_id),
        fetchone=True
    )
    if dup_check and dup_check["result"]:
        return jsonify({"success": False, "message": "A pending request has already been sent to this user"}), 400

    # Insert request
    ins = database.execute_query(
        """INSERT INTO exchange_requests (sender_id, receiver_id, offered_skill, requested_skill, status)
           VALUES (?, ?, ?, ?, 'Pending')""",
        (sender_id, receiver_id, offered_skill, requested_skill),
        commit=True
    )
    req_id = ins["lastrowid"]

    # Create notification for receiver
    sender_name = sender_res["result"]["name"]
    database.execute_query(
        """INSERT INTO notifications (user_id, type, message)
           VALUES (?, 'exchange_request', ?)""",
        (receiver_id, f"{sender_name} offered to teach you '{offered_skill}' in exchange for '{requested_skill}'."),
        commit=True
    )

    return jsonify({
        "success": True,
        "message": "Skill exchange request sent successfully!",
        "data": {
            "id": req_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "offered_skill": offered_skill,
            "requested_skill": requested_skill,
            "status": "Pending"
        }
    }), 201

@app.route("/api/requests", methods=["GET"])
def get_requests():
    user_id = request.args.get("user_id")
    req_type = request.args.get("type", "all").lower()

    if not user_id:
        return jsonify({"success": False, "message": "user_id query parameter is required"}), 400

    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid user_id"}), 400

    results = {"incoming": [], "outgoing": []}

    if req_type in ["incoming", "all"]:
        inc_res = database.execute_query(
            """SELECT r.*, u.name as sender_name, u.email as sender_email, u.department as sender_dept,
                      u.semester as sender_semester, u.profile_image as sender_image, u.bio as sender_bio
               FROM exchange_requests r
               JOIN users u ON r.sender_id = u.id
               WHERE r.receiver_id = ?
               ORDER BY r.id DESC""",
            (user_id,),
            fetchall=True
        )
        results["incoming"] = [format_request(r) for r in inc_res["result"] or []]

    if req_type in ["outgoing", "all"]:
        out_res = database.execute_query(
            """SELECT r.*, u.name as receiver_name, u.email as receiver_email, u.department as receiver_dept,
                      u.semester as receiver_semester, u.profile_image as receiver_image, u.bio as receiver_bio
               FROM exchange_requests r
               JOIN users u ON r.receiver_id = u.id
               WHERE r.sender_id = ?
               ORDER BY r.id DESC""",
            (user_id,),
            fetchall=True
        )
        results["outgoing"] = [format_request(r) for r in out_res["result"] or []]

    return jsonify({"success": True, "data": results}), 200

@app.route("/api/requests/<int:request_id>", methods=["PUT"])
def update_request_status(request_id):
    data = request.get_json() or {}
    status = data.get("status", "").strip().capitalize()

    if status not in ["Accepted", "Rejected", "Cancelled"]:
        return jsonify({"success": False, "message": "Status must be 'Accepted', 'Rejected', or 'Cancelled'"}), 400

    req_res = database.execute_query(
        """SELECT r.*, s.name as sender_name, rc.name as receiver_name 
           FROM exchange_requests r
           JOIN users s ON r.sender_id = s.id
           JOIN users rc ON r.receiver_id = rc.id
           WHERE r.id = ?""",
        (request_id,),
        fetchone=True
    )
    if not req_res or not req_res["result"]:
        return jsonify({"success": False, "message": "Request not found"}), 404

    req_data = req_res["result"]
    sender_id = req_data["sender_id"]
    receiver_id = req_data["receiver_id"]
    receiver_name = req_data["receiver_name"]

    database.execute_query(
        "UPDATE exchange_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, request_id),
        commit=True
    )

    if status == "Accepted":
        # Create connection (ensure sorted user1_id, user2_id to prevent duplicates)
        u1 = min(sender_id, receiver_id)
        u2 = max(sender_id, receiver_id)

        conn_check = database.execute_query(
            "SELECT id FROM connections WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
            (u1, u2, u2, u1),
            fetchone=True
        )
        if not conn_check or not conn_check["result"]:
            database.execute_query(
                "INSERT INTO connections (user1_id, user2_id) VALUES (?, ?)",
                (u1, u2),
                commit=True
            )

        # Notify sender
        database.execute_query(
            "INSERT INTO notifications (user_id, type, message) VALUES (?, 'request_accepted', ?)",
            (sender_id, f"Great news! {receiver_name} accepted your skill exchange request. You are now connected!"),
            commit=True
        )
    elif status == "Rejected":
        database.execute_query(
            "INSERT INTO notifications (user_id, type, message) VALUES (?, 'request_rejected', ?)",
            (sender_id, f"{receiver_name} was unable to accept your skill exchange request at this time."),
            commit=True
        )

    return jsonify({"success": True, "message": f"Request has been {status.lower()} successfully"}), 200

# -------------------------------------------------------------
# CONNECTIONS
# -------------------------------------------------------------

@app.route("/api/connections", methods=["GET"])
def get_connections():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400

    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid user_id"}), 400

    query = """
        SELECT c.id as connection_id, c.created_at as connected_at,
               u.id as user_id, u.name, u.email, u.department, u.semester, u.bio, u.profile_image,
               u.is_verified, u.verification_status,
               s.skill_name as teach_skill, s.learning_skill as learn_skill, s.video_url, s.certificate_url, s.certificate_title
        FROM connections c
        JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END) = u.id
        LEFT JOIN (
            SELECT user_id, skill_name, learning_skill, video_url, certificate_url, certificate_title,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id DESC) as rn
            FROM skills
        ) s ON u.id = s.user_id AND s.rn = 1
        WHERE c.user1_id = ? OR c.user2_id = ?
        ORDER BY c.id DESC
    """
    res = database.execute_query(query, (user_id, user_id, user_id), fetchall=True)
    connections = [sanitize_user(row) for row in res["result"] or []]

    return jsonify({"success": True, "data": connections}), 200

# -------------------------------------------------------------
# MESSAGES & CHAT
# -------------------------------------------------------------

@app.route("/api/messages", methods=["POST"])
def send_message():
    data = request.get_json() or {}
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    message = data.get("message", "").strip()

    # Precise validation handling the known prompt specification
    if sender_id is None or receiver_id is None or not message:
        return jsonify({"success": False, "message": "sender id and receiver id and message are required"}), 400

    try:
        sender_id = int(sender_id)
        receiver_id = int(receiver_id)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid sender or receiver ID"}), 400

    sender_res = database.execute_query("SELECT id, name FROM users WHERE id = ?", (sender_id,), fetchone=True)
    receiver_res = database.execute_query("SELECT id FROM users WHERE id = ?", (receiver_id,), fetchone=True)

    if not sender_res or not sender_res["result"]:
        return jsonify({"success": False, "message": "Sender user not found"}), 404
    if not receiver_res or not receiver_res["result"]:
        return jsonify({"success": False, "message": "Receiver user not found"}), 404

    ins = database.execute_query(
        "INSERT INTO messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, 0)",
        (sender_id, receiver_id, message),
        commit=True
    )
    msg_id = ins["lastrowid"]

    # Optional notification for receiver
    sender_name = sender_res["result"]["name"]
    database.execute_query(
        "INSERT INTO notifications (user_id, type, message) VALUES (?, 'new_message', ?)",
        (receiver_id, f"New message from {sender_name}: {message[:40]}{'...' if len(message) > 40 else ''}"),
        commit=True
    )

    created_msg = {
        "id": msg_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "message": message,
        "is_read": False,
        "created_at": datetime.now().isoformat()
    }

    return jsonify({"success": True, "message": "Message sent successfully", "data": created_msg}), 201

@app.route("/api/messages/<int:other_user_id>", methods=["GET"])
def get_messages(other_user_id):
    current_user_id = request.args.get("current_user_id")
    if not current_user_id:
        return jsonify({"success": False, "message": "current_user_id query parameter is required"}), 400

    try:
        current_user_id = int(current_user_id)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid current_user_id"}), 400

    # Mark incoming messages from other_user_id as read
    database.execute_query(
        "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
        (other_user_id, current_user_id),
        commit=True
    )

    query = """
        SELECT * FROM messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY id ASC
    """
    res = database.execute_query(query, (current_user_id, other_user_id, other_user_id, current_user_id), fetchall=True)
    messages = [format_message(m) for m in res["result"] or []]

    return jsonify({"success": True, "data": messages}), 200

# -------------------------------------------------------------
# NOTIFICATIONS
# -------------------------------------------------------------

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400

    res = database.execute_query(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 25",
        (user_id,),
        fetchall=True
    )
    notifs = [format_notification(n) for n in res["result"] or []]
    unread_count = sum(1 for n in notifs if not n["is_read"])

    return jsonify({"success": True, "data": notifs, "unread_count": unread_count}), 200

@app.route("/api/notifications/<int:notif_id>/read", methods=["PUT"])
def mark_notification_read(notif_id):
    database.execute_query("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,), commit=True)
    return jsonify({"success": True, "message": "Notification marked as read"}), 200

@app.route("/api/notifications/read-all", methods=["PUT"])
def mark_all_notifications_read():
    user_id = request.args.get("user_id")
    if user_id:
        database.execute_query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user_id,), commit=True)
    return jsonify({"success": True, "message": "All notifications marked as read"}), 200

# -------------------------------------------------------------
# STATS
# -------------------------------------------------------------

@app.route("/api/stats", methods=["GET"])
def get_stats():
    u_count = database.execute_query("SELECT COUNT(*) as c FROM users", fetchone=True)
    s_count = database.execute_query("SELECT COUNT(*) as c FROM skills", fetchone=True)
    r_count = database.execute_query("SELECT COUNT(*) as c FROM exchange_requests WHERE status = 'Accepted'", fetchone=True)
    c_count = database.execute_query("SELECT COUNT(*) as c FROM connections", fetchone=True)

    users_total = u_count["result"]["c"] if u_count and u_count["result"] else 0
    skills_total = s_count["result"]["c"] if s_count and s_count["result"] else 0
    exchanges_total = r_count["result"]["c"] if r_count and r_count["result"] else 0
    connections_total = c_count["result"]["c"] if c_count and c_count["result"] else 0

    return jsonify({
        "success": True,
        "data": {
            "students_connected": max(users_total, 120),  # display friendly metrics with real baseline
            "real_users": users_total,
            "skills_shared": max(skills_total, 85),
            "real_skills": skills_total,
            "exchanges_completed": max(exchanges_total, 45),
            "real_exchanges": exchanges_total,
            "active_connections": max(connections_total, 32),
            "real_connections": connections_total
        }
    }), 200

# -------------------------------------------------------------
# ADMIN PORTAL ENDPOINTS
# -------------------------------------------------------------

@app.route("/api/admin/overview", methods=["GET"])
def admin_overview():
    u_count = database.execute_query("SELECT COUNT(*) as c FROM users WHERE role != 'admin'", fetchone=True)
    s_count = database.execute_query("SELECT COUNT(*) as c FROM skills", fetchone=True)
    v_count = database.execute_query("SELECT COUNT(*) as c FROM users WHERE is_verified = 1 AND role != 'admin'", fetchone=True)
    p_count = database.execute_query("SELECT COUNT(*) as c FROM users WHERE (verification_status = 'pending' OR (certificate_url != '' AND is_verified = 0)) AND role != 'admin'", fetchone=True)
    e_count = database.execute_query("SELECT COUNT(*) as c FROM exchange_requests", fetchone=True)
    c_count = database.execute_query("SELECT COUNT(*) as c FROM connections", fetchone=True)

    return jsonify({
        "success": True,
        "data": {
            "total_users": u_count["result"]["c"] if u_count and u_count["result"] else 0,
            "total_skills": s_count["result"]["c"] if s_count and s_count["result"] else 0,
            "verified_mentors": v_count["result"]["c"] if v_count and v_count["result"] else 0,
            "pending_verifications": p_count["result"]["c"] if p_count and p_count["result"] else 0,
            "total_exchanges": e_count["result"]["c"] if e_count and e_count["result"] else 0,
            "total_connections": c_count["result"]["c"] if c_count and c_count["result"] else 0
        }
    }), 200

@app.route("/api/admin/verifications", methods=["GET"])
def admin_verifications():
    query = """
        SELECT u.id as user_id, u.name, u.email, u.department, u.semester, u.profile_image,
               u.verification_status as user_status, u.is_verified as user_is_verified,
               s.id as skill_id, s.skill_name, s.skill_level, s.certificate_title, s.certificate_url,
               s.video_url, s.verification_status as skill_status, s.is_verified as skill_is_verified,
               s.created_at
        FROM users u
        JOIN skills s ON u.id = s.user_id
        WHERE (s.certificate_url != '' OR u.certificate_url != '')
        ORDER BY s.is_verified ASC, s.id DESC
    """
    res = database.execute_query(query, fetchall=True)
    items = []
    for r in (res["result"] or []):
        item = dict(r)
        item["cert_url"] = item.get("certificate_url") or ""
        item["cert_title"] = item.get("certificate_title") or "Skill Credential"
        item["is_verified"] = bool(item.get("skill_is_verified") or item.get("user_is_verified"))
        items.append(item)

    return jsonify({"success": True, "data": items}), 200

@app.route("/api/admin/users", methods=["GET"])
def admin_get_users():
    query = """
        SELECT u.id, u.name, u.email, u.department, u.semester, u.role, u.profile_image,
               u.verification_status, u.is_verified, u.created_at,
               (SELECT COUNT(*) FROM skills WHERE user_id = u.id) as skills_count,
               (SELECT COUNT(*) FROM connections WHERE user1_id = u.id OR user2_id = u.id) as connections_count
        FROM users u
        ORDER BY u.role DESC, u.id DESC
    """
    res = database.execute_query(query, fetchall=True)
    users = []
    for r in (res["result"] or []):
        u = dict(r)
        u["is_verified"] = bool(u.get("is_verified"))
        users.append(u)

    return jsonify({"success": True, "data": users}), 200

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def admin_delete_user(user_id):
    target = database.execute_query("SELECT role FROM users WHERE id = ?", (user_id,), fetchone=True)
    if not target or not target["result"]:
        return jsonify({"success": False, "message": "User not found"}), 404
    if target["result"]["role"] == "admin":
        return jsonify({"success": False, "message": "Cannot delete administrator accounts"}), 403

    database.execute_query("DELETE FROM users WHERE id = ?", (user_id,), commit=True)
    return jsonify({"success": True, "message": "User deleted successfully"}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)