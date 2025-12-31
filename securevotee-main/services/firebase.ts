// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,   // ← NEW: For sign-up
  signInWithEmailAndPassword,       // ← NEW: For email/password login
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDxtiT582quKD83Fr0znyry-xl42R6yoFg",
  authDomain: "campusvote-830c6.firebaseapp.com",
  projectId: "campusvote-830c6",
  storageBucket: "campusvote-830c6.firebasestorage.app",
  messagingSenderId: "415494360676",
  appId: "1:415494360676:web:17a586e51978f9b6d85971",
  // measurementId: "G-SEQNW4RLXV" // Optional: Uncomment if using Analytics
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Providers
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Restrict Google to your university domain
googleProvider.setCustomParameters({
  hd: 'cunima.ac.mw'
});

// Export all auth methods
export {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,   // ← For registration
  signInWithEmailAndPassword,       // ← For login
};

//goog