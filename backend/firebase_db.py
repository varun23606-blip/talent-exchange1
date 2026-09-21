import os
import time
from datetime import datetime
import firebase_config
from werkzeug.security import generate_password_hash

# Fallback SQLite DB for local dev mode
import database as local_db

def _now_iso():
    return datetime.utcnow().isoformat()

def get_next_id(collection_name):
    return int(time.time() * 1000)

# ==============================================================================
# USERS
# ==============================================================================

def create_user(name, email, password_hash, department="", semester="", bio="",
                profile_image="assets/avatar-default.svg", role="student",
                certificate_url="", verification_status="unverified", is_verified=0):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        user_id = str(get_next_id("users"))
        user_doc = {
            "id": user_id,
            "name": name,
            "email": email.lower(),
            "password_hash": password_hash,
            "department": department or "",
            "semester": semester or "",
            "bio": bio or "",
            "profile_image": profile_image or "assets/avatar-default.svg",
            "role": role or "student",
            "certificate_url": certificate_url or "",
            "verification_status": verification_status or "unverified",
            "is_verified": bool(is_verified),
            "created_at": _now_iso()
        }
        db.collection("users").document(user_id).set(user_doc)
        return user_doc
    else:
        res = local_db.execute_query(
            """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, role, certificate_url, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, email.lower(), password_hash, department, semester, bio, profile_image, role, certificate_url, verification_status, is_verified),
            commit=True
        )
        user_id = res["lastrowid"]
        if not user_id:
            row = local_db.execute_query("SELECT id FROM users WHERE email = ?", (email.lower(),), fetchone=True)
            user_id = row["result"]["id"]
        return get_user_by_id(user_id)

def get_user_by_id(user_id):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        doc = db.collection("users").document(str(user_id)).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = user_id
            return data
        return None
    else:
        res = local_db.execute_query("SELECT * FROM users WHERE id = ?", (user_id,), fetchone=True)
        return res["result"] if res and res["result"] else None

def get_user_by_email(email):
    if not email:
        return None
    email_clean = email.strip().lower()
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        docs = db.collection("users").where("email", "==", email_clean).limit(1).stream()
        for d in docs:
            data = d.to_dict()
            data["id"] = d.id
            return data
        return None
    else:
        res = local_db.execute_query("SELECT * FROM users WHERE email = ?", (email_clean,), fetchone=True)
        return res["result"] if res and res["result"] else None

def update_user(user_id, updates):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        db.collection("users").document(str(user_id)).update(updates)
        return get_user_by_id(user_id)
    else:
        cols = []
        vals = []
        for k, v in updates.items():
            cols.append(f"{k} = ?")
            vals.append(v)
        if cols:
            vals.append(user_id)
            local_db.execute_query(f"UPDATE users SET {', '.join(cols)} WHERE id = ?", tuple(vals), commit=True)
        return get_user_by_id(user_id)

def delete_user(user_id):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        db.collection("users").document(str(user_id)).delete()
        # Clean up related skills
        skills = db.collection("skills").where("user_id", "==", str(user_id)).stream()
        for s in skills:
            s.reference.delete()
        return True
    else:
        local_db.execute_query("DELETE FROM users WHERE id = ?", (user_id,), commit=True)
        return True

def list_users(q="", skill="", department="", semester="", only_verified=False, exclude_user_id=None):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        users_stream = db.collection("users").stream()
        results = []
        exclude_str = str(exclude_user_id) if exclude_user_id is not None else None

        for doc in users_stream:
            u = doc.to_dict()
            u_id = str(doc.id)
            if exclude_str and u_id == exclude_str:
                continue

            # Fetch skill for this user
            skill_doc = None
            skills = db.collection("skills").where("user_id", "==", u_id).limit(1).stream()
            for s in skills:
                skill_doc = s.to_dict()
                break

            u_item = {
                "id": u_id,
                "name": u.get("name", ""),
                "email": u.get("email", ""),
                "department": u.get("department", ""),
                "semester": u.get("semester", ""),
                "bio": u.get("bio", ""),
                "profile_image": u.get("profile_image", "assets/avatar-default.svg"),
                "role": u.get("role", "student"),
                "created_at": u.get("created_at"),
                "teach_skill": skill_doc.get("skill_name", "") if skill_doc else "",
                "learn_skill": skill_doc.get("learning_skill", "") if skill_doc else "",
                "skill_category": skill_doc.get("skill_category", "") if skill_doc else "",
                "skill_level": skill_doc.get("skill_level", "") if skill_doc else "",
                "video_url": skill_doc.get("video_url", "") if skill_doc else "",
                "certificate_url": skill_doc.get("certificate_url", "") if skill_doc else u.get("certificate_url", ""),
                "certificate_title": skill_doc.get("certificate_title", "") if skill_doc else "",
                "verification_status": skill_doc.get("verification_status", "unverified") if skill_doc else u.get("verification_status", "unverified"),
                "is_verified": bool((skill_doc and skill_doc.get("is_verified")) or u.get("is_verified"))
            }

            if only_verified and not u_item["is_verified"]:
                continue
            if department and u_item["department"] != department:
                continue
            if semester and u_item["semester"] != semester:
                continue
            if skill and skill.lower() not in (u_item["teach_skill"] or "").lower():
                continue
            if q:
                q_low = q.lower()
                name_match = q_low in u_item["name"].lower()
                skill_match = q_low in (u_item["teach_skill"] or "").lower()
                bio_match = q_low in (u_item["bio"] or "").lower()
                if not (name_match or skill_match or bio_match):
                    continue

            results.append(u_item)
        return results
    else:
        # Fallback to local SQL query
        query = """
            SELECT u.id, u.name, u.email, u.department, u.semester, u.bio, u.profile_image, u.role, u.created_at,
                   u.certificate_url as user_cert_url, u.verification_status as user_ver_status, u.is_verified as user_is_verified,
                   s.skill_name as teach_skill, s.learning_skill as learn_skill, s.skill_category, s.skill_level,
                   s.video_url, s.certificate_url as skill_cert_url, s.certificate_title,
                   s.verification_status as skill_ver_status, s.is_verified as skill_is_verified
            FROM users u
            LEFT JOIN (
                SELECT s1.* FROM skills s1
                INNER JOIN (
                    SELECT user_id, MAX(id) as max_id FROM skills GROUP BY user_id
                ) s2 ON s1.id = s2.max_id
            ) s ON u.id = s.user_id
            WHERE 1=1
        """
        params = []
        if exclude_user_id:
            query += " AND u.id != ?"
            params.append(exclude_user_id)
        if q:
            term = f"%{q}%"
            query += " AND (u.name LIKE ? OR s.skill_name LIKE ? OR u.bio LIKE ?)"
            params.extend([term, term, term])
        if skill:
            query += " AND s.skill_name LIKE ?"
            params.append(f"%{skill}%")
        if department:
            query += " AND u.department = ?"
            params.append(department)
        if semester:
            query += " AND u.semester = ?"
            params.append(semester)
        if only_verified:
            query += " AND (s.is_verified = 1 OR u.is_verified = 1)"

        query += " ORDER BY (s.is_verified = 1 OR u.is_verified = 1) DESC, u.id DESC"
        res = local_db.execute_query(query, tuple(params), fetchall=True)
        users = []
        for r in (res["result"] or []):
            item = dict(r)
            item["certificate_url"] = item.get("skill_cert_url") or item.get("user_cert_url") or ""
            item["verification_status"] = item.get("skill_ver_status") or item.get("user_ver_status") or "unverified"
            item["is_verified"] = bool(item.get("skill_is_verified") or item.get("user_is_verified"))
            users.append(item)
        return users

# ==============================================================================
# SKILLS
# ==============================================================================

def create_skill(user_id, skill_name, skill_category="General", skill_level="Intermediate",
                 learning_skill="", description="", video_url="", certificate_url="",
                 certificate_title="", verification_status="unverified", is_verified=0):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        skill_id = str(get_next_id("skills"))
        skill_doc = {
            "id": skill_id,
            "user_id": str(user_id),
            "skill_name": skill_name,
            "skill_category": skill_category,
            "skill_level": skill_level,
            "learning_skill": learning_skill,
            "description": description,
            "video_url": video_url or "",
            "certificate_url": certificate_url or "",
            "certificate_title": certificate_title or "",
            "verification_status": verification_status or "unverified",
            "is_verified": bool(is_verified),
            "created_at": _now_iso()
        }
        db.collection("skills").document(skill_id).set(skill_doc)
        return skill_doc
    else:
        res = local_db.execute_query(
            """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status, is_verified),
            commit=True
        )
        return get_skill_by_id(res["lastrowid"])

def get_skill_by_id(skill_id):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        doc = db.collection("skills").document(str(skill_id)).get()
        return doc.to_dict() if doc.exists else None
    else:
        res = local_db.execute_query("SELECT * FROM skills WHERE id = ?", (skill_id,), fetchone=True)
        return res["result"] if res and res["result"] else None

def get_skills_by_user(user_id):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        docs = db.collection("skills").where("user_id", "==", str(user_id)).stream()
        return [d.to_dict() for d in docs]
    else:
        res = local_db.execute_query("SELECT * FROM skills WHERE user_id = ? ORDER BY id DESC", (user_id,), fetchall=True)
        return res["result"] or []

def update_skill(user_id, updates):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        skills = db.collection("skills").where("user_id", "==", str(user_id)).limit(1).stream()
        for s in skills:
            s.reference.update(updates)
            return s.reference.get().to_dict()
        return None
    else:
        existing = local_db.execute_query("SELECT id FROM skills WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,), fetchone=True)
        if existing and existing["result"]:
            cols = []
            vals = []
            for k, v in updates.items():
                cols.append(f"{k} = ?")
                vals.append(v)
            vals.append(existing["result"]["id"])
            local_db.execute_query(f"UPDATE skills SET {', '.join(cols)} WHERE id = ?", tuple(vals), commit=True)
            return get_skill_by_id(existing["result"]["id"])
        return None

# ==============================================================================
# EXCHANGE REQUESTS
# ==============================================================================

def create_request(sender_id, receiver_id, offered_skill, requested_skill):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        req_id = str(get_next_id("requests"))
        req_doc = {
            "id": req_id,
            "sender_id": str(sender_id),
            "receiver_id": str(receiver_id),
            "offered_skill": offered_skill,
            "requested_skill": requested_skill,
            "status": "Pending",
            "created_at": _now_iso(),
            "updated_at": _now_iso()
        }
        db.collection("exchange_requests").document(req_id).set(req_doc)
        return req_doc
    else:
        res = local_db.execute_query(
            """INSERT INTO exchange_requests (sender_id, receiver_id, offered_skill, requested_skill, status)
               VALUES (?, ?, ?, ?, 'Pending')""",
            (sender_id, receiver_id, offered_skill, requested_skill),
            commit=True
        )
        req_row = local_db.execute_query("SELECT * FROM exchange_requests WHERE id = ?", (res["lastrowid"],), fetchone=True)
        return req_row["result"]

def get_requests(user_id, req_type="incoming"):
    user_id_str = str(user_id)
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        coll = db.collection("exchange_requests")
        if req_type == "incoming":
            docs = coll.where("receiver_id", "==", user_id_str).stream()
        elif req_type == "outgoing":
            docs = coll.where("sender_id", "==", user_id_str).stream()
        else:
            in_docs = list(coll.where("receiver_id", "==", user_id_str).stream())
            out_docs = list(coll.where("sender_id", "==", user_id_str).stream())
            docs = in_docs + out_docs

        results = []
        for d in docs:
            r = d.to_dict()
            s_u = get_user_by_id(r.get("sender_id"))
            r_u = get_user_by_id(r.get("receiver_id"))
            r["sender_name"] = s_u.get("name") if s_u else "Student"
            r["sender_email"] = s_u.get("email") if s_u else ""
            r["sender_image"] = s_u.get("profile_image") if s_u else "assets/avatar-default.svg"
            r["sender_dept"] = s_u.get("department") if s_u else ""
            r["receiver_name"] = r_u.get("name") if r_u else "Student"
            r["receiver_email"] = r_u.get("email") if r_u else ""
            r["receiver_image"] = r_u.get("profile_image") if r_u else "assets/avatar-default.svg"
            r["receiver_dept"] = r_u.get("department") if r_u else ""
            results.append(r)
        return results
    else:
        query = """
            SELECT r.*,
                   s.name as sender_name, s.email as sender_email, s.profile_image as sender_image, s.department as sender_dept,
                   rec.name as receiver_name, rec.email as receiver_email, rec.profile_image as receiver_image, rec.department as receiver_dept
            FROM exchange_requests r
            JOIN users s ON r.sender_id = s.id
            JOIN users rec ON r.receiver_id = rec.id
            WHERE 
        """
        if req_type == "incoming":
            query += "r.receiver_id = ?"
            params = (user_id,)
        elif req_type == "outgoing":
            query += "r.sender_id = ?"
            params = (user_id,)
        else:
            query += "(r.receiver_id = ? OR r.sender_id = ?)"
            params = (user_id, user_id)

        query += " ORDER BY r.id DESC"
        res = local_db.execute_query(query, params, fetchall=True)
        return res["result"] or []

def update_request_status(request_id, status):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        doc_ref = db.collection("exchange_requests").document(str(request_id))
        doc_ref.update({"status": status, "updated_at": _now_iso()})
        return doc_ref.get().to_dict()
    else:
        local_db.execute_query(
            "UPDATE exchange_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (status, request_id),
            commit=True
        )
        res = local_db.execute_query("SELECT * FROM exchange_requests WHERE id = ?", (request_id,), fetchone=True)
        return res["result"]

# ==============================================================================
# CONNECTIONS
# ==============================================================================

def create_connection(user1_id, user2_id):
    u1 = min(int(user1_id), int(user2_id))
    u2 = max(int(user1_id), int(user2_id))

    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        conn_id = f"{u1}_{u2}"
        doc_ref = db.collection("connections").document(conn_id)
        if not doc_ref.get().exists:
            conn_data = {
                "id": conn_id,
                "user1_id": str(u1),
                "user2_id": str(u2),
                "created_at": _now_iso()
            }
            doc_ref.set(conn_data)
            return conn_data
        return doc_ref.get().to_dict()
    else:
        existing = local_db.execute_query(
            "SELECT id FROM connections WHERE user1_id = ? AND user2_id = ?",
            (u1, u2), fetchone=True
        )
        if not existing or not existing["result"]:
            local_db.execute_query(
                "INSERT INTO connections (user1_id, user2_id) VALUES (?, ?)",
                (u1, u2), commit=True
            )
        res = local_db.execute_query("SELECT * FROM connections WHERE user1_id = ? AND user2_id = ?", (u1, u2), fetchone=True)
        return res["result"]

def get_connections(user_id):
    uid_str = str(user_id)
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        d1 = list(db.collection("connections").where("user1_id", "==", uid_str).stream())
        d2 = list(db.collection("connections").where("user2_id", "==", uid_str).stream())
        all_conns = d1 + d2

        results = []
        for c in all_conns:
            c_data = c.to_dict()
            partner_id = c_data["user2_id"] if c_data["user1_id"] == uid_str else c_data["user1_id"]
            partner = get_user_by_id(partner_id)
            if partner:
                skill_doc = None
                skills = db.collection("skills").where("user_id", "==", partner_id).limit(1).stream()
                for s in skills:
                    skill_doc = s.to_dict()
                    break

                results.append({
                    "id": partner_id,
                    "user_id": partner_id,
                    "partner_id": partner_id,
                    "connection_id": c_data.get("id"),
                    "connected_at": c_data.get("created_at"),
                    "name": partner.get("name"),
                    "email": partner.get("email"),
                    "department": partner.get("department"),
                    "semester": partner.get("semester"),
                    "profile_image": partner.get("profile_image"),
                    "teach_skill": skill_doc.get("skill_name", "") if skill_doc else "",
                    "learn_skill": skill_doc.get("learning_skill", "") if skill_doc else "",
                    "is_verified": bool(partner.get("is_verified") or (skill_doc and skill_doc.get("is_verified")))
                })
        return results
    else:
        query = """
            SELECT c.id as connection_id, c.created_at as connected_at,
                   u.id as partner_id, u.name, u.email, u.department, u.semester, u.profile_image,
                   u.certificate_url as user_cert_url, u.verification_status as user_ver_status, u.is_verified as user_is_verified,
                   s.skill_name as teach_skill, s.learning_skill as learn_skill, s.video_url, s.certificate_url as skill_cert_url,
                   s.is_verified as skill_is_verified
            FROM connections c
            JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END) = u.id
            LEFT JOIN (
                SELECT s1.* FROM skills s1
                INNER JOIN (
                    SELECT user_id, MAX(id) as max_id FROM skills GROUP BY user_id
                ) s2 ON s1.id = s2.max_id
            ) s ON u.id = s.user_id
            WHERE c.user1_id = ? OR c.user2_id = ?
            ORDER BY c.id DESC
        """
        res = local_db.execute_query(query, (user_id, user_id, user_id), fetchall=True)
        results = []
        for r in (res["result"] or []):
            item = dict(r)
            item["id"] = item.get("partner_id")
            item["user_id"] = item.get("partner_id")
            item["is_verified"] = bool(item.get("skill_is_verified") or item.get("user_is_verified"))
            results.append(item)
        return results

# ==============================================================================
# MESSAGES
# ==============================================================================

def send_message(sender_id, receiver_id, message_text):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        msg_id = str(get_next_id("messages"))
        msg_doc = {
            "id": msg_id,
            "sender_id": str(sender_id),
            "receiver_id": str(receiver_id),
            "message": message_text,
            "is_read": False,
            "created_at": _now_iso()
        }
        db.collection("messages").document(msg_id).set(msg_doc)
        return msg_doc
    else:
        res = local_db.execute_query(
            "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
            (sender_id, receiver_id, message_text),
            commit=True
        )
        msg_row = local_db.execute_query("SELECT * FROM messages WHERE id = ?", (res["lastrowid"],), fetchone=True)
        return msg_row["result"]

def get_conversation(user1_id, user2_id):
    u1 = str(user1_id)
    u2 = str(user2_id)
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        docs1 = list(db.collection("messages").where("sender_id", "==", u1).where("receiver_id", "==", u2).stream())
        docs2 = list(db.collection("messages").where("sender_id", "==", u2).where("receiver_id", "==", u1).stream())
        all_msgs = [d.to_dict() for d in docs1 + docs2]
        all_msgs.sort(key=lambda x: x.get("created_at", ""))
        return all_msgs
    else:
        res = local_db.execute_query(
            """SELECT * FROM messages 
               WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
               ORDER BY id ASC""",
            (user1_id, user2_id, user2_id, user1_id),
            fetchall=True
        )
        return res["result"] or []

# ==============================================================================
# NOTIFICATIONS
# ==============================================================================

def create_notification(user_id, notif_type, message):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        notif_id = str(get_next_id("notifications"))
        doc = {
            "id": notif_id,
            "user_id": str(user_id),
            "type": notif_type,
            "message": message,
            "is_read": False,
            "created_at": _now_iso()
        }
        db.collection("notifications").document(notif_id).set(doc)
        return doc
    else:
        res = local_db.execute_query(
            "INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)",
            (user_id, notif_type, message),
            commit=True
        )
        return {"id": res["lastrowid"], "user_id": user_id, "type": notif_type, "message": message, "is_read": 0}

def get_notifications(user_id):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        docs = db.collection("notifications").where("user_id", "==", str(user_id)).stream()
        notifs = [d.to_dict() for d in docs]
        notifs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return notifs
    else:
        res = local_db.execute_query(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20",
            (user_id,), fetchall=True
        )
        return res["result"] or []

def mark_notifications_read(user_id):
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        docs = db.collection("notifications").where("user_id", "==", str(user_id)).stream()
        for d in docs:
            d.reference.update({"is_read": True})
        return True
    else:
        local_db.execute_query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user_id,), commit=True)
        return True

# ==============================================================================
# STATS & ADMIN
# ==============================================================================

def get_stats():
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        u_count = len(list(db.collection("users").stream()))
        s_count = len(list(db.collection("skills").stream()))
        req_count = len(list(db.collection("exchange_requests").where("status", "==", "Accepted").stream()))
        c_count = len(list(db.collection("connections").stream()))
        return {
            "students_connected": max(u_count, 120),
            "real_users": u_count,
            "skills_shared": max(s_count, 85),
            "real_skills": s_count,
            "exchanges_completed": max(req_count, 45),
            "real_exchanges": req_count,
            "active_connections": max(c_count, 32),
            "real_connections": c_count
        }
    else:
        u_count = local_db.execute_query("SELECT COUNT(*) as c FROM users", fetchone=True)["result"]["c"]
        s_count = local_db.execute_query("SELECT COUNT(*) as c FROM skills", fetchone=True)["result"]["c"]
        r_count = local_db.execute_query("SELECT COUNT(*) as c FROM exchange_requests WHERE status = 'Accepted'", fetchone=True)["result"]["c"]
        c_count = local_db.execute_query("SELECT COUNT(*) as c FROM connections", fetchone=True)["result"]["c"]
        return {
            "students_connected": max(u_count, 120),
            "real_users": u_count,
            "skills_shared": max(s_count, 85),
            "real_skills": s_count,
            "exchanges_completed": max(r_count, 45),
            "real_exchanges": r_count,
            "active_connections": max(c_count, 32),
            "real_connections": c_count
        }

def get_admin_overview():
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        all_u = [d.to_dict() for d in db.collection("users").stream()]
        non_admin = [u for u in all_u if u.get("role") != "admin"]
        v_count = sum(1 for u in non_admin if u.get("is_verified"))
        p_count = sum(1 for u in non_admin if u.get("verification_status") == "pending" or (u.get("certificate_url") and not u.get("is_verified")))
        s_count = len(list(db.collection("skills").stream()))
        e_count = len(list(db.collection("exchange_requests").stream()))
        c_count = len(list(db.collection("connections").stream()))
        return {
            "total_users": len(non_admin),
            "total_skills": s_count,
            "verified_mentors": v_count,
            "pending_verifications": p_count,
            "total_exchanges": e_count,
            "total_connections": c_count
        }
    else:
        u_count = local_db.execute_query("SELECT COUNT(*) as c FROM users WHERE role != 'admin'", fetchone=True)["result"]["c"]
        s_count = local_db.execute_query("SELECT COUNT(*) as c FROM skills", fetchone=True)["result"]["c"]
        v_count = local_db.execute_query("SELECT COUNT(*) as c FROM users WHERE is_verified = 1 AND role != 'admin'", fetchone=True)["result"]["c"]
        p_count = local_db.execute_query("SELECT COUNT(*) as c FROM users WHERE (verification_status = 'pending' OR (certificate_url != '' AND is_verified = 0)) AND role != 'admin'", fetchone=True)["result"]["c"]
        e_count = local_db.execute_query("SELECT COUNT(*) as c FROM exchange_requests", fetchone=True)["result"]["c"]
        c_count = local_db.execute_query("SELECT COUNT(*) as c FROM connections", fetchone=True)["result"]["c"]
        return {
            "total_users": u_count,
            "total_skills": s_count,
            "verified_mentors": v_count,
            "pending_verifications": p_count,
            "total_exchanges": e_count,
            "total_connections": c_count
        }

def get_admin_verifications():
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        skills = [s.to_dict() for s in db.collection("skills").stream()]
        cert_skills = [s for s in skills if s.get("certificate_url")]
        items = []
        for s in cert_skills:
            u = get_user_by_id(s.get("user_id"))
            if u:
                items.append({
                    "user_id": u.get("id"),
                    "name": u.get("name"),
                    "email": u.get("email"),
                    "department": u.get("department"),
                    "semester": u.get("semester"),
                    "profile_image": u.get("profile_image"),
                    "user_status": u.get("verification_status"),
                    "user_is_verified": u.get("is_verified"),
                    "skill_id": s.get("id"),
                    "skill_name": s.get("skill_name"),
                    "skill_level": s.get("skill_level"),
                    "certificate_title": s.get("certificate_title") or "Skill Credential",
                    "cert_title": s.get("certificate_title") or "Skill Credential",
                    "certificate_url": s.get("certificate_url"),
                    "cert_url": s.get("certificate_url"),
                    "video_url": s.get("video_url"),
                    "skill_status": s.get("verification_status"),
                    "skill_is_verified": s.get("is_verified"),
                    "is_verified": bool(s.get("is_verified") or u.get("is_verified")),
                    "created_at": s.get("created_at")
                })
        return items
    else:
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
        res = local_db.execute_query(query, fetchall=True)
        items = []
        for r in (res["result"] or []):
            item = dict(r)
            item["cert_url"] = item.get("certificate_url") or ""
            item["cert_title"] = item.get("certificate_title") or "Skill Credential"
            item["is_verified"] = bool(item.get("skill_is_verified") or item.get("user_is_verified"))
            items.append(item)
        return items

def get_admin_users():
    if firebase_config.is_firebase_live():
        db = firebase_config.get_firestore_client()
        users = [d.to_dict() for d in db.collection("users").stream()]
        users_list = []
        for u in users:
            uid = u.get("id")
            s_count = len(list(db.collection("skills").where("user_id", "==", str(uid)).stream()))
            c_count = len(list(db.collection("connections").where("user1_id", "==", str(uid)).stream())) + \
                      len(list(db.collection("connections").where("user2_id", "==", str(uid)).stream()))
            users_list.append({
                "id": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "department": u.get("department"),
                "semester": u.get("semester"),
                "role": u.get("role", "student"),
                "profile_image": u.get("profile_image"),
                "verification_status": u.get("verification_status", "unverified"),
                "is_verified": bool(u.get("is_verified")),
                "created_at": u.get("created_at"),
                "skills_count": s_count,
                "connections_count": c_count
            })
        return users_list
    else:
        query = """
            SELECT u.id, u.name, u.email, u.department, u.semester, u.role, u.profile_image,
                   u.verification_status, u.is_verified, u.created_at,
                   (SELECT COUNT(*) FROM skills WHERE user_id = u.id) as skills_count,
                   (SELECT COUNT(*) FROM connections WHERE user1_id = u.id OR user2_id = u.id) as connections_count
            FROM users u
            ORDER BY u.role DESC, u.id DESC
        """
        res = local_db.execute_query(query, fetchall=True)
        users = []
        for r in (res["result"] or []):
            u = dict(r)
            u["is_verified"] = bool(u.get("is_verified"))
            users.append(u)
        return users

def seed_default_data():
    """Initializes local database tables and seed accounts"""
    local_db.init_db()
