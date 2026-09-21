# TALENT EXCHANGE

> **Learn. Teach. Connect.**  
> *The premier campus skill-sharing & peer mentorship platform.*

---

## 🌟 Overview

**Talent Exchange** is a modern, responsive web platform designed for students and learners to trade knowledge directly through peer-to-peer barter. Students can share what they know, learn what they love, demonstrate their expertise through teaching demo videos, and earn verified mentor status by submitting skill certificates.

### 🏛️ Pure Firebase Architecture

The platform operates on a 100% serverless, cloud-native architecture powered by **Google Firebase** and **GitHub Pages**:

```
                       TALENT EXCHANGE

              ┌─────────────────────────────┐
              │          FRONTEND           │
              │   HTML5 + CSS + JavaScript  │
              │  GitHub Pages / Web Server  │
              └──────────────┬──────────────┘
                             │
                             │ Firebase Web SDK (v10.8.0)
                             ▼
              ┌─────────────────────────────┐
              │          FIREBASE           │
              │                             │
              │  🔥 Firebase Authentication │
              │  📦 Cloud Firestore         │
              │  🗂️ Firebase Cloud Storage  │
              │  🌐 Firebase Hosting        │
              └─────────────────────────────┘
```

- **Zero Server Overhead**: Does NOT require Render, Flask, or PostgreSQL for production operation.
- **Firebase Project**: `talent-exchange-b8827`
- **Frontend Hosting**: Deployable directly via GitHub Pages or Firebase Hosting.
- **Realtime Database**: Cloud Firestore provides instant messaging, notifications, and live status updates without polling.
- **Authentication**: Firebase Authentication securely manages student and admin accounts with client-side credential verification.
- **Cloud Storage**: Firebase Cloud Storage securely hosts teaching demonstration videos, skill certificates, and profile images.

---

## ✨ Features

1. **Authentication & Roles**:
   - Student registration and login powered by Firebase Authentication.
   - Separate **Administrator Portal** (`admin-login.html` & `admin.html`) with role-based access control (`role: "admin"`).
   - Session persistence and secure sign-out.

2. **Skill Discovery & Filtering (`find-skills.html`)**:
   - Filter by skill name, department, semester, and a dedicated **"Verified Mentors Only"** toggle.
   - User cards display teaching skills, learning interests, bios, verification badges, and preview buttons.

3. **Skill Exchange Workflow (`requests.html` & `dashboard.html`)**:
   - Send targeted exchange proposals specifying what you offer and what you want in return.
   - Prevents duplicate pending requests and prevents self-proposals.
   - Accepting a proposal automatically creates a mutual connection in the `connections` collection and triggers a realtime notification.

4. **Real-time Chat Engine (`chat.html`)**:
   - Live messaging powered by Cloud Firestore `onSnapshot` realtime listeners.
   - Instant message delivery without manual page refreshing.
   - Sender identity tied directly to `firebase.auth().currentUser.uid`.

5. **Teaching Demonstration Videos (`offer-skill.html`, `profile.html`)**:
   - Students upload demonstration videos (`.mp4`, `.webm`, `.ogg`, `.mov`, up to 50MB) or provide streaming links.
   - Stored in Firebase Cloud Storage under `teaching-videos/{uid}/`.
   - Embedded modal video player (`▶ Watch Teaching Video`) allows learners to preview teaching styles.

6. **Skill Certificate Verification & Verified Mentor Badge (`admin.html`)**:
   - Students submit credential documents (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`) or Credly links.
   - Stored in Firebase Cloud Storage under `certificates/{uid}/`.
   - Submitted certificates enter an admin review queue with `status: "pending"`.
   - Administrator reviews credential documents and approves or rejects submissions.
   - Approved students receive the prestigious **`🛡️ Verified Mentor`** badge across their profile, cards, and search results.

7. **Audio & Video Collaboration Preview (`calls.js`)**:
   - Browser WebRTC (`getUserMedia()`, `RTCPeerConnection`).
   - Clear UI distinction between **Local Preview (Waiting for peer)** and **Connected Call**.
   - Camera toggle, microphone mute/unmute, live call timer, and hang-up controls.

8. **Admin Control Console & Live Analytics (`admin.html`)**:
   - Dynamic platform metrics loaded live from Firestore: Total Students, Skills Offered, Verified Mentors, Pending Review, Active Connections, and Completed Exchanges.
   - Comprehensive student directory with search and badge management.

9. **Progressive Web App (PWA)**:
   - Modern glassmorphism UI theme with responsive mobile navigation.
   - Offline static app shell caching via `service-worker.js`.
   - Direct network pass-through for all live Firebase operations.

---

## 📁 Project Structure

```
talent-exchange1/
├── frontend/                     # Primary web application source
│   ├── index.html                # Landing page & platform overview
│   ├── login.html                # Student login portal
│   ├── register.html             # Student registration with video/cert uploads
│   ├── dashboard.html            # Student dashboard with live metrics & recommendations
│   ├── find-skills.html          # Search & filter students and verified mentors
│   ├── offer-skill.html          # Skill offering & credential submission form
│   ├── requests.html             # Incoming & outgoing exchange proposals
│   ├── connections.html          # Established student connections & call launchers
│   ├── chat.html                 # Real-time Firestore messaging interface
│   ├── profile.html              # Student profile management & verification status
│   ├── admin-login.html          # Administrator login portal
│   ├── admin.html                # Administrator moderation & certificate review console
│   ├── manifest.json             # PWA web app manifest
│   ├── service-worker.js         # Service worker for offline shell caching
│   ├── css/
│   │   ├── style.css             # Core design system, glassmorphism, buttons, navbar
│   │   ├── auth.css              # Authentication card and input styles
│   │   ├── dashboard.css         # Dashboard grid, metric cards, user cards
│   │   └── chat.css              # Real-time chat bubbles and WebRTC call modal
│   ├── js/
│   │   ├── firebase-config.js    # Firebase Web SDK initialization (talent-exchange-b8827)
│   │   ├── firebase-auth.js      # Authentication service (UID, register, login, session)
│   │   ├── firebase-db.js        # Cloud Firestore database layer (all collections & seeder)
│   │   ├── firebase-storage.js   # Cloud Storage uploads (videos, certificates, avatars)
│   │   ├── api.js                # Central client utilities, modals, navbar renderer, toasts
│   │   ├── auth.js               # Login and registration form controllers
│   │   ├── dashboard.js          # Dashboard live data and recommendations controller
│   │   ├── skills.js             # Find skills and offer skill form controllers
│   │   ├── requests.js           # Proposal acceptance and rejection logic
│   │   ├── connections.js        # Connections list and profile viewers
│   │   ├── chat.js               # Firestore onSnapshot messaging engine
│   │   ├── calls.js              # WebRTC camera, mic, and call modal logic
│   │   └── admin.js              # Admin verification queue & analytics controller
│   └── assets/                   # SVG logos and default user avatars
│
├── docs/                         # Synchronized mirror for GitHub Pages deployment
├── public/                       # Synchronized mirror for Firebase Hosting
├── firestore.rules               # Cloud Firestore security rules
├── storage.rules                 # Firebase Cloud Storage security rules
├── firestore.indexes.json        # Firestore composite indexes
├── firebase.json                 # Firebase Hosting & Firestore configuration
├── .firebaserc                   # Firebase project binding (talent-exchange-b8827)
└── README.md                     # Documentation
```

---

## 🚀 How to Run Locally

Because the platform uses direct client-to-Firebase communication, no local database or backend compilation is needed:

1. **Serve the files with any static HTTP server**:
   ```bash
   # Using Python 3
   cd frontend
   python -m http.server 8000
   ```
   *or*
   ```bash
   # Using Node.js npx serve
   npx serve frontend
   ```

2. **Open in browser**:
   Navigate to `http://localhost:8000` (or double-click `run-local.bat`).

---

## 🌐 How to Deploy to GitHub Pages

1. **Repository Configuration**:
   - Push your code to your GitHub repository: `https://github.com/varun23606-blip/talent-exchange1`
2. **Enable GitHub Pages**:
   - In GitHub: navigate to **Settings** → **Pages**.
   - Under **Build and deployment**:
     - **Source**: `Deploy from a branch`
     - **Branch**: `main`, Folder: `/docs` (or `/` if deploying from root).
   - Click **Save**.
3. **Live URL**:
   - GitHub Pages will publish your site instantly at your repository URL:
     `https://varun23606-blip.github.io/talent-exchange1/`
   - All authentication, Firestore database operations, and file storage will run directly against Firebase without requiring any backend server!

---

## 🧪 Testing the Complete User Flow

### 1. Pre-configured Demo Accounts
The platform includes built-in demo profiles that seed into Firestore automatically:

| Role | Name | Email | Password | Primary Skill |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | System Administrator | `admin@talentexchange.edu` | `Admin123!` | Platform Moderation |
| **Student** | Mahadev Patel | `mahadev@talentexchange.edu` | `Password123!` | Python (Teaches) / Guitar (Wants) |
| **Student** | Rahul Sharma | `rahul@talentexchange.edu` | `Password123!` | Guitar (Teaches) / Python (Wants) |
| **Student** | Ananya Iyer | `ananya@talentexchange.edu` | `Password123!` | UI/UX Design (Teaches) |

### 2. Verified Mentorship Flow (Mahadev → Rahul)
1. **Sign in as Mahadev**:
   - Go to `login.html`, sign in with `mahadev@talentexchange.edu` / `Password123!`.
   - On `dashboard.html`, review your offered skill (Python) and wanted skill (Guitar).
2. **Propose Exchange**:
   - Go to `find-skills.html`.
   - Search for **"Guitar"** to find **Rahul Sharma** (with verified badge 🛡️ and teaching video).
   - Click **▶ Watch Teaching Video** to preview Rahul playing acoustic guitar in the modal player.
   - Click **📜 View Certificate** to inspect his Trinity College credential.
   - Click **🤝 Request Exchange**, verify the offered and requested skills, and click **Send Proposal**.
3. **Accept Proposal as Rahul**:
   - Open an Incognito window, go to `login.html`, and sign in as `rahul@talentexchange.edu` / `Password123!`.
   - Check the notification bell 🔔 in the navbar.
   - Go to `requests.html`, locate Mahadev's proposal, and click **Accept Exchange**.
4. **Real-time Messaging**:
   - Navigate to `connections.html` or `chat.html`.
   - Select Mahadev from the contacts list and send a message.
   - The message delivers in real time via Firestore `onSnapshot` listeners.
5. **WebRTC Local Preview**:
   - Click **📹 Video Call** in the chat header.
   - Browser prompts for camera and microphone access.
   - The screen shows the live camera feed with **"Local Preview Active (Waiting for peer)"**, mic mute toggle, and camera toggle.
6. **Admin Certificate Verification**:
   - Go to `admin-login.html`, sign in with `admin@talentexchange.edu` / `Admin123!`.
   - In `admin.html`, review live statistics (Students, Skills, Verified Mentors, Pending Review, Connections, Exchanges).
   - In the **Mentor Skill Certificate Verifications** table, inspect student submissions, preview their certificates and videos, and click **✅ Approve** or **❌ Reject**.
   - Approving updates Firestore, awards the student the `🛡️ Verified Mentor` badge, and sends an in-app notification.

---

## 🔒 Security & Privacy

- **Firebase Authentication**: User identity is verified on every request using Auth UID. Passwords are never stored in Firestore or localStorage.
- **Firestore Security Rules**: Configured in `firestore.rules` to prevent unauthorized role escalation, protect private conversation messages, and restrict certificate verification to administrators.
- **Cloud Storage Security Rules**: Configured in `storage.rules` to ensure students can only upload and modify media in their own UID folders (`teaching-videos/{uid}/`, `certificates/{uid}/`).