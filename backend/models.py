from datetime import datetime

def format_datetime(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)

def sanitize_user(user_dict):
    if not user_dict:
        return None
    user = dict(user_dict)
    user.pop("password_hash", None)
    if "created_at" in user:
        user["created_at"] = format_datetime(user["created_at"])
    user["is_verified"] = bool(user.get("is_verified", False))
    user["verification_status"] = user.get("verification_status") or "unverified"
    user["certificate_url"] = user.get("certificate_url") or ""
    return user

def format_skill(skill_dict):
    if not skill_dict:
        return None
    skill = dict(skill_dict)
    if "created_at" in skill:
        skill["created_at"] = format_datetime(skill["created_at"])
    skill["is_verified"] = bool(skill.get("is_verified", False))
    skill["verification_status"] = skill.get("verification_status") or "unverified"
    skill["video_url"] = skill.get("video_url") or ""
    skill["certificate_url"] = skill.get("certificate_url") or ""
    skill["certificate_title"] = skill.get("certificate_title") or ""
    return skill

def format_request(req_dict):
    if not req_dict:
        return None
    req = dict(req_dict)
    if "created_at" in req:
        req["created_at"] = format_datetime(req["created_at"])
    if "updated_at" in req:
        req["updated_at"] = format_datetime(req["updated_at"])
    return req

def format_message(msg_dict):
    if not msg_dict:
        return None
    msg = dict(msg_dict)
    if "created_at" in msg:
        msg["created_at"] = format_datetime(msg["created_at"])
    msg["is_read"] = bool(msg.get("is_read"))
    return msg

def format_notification(notif_dict):
    if not notif_dict:
        return None
    notif = dict(notif_dict)
    if "created_at" in notif:
        notif["created_at"] = format_datetime(notif["created_at"])
    notif["is_read"] = bool(notif.get("is_read"))
    return notif