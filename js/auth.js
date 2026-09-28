import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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

document
  .querySelectorAll(".eye-btn")
  .forEach((button) => {

    button.addEventListener("click", () => {

      const targetId =
        button.dataset.target;

      const input =
        document.getElementById(targetId);

      if (!input) {
        return;
      }

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
          .trim()
          .toLowerCase();

      const password =
        document
          .getElementById("registerPassword")
          .value;

      const confirmPassword =
        document
          .getElementById("confirmPassword")
          .value;


      message.textContent = "";
      message.style.color = "#ff5f6d";


      // ----------------------------------------
      // VALIDATION
      // ----------------------------------------

      if (!name) {

        message.textContent =
          "Please enter your full name.";

        return;
      }


      if (!email) {

        message.textContent =
          "Please enter your email.";

        return;
      }


      if (
        password !==
        confirmPassword
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

        // --------------------------------------
        // CREATE FIREBASE AUTH ACCOUNT
        // --------------------------------------

        const result =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          result.user;


        // --------------------------------------
        // CREATE ADMIN PROFILE
        // --------------------------------------

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

            /*
             * Public registration creates
             * an Admin account.
             */

            role: "admin",

            status: "active",

            createdBy: null,

            createdAt:
              serverTimestamp()

          }
        );


        message.style.color =
          "#63e6be";

        message.textContent =
          "Admin account created successfully!";


        // --------------------------------------
        // OPEN DASHBOARD
        // --------------------------------------

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


        switch (error.code) {

          case "auth/email-already-in-use":

            message.textContent =
              "This email is already registered.";

            break;


          case "auth/invalid-email":

            message.textContent =
              "Please enter a valid email address.";

            break;


          case "auth/weak-password":

            message.textContent =
              "Password must contain at least 6 characters.";

            break;


          case "permission-denied":

            message.textContent =
              "Firestore permission denied. Check your Firebase Rules.";

            break;


          default:

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
          .trim()
          .toLowerCase();

      const password =
        document
          .getElementById("loginPassword")
          .value;


      message.textContent = "";
      message.style.color = "#ff5f6d";


      if (!email || !password) {

        message.textContent =
          "Please enter email and password.";

        return;
      }


      try {

        // --------------------------------------
        // FIREBASE LOGIN
        // --------------------------------------

        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          result.user;


        // --------------------------------------
        // GET FIRESTORE PROFILE
        // --------------------------------------

        const userRef =
          doc(
            db,
            "users",
            user.uid
          );


        const userSnap =
          await getDoc(userRef);


        // --------------------------------------
        // PROFILE NOT FOUND
        // --------------------------------------

        if (!userSnap.exists()) {

          await signOut(auth);

          message.textContent =
            "Your account profile was not found.";

          return;
        }


        const data =
          userSnap.data();


        // --------------------------------------
        // CHECK STATUS
        // --------------------------------------

        if (
          data.status ===
          "disabled"
        ) {

          await signOut(auth);

          message.textContent =
            "Your account has been disabled.";

          return;
        }


        // --------------------------------------
        // CHECK ROLE
        // --------------------------------------

        const allowedRoles = [
          "super_admin",
          "admin",
          "user"
        ];


        if (
          !allowedRoles.includes(
            data.role
          )
        ) {

          await signOut(auth);

          message.textContent =
            "Your account role is not configured correctly.";

          return;
        }


        // --------------------------------------
        // SUCCESS
        // --------------------------------------

        message.style.color =
          "#63e6be";

        message.textContent =
          "Login successful!";


        /*
         * app.js / dashboard will use
         * the user's role to show the
         * correct interface.
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


        switch (error.code) {

          case "auth/invalid-credential":

          case "auth/wrong-password":

          case "auth/user-not-found":

            message.textContent =
              "Invalid email or password.";

            break;


          case "auth/too-many-requests":

            message.textContent =
              "Too many attempts. Please try again later.";

            break;


          case "auth/user-disabled":

            message.textContent =
              "This Firebase account has been disabled.";

            break;


          case "permission-denied":

            message.textContent =
              "Firestore permission denied. Check your Firebase Rules.";

            break;


          default:

            message.textContent =
              "Login failed: " +
              error.message;

        }

      }

    }
  );

      }
