import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.querySelectorAll(".eye").forEach(btn => {
  btn.onclick = () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === "password" ? "text" : "password";
    btn.textContent = input.type === "password" ? "👁" : "🙈";
  };
});

document.getElementById("loginForm").onsubmit = async e => {
  e.preventDefault();
  const msg = document.getElementById("message");
  msg.textContent = "Signing in...";
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value.trim(),
      document.getElementById("password").value
    );
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) throw new Error("Profile not found.");
    const data = snap.data();
    if (data.status === "disabled") throw new Error("Your account is disabled.");
    if (!["super_admin","admin","user"].includes(data.role)) throw new Error("Invalid account role.");
    location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    msg.textContent = err.message || "Login failed.";
  }
};
