import os
import sqlite3
from urllib.parse import urlparse
from werkzeug.security import generate_password_hash

DATABASE_URL = os.environ.get("DATABASE_URL")

def is_postgres():
    return bool(DATABASE_URL and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")))

def get_connection():
    if is_postgres():
        import psycopg2
        import psycopg2.extras
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url, sslmode="prefer")
        return conn
    else:
        db_path = os.path.join(os.path.dirname(__file__), "talent_exchange.db")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    params = params or ()
    conn = get_connection()
    is_pg = is_postgres()
    
    if is_pg:
        import psycopg2.extras
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        adapted_query = query.replace("?", "%s")
    else:
        cursor = conn.cursor()
        adapted_query = query

    try:
        cursor.execute(adapted_query, params)
        result = None
        lastrowid = None

        if fetchone:
            row = cursor.fetchone()
            result = dict(row) if row else None
        elif fetchall:
            rows = cursor.fetchall()
            result = [dict(r) for r in rows]
            
        if not is_pg and commit:
            lastrowid = cursor.lastrowid

        if commit:
            conn.commit()

        if is_pg and commit and "RETURNING id" in adapted_query.upper():
            try:
                ret = cursor.fetchone()
                if ret:
                    lastrowid = ret["id"] if isinstance(ret, dict) else ret[0]
            except Exception:
                pass

        return {
            "result": result,
            "lastrowid": lastrowid,
            "rowcount": cursor.rowcount
        }
    finally:
        cursor.close()
        conn.close()

def init_db():
    conn = get_connection()
    is_pg = is_postgres()
    cursor = conn.cursor()

    try:
        if is_pg:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                department VARCHAR(100) DEFAULT '',
                semester VARCHAR(50) DEFAULT '',
                bio TEXT DEFAULT '',
                profile_image TEXT DEFAULT '',
                role VARCHAR(20) DEFAULT 'student',
                certificate_url TEXT DEFAULT '',
                verification_status VARCHAR(20) DEFAULT 'unverified',
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS skills (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                skill_name VARCHAR(100) NOT NULL,
                skill_category VARCHAR(100) DEFAULT 'General',
                skill_level VARCHAR(50) DEFAULT 'Intermediate',
                learning_skill VARCHAR(100) DEFAULT '',
                description TEXT DEFAULT '',
                video_url TEXT DEFAULT '',
                certificate_url TEXT DEFAULT '',
                certificate_title VARCHAR(150) DEFAULT '',
                verification_status VARCHAR(20) DEFAULT 'unverified',
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS exchange_requests (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                offered_skill VARCHAR(100) NOT NULL,
                requested_skill VARCHAR(100) NOT NULL,
                status VARCHAR(20) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS connections (
                id SERIAL PRIMARY KEY,
                user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_connection UNIQUE (user1_id, user2_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(sender_id, receiver_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_requests_status ON exchange_requests(status);
            """)
        else:
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                department TEXT DEFAULT '',
                semester TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                profile_image TEXT DEFAULT '',
                role TEXT DEFAULT 'student',
                certificate_url TEXT DEFAULT '',
                verification_status TEXT DEFAULT 'unverified',
                is_verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                skill_name TEXT NOT NULL,
                skill_category TEXT DEFAULT 'General',
                skill_level TEXT DEFAULT 'Intermediate',
                learning_skill TEXT DEFAULT '',
                description TEXT DEFAULT '',
                video_url TEXT DEFAULT '',
                certificate_url TEXT DEFAULT '',
                certificate_title TEXT DEFAULT '',
                verification_status TEXT DEFAULT 'unverified',
                is_verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS exchange_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                offered_skill TEXT NOT NULL,
                requested_skill TEXT NOT NULL,
                status TEXT DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user1_id, user2_id),
                FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(sender_id, receiver_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
            """)

        conn.commit()

        # Run safe migrations for existing tables if needed
        migrate_schema(cursor, is_pg)
        conn.commit()

    finally:
        cursor.close()
        conn.close()

    seed_demo_data()

def migrate_schema(cursor, is_pg):
    # Ensure new columns exist on users
    user_cols = ["certificate_url", "verification_status", "is_verified"]
    skill_cols = ["video_url", "certificate_url", "certificate_title", "verification_status", "is_verified"]

    if not is_pg:
        cursor.execute("PRAGMA table_info(users)")
        existing_u = [r[1] for r in cursor.fetchall()]
        if "certificate_url" not in existing_u:
            cursor.execute("ALTER TABLE users ADD COLUMN certificate_url TEXT DEFAULT ''")
        if "verification_status" not in existing_u:
            cursor.execute("ALTER TABLE users ADD COLUMN verification_status TEXT DEFAULT 'unverified'")
        if "is_verified" not in existing_u:
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")

        cursor.execute("PRAGMA table_info(skills)")
        existing_s = [r[1] for r in cursor.fetchall()]
        if "video_url" not in existing_s:
            cursor.execute("ALTER TABLE skills ADD COLUMN video_url TEXT DEFAULT ''")
        if "certificate_url" not in existing_s:
            cursor.execute("ALTER TABLE skills ADD COLUMN certificate_url TEXT DEFAULT ''")
        if "certificate_title" not in existing_s:
            cursor.execute("ALTER TABLE skills ADD COLUMN certificate_title TEXT DEFAULT ''")
        if "verification_status" not in existing_s:
            cursor.execute("ALTER TABLE skills ADD COLUMN verification_status TEXT DEFAULT 'unverified'")
        if "is_verified" not in existing_s:
            cursor.execute("ALTER TABLE skills ADD COLUMN is_verified INTEGER DEFAULT 0")

def seed_demo_data():
    check = execute_query("SELECT COUNT(*) as count FROM users", fetchone=True)
    count = check["result"]["count"] if check and check["result"] else 0
    default_pwd = generate_password_hash("Password123!")

    if count == 0:
        # 1. Rahul Sharma
        r_user = execute_query(
            """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, certificate_url, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1)""",
            ("Rahul Sharma", "rahul@talentexchange.edu", default_pwd, "Computer Science", "Semester 6",
             "Acoustic guitarist with 5 years experience, eager to collaborate and master Python automation and web tech.",
             "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
             "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80"),
            commit=True
        )
        rahul_id = r_user["lastrowid"] or 1
        execute_query(
            """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1)""",
            (rahul_id, "Guitar", "Music & Arts", "Advanced", "Python",
             "Acoustic fingerstyle, chord transitions, music theory basics.",
             "https://assets.mixkit.co/videos/preview/mixkit-guitarist-playing-an-acoustic-guitar-3437-large.mp4",
             "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80",
             "Trinity College London - Acoustic Guitar Grade 6 Distinction"),
            commit=True
        )
        
        # 2. Mahadev Patel
        m_user = execute_query(
            """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, certificate_url, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1)""",
            ("Mahadev Patel", "mahadev@talentexchange.edu", default_pwd, "Information Technology", "Semester 4",
             "Passionate about backend software development, algorithms, and eager to learn guitar chords and rhythms.",
             "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
             "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=80"),
            commit=True
        )
        mahadev_id = m_user["lastrowid"] or 2
        execute_query(
            """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1)""",
            (mahadev_id, "Python", "Programming & Tech", "Advanced", "Guitar",
             "Core Python, Flask APIs, script automation, and data structures.",
             "https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-42352-large.mp4",
             "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=80",
             "Python Institute - Certified Associate in Python Programming (PCAP)"),
            commit=True
        )

        # 3. Ananya Iyer
        a_user = execute_query(
            """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, certificate_url, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1)""",
            ("Ananya Iyer", "ananya@talentexchange.edu", default_pwd, "Design & Media", "Semester 5",
             "UI/UX Specialist passionate about Figma, design systems, and looking to learn Modern Frontend Development.",
             "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
             "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop&q=80"),
            commit=True
        )
        ananya_id = a_user["lastrowid"] or 3
        execute_query(
            """INSERT INTO skills (user_id, skill_name, skill_category, skill_level, learning_skill, description, video_url, certificate_url, certificate_title, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1)""",
            (ananya_id, "UI/UX Design", "Design & Creative", "Advanced", "Web Development",
             "Wireframing, high-fidelity prototypes, Figma auto-layout.",
             "",
             "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop&q=80",
             "Google UX Design Professional Certificate"),
            commit=True
        )
        # 4. Administrator
        admin_pwd = generate_password_hash("Admin123!")
        execute_query(
            """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, role, verification_status, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', 'verified', 1)""",
            ("System Administrator", "admin@talentexchange.edu", admin_pwd, "Administration", "Staff",
             "Campus Administrator overseeing skill exchanges, mentor verifications, and community safety.",
             "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80"),
            commit=True
        )
    else:
        # Update existing seed users if they have empty certificates
        execute_query(
            """UPDATE users 
               SET verification_status = 'verified', is_verified = 1,
                    certificate_url = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
               WHERE email = 'rahul@talentexchange.edu' AND (certificate_url IS NULL OR certificate_url = '')""",
            commit=True
        )
        execute_query(
            """UPDATE skills 
               SET verification_status = 'verified', is_verified = 1,
                    certificate_title = 'Trinity College London - Acoustic Guitar Grade 6 Distinction',
                    certificate_url = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
                    video_url = 'https://assets.mixkit.co/videos/preview/mixkit-guitarist-playing-an-acoustic-guitar-3437-large.mp4'
               WHERE skill_name = 'Guitar' AND (certificate_url IS NULL OR certificate_url = '')""",
            commit=True
        )

        execute_query(
            """UPDATE users 
               SET verification_status = 'verified', is_verified = 1,
                    certificate_url = 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=80'
               WHERE email = 'mahadev@talentexchange.edu' AND (certificate_url IS NULL OR certificate_url = '')""",
            commit=True
        )
        execute_query(
            """UPDATE skills 
               SET verification_status = 'verified', is_verified = 1,
                    certificate_title = 'Python Institute - Certified Associate in Python Programming (PCAP)',
                    certificate_url = 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=80',
                    video_url = 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-42352-large.mp4'
               WHERE skill_name = 'Python' AND (certificate_url IS NULL OR certificate_url = '')""",
            commit=True
        )

        # Ensure admin account exists in existing databases
        admin_check = execute_query("SELECT id FROM users WHERE email = 'admin@talentexchange.edu'", fetchone=True)
        if not admin_check or not admin_check["result"]:
            admin_pwd = generate_password_hash("Admin123!")
            execute_query(
                """INSERT INTO users (name, email, password_hash, department, semester, bio, profile_image, role, verification_status, is_verified)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', 'verified', 1)""",
                ("System Administrator", "admin@talentexchange.edu", admin_pwd, "Administration", "Staff",
                 "Campus Administrator overseeing skill exchanges, mentor verifications, and community safety.",
                 "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80"),
                commit=True
            )