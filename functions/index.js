const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

async function caller(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

async function requireRole(context, roles) {
  if (!context.auth) throw new HttpsError("unauthenticated", "Login required.");
  const p = await caller(context.auth.uid);
  if (!p || !roles.includes(p.role) || p.status !== "active") {
    throw new HttpsError("permission-denied", "You are not allowed to perform this action.");
  }
  return p;
}

exports.createAccount = onCall(async (request) => {
  const actor = await requireRole(request, ["super_admin", "admin"]);
  const { name, email, password, role, createdBy } = request.data || {};

  if (!name || !email || !password || password.length < 6) {
    throw new HttpsError("invalid-argument", "Name, email and a password of at least 6 characters are required.");
  }

  if (!["admin", "user"].includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }

  if (role === "admin" && actor.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Only Super Admin can create admins.");
  }

  const owner = role === "user" ? (createdBy || actor.uid) : actor.uid;

  if (role === "user" && actor.role === "admin" && owner !== actor.uid) {
    throw new HttpsError("permission-denied", "Invalid owner.");
  }

  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name
    });

    await db.doc(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      name,
      email,
      role,
      status: "active",
      createdBy: owner,
      createdAt: FieldValue.serverTimestamp()
    });

    return { uid: userRecord.uid };
  } catch (e) {
    console.error(e);
    if (e.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already registered.");
    }
    throw new HttpsError("internal", e.message || "Unable to create account.");
  }
});

exports.updateProfile = onCall(async (request) => {
  const actor = await requireRole(request, ["super_admin", "admin"]);
  const { uid, name } = request.data || {};
  if (!uid || !name) throw new HttpsError("invalid-argument", "UID and name are required.");

  const target = await caller(uid);
  if (!target) throw new HttpsError("not-found", "Profile not found.");

  if (actor.role === "admin" && target.createdBy !== actor.uid) {
    throw new HttpsError("permission-denied", "You do not own this user.");
  }

  await db.doc(`users/${uid}`).update({ name });
  await adminAuth.updateUser(uid, { displayName: name });
  return { ok: true };
});

exports.setAccountStatus = onCall(async (request) => {
  const actor = await requireRole(request, ["super_admin", "admin"]);
  const { uid, status } = request.data || {};
  if (!uid || !["active", "disabled"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid request.");
  }

  const target = await caller(uid);
  if (!target) throw new HttpsError("not-found", "Account not found.");

  if (actor.role === "admin" && target.createdBy !== actor.uid) {
    throw new HttpsError("permission-denied", "You do not own this user.");
  }
  if (actor.role === "admin" && target.role !== "user") {
    throw new HttpsError("permission-denied", "Admins cannot manage other admins.");
  }
  if (target.role === "super_admin") {
    throw new HttpsError("permission-denied", "Super Admin cannot be disabled here.");
  }

  await db.doc(`users/${uid}`).update({ status });
  if (status === "disabled") await adminAuth.updateUser(uid, { disabled: true });
  else await adminAuth.updateUser(uid, { disabled: false });

  return { ok: true };
});

exports.deleteAccount = onCall(async (request) => {
  const actor = await requireRole(request, ["super_admin", "admin"]);
  const { uid } = request.data || {};
  const target = await caller(uid);
  if (!target) throw new HttpsError("not-found", "Account not found.");

  if (target.role === "super_admin") {
    throw new HttpsError("permission-denied", "Super Admin cannot be deleted.");
  }
  if (actor.role === "admin" && (target.role !== "user" || target.createdBy !== actor.uid)) {
    throw new HttpsError("permission-denied", "You cannot delete this account.");
  }

  await adminAuth.deleteUser(uid);
  await db.doc(`users/${uid}`).delete();
  return { ok: true };
});
