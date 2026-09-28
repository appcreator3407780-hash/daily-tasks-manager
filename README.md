# Daily Tasks Manager

Professional Firebase + Vercel web app with 3 roles:

- Super Admin
- Admin
- User

## Features

### Super Admin
- View all admins
- Create admins
- Edit/disable/delete admins
- View every admin's users
- View all tasks
- Create groups and assign admins/users
- Overall task statistics

### Admin
- Create/edit/delete users
- Create groups
- Assign tasks
- View user task progress
- View task statistics
- Search users
- Disable/enable users

### User
- View assigned tasks
- Accept task
- Move task to In Progress
- Complete task
- Cannot edit/delete tasks

## Firebase setup

1. Enable Email/Password in Firebase Authentication.
2. Create Firestore Database.
3. Deploy the Firestore rules from `firestore.rules`.
4. Deploy Cloud Functions from `functions/`.
5. Create the first Super Admin manually in Firebase Authentication.
6. Create a matching document in Firestore:
   `users/{AUTH_UID}`
   with:
   - uid: same Auth UID
   - name: Super Admin
   - email: the same email
   - role: super_admin
   - status: active

The browser Firebase config is intentionally in `js/firebase-config.js`. Firebase web config/API keys are not admin secrets. Never put a Firebase service-account private key in the frontend.

## Vercel

This is a static frontend, so the project can be deployed to Vercel directly.

The secure operations that create/delete Firebase Authentication accounts are handled by Cloud Functions.

## Important

Creating Firebase Authentication users from the browser while an admin is logged in would replace the current Auth session. This project therefore uses Cloud Functions for admin-created accounts.
