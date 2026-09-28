import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHKGKZGZtcddPgca5IVhj1PchWCkcL880",
  authDomain: "daily-tasks-manager-85f77.firebaseapp.com",
  projectId: "daily-tasks-manager-85f77",
  storageBucket: "daily-tasks-manager-85f77.firebasestorage.app",
  messagingSenderId: "1055247251842",
  appId: "1:1055247251842:web:ad422a351c1395b496379b"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db
};
