import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.querySelectorAll(".eye").forEach(btn => {
  btn.onclick = () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === "password" ? "text" : "password";
    btn.textContent = input.type === "password" ? "👁" : "🙈";
  };
});

document.getElementById("registerForm").onsubmit = async e => {
  e.preventDefault();
  const msg = document.getElementById("message");
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;

  if (password !== confirm) return msg.textContent = "Passwords do not match.";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      name, email,
      role: "admin",
      status: "active",
      createdBy: cred.user.uid,
      createdAt: serverTimestamp()
    });
    location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    msg.textContent = err.message || "Registration failed.";
  }
};
