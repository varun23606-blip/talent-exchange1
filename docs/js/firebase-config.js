/**
 * ==============================================================================
 * TALENT EXCHANGE - FIREBASE CLIENT CONFIGURATION & INITIALIZATION
 * ==============================================================================
 * Project: talent-exchange-b8827
 * Connected on: 2026-09-21
 * ==============================================================================
 */

// Official Firebase Web configuration for Talent Exchange
const firebaseConfig = {
  apiKey: "AIzaSyD9LKX1GFGJXnNWWZOQZon4VyEx6b0a65Y",
  authDomain: "talent-exchange-b8827.firebaseapp.com",
  projectId: "talent-exchange-b8827",
  storageBucket: "talent-exchange-b8827.firebasestorage.app",
  messagingSenderId: "166142955644",
  appId: "1:166142955644:web:b30063851d3c4cac48b9f9",
  measurementId: "G-JRCG828E5X"
};

const FIREBASE_CONFIG = firebaseConfig;

let _firebaseApp = null;
let _firestoreDb = null;
let _firebaseStorage = null;
let _firebaseAuth = null;

/**
 * Initializes the Firebase Web SDK if the SDK is loaded in window.
 */
function initFirebaseClient() {
  if (typeof window !== "undefined" && typeof window.firebase !== "undefined") {
    try {
      if (!window.firebase.apps || window.firebase.apps.length === 0) {
        _firebaseApp = window.firebase.initializeApp(firebaseConfig);
        console.log("[Firebase Client]: Initialized app for project:", firebaseConfig.projectId);
      } else {
        _firebaseApp = window.firebase.apps[0];
      }

      if (typeof window.firebase.firestore === "function") {
        _firestoreDb = window.firebase.firestore();
        console.log("[Firebase Client]: Cloud Firestore ready.");
      }
      if (typeof window.firebase.storage === "function") {
        _firebaseStorage = window.firebase.storage();
        console.log("[Firebase Client]: Cloud Storage ready (bucket: " + firebaseConfig.storageBucket + ").");
      }
      if (typeof window.firebase.auth === "function") {
        _firebaseAuth = window.firebase.auth();
      }
    } catch (err) {
      console.warn("[Firebase Client Init]:", err.message);
    }
  }
  return _firebaseApp;
}

/**
 * Checks if the project is configured with live Firebase credentials.
 */
function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.projectId === "talent-exchange-b8827" &&
    FIREBASE_CONFIG.apiKey.startsWith("AIza")
  );
}

/**
 * Returns the client configuration object.
 */
function getFirebaseConfig() {
  return FIREBASE_CONFIG;
}

/**
 * Direct file upload helper to Firebase Cloud Storage (bucket: talent-exchange-b8827.firebasestorage.app)
 */
async function uploadToFirebaseStorage(file, folder = "uploads") {
  if (!_firebaseStorage) {
    initFirebaseClient();
  }

  if (!_firebaseStorage) {
    throw new Error("Firebase Storage SDK is not loaded. Falling back to backend server upload.");
  }

  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${folder}/${timestamp}_${cleanName}`;
  const storageRef = _firebaseStorage.ref().child(filePath);

  const snapshot = await storageRef.put(file);
  const downloadUrl = await snapshot.ref.getDownloadURL();

  return {
    success: true,
    url: downloadUrl,
    filename: cleanName,
    storage: "firebase_cloud_storage"
  };
}

// Global exports
if (typeof window !== "undefined") {
  window.firebaseConfig = firebaseConfig;
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.isFirebaseConfigured = isFirebaseConfigured;
  window.getFirebaseConfig = getFirebaseConfig;
  window.initFirebaseClient = initFirebaseClient;
  window.uploadToFirebaseStorage = uploadToFirebaseStorage;

  // Auto-initialize if Firebase script already loaded
  if (typeof window.firebase !== "undefined") {
    initFirebaseClient();
  }
}
