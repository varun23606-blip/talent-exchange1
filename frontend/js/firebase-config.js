/**
 * ==============================================================================
 * TALENT EXCHANGE - FIREBASE CLIENT CONFIGURATION
 * ==============================================================================
 * 
 * HOW TO OBTAIN YOUR CONFIGURATION:
 * 1. Visit the Firebase Console: https://console.firebase.google.com
 * 2. Select or create your project (e.g. "talent-exchange").
 * 3. Go to Project Settings (gear icon) -> General.
 * 4. Scroll down to "Your apps" and click the Web icon (</>).
 * 5. Register app name "Talent Exchange" and copy the firebaseConfig object below.
 * ==============================================================================
 */

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "your-talent-exchange-project.firebaseapp.com",
  projectId: "your-talent-exchange-project",
  storageBucket: "your-talent-exchange-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

/**
 * Checks if the developer has configured live Firebase Web credentials.
 */
function isFirebaseConfigured() {
  return FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY_HERE" &&
         FIREBASE_CONFIG.projectId !== "your-talent-exchange-project";
}

/**
 * Returns the client configuration object.
 */
function getFirebaseConfig() {
  return FIREBASE_CONFIG;
}

// Attach globally for access across frontend scripts
if (typeof window !== "undefined") {
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.isFirebaseConfigured = isFirebaseConfigured;
  window.getFirebaseConfig = getFirebaseConfig;
}
