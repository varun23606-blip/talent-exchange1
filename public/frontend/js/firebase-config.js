/**
 * ==============================================================================
 * TALENT EXCHANGE - FIREBASE CLIENT CONFIGURATION & INITIALIZATION
 * ==============================================================================
 * Project: talent-exchange-b8827
 * Architecture: Serverless Firebase (Auth, Firestore, Cloud Storage)
 * ==============================================================================
 */

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
 * Initializes the Firebase Web SDK.
 */
function initFirebaseClient() {
  if (typeof window !== "undefined" && typeof window.firebase !== "undefined") {
    try {
      if (!window.firebase.apps || window.firebase.apps.length === 0) {
        _firebaseApp = window.firebase.initializeApp(firebaseConfig);
        console.log("[Talent Exchange Firebase]: Initialized app for project:", firebaseConfig.projectId);
      } else {
        _firebaseApp = window.firebase.apps[0];
      }

      if (typeof window.firebase.auth === "function") {
        _firebaseAuth = window.firebase.auth();
        window.auth = _firebaseAuth;
      }

      if (typeof window.firebase.firestore === "function") {
        _firestoreDb = window.firebase.firestore();
        window.db = _firestoreDb;
        console.log("[Talent Exchange Firebase]: Cloud Firestore ready.");
      }

      if (typeof window.firebase.storage === "function") {
        _firebaseStorage = window.firebase.storage();
        window.storage = _firebaseStorage;
        console.log("[Talent Exchange Firebase]: Cloud Storage ready (bucket: " + firebaseConfig.storageBucket + ").");
      }
    } catch (err) {
      console.warn("[Talent Exchange Firebase Init Warning]:", err.message);
    }
  }
  return _firebaseApp;
}

function getFirebaseAuth() {
  if (!_firebaseAuth && typeof window !== "undefined" && window.firebase) {
    initFirebaseClient();
  }
  return _firebaseAuth || (window.firebase && typeof window.firebase.auth === "function" ? window.firebase.auth() : null);
}

function getFirestoreDb() {
  if (!_firestoreDb && typeof window !== "undefined" && window.firebase) {
    initFirebaseClient();
  }
  return _firestoreDb || (window.firebase && typeof window.firebase.firestore === "function" ? window.firebase.firestore() : null);
}

function getFirebaseStorage() {
  if (!_firebaseStorage && typeof window !== "undefined" && window.firebase) {
    initFirebaseClient();
  }
  return _firebaseStorage || (window.firebase && typeof window.firebase.storage === "function" ? window.firebase.storage() : null);
}

function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.projectId === "talent-exchange-b8827" &&
    FIREBASE_CONFIG.apiKey.startsWith("AIza")
  );
}

// Global exports
if (typeof window !== "undefined") {
  window.firebaseConfig = firebaseConfig;
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.isFirebaseConfigured = isFirebaseConfigured;
  window.initFirebaseClient = initFirebaseClient;
  window.getFirebaseAuth = getFirebaseAuth;
  window.getFirestoreDb = getFirestoreDb;
  window.getFirebaseStorage = getFirebaseStorage;

  if (typeof window.firebase !== "undefined") {
    initFirebaseClient();
  }
}
