import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";


// ============================================
// PASSWORD SHOW / HIDE
// ============================================

document.querySelectorAll(".eye-btn").forEach(button => {

  button.addEventListener("click", () => {

    const targetId = button.dataset.target;
    const input = document.getElementById(targetId);

    if (!input) return;

    if (input.type === "password") {

      input.type = "text";
      button.textContent = "🙈";
      button.setAttribute("aria-label", "Hide password");

    } else {

      input.type = "password";
      button.textContent = "👁";
      button.setAttribute("aria-label", "Show password");

    }

  });

});


// ============================================
// REGISTER
// ============================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {

  registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const message =
      document.getElementById("registerMessage");

    const name =
      document.getElementById("registerName").value.trim();

    const email =
      document.getElementById("registerEmail").value.trim();

    const password =
      document.getElementById("registerPassword").value;

    const confirmPassword =
      document.getElementById("confirmPassword").value;


    message.textContent = "";
    message.style.color = "#ff5f6d";


    // Password check
    if (password !== confirmPassword) {

      message.textContent =
        "Passwords do not match.";

      return;
    }


    if (password.length < 6) {

      message.textContent =
        "Password must contain at least 6 characters.";

      return;
    }


    try {

      // Create Firebase Authentication account
      const result =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = result.user;


      // Create user's Firestore profile
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: name,
          email: email,

          // Every normal registration is an Admin
          role: "admin",
          status: "active",

          createdAt: serverTimestamp()
        }
      );


      message.style.color = "#63e6be";

      message.textContent =
        "Account created successfully!";


      // Give Firebase a moment to save
      setTimeout(() => {

        window.location.href = "dashboard.html";

      }, 800);


    } catch (error) {

      console.error("Registration error:", error);

      message.style.color = "#ff5f6d";


      if (
        error.code ===
        "auth/email-already-in-use"
      ) {

        message.textContent =
          "This email is already registered.";

      }

      else if (
        error.code ===
        "auth/invalid-email"
      ) {

        message.textContent =
          "Please enter a valid email address.";

      }

      else if (
        error.code ===
        "auth/weak-password"
      ) {

        message.textContent =
          "Password is too weak.";

      }

      else if (
        error.code ===
        "permission-denied"
      ) {

        message.textContent =
          "Firestore permission denied. Check your Firebase Rules.";

      }

      else {

        message.textContent =
          "Registration failed: " +
          error.message;

      }

    }

  });

}


// ============================================
// LOGIN
// ============================================

const loginForm =
  document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const message =
      document.getElementById("loginMessage");

    const email =
      document
        .getElementById("loginEmail")
        .value
        .trim();

    const password =
      document
        .getElementById("loginPassword")
        .value;


    message.textContent = "";
    message.style.color = "#ff5f6d";


    try {

      // Firebase login
      const result =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = result.user;


      // Get Firestore profile
      const userRef =
        doc(db, "users", user.uid);

      const userSnap =
        await getDoc(userRef);


      if (!userSnap.exists()) {

        await signOut(auth);

        message.textContent =
          "Your account profile was not found.";

        return;
      }


      const userData =
        userSnap.data();


      // Disabled accounts cannot login
      if (userData.status === "disabled") {

        await signOut(auth);

        message.textContent =
          "Your account has been disabled.";

        return;
      }


      // Active account → Dashboard
      window.location.href =
        "dashboard.html";


    } catch (error) {

      console.error("Login error:", error);

      message.style.color = "#ff5f6d";


      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {

        message.textContent =
          "Invalid email or password.";

      }

      else if (
        error.code === "auth/too-many-requests"
      ) {

        message.textContent =
          "Too many attempts. Please try again later.";

      }

      else if (
        error.code === "permission-denied"
      ) {

        message.textContent =
          "Permission denied. Check Firestore Rules.";

      }

      else {

        message.textContent =
          "Login failed: " +
          error.message;

      }

    }

  });

}


// ============================================
// PROTECT DASHBOARD
// ============================================

if (
  window.location.pathname.endsWith(
    "dashboard.html"
  )
) {

  onAuthStateChanged(
    auth,
    async (user) => {

      if (!user) {

        window.location.href =
          "index.html";

        return;
      }


      try {

        const userSnap =
          await getDoc(
            doc(db, "users", user.uid)
          );


        if (!userSnap.exists()) {

          await signOut(auth);

          window.location.href =
            "index.html";

          return;
        }


        const data =
          userSnap.data();


        if (data.status === "disabled") {

          await signOut(auth);

          window.location.href =
            "index.html";

          return;
        }


        // Account is active
        console.log(
          "Logged in:",
          data.name,
          data.role
        );


      } catch (error) {

        console.error(
          "Dashboard authentication error:",
          error
        );

      }

    }
  );

}
