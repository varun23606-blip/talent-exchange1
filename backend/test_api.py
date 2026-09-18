import unittest
import json
import time
from app import app
import database

class TalentExchangeAPITest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_01_health_check(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "online")

    def test_02_login_seed_user(self):
        res = self.client.post("/api/login", json={
            "email": "mahadev@talentexchange.edu",
            "password": "Password123!"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["name"], "Mahadev Patel")
        self.assertEqual(data["data"]["teach_skill"], "Python")
        self.assertNotIn("password_hash", data["data"])

    def test_03_login_wrong_password(self):
        res = self.client.post("/api/login", json={
            "email": "mahadev@talentexchange.edu",
            "password": "WrongPassword!"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data["success"])

    def test_04_register_new_user_and_duplicate(self):
        ts = int(time.time() * 1000)
        test_email = f"student_{ts}@talentexchange.edu"
        res = self.client.post("/api/register", json={
            "name": f"Student {ts}",
            "email": test_email,
            "password": "SecurePassword123!",
            "department": "Computer Science",
            "semester": "Semester 3",
            "teach_skill": "C++",
            "learn_skill": "Machine Learning",
            "bio": "Excited to exchange C++ knowledge for ML foundations."
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("Student", data["data"]["name"])

        # Duplicate attempt with same email
        res_dup = self.client.post("/api/register", json={
            "name": "Duplicate Student",
            "email": test_email,
            "password": "SecurePassword123!"
        })
        self.assertEqual(res_dup.status_code, 400)
        dup_data = res_dup.get_json()
        self.assertFalse(dup_data["success"])
        self.assertIn("already exists", dup_data["message"])

    def test_05_get_users_with_filter(self):
        res = self.client.get("/api/users?exclude_user_id=2")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        user_ids = [u["id"] for u in data["data"]]
        self.assertNotIn(2, user_ids)

        res_skill = self.client.get("/api/users?skill=Guitar")
        self.assertEqual(res_skill.status_code, 200)
        skill_data = res_skill.get_json()
        self.assertTrue(any("guitar" in (u.get("teach_skill") or "").lower() for u in skill_data["data"]))

    def test_06_exchange_request_flow(self):
        # Create a fresh unique test sender and receiver to test full exchange life cycle
        ts = int(time.time() * 1000)
        u1 = self.client.post("/api/register", json={
            "name": f"Exchange Tester A {ts}",
            "email": f"tester_a_{ts}@talentexchange.edu",
            "password": "Password123!",
            "teach_skill": "Python",
            "learn_skill": "Guitar"
        }).get_json()["data"]

        u2 = self.client.post("/api/register", json={
            "name": f"Exchange Tester B {ts}",
            "email": f"tester_b_{ts}@talentexchange.edu",
            "password": "Password123!",
            "teach_skill": "Guitar",
            "learn_skill": "Python"
        }).get_json()["data"]

        # Sender sends request
        res_req = self.client.post("/api/requests", json={
            "sender_id": u1["id"],
            "receiver_id": u2["id"],
            "offered_skill": "Python",
            "requested_skill": "Guitar"
        })
        self.assertEqual(res_req.status_code, 201)
        req_data = res_req.get_json()
        self.assertTrue(req_data["success"])
        req_id = req_data["data"]["id"]

        # Receiver views incoming requests
        res_inc = self.client.get(f"/api/requests?user_id={u2['id']}&type=incoming")
        self.assertEqual(res_inc.status_code, 200)
        inc_data = res_inc.get_json()
        self.assertTrue(any(r["id"] == req_id for r in inc_data["data"]["incoming"]))

        # Receiver accepts request
        res_accept = self.client.put(f"/api/requests/{req_id}", json={"status": "Accepted"})
        self.assertEqual(res_accept.status_code, 200)

        # Verify automatic connection creation
        res_conn = self.client.get(f"/api/connections?user_id={u1['id']}")
        self.assertEqual(res_conn.status_code, 200)
        conns = res_conn.get_json()["data"]
        self.assertTrue(any(c["user_id"] == u2["id"] for c in conns))

    def test_07_chat_messages(self):
        res_msg = self.client.post("/api/messages", json={
            "sender_id": 2,
            "receiver_id": 1,
            "message": "Hey Rahul, let's schedule our first guitar/Python exchange session!"
        })
        self.assertEqual(res_msg.status_code, 201)
        msg_data = res_msg.get_json()
        self.assertTrue(msg_data["success"])

        # Fetch messages
        res_conv = self.client.get("/api/messages/1?current_user_id=2")
        self.assertEqual(res_conv.status_code, 200)
        conv_data = res_conv.get_json()
        self.assertTrue(len(conv_data["data"]) > 0)
        self.assertIn("guitar/Python", conv_data["data"][-1]["message"])

    def test_08_stats(self):
        res = self.client.get("/api/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("students_connected", data["data"])
        self.assertIn("skills_shared", data["data"])

    def test_09_upload_and_verification(self):
        import io
        # Test certificate upload
        data = {
            "file": (io.BytesIO(b"fake certificate pdf content"), "sample_cert.pdf")
        }
        res_upload = self.client.post("/api/upload", data=data, content_type="multipart/form-data")
        self.assertEqual(res_upload.status_code, 201)
        upload_json = res_upload.get_json()
        self.assertTrue(upload_json["success"])
        self.assertIn("uploads/", upload_json["url"])
        self.assertEqual(upload_json["type"], "certificate")

        # Test certificate verification endpoint
        res_ver = self.client.post("/api/verify-certificate", json={
            "user_id": 1,
            "certificate_url": upload_json["url"],
            "certificate_title": "Certified Web & Guitar Instructor",
            "status": "verified"
        })
        self.assertEqual(res_ver.status_code, 200)
        ver_json = res_ver.get_json()
        self.assertTrue(ver_json["success"])
        self.assertTrue(ver_json["data"]["is_verified"])

        # Test only_verified filter in GET /api/users
        res_users = self.client.get("/api/users?only_verified=true")
        self.assertEqual(res_users.status_code, 200)
        users_json = res_users.get_json()
        self.assertTrue(all(u["is_verified"] for u in users_json["data"]))

if __name__ == "__main__":
    unittest.main()