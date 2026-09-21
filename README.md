# 🎓 TALENT EXCHANGE
> **"Learn. Teach. Connect."**

Talent Exchange is a production-style campus peer skill-sharing platform powered by a **Firebase** backend (Cloud Firestore NoSQL database, Firebase Cloud Storage for media, and Firebase Admin SDK) with a Python Flask REST API server and a modern glassmorphic responsive frontend. Students can offer skills they are proficient in, discover peers who possess the skills they wish to learn, send reciprocal exchange requests, chat in real time, upload teaching videos and certificates, and launch audio/video collaboration sessions.

---

## 🏗️ Architecture Overview

```
Frontend (HTML5 / Vanilla JS / CSS3) ─────── [GitHub Pages / Local Port 8000]
                 │
                 ▼ (REST JSON / Fetch API via API_BASE_URL)
Backend (Flask REST API + CORS) ───────────── [Render Web Service / Local Port 5000]
                 │
                 ▼ (Firebase Admin SDK / Google Cloud)
Firebase Cloud Services:
  ├── Cloud Firestore ────────────────────── [Users, Skills, Requests, Connections, Messages]
  └── Cloud Storage Bucket ───────────────── [Videos (.mp4/.webm), Certificates (.pdf/.jpg)]
  └── (Auto-fallback to SQLite/local upload if serviceAccountKey.json is not present)
```

> 📖 **Full Firebase Setup Guide**: For complete step-by-step instructions on creating a Firebase project and generating credentials, see [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

### Configurable API Base URL (Frontend → Backend Connection)
The frontend connects to the backend through a single centralized configuration in `frontend/js/api.js`:
```javascript
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://talent-exchange-backend-p5wq.onrender.com";
```
- **Local Development**: When running frontend locally, requests route automatically to `http://localhost:5000`.
- **Production**: When hosted on GitHub Pages or custom domain, requests route automatically to your Render web service backend.

---

## 📁 Repository Structure

```
talent-exchange/
├── FIREBASE_SETUP.md        # Step-by-step Firebase project configuration guide
├── backend/
│   ├── app.py               # Flask REST API endpoints, CORS & routing logic
│   ├── firebase_config.py   # Firebase Admin SDK initialization & credentials loader
│   ├── firebase_db.py       # Cloud Firestore CRUD operations for all collections
│   ├── serviceAccountKey.json.example # Template for Firebase service account private key
│   ├── database.py          # Relational engine & local fallback pool
│   ├── models.py            # Serializers & security sanitizer
│   ├── requirements.txt     # Python production dependencies (firebase-admin, Flask, etc.)
│   ├── Procfile             # Render start command (web: gunicorn app:app)
│   └── test_api.py          # Automated test suite (11 tests, 100% passing)
│
├── frontend/
│   ├── index.html           # Landing page with hero, features, stats, steps
│   ├── login.html           # Student authentication login page
│   ├── admin-login.html     # Administrator authentication portal
│   ├── register.html        # Student registration & skill declaration
│   ├── dashboard.html       # Personalized student hub & recommendations
│   ├── find-skills.html     # Real-time search & discovery directory
│   ├── offer-skill.html     # Skill offering & proficiency editor
│   ├── requests.html        # Inbound and outbound exchange management
│   ├── connections.html     # Active peer network directory
│   ├── chat.html            # Real-time messaging with live polling
│   ├── profile.html         # User profile viewer & editor
│   ├── admin.html           # Admin moderation & certificate verification console
│   ├── manifest.json        # PWA Web App Manifest
│   ├── service-worker.js    # PWA Service Worker (Cache-first assets, live network APIs)
│   │
│   ├── css/
│   │   ├── style.css        # Theme variables, glassmorphism, navbar, toasts, modals
│   │   ├── auth.css         # Auth cards, floating accents, validation layouts
│   │   ├── dashboard.css    # Metrics cards, user cards, filter toolbar
│   │   └── chat.css         # Message bubbles, WebRTC call modals, video stream
│   │
│   ├── js/
│   │   ├── api.js           # Central API client, session management, toast alerts
│   │   ├── firebase-config.js # Client-side Firebase configuration template & helpers
│   │   ├── auth.js          # Client auth forms, validation, login/register flow
│   │   ├── dashboard.js     # Metric counters, partner recommendations
│   │   ├── skills.js        # Search filters, skill posting forms
│   │   ├── requests.js      # Accept / Reject / Cancel exchange proposals
│   │   ├── connections.js   # Peer connection directory & call launchers
│   │   ├── chat.js          # Real-time messaging with 3s polling (fixed field keys)
│   │   ├── calls.js         # Browser WebRTC video & audio media stream capture
│   │   ├── profile.js       # Profile rendering and updates
│   │   └── admin.js         # Admin statistics & certificate verification handlers
│   │
│   └── assets/
│       ├── logo.svg         # Modern vector logo
│       └── avatar-default.svg# Default user avatar
│
└── README.md
```

---

## 🗄️ Database Tables (PostgreSQL)

The database schema is defined in `backend/database.py` with foreign keys, cascading deletes, and indexes:

1. **`users`**:
   - `id` (SERIAL PRIMARY KEY)
   - `name` VARCHAR(100) NOT NULL
   - `email` VARCHAR(150) UNIQUE NOT NULL
   - `password_hash` VARCHAR(255) NOT NULL *(never returned by API)*
   - `department` VARCHAR(100)
   - `semester` VARCHAR(50)
   - `bio` TEXT
   - `profile_image` TEXT
   - `certificate_url` TEXT *(uploaded document or external credential URL)*
   - `verification_status` VARCHAR(50) DEFAULT 'unverified' ('unverified', 'pending', 'verified', 'rejected')
   - `is_verified` INTEGER DEFAULT 0 *(1 = Verified Mentor 🛡️)*
   - `role` VARCHAR(20) DEFAULT 'student'
   - `created_at` TIMESTAMP

2. **`skills`**:
   - `id` (SERIAL PRIMARY KEY)
   - `user_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `skill_name` VARCHAR(100) NOT NULL
   - `skill_category` VARCHAR(100)
   - `skill_level` VARCHAR(50) ('Beginner', 'Intermediate', 'Advanced')
   - `learning_skill` VARCHAR(100)
   - `description` TEXT
   - `video_url` TEXT *(teaching demonstration video)*
   - `certificate_url` TEXT *(proof certificate document)*
   - `certificate_title` VARCHAR(200) *(e.g. AWS Certified Developer, PCAP Python)*
   - `verification_status` VARCHAR(50) DEFAULT 'unverified'
   - `is_verified` INTEGER DEFAULT 0
   - `created_at` TIMESTAMP

3. **`exchange_requests`**:
   - `id` (SERIAL PRIMARY KEY)
   - `sender_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `receiver_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `offered_skill` VARCHAR(100) NOT NULL
   - `requested_skill` VARCHAR(100) NOT NULL
   - `status` VARCHAR(20) DEFAULT 'Pending' ('Pending', 'Accepted', 'Rejected', 'Cancelled')
   - `created_at`, `updated_at` TIMESTAMP

4. **`connections`**:
   - `id` (SERIAL PRIMARY KEY)
   - `user1_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `user2_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `created_at` TIMESTAMP
   - `CONSTRAINT unique_connection UNIQUE (user1_id, user2_id)`

5. **`messages`**:
   - `id` (SERIAL PRIMARY KEY)
   - `sender_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `receiver_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `message` TEXT NOT NULL
   - `is_read` BOOLEAN DEFAULT FALSE
   - `created_at` TIMESTAMP

6. **`notifications`**:
   - `id` (SERIAL PRIMARY KEY)
   - `user_id` INTEGER REFERENCES users(id) ON DELETE CASCADE
   - `type` VARCHAR(50)
   - `message` TEXT
   - `is_read` BOOLEAN DEFAULT FALSE
   - `created_at` TIMESTAMP

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status check |
| `POST` | `/api/upload` | Upload multipart media (videos `.mp4`, `.webm`; certificates `.pdf`, `.png`, `.jpg`) |
| `POST` | `/api/verify-certificate` | Review & verify skill certificates; grants `Verified Mentor 🛡️` badge |
| `POST` | `/api/register` | Create student account (with optional certificate credential) |
| `POST` | `/api/login` | Authenticate student and obtain profile with verification state |
| `POST` | `/api/logout` | Clear session |
| `GET` | `/api/users` | Search students (`?q=`, `?skill=`, `?department=`, `?only_verified=true`, `?exclude_user_id=`) |
| `GET` | `/api/profile/<id>` | Fetch profile with video, certificate, and verification status |
| `PUT` | `/api/profile/<id>` | Update profile details, video demo, and certificate credentials |
| `POST` | `/api/skills` | Add or update student skill with video & certificate |
| `GET` | `/api/skills/<user_id>` | Get all skills for a user |
| `POST` | `/api/requests` | Propose an exchange (`sender_id`, `receiver_id`, `offered_skill`, `requested_skill`) |
| `GET` | `/api/requests` | List user requests (`?user_id=X&type=incoming\|outgoing\|all`) |
| `PUT` | `/api/requests/<id>` | Update request (`Accepted`, `Rejected`, `Cancelled`). Creates connection on `Accepted`. |
| `GET` | `/api/connections` | Get all connected peers for user (`?user_id=X`) |
| `POST` | `/api/messages` | Send a chat message (`sender_id`, `receiver_id`, `message`) |
| `GET` | `/api/messages/<other_id>` | Fetch conversation history (`?current_user_id=X`) |
| `GET` | `/api/notifications` | Get unread & recent notifications (`?user_id=X`) |
| `POST` | `/api/notifications/read-all` | Mark all user notifications as read |
| `GET` | `/api/stats` | Platform statistics (Students, Skills, Exchanges, Connections) |
| `GET` | `/api/firebase-status` | Check live Firebase Firestore & Storage connectivity |
| `GET` | `/api/admin/overview` | Admin metric counters (Total users, skills, verified, pending) |
| `GET` | `/api/admin/verifications` | Admin list of student skill certificate submissions |
| `GET` | `/api/admin/users` | Admin student & staff directory with skill/connection counts |
| `DELETE` | `/api/admin/users/<id>` | Admin remove student account |

---

## 🚀 Running Locally

### Step 1: Start Backend
```bash
cd backend
python -m pip install -r requirements.txt
python app.py
```
Backend will start on `http://localhost:5000`. It automatically initializes the schema and seeds two demonstration student accounts:
- **Student A**: `mahadev@talentexchange.edu` / `Password123!` (Offers Python, Seeks Guitar)
- **Student B**: `rahul@talentexchange.edu` / `Password123!` (Offers Guitar, Seeks Python)

### Step 2: Run Automated Tests
```bash
cd backend
python test_api.py
```
Verifies registration, validation, exchange flow, chat, and stats.

### Step 3: Launch Frontend
Serve the `frontend/` folder with any web server (or Python's built-in HTTP server):
```bash
cd frontend
python -m http.server 8000
```
Open `http://localhost:8000` in your web browser.

---

## 🚢 Deployment Guide

### A. Deploy Backend to Render
1. Create a **Web Service** on [Render](https://render.com).
2. Connect your Git repository containing the `talent-exchange` project.
3. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
4. Create a **PostgreSQL Database** on Render.
5. In your Web Service **Environment Variables**, add:
   - `DATABASE_URL` = `<Render Internal/External Database URL>`
6. Deploy! Render will publish the backend at:
   `https://talent-exchange-backend-p5wq.onrender.com`

### B. Deploy Frontend to GitHub Pages
1. Push the contents of `frontend/` to your GitHub repository (e.g. `govardhan1305/talent-exchange`).
2. In GitHub: go to **Settings** → **Pages**.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` (or `gh-pages`), folder: `/` (or `/frontend` if deployed from repo root).
4. Save. GitHub Pages will publish the frontend at:
   `https://govardhan1305.github.io/talent-exchange/`
5. The frontend will automatically detect that the hostname is not localhost and route all API calls to the Render production backend!

---

## 🧪 Testing the Complete User Flow

1. **Login as Mahadev**:
   - Go to `login.html`.
   - Email: `mahadev@talentexchange.edu`, Password: `Password123!`.
   - You will land on `dashboard.html`.
2. **Find Rahul**:
   - Navigate to `find-skills.html`.
   - Search for `Guitar`. You will see Rahul Sharma.
   - Click **Request Exchange**.
   - Your offered skill `Python` and requested skill `Guitar` are pre-filled.
   - Click **Send Request**.
3. **Login as Rahul in a second window / Incognito tab**:
   - Login with `rahul@talentexchange.edu` / `Password123!`.
   - Notice the notification badge 🔔 in the navbar.
   - Navigate to `requests.html` (or view Pending Requests on Dashboard).
   - Click **Accept Exchange**.
4. **Chat & WebRTC Connection**:
   - Both users will now see each other on `connections.html`.
   - Click **Open Chat**.
   - Send messages in real time! Messages appear instantly and persist to the database.
   - Click **Video Call** or **Audio Call** above the chat window.
   - The browser will prompt for camera and microphone permissions and render the real-time local video feed with mute/unmute and camera toggles!
5. **Teaching Demo Video & Verified Mentor Certificate**:
   - Navigate to `offer-skill.html` or `profile.html`.
   - Upload a teaching demonstration video or provide a video URL to show students how you explain concepts.
   - Upload a certificate document (PDF, PNG, JPG) or Credly URL and add a certificate title (e.g. *PCAP – Certified Associate in Python Programming*).
   - Once verified (or simulated via **Verify My Certificate Now** on `profile.html`), your profile and skill cards gain the **🛡️ Verified Mentor** badge.
   - In `find-skills.html`, other students can check the **🛡️ Verified Mentors** filter, click **▶ Watch Teaching Video** to preview your teaching style in an embedded modal player, or click **📜 View Certificate** to verify your credentials before proposing an exchange!