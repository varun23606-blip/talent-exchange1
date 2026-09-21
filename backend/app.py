import os
import re
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import firebase_config
import firebase_db
from models import sanitize_user, format_skill, format_request, format_message, format_notification

app = Flask(__name__)
# Enable CORS for all API routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Uploads directory (used for local uploads and fallback)
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_DIR
ALLOWED_VIDEO_EXTS = {".mp4", ".webm", ".mov", ".ogg", ".avi"}
ALLOWED_CERT_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

# Initialize default seed data
firebase_db.seed_default_data()

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

# -------------------------------------------------------------
# STATUS & HEALTH
# -------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    fb_info = firebase_config.get_firebase_info()
    return jsonify({
        "name": "Talent Exchange REST API",
        "version": "2.0.0",
        "backend": "Firebase (Cloud Firestore & Firebase Storage)",
        "firebase_mode": fb_info.get("mode"),
        "firebase_project": fb_info.get("project_id"),
        "status": "online",
        "tagline": "Learn. Teach. Connect."
    })

@app.route("/api/firebase-status", methods=["GET"])
def firebase_status():
    """Returns Firebase connectivity, Project ID, and Storage status"""
    info = firebase_config.get_firebase_info()
    return jsonify({
        "success": True,
        "status": info.get("status", "local_fallback"),
        "is_live": info.get("is_live", False),
        "data": info
    }), 200

# -------------------------------------------------------------
# FILE & MEDIA UPLOADS (FIREBASE STORAGE / LOCAL FALLBACK)
# -------------------------------------------------------------

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

    # 1. Try Firebase Cloud Storage if connected
    bucket = firebase_config.get_storage_bucket()
    if firebase_config.is_firebase_live() and bucket:
        try:
            blob = bucket.blob(f"{file_category}s/{saved_filename}")
            file.seek(0)
            blob.upload_from_file(file, content_type=file.content_type)
            try:
                blob.make_public()
                cloud_url = blob.public_url
            except Exception:
                cloud_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{file_category}s%2F{saved_filename}?alt=media"

            return jsonify({
                "success": True,
                "message": f"{file_category.capitalize()} uploaded to Firebase Storage successfully",
                "url": cloud_url,
                "filename": saved_filename,
                "type": file_category,
                "storage": "firebase_cloud_storage"
            }), 201
        except Exception as err:
            print(f"[Firebase Storage Upload Error]: {err}. Falling back to local storage.")

    # 2. Local fallback storage
    file.seek(0)
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    file.save(file_path)
    relative_url = f"uploads/{saved_filename}"

    return jsonify({
        "success": True,
        "message": f"{file_category.capitalize()} uploaded successfully",
        "url": relative_url,
        "filename": saved_filename,
        "type": file_category,
        "storage": "local"
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
    existing = firebase_db.get_user_by_email(email)
    if existing:
        return jsonify({"success": False, "message": "An account with this email already exists"}), 400

    password_hash = generate_password_hash(password)
    if not profile_image:
        profile_image = "assets/avatar-default.svg"

    verification_status = "pending" if certificate_url else "unverified"
    is_verified = 0

    new_user = firebase_db.create_user(
        name=name,
        email=email,
        password_hash=password_hash,
        department=department,
        semester=semester,
        bio=bio,
        profile_image=profile_image,
        role="student",
        certificate_url=certificate_url,
        verification_status=verification_status,
        is_verified=is_verified
    )
    user_id = new_user["id"]

    # Save initial skill
    if teach_skill or learn_skill or video_url or certificate_url:
        firebase_db.create_skill(
            user_id=user_id,
            skill_name=teach_skill or "General Knowledge",
            skill_category="General",
            skill_level="Intermediate",
            learning_skill=learn_skill,
            description=f"Can teach {teach_skill}. Wants to learn {learn_skill}.",
            video_url=video_url,
            certificate_url=certificate_url,
            certificate_title=certificate_title,
            verification_status=verification_status,
            is_verified=is_verified
        )

    sanitized = sanitize_user(new_user)
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

    user_data = firebase_db.get_user_by_email(email)
    if not user_data:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    if not check_password_hash(user_data["password_hash"], password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    user_id = user_data["id"]
    skills = firebase_db.get_skills_by_user(user_id)
    sanitized = sanitize_user(user_data)

    if skills:
        sk = skills[0]
        sanitized["teach_skill"] = sk.get("skill_name", "")
        sanitized["learn_skill"] = sk.get("learning_skill", "")
        sanitized["skill_level"] = sk.get("skill_level", "")
        sanitized["skill_category"] = sk.get("skill_category", "")
        sanitized["video_url"] = sk.get("video_url") or ""
        sanitized["certificate_url"] = sk.get("certificate_url") or sanitized.get("certificate_url", "")
        sanitized["certificate_title"] = sk.get("certificate_title") or ""
        sanitized["verification_status"] = sk.get("verification_status") or sanitized.get("verification_status", "unverified")
        sanitized["is_verified"] = bool(sk.get("is_verified") or sanitized.get("is_verified"))
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
    status = data.get("status", "verified")

    if not user_id:
        return jsonify({"success": False, "message": "User ID is required"}), 400

    u = firebase_db.get_user_by_id(user_id)
    if not u:
        return jsonify({"success": False, "message": "User not found"}), 404

    is_verified_val = 1 if status == "verified" else 0

    user_updates = {
        "verification_status": status,
        "is_verified": bool(is_verified_val)
    }
    if certificate_url:
        user_updates["certificate_url"] = certificate_url

    firebase_db.update_user(user_id, user_updates)

    skill_updates = {
        "verification_status": status,
        "is_verified": bool(is_verified_val)
    }
    if certificate_url:
        skill_updates["certificate_url"] = certificate_url
    if certificate_title:
        skill_updates["certificate_title"] = certificate_title

    firebase_db.update_skill(user_id, skill_updates)

    status_msg = "Your skill certificate has been successfully verified! 🛡️ You now display the Verified Mentor badge." if status == "verified" else "Your skill certificate status has been updated."
    firebase_db.create_notification(user_id, "certificate_verification", status_msg)

    updated_u = firebase_db.get_user_by_id(user_id)
    sanitized = sanitize_user(updated_u)
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

    users = firebase_db.list_users(
        q=q,
        skill=skill_filter,
        department=department,
        semester=semester,
        only_verified=only_verified,
        exclude_user_id=exclude_user_id
    )

    return jsonify({
        "success": True,
        "count": len(users),
        "data": users
    }), 200

@app.route("/api/profile/<user_id>", methods=["GET"])
def get_user_profile(user_id):
    user = firebase_db.get_user_by_id(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    sanitized = sanitize_user(user)
    skills = firebase_db.get_skills_by_user(user_id)
    sanitized["skills"] = [format_skill(s) for s in skills]

    if skills:
        latest = skills[0]
        sanitized["teach_skill"] = latest.get("skill_name", "")
        sanitized["learn_skill"] = latest.get("learning_skill", "")
        sanitized["skill_level"] = latest.get("skill_level", "")
        sanitized["skill_category"] = latest.get("skill_category", "")
        sanitized["video_url"] = latest.get("video_url") or ""
        sanitized["certificate_url"] = latest.get("certificate_url") or sanitized.get("certificate_url", "")
        sanitized["certificate_title"] = latest.get("certificate_title") or ""
        sanitized["verification_status"] = latest.get("verification_status") or sanitized.get("verification_status", "unverified")
        sanitized["is_verified"] = bool(latest.get("is_verified") or sanitized.get("is_verified"))

    conns = firebase_db.get_connections(user_id)
    sanitized["connections_count"] = len(conns)

    return jsonify({"success": True, "data": sanitized}), 200

@app.route("/api/profile/<user_id>", methods=["PUT"])
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

    user_check = firebase_db.get_user_by_id(user_id)
    if not user_check:
        return jsonify({"success": False, "message": "User not found"}), 404

    user_updates = {}
    if name: user_updates["name"] = name
    if department: user_updates["department"] = department
    if semester: user_updates["semester"] = semester
    if bio is not None: user_updates["bio"] = bio
    if profile_image: user_updates["profile_image"] = profile_image
    if certificate_url: user_updates["certificate_url"] = certificate_url

    firebase_db.update_user(user_id, user_updates)

    if teach_skill or learn_skill or video_url or certificate_url or certificate_title:
        skill_updates = {}
        if teach_skill: skill_updates["skill_name"] = teach_skill
        if learn_skill: skill_updates["learning_skill"] = learn_skill
        if video_url: skill_updates["video_url"] = video_url
        if certificate_url: skill_updates["certificate_url"] = certificate_url
        if certificate_title: skill_updates["certificate_title"] = certificate_title

        existing_skills = firebase_db.get_skills_by_user(user_id)
        if existing_skills:
            firebase_db.update_skill(user_id, skill_updates)
        else:
            firebase_db.create_skill(
                user_id=user_id,
                skill_name=teach_skill or "General",
                learning_skill=learn_skill,
                video_url=video_url,
                certificate_url=certificate_url,
                certificate_title=certificate_title
            )

    updated_u = firebase_db.get_user_by_id(user_id)
    sanitized = sanitize_user(updated_u)
    sanitized["teach_skill"] = teach_skill or user_check.get("teach_skill", "")
    sanitized["learn_skill"] = learn_skill or user_check.get("learn_skill", "")
    sanitized["video_url"] = video_url or user_check.get("video_url", "")
    sanitized["certificate_url"] = certificate_url or user_check.get("certificate_url", "")
    sanitized["certificate_title"] = certificate_title or user_check.get("certificate_title", "")

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "data": sanitized
    }), 200

# -------------------------------------------------------------
# SKILLS
# -------------------------------------------------------------

@app.route("/api/skills", methods=["POST"])
def add_or_update_skill():
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

    u = firebase_db.get_user_by_id(user_id)
    if not u:
        return jsonify({"success": False, "message": "User not found"}), 404

    existing_skills = firebase_db.get_skills_by_user(user_id)
    verification_status = "pending" if certificate_url else "unverified"

    if existing_skills:
        skill = firebase_db.update_skill(user_id, {
            "skill_name": skill_name,
            "skill_category": skill_category,
            "skill_level": skill_level,
            "learning_skill": learning_skill,
            "description": description,
            "video_url": video_url,
            "certificate_url": certificate_url,
            "certificate_title": certificate_title,
            "verification_status": verification_status
        })
    else:
        skill = firebase_db.create_skill(
            user_id=user_id,
            skill_name=skill_name,
            skill_category=skill_category,
            skill_level=skill_level,
            learning_skill=learning_skill,
            description=description,
            video_url=video_url,
            certificate_url=certificate_url,
            certificate_title=certificate_title,
            verification_status=verification_status
        )

    return jsonify({
        "success": True,
        "message": "Skill profile saved successfully",
        "data": format_skill(skill)
    }), 201

@app.route("/api/skills/<user_id>", methods=["GET"])
def get_user_skills(user_id):
    skills = firebase_db.get_skills_by_user(user_id)
    return jsonify({
        "success": True,
        "data": [format_skill(s) for s in skills]
    }), 200

# -------------------------------------------------------------
# EXCHANGE REQUESTS
# -------------------------------------------------------------

@app.route("/api/requests", methods=["POST"])
def send_request():
    data = request.get_json() or {}
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    offered_skill = data.get("offered_skill", "").strip()
    requested_skill = data.get("requested_skill", "").strip()

    if not sender_id or not receiver_id or not offered_skill or not requested_skill:
        return jsonify({"success": False, "message": "sender_id, receiver_id, offered_skill, and requested_skill are required"}), 400

    if str(sender_id) == str(receiver_id):
        return jsonify({"success": False, "message": "You cannot propose an exchange with yourself"}), 400

    req_data = firebase_db.create_request(sender_id, receiver_id, offered_skill, requested_skill)

    sender = firebase_db.get_user_by_id(sender_id)
    sender_name = sender.get("name") if sender else "A student"
    firebase_db.create_notification(
        receiver_id,
        "request_received",
        f"{sender_name} proposed an exchange: teach {offered_skill} in return for {requested_skill}."
    )

    return jsonify({
        "success": True,
        "message": "Exchange request sent successfully",
        "data": format_request(req_data)
    }), 201

@app.route("/api/requests", methods=["GET"])
def get_user_requests():
    user_id = request.args.get("user_id")
    req_type = request.args.get("type", "incoming")

    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400

    reqs = firebase_db.get_requests(user_id, req_type)
    return jsonify({
        "success": True,
        "data": {req_type: [format_request(r) for r in reqs]}
    }), 200

@app.route("/api/requests/<request_id>", methods=["PUT"])
def update_request_status_route(request_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").capitalize()

    if new_status not in ["Accepted", "Rejected", "Cancelled"]:
        return jsonify({"success": False, "message": "Status must be 'Accepted', 'Rejected', or 'Cancelled'"}), 400

    req_doc = firebase_db.update_request_status(request_id, new_status)
    if not req_doc:
        return jsonify({"success": False, "message": "Request not found"}), 404

    sender_id = req_doc.get("sender_id")
    receiver_id = req_doc.get("receiver_id")
    receiver = firebase_db.get_user_by_id(receiver_id)
    receiver_name = receiver.get("name") if receiver else "A student"

    if new_status == "Accepted":
        firebase_db.create_connection(sender_id, receiver_id)
        firebase_db.create_notification(
            sender_id,
            "request_accepted",
            f"🎉 {receiver_name} accepted your exchange proposal! You are now connected."
        )
    elif new_status == "Rejected":
        firebase_db.create_notification(
            sender_id,
            "request_rejected",
            f"{receiver_name} was unable to accept your exchange proposal."
        )

    return jsonify({
        "success": True,
        "message": f"Request status updated to {new_status}",
        "data": format_request(req_doc)
    }), 200

# -------------------------------------------------------------
# CONNECTIONS
# -------------------------------------------------------------

@app.route("/api/connections", methods=["GET"])
def get_user_connections():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "user_id query param is required"}), 400

    conns = firebase_db.get_connections(user_id)
    return jsonify({
        "success": True,
        "count": len(conns),
        "data": conns
    }), 200

# -------------------------------------------------------------
# REAL-TIME MESSAGING
# -------------------------------------------------------------

@app.route("/api/messages", methods=["POST"])
def send_message_route():
    data = request.get_json() or {}
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    msg_text = data.get("message", "").strip()

    if not sender_id or not receiver_id or not msg_text:
        return jsonify({"success": False, "message": "sender_id, receiver_id, and message are required"}), 400

    msg = firebase_db.send_message(sender_id, receiver_id, msg_text)

    sender = firebase_db.get_user_by_id(sender_id)
    sender_name = sender.get("name") if sender else "Peer"
    firebase_db.create_notification(
        receiver_id,
        "new_message",
        f"💬 {sender_name}: {msg_text[:60]}{'...' if len(msg_text) > 60 else ''}"
    )

    return jsonify({
        "success": True,
        "message": "Message sent",
        "data": format_message(msg)
    }), 201

@app.route("/api/messages/<other_user_id>", methods=["GET"])
def get_messages(other_user_id):
    current_user_id = request.args.get("current_user_id")
    if not current_user_id:
        return jsonify({"success": False, "message": "current_user_id is required"}), 400

    msgs = firebase_db.get_conversation(current_user_id, other_user_id)
    return jsonify({
        "success": True,
        "count": len(msgs),
        "data": [format_message(m) for m in msgs]
    }), 200

# -------------------------------------------------------------
# NOTIFICATIONS
# -------------------------------------------------------------

@app.route("/api/notifications", methods=["GET"])
def get_notifications_route():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400

    notifs = firebase_db.get_notifications(user_id)
    unread_count = sum(1 for n in notifs if not n.get("is_read"))

    return jsonify({
        "success": True,
        "unread_count": unread_count,
        "data": [format_notification(n) for n in notifs]
    }), 200

@app.route("/api/notifications/read-all", methods=["POST"])
def mark_read_notifications():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if user_id:
        firebase_db.mark_notifications_read(user_id)
    return jsonify({"success": True, "message": "All notifications marked as read"}), 200

# -------------------------------------------------------------
# STATS & ADMIN CONSOLE
# -------------------------------------------------------------

@app.route("/api/stats", methods=["GET"])
def get_stats():
    stats = firebase_db.get_stats()
    return jsonify({
        "success": True,
        "data": stats
    }), 200

@app.route("/api/admin/overview", methods=["GET"])
def admin_overview():
    data = firebase_db.get_admin_overview()
    return jsonify({"success": True, "data": data}), 200

@app.route("/api/admin/verifications", methods=["GET"])
def admin_verifications():
    data = firebase_db.get_admin_verifications()
    return jsonify({"success": True, "data": data}), 200

@app.route("/api/admin/users", methods=["GET"])
def admin_get_users():
    data = firebase_db.get_admin_users()
    return jsonify({"success": True, "data": data}), 200

@app.route("/api/admin/users/<user_id>", methods=["DELETE"])
def admin_delete_user(user_id):
    target = firebase_db.get_user_by_id(user_id)
    if not target:
        return jsonify({"success": False, "message": "User not found"}), 404
    if target.get("role") == "admin":
        return jsonify({"success": False, "message": "Cannot delete administrator accounts"}), 403

    firebase_db.delete_user(user_id)
    return jsonify({"success": True, "message": "User deleted successfully"}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)