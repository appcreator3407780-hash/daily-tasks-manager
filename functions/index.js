const { onCall, HttpsError } =
  require("firebase-functions/v2/https");

const { initializeApp } =
  require("firebase-admin/app");

const { getAuth } =
  require("firebase-admin/auth");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");


initializeApp();

const db = getFirestore();

const adminAuth = getAuth();


// =====================================================
// GET USER PROFILE
// =====================================================

async function caller(uid) {

  const snap =
    await db.doc(`users/${uid}`).get();

  return snap.exists
    ? snap.data()
    : null;
}


// =====================================================
// CHECK ROLE
// =====================================================

async function requireRole(context, roles) {

  if (!context.auth) {

    throw new HttpsError(
      "unauthenticated",
      "Login required."
    );

  }

  const profile =
    await caller(context.auth.uid);


  if (
    !profile ||
    !roles.includes(profile.role) ||
    profile.status !== "active"
  ) {

    throw new HttpsError(
      "permission-denied",
      "You are not allowed to perform this action."
    );

  }


  return profile;
}


// =====================================================
// CREATE ACCOUNT
// =====================================================

exports.createAccount = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      name,
      email,
      password,
      role,
      createdBy
    } = request.data || {};


    if (
      !name ||
      !email ||
      !password ||
      password.length < 6
    ) {

      throw new HttpsError(
        "invalid-argument",
        "Name, email and password are required."
      );

    }


    if (
      !["admin", "user"].includes(role)
    ) {

      throw new HttpsError(
        "invalid-argument",
        "Invalid role."
      );

    }


    // Only Super Admin can create Admins

    if (
      role === "admin" &&
      actor.role !== "super_admin"
    ) {

      throw new HttpsError(
        "permission-denied",
        "Only Super Admin can create admins."
      );

    }


    const owner =
      role === "user"
        ? (createdBy || actor.uid)
        : actor.uid;


    // Admin can only create own users

    if (
      role === "user" &&
      actor.role === "admin" &&
      owner !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "Invalid user owner."
      );

    }


    try {

      const userRecord =
        await adminAuth.createUser({

          email,
          password,

          displayName:
            name

        });


      await db
        .doc(`users/${userRecord.uid}`)
        .set({

          uid:
            userRecord.uid,

          name,

          email,

          role,

          status:
            "active",

          createdBy:
            owner,

          createdAt:
            FieldValue.serverTimestamp()

        });


      return {
        uid:
          userRecord.uid
      };


    } catch (error) {

      console.error(
        "Create account error:",
        error
      );


      if (
        error.code ===
        "auth/email-already-exists"
      ) {

        throw new HttpsError(
          "already-exists",
          "This email is already registered."
        );

      }


      throw new HttpsError(
        "internal",
        error.message ||
        "Unable to create account."
      );

    }

  }
);


// =====================================================
// UPDATE PROFILE
// =====================================================

exports.updateProfile = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      uid,
      name
    } =
      request.data || {};


    if (!uid || !name) {

      throw new HttpsError(
        "invalid-argument",
        "UID and name are required."
      );

    }


    const target =
      await caller(uid);


    if (!target) {

      throw new HttpsError(
        "not-found",
        "Profile not found."
      );

    }


    if (
      actor.role === "admin" &&
      target.createdBy !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "You do not own this user."
      );

    }


    await db
      .doc(`users/${uid}`)
      .update({

        name

      });


    await adminAuth.updateUser(
      uid,
      {
        displayName:
          name
      }
    );


    return {
      ok:
        true
    };

  }
);


// =====================================================
// ENABLE / DISABLE ACCOUNT
// =====================================================

exports.setAccountStatus = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      uid,
      status
    } =
      request.data || {};


    if (
      !uid ||
      !["active", "disabled"].includes(status)
    ) {

      throw new HttpsError(
        "invalid-argument",
        "Invalid request."
      );

    }


    const target =
      await caller(uid);


    if (!target) {

      throw new HttpsError(
        "not-found",
        "Account not found."
      );

    }


    if (
      target.role === "super_admin"
    ) {

      throw new HttpsError(
        "permission-denied",
        "Super Admin cannot be disabled."
      );

    }


    if (
      actor.role === "admin" &&
      (
        target.role !== "user" ||
        target.createdBy !== actor.uid
      )
    ) {

      throw new HttpsError(
        "permission-denied",
        "You cannot manage this account."
      );

    }


    await db
      .doc(`users/${uid}`)
      .update({

        status

      });


    await adminAuth.updateUser(
      uid,
      {
        disabled:
          status === "disabled"
      }
    );


    return {
      ok:
        true
    };

  }
);


// =====================================================
// DELETE ACCOUNT
// =====================================================

exports.deleteAccount = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      uid
    } =
      request.data || {};


    if (!uid) {

      throw new HttpsError(
        "invalid-argument",
        "User UID is required."
      );

    }


    const target =
      await caller(uid);


    if (!target) {

      throw new HttpsError(
        "not-found",
        "Account not found."
      );

    }


    // Super Admin cannot be deleted

    if (
      target.role === "super_admin"
    ) {

      throw new HttpsError(
        "permission-denied",
        "Super Admin cannot be deleted."
      );

    }


    // Admin can only delete own users

    if (
      actor.role === "admin" &&
      (
        target.role !== "user" ||
        target.createdBy !== actor.uid
      )
    ) {

      throw new HttpsError(
        "permission-denied",
        "You cannot delete this account."
      );

    }


    try {

      // Delete Firebase Authentication account

      await adminAuth.deleteUser(uid);


    } catch (error) {

      // If Auth account is already missing,
      // still remove Firestore profile.

      if (
        error.code !==
        "auth/user-not-found"
      ) {

        console.error(
          "Auth delete error:",
          error
        );

        throw new HttpsError(
          "internal",
          "Unable to delete authentication account."
        );

      }

    }


    // Delete Firestore profile

    await db
      .doc(`users/${uid}`)
      .delete();


    // Remove user from groups

    const groupSnapshot =
      await db
        .collection("groups")
        .where(
          "memberIds",
          "array-contains",
          uid
        )
        .get();


    const batch =
      db.batch();


    groupSnapshot.forEach(
      groupDoc => {

        const data =
          groupDoc.data();


        const memberIds =
          Array.isArray(data.memberIds)
            ? data.memberIds.filter(
                id => id !== uid
              )
            : [];


        batch.update(
          groupDoc.ref,
          {
            memberIds
          }
        );

      }
    );


    await batch.commit();


    return {
      ok:
        true
    };

  }
);


// =====================================================
// CREATE GROUP
// =====================================================

exports.createGroup = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      name,
      description,
      memberIds
    } =
      request.data || {};


    if (!name || !name.trim()) {

      throw new HttpsError(
        "invalid-argument",
        "Group name is required."
      );

    }


    let members =
      Array.isArray(memberIds)
        ? [...new Set(memberIds)]
        : [];


    // Admin can only add users created by himself

    if (
      actor.role === "admin"
    ) {

      const validMembers = [];


      for (
        const uid of members
      ) {

        const user =
          await caller(uid);


        if (
          user &&
          user.role === "user" &&
          user.createdBy === actor.uid
        ) {

          validMembers.push(uid);

        }

      }


      members =
        validMembers;

    }


    const groupRef =
      await db
        .collection("groups")
        .add({

          name:
            name.trim(),

          description:
            (description || "").trim(),

          createdBy:
            actor.uid,

          createdByRole:
            actor.role,

          memberIds:
            members,

          memberCount:
            members.length,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp()

        });


    return {

      ok:
        true,

      groupId:
        groupRef.id

    };

  }
);


// =====================================================
// UPDATE GROUP
// =====================================================

exports.updateGroup = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      groupId,
      name,
      description,
      memberIds
    } =
      request.data || {};


    if (!groupId) {

      throw new HttpsError(
        "invalid-argument",
        "Group ID is required."
      );

    }


    const groupRef =
      db.doc(
        `groups/${groupId}`
      );


    const groupSnap =
      await groupRef.get();


    if (!groupSnap.exists) {

      throw new HttpsError(
        "not-found",
        "Group not found."
      );

    }


    const group =
      groupSnap.data();


    if (
      actor.role === "admin" &&
      group.createdBy !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "You do not own this group."
      );

    }


    let members =
      Array.isArray(memberIds)
        ? [...new Set(memberIds)]
        : (
          Array.isArray(group.memberIds)
            ? group.memberIds
            : []
        );


    if (
      actor.role === "admin"
    ) {

      const validMembers = [];


      for (
        const uid of members
      ) {

        const user =
          await caller(uid);


        if (
          user &&
          user.role === "user" &&
          user.createdBy === actor.uid
        ) {

          validMembers.push(uid);

        }

      }


      members =
        validMembers;

    }


    await groupRef.update({

      name:
        name !== undefined
          ? String(name).trim()
          : group.name,

      description:
        description !== undefined
          ? String(description).trim()
          : group.description,

      memberIds:
        members,

      memberCount:
        members.length,

      updatedAt:
        FieldValue.serverTimestamp()

    });


    return {
      ok:
        true
    };

  }
);


// =====================================================
// DELETE GROUP
// =====================================================

exports.deleteGroup = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      groupId
    } =
      request.data || {};


    if (!groupId) {

      throw new HttpsError(
        "invalid-argument",
        "Group ID is required."
      );

    }


    const groupRef =
      db.doc(
        `groups/${groupId}`
      );


    const groupSnap =
      await groupRef.get();


    if (!groupSnap.exists) {

      throw new HttpsError(
        "not-found",
        "Group not found."
      );

    }


    const group =
      groupSnap.data();


    if (
      actor.role === "admin" &&
      group.createdBy !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "You do not own this group."
      );

    }


    await groupRef.delete();


    return {
      ok:
        true
    };

  }
);


// =====================================================
// ADD MEMBER TO GROUP
// =====================================================

exports.addGroupMember = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      groupId,
      userId
    } =
      request.data || {};


    if (!groupId || !userId) {

      throw new HttpsError(
        "invalid-argument",
        "Group ID and user ID are required."
      );

    }


    const groupRef =
      db.doc(
        `groups/${groupId}`
      );


    const groupSnap =
      await groupRef.get();


    if (!groupSnap.exists) {

      throw new HttpsError(
        "not-found",
        "Group not found."
      );

    }


    const group =
      groupSnap.data();


    if (
      actor.role === "admin" &&
      group.createdBy !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "You do not own this group."
      );

    }


    const user =
      await caller(userId);


    if (!user || user.role !== "user") {

      throw new HttpsError(
        "not-found",
        "User not found."
      );

    }


    if (
      actor.role === "admin" &&
      user.createdBy !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "You cannot add this user."
      );

    }


    const currentMembers =
      Array.isArray(group.memberIds)
        ? group.memberIds
        : [];


    if (
      !currentMembers.includes(userId)
    ) {

      currentMembers.push(userId);

    }


    await groupRef.update({

      memberIds:
        currentMembers,

      memberCount:
        currentMembers.length,

      updatedAt:
        FieldValue.serverTimestamp()

    });


    return {
      ok:
        true
    };

  }
);


// =====================================================
// REMOVE MEMBER FROM GROUP
// =====================================================

exports.removeGroupMember = onCall(
  async (request) => {

    const actor =
      await requireRole(
        request,
        ["super_admin", "admin"]
      );


    const {
      groupId,
      userId
    } =
      request.data || {};


    if (!groupId || !userId) {

      throw new HttpsError(
        "invalid-argument",
        "Group ID and user ID are required."
      );

    }


    const groupRef =
      db.doc(
        `groups/${groupId}`
      );


    const groupSnap =
      await groupRef.get();


    if (!groupSnap.exists) {

      throw new HttpsError(
        "not-found",
        "Group not found."
      );

    }


    const group =
      groupSnap.data();


    if (
      actor.role === "admin" &&
      group.createdBy !== actor.uid
    ) {

      throw new HttpsError(
        "permission-denied",
        "You do not own this group."
      );

    }


    const members =
      Array.isArray(group.memberIds)
        ? group.memberIds.filter(
            id => id !== userId
          )
        : [];


    await groupRef.update({

      memberIds:
        members,

      memberCount:
        members.length,

      updatedAt:
        FieldValue.serverTimestamp()

    });


    return {
      ok:
        true
    };

  }
);
