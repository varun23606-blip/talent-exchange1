# 🔥 Talent Exchange - Firebase Backend & Connection Guide

This guide explains how **Firebase** powers the **Talent Exchange** backend (Cloud Firestore, Firebase Admin SDK, Firebase Storage) and how the **Frontend connects to the Backend**.

---

## 🏗️ Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                       FRONTEND (Web Browser)                     │
│  - Vanilla JS, HTML5, CSS3 Glassmorphic UI                       │
│  - Config: frontend/js/api.js (API_BASE_URL)                     │
│  - Client Config: frontend/js/firebase-config.js                 │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                         REST JSON / Fetch API
                         (CORS Enabled on Backend)
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│                     BACKEND (Flask Web Service)                  │
│  - app.py: REST API routes & media upload handling               │
│  - firebase_config.py: Firebase Admin SDK credentials loader     │
│  - firebase_db.py: Cloud Firestore CRUD collections layer        │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                     Firebase Admin SDK (Python)
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
┌────────▼────────────────────────┐       ┌────────────────▼───────────────┐
│     GOOGLE CLOUD FIRESTORE      │       │     FIREBASE CLOUD STORAGE     │
│  Collections:                   │       │  Buckets:                      │
│  - users (students & admins)    │       │  - /videos (Teaching Demos)    │
│  - skills (offered skills)      │       │  - /certificates (Diplomas)    │
│  - exchange_requests            │       └────────────────────────────────┘
│  - connections                  │
│  - messages (chat history)      │
│  - notifications                │
└─────────────────────────────────┘
```

---

## ⚡ Quick Summary: How Frontend and Backend Connect

1. **The Frontend (`frontend/js/api.js`)** sends requests to the backend using standard HTTP `fetch()`:
   - When running locally: `http://localhost:5000`
   - When running in production (GitHub Pages): your Render backend URL
2. **The Backend (`backend/app.py`)** receives the HTTP requests:
   - Validates data and hashes passwords with PBKDF2/SHA256.
   - Saves records into **Google Cloud Firestore** via `backend/firebase_db.py`.
   - Stores demonstration videos and certificates directly into **Firebase Cloud Storage**.
3. **The Backend returns JSON** back to the frontend:
   - The frontend immediately updates the UI, renders the glassmorphic cards, streams teaching videos, or displays certificates.

---

## 📋 Step-by-Step Setup Guide

### Step 1: Create a Project in Firebase Console
1. Open [Google Firebase Console](https://console.firebase.google.com).
2. Click **"Add project"** (or **"Create a project"**).
3. Enter project name (e.g. `talent-exchange-app`).
4. Disable Google Analytics (optional, for simplicity) and click **Create Project**.

---

### Step 2: Enable Cloud Firestore Database
1. In your Firebase Console left sidebar, click **Build** → **Firestore Database**.
2. Click **"Create database"**.
3. Choose a location close to your users (e.g. `us-central1` or `asia-south1`).
4. For security rules, select **"Start in test mode"** (allows reads/writes during development) and click **Enable**.

---

### Step 3: Enable Firebase Storage (for Videos & Certificates)
1. In the left sidebar, click **Build** → **Storage**.
2. Click **"Get started"**.
3. Select **"Start in test mode"** and click **Next** → **Done**.

---

### Step 4: Download your Private Key (`serviceAccountKey.json`)
1. In the Firebase Console, click the **Settings Gear (⚙️)** next to "Project Overview" → **Project settings**.
2. Click the **Service accounts** tab.
3. Click the blue button **"Generate new private key"**.
4. Confirm by clicking **"Generate key"**. A `.json` file will download to your computer.
5. Rename the downloaded file to:
   ```
   serviceAccountKey.json
   ```
6. Move `serviceAccountKey.json` into the `talent-exchange/backend/` directory:
   ```
   talent-exchange/
   ├── backend/
   │   ├── serviceAccountKey.json   <-- PLACE IT HERE
   │   ├── app.py
   │   ├── firebase_config.py
   │   └── firebase_db.py
   ```

> [!TIP]
> `backend/serviceAccountKey.json` is already listed in `.gitignore` so your private key will never be accidentally committed to GitHub.

---

### Step 5: (Optional) Configure Frontend Web App Keys
If you want to use the optional client-side Firebase SDK:
1. In Firebase Console, go to **Project settings** → **General**.
2. Scroll down to **Your apps**, click the **Web icon (`</>`)**.
3. Register app name: `Talent Exchange Web`.
4. Copy the `firebaseConfig` object and paste it into [`frontend/js/firebase-config.js`](file:///C:/Users/varun/.gemini/antigravity/scratch/talent-exchange/frontend/js/firebase-config.js):
   ```javascript
   const FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "talent-exchange-app.firebaseapp.com",
     projectId: "talent-exchange-app",
     storageBucket: "talent-exchange-app.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```

---

## 🚀 Running the Application

### 1. Launch with One Click (Windows)
Double-click [`run-local.bat`](file:///C:/Users/varun/.gemini/antigravity/scratch/talent-exchange/run-local.bat) in the project root. It will start:
- The Backend on `http://localhost:5000`
- The Frontend on `http://localhost:8000`
- Open your default browser automatically.

### 2. Or Launch via Terminal
**Terminal 1 (Backend):**
```powershell
cd backend
python -m pip install -r requirements.txt
python app.py
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
python -m http.server 8000
```

---

## 🔍 Checking Connection Status

Visit the health endpoint in your browser:
```
http://localhost:5000/api/firebase-status
```
You will receive:
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "is_live": true,
    "project_id": "talent-exchange-app",
    "storage_bucket": "talent-exchange-app.appspot.com",
    "mode": "Live Google Cloud Firebase"
  }
}
```

If you haven't added `serviceAccountKey.json` yet, the backend automatically runs in **Local Development Mode** without crashing:
```json
{
  "success": true,
  "data": {
    "status": "local_dev_fallback",
    "is_live": false,
    "mode": "Local Development Mode"
  }
}
```

---

## 🛡️ Default Seed Accounts for Testing

| Email | Password | Role | Skills & Badges |
|---|---|---|---|
| `admin@talentexchange.edu` | `Admin123!` | Administrator | System Admin Console (`admin.html`) |
| `mahadev@talentexchange.edu` | `Password123!` | Student | Python • PCAP Certified 🛡️ • Video Demo |
| `rahul@talentexchange.edu` | `Password123!` | Student | Guitar • Trinity Grade 6 🛡️ • Video Demo |
| `ananya@talentexchange.edu` | `Password123!` | Student | UI/UX • Google UX Certified 🛡️ |

---

## 🌐 Production Deployment (Render + GitHub Pages)

1. **Deploy Backend on Render**:
   - Add environment variable:
     - `FIREBASE_SERVICE_ACCOUNT`: paste the entire JSON content of your `serviceAccountKey.json` as a single string, OR upload as a secret file.
     - `FIREBASE_STORAGE_BUCKET`: `your-project-id.appspot.com`
2. **Deploy Frontend on GitHub Pages**:
   - Push your repository to GitHub.
   - Enable GitHub Pages under **Repository Settings > Pages**.
   - `frontend/js/api.js` will automatically detect GitHub Pages and route all requests to your Render Firebase backend!
