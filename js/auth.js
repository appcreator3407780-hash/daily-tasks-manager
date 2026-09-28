import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
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

    const input =
      document.getElementById(targetId);

    if (!input) return;

    if (input.type === "password") {

      input.type = "text";

      button.textContent = "🙈";

      button.setAttribute(
        "aria-label",
        "Hide password"
      );

    } else {

      input.type = "password";

      button.textContent = "👁";

      button.setAttribute(
        "aria-label",
        "Show password"
      );

    }

  });

});


// ============================================
// REGISTER
// ============================================

const registerForm =
  document.getElementById("registerForm");


if (registerForm) {

  registerForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const message =
        document.getElementById(
          "registerMessage"
        );


      const name =
        document
          .getElementById("registerName")
          .value
          .trim();


      const email =
        document
          .getElementById("registerEmail")
          .value
          .trim();


      const password =
        document
          .getElementById("registerPassword")
          .value;


      const confirmPassword =
        document
          .getElementById("confirmPassword")
          .value;


      message.textContent = "";


      if (
        password !== confirmPassword
      ) {

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

        const result =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          result.user;


        /*
         * Every public registration
         * becomes an active Admin.
         */

        await setDoc(
          doc(
            db,
            "users",
            user.uid
          ),
          {

            uid: user.uid,

            name: name,

            email: email,

            role: "admin",

            status: "active",

            createdAt:
              serverTimestamp()

          }
        );


        message.style.color =
          "#63e6be";


        message.textContent =
          "Account created successfully!";


        setTimeout(
          () => {

            window.location.href =
              "dashboard.html";

          },
          500
        );


      } catch (error) {

        console.error(
          "Registration error:",
          error
        );


        message.style.color =
          "#ff5f6d";


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
            "Firestore permission denied.";

        }

        else {

          message.textContent =
            "Registration failed: " +
            error.message;

        }

      }

    }
  );

}


// ============================================
// LOGIN
// ============================================

const loginForm =
  document.getElementById("loginForm");


if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const message =
        document.getElementById(
          "loginMessage"
        );


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


      try {

        /*
         * Login with Firebase
         */

        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          result.user;


        /*
         * Check that Firestore profile exists.
         */

        const userSnap =
          await getDoc(
            doc(
              db,
              "users",
              user.uid
            )
          );


        if (!userSnap.exists()) {

          message.textContent =
            "Your account profile was not found.";

          return;

        }


        const data =
          userSnap.data();


        if (
          data.status ===
          "disabled"
        ) {

          message.textContent =
            "Your account has been disabled.";

          return;

        }


        message.style.color =
          "#63e6be";


        message.textContent =
          "Login successful!";


        /*
         * Go directly to dashboard.
         */

        setTimeout(
          () => {

            window.location.href =
              "dashboard.html";

          },
          300
        );


      } catch (error) {

        console.error(
          "Login error:",
          error
        );


        message.style.color =
          "#ff5f6d";


        if (
          error.code ===
          "auth/invalid-credential"
          ||
          error.code ===
          "auth/wrong-password"
          ||
          error.code ===
          "auth/user-not-found"
        ) {

          message.textContent =
            "Invalid email or password.";

        }

        else if (
          error.code ===
          "auth/too-many-requests"
        ) {

          message.textContent =
            "Too many attempts. Please try again later.";

        }

        else if (
          error.code ===
          "permission-denied"
        ) {

          message.textContent =
            "Firestore permission denied.";

        }

        else {

          message.textContent =
            "Login failed: " +
            error.message;

        }

      }

    }
  );

}
