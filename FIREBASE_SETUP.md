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

## ⚡ Quick Summary: Client Architecture

1. **The Frontend (`frontend/js/`)** connects directly to Firebase services using the official Firebase Web SDK (v10.8.0):
   - **Authentication** (`js/firebase-auth.js`): Manages student registration, student login, and admin login directly with Firebase Auth.
   - **Database** (`js/firebase-db.js`): Reads and writes users, skills, exchange proposals, connections, messages, and certificates directly with Cloud Firestore.
   - **Storage** (`js/firebase-storage.js`): Uploads demonstration videos and certificates directly into Firebase Cloud Storage.
2. **Real-Time Responsiveness**:
   - Cloud Firestore `onSnapshot` listeners deliver instant chat messages and notifications without page refreshing.
   - Zero Render, Flask, or PostgreSQL dependencies are required for production operation.

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
1. Open your project's service account settings directly:
   👉 **[Firebase Console Service Accounts (talent-exchange-b8827)](https://console.firebase.google.com/project/talent-exchange-b8827/settings/serviceaccounts/adminsdk)**
2. Click the blue button **"Generate new private key"**.
3. Confirm by clicking **"Generate key"**. A `.json` file will download to your computer.
4. Rename the downloaded file to:
   ```
   serviceAccountKey.json
   ```
5. Move `serviceAccountKey.json` into the `talent-exchange/backend/` directory:
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

### Step 5: Frontend Web Configuration (Already Connected! ✅)
Your Firebase Web configuration has already been connected to [`frontend/js/firebase-config.js`](frontend/js/firebase-config.js):
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD9LKX1GFGJXnNWWZOQZon4VyEx6b0a65Y",
  authDomain: "talent-exchange-b8827.firebaseapp.com",
  projectId: "talent-exchange-b8827",
  storageBucket: "talent-exchange-b8827.firebasestorage.app",
  messagingSenderId: "166142955644",
  appId: "1:166142955644:web:b30063851d3c4cac48b9f9",
  measurementId: "G-JRCG828E5X"
};
```
All frontend HTML pages now load the Firebase Web SDK v10.8.0 and initialize this configuration automatically.

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

## 🌐 Production Deployment (GitHub Pages)
 
1. **Push Repository to GitHub**:
   - Push your code to your repository: `https://github.com/varun23606-blip/talent-exchange1`
2. **Enable GitHub Pages**:
   - Navigate to **Settings** → **Pages**.
   - Under **Build and deployment**: Select Source: `Deploy from a branch`, Branch: `main`, Folder: `/docs` (or `/`).
   - Click **Save**.
3. **Live Deployment**:
   - GitHub Pages serves your site directly:
     `https://varun23606-blip.github.io/talent-exchange1/`
   - The frontend communicates directly with Firebase Authentication, Cloud Firestore, and Cloud Storage with zero backend servers!
