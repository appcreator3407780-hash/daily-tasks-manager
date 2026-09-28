import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
collection,
query,
where,
getDocs,
doc,
getDoc,
addDoc,
updateDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import {
httpsCallable
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-functions.js";

import {
auth,
db,
functions
} from "./firebase-config.js";

/* =====================================================
STATE
===================================================== */

let me = null;
let users = [];
let admins = [];
let tasks = [];
let groups = [];

/* =====================================================
HELPERS
===================================================== */

const $ = id => document.getElementById(id);

const esc = value =>
String(value ?? "").replace(/[&<>"']/g, char => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
}[char]));

function toast(text) {

const el = $("toast");

if (!el) return;

el.textContent = text;
el.classList.add("show");

setTimeout(() => {
el.classList.remove("show");
}, 2500);
}

function modal(title, body) {

const root = $("modalRoot");

if (!root) return;

root.innerHTML = `
<div class="modal show">

  <div class="modal-card">

    <div class="modal-head">

      <h2>${esc(title)}</h2>

      <button
        class="close"
        id="closeModal">
        ×
      </button>

    </div>

    ${body}

  </div>

</div>

`;

$("closeModal").onclick = () => {
root.innerHTML = "";
};
}

async function callable(name, data = {}) {

const fn = httpsCallable(functions, name);

const result = await fn(data);

return result.data;
}

function friendlyError(error) {

console.error(error);

if (error?.message) {
return error.message;
}

return "Something went wrong. Please try again.";
}

/* =====================================================
AUTH
===================================================== */

onAuthStateChanged(auth, async user => {

if (!user) {
location.replace("index.html");
return;
}

try {

const snap =
  await getDoc(
    doc(db, "users", user.uid)
  );


if (!snap.exists()) {

  await signOut(auth);

  location.replace("index.html");

  return;
}


me = {
  id: user.uid,
  ...snap.data()
};


if (me.status === "disabled") {

  await signOut(auth);

  location.replace("index.html");

  return;
}


if ($("userName")) {
  $("userName").textContent =
    me.name || me.email;
}


if ($("roleLabel")) {

  $("roleLabel").textContent =
    me.role === "super_admin"
      ? "Super Admin"
      : me.role === "admin"
        ? "Admin"
        : "User";

}


configureNavigation();

await loadData();

renderOverview();

} catch (error) {

console.error(error);

toast("Unable to load account.");

}

});

/* =====================================================
NAVIGATION
===================================================== */

function configureNavigation() {

document
.querySelectorAll(".super-only")
.forEach(element => {

  element.style.display =
    me.role === "super_admin"
      ? ""
      : "none";

});

document
.querySelectorAll(".admin-visible")
.forEach(element => {

  element.style.display =
    me.role === "user"
      ? "none"
      : "";

});

document
.querySelectorAll(".user-visible")
.forEach(element => {

  element.style.display = "";

});

document
.querySelectorAll(".nav")
.forEach(button => {

  button.onclick = () => {

    showPage(
      button.dataset.page
    );

  };

});

if ($("logoutBtn")) {

$("logoutBtn").onclick =
  async () => {

    await signOut(auth);

    location.replace("index.html");

  };

}

}

function showPage(page) {

document
.querySelectorAll(".page")
.forEach(element => {

  element.classList.remove("active");

});

document
.querySelectorAll(".nav")
.forEach(element => {

  element.classList.remove("active");

});

$("page-" + page)
?.classList.add("active");

document
.querySelector(
"[data-page="${page}"]"
)
?.classList.add("active");

if (page === "overview") {
renderOverview();
}

if (page === "admins") {
renderAdmins();
}

if (page === "users") {
renderUsers();
}

if (page === "groups") {
renderGroups();
}

if (page === "tasks") {
renderTasks();
}

}

/* =====================================================
LOAD DATA
===================================================== */

async function loadData() {

admins = [];
users = [];
tasks = [];
groups = [];

if (me.role === "super_admin") {

admins =
  await readAll(
    "users",
    "role",
    "admin"
  );

users =
  await readAll(
    "users",
    "role",
    "user"
  );

}

else if (me.role === "admin") {

users =
  await readAll(
    "users",
    "createdBy",
    me.id
  );

}

if (me.role === "user") {

tasks =
  await readAll(
    "tasks",
    "assignedTo",
    me.id
  );

}

else if (me.role === "super_admin") {

tasks =
  await getAll("tasks");

}

else {

tasks =
  await readAll(
    "tasks",
    "createdBy",
    me.id
  );

}

await loadGroups();

}

async function readAll(
collectionName,
field,
value
) {

if (value == null) {
return [];
}

const snap =
await getDocs(
query(
collection(
db,
collectionName
),
where(
field,
"==",
value
)
)
);

return snap.docs.map(
item => ({
id: item.id,
...item.data()
})
);

}

async function getAll(
collectionName
) {

const snap =
await getDocs(
collection(
db,
collectionName
)
);

return snap.docs.map(
item => ({
id: item.id,
...item.data()
})
);

}

/* =====================================================
GROUP DATA
===================================================== */

async function loadGroups() {

try {

const allGroups =
  await getAll("groups");


if (me.role === "super_admin") {

  groups = allGroups;

  return;
}


if (me.role === "admin") {

  groups =
    allGroups.filter(
      group =>
        group.createdBy === me.id
    );

  return;
}


groups =
  allGroups.filter(
    group =>
      Array.isArray(group.memberIds) &&
      group.memberIds.includes(me.id)
  );

} catch (error) {

console.error(
  "Groups loading error:",
  error
);

groups = [];

}

}

/* =====================================================
OVERVIEW
===================================================== */

function statsCards() {

const total =
tasks.length;

const done =
tasks.filter(
task =>
task.status === "completed"
).length;

const progress =
tasks.filter(
task =>
task.status === "in_progress"
).length;

return `
<div class="stats">

  <div class="stat">
    <b>${users.length}</b>
    <span>Users</span>
  </div>

  ${
    me.role === "super_admin"
      ? `
        <div class="stat">
          <b>${admins.length}</b>
          <span>Admins</span>
        </div>
      `
      : ""
  }

  <div class="stat">
    <b>${groups.length}</b>
    <span>Groups</span>
  </div>

  <div class="stat">
    <b>${total}</b>
    <span>Total Tasks</span>
  </div>

  <div class="stat">
    <b>${progress}</b>
    <span>In Progress</span>
  </div>

  <div class="stat">
    <b>${done}</b>
    <span>Completed</span>
  </div>

</div>

`;

}

function renderOverview() {

$("page-overview").innerHTML = `

<div class="page-title">

  <div>

    <h1>
      ${
        me.role === "super_admin"
          ? "Super Admin Overview"
          : me.role === "admin"
            ? "Admin Overview"
            : "My Tasks"
      }
    </h1>

    <p class="muted">
      Welcome back,
      ${esc(me.name || me.email)}
    </p>

  </div>

</div>


${statsCards()}


<div class="panel">

  <h2>Task Progress</h2>

  <div class="progress-row">
    <span>Completed</span>
    <b>
      ${
        tasks.filter(
          t => t.status === "completed"
        ).length
      }
    </b>
  </div>

  <div class="progress-row">
    <span>In Progress</span>
    <b>
      ${
        tasks.filter(
          t => t.status === "in_progress"
        ).length
      }
    </b>
  </div>

  <div class="progress-row">
    <span>Pending</span>
    <b>
      ${
        tasks.filter(
          t => t.status === "pending"
        ).length
      }
    </b>
  </div>

</div>

`;

}

/* =====================================================
ADMINS
===================================================== */

function renderAdmins() {

if (me.role !== "super_admin") {
return;
}

$("page-admins").innerHTML = `

<div class="page-title">

  <div>

    <h1>Admins</h1>

    <p class="muted">
      Manage administrator accounts.
    </p>

  </div>

  <button
    class="primary"
    id="addAdmin">
    + Add Admin
  </button>

</div>


<div class="list">

  ${
    admins.length

      ? admins.map(admin => `

          <div class="card-row">

            <div class="avatar">
              ${esc(
                (admin.name || "A")[0]
                  .toUpperCase()
              )}
            </div>

            <div class="grow">

              <b>
                ${esc(admin.name)}
              </b>

              <small>
                ${esc(admin.email)}
              </small>

            </div>

            <div class="row-actions">

              <span class="badge ${admin.status}">
                ${esc(admin.status)}
              </span>

              <button
                class="ghost"
                data-admin="${admin.id}">
                Manage
              </button>

            </div>

          </div>

        `).join("")

      : `
          <div class="empty">
            No admins found.
          </div>
        `
  }

</div>

`;

$("addAdmin").onclick =
adminModal;

document
.querySelectorAll("[data-admin]")
.forEach(button => {

  button.onclick =
    () =>
      manageAdmin(
        button.dataset.admin
      );

});

}

function adminModal() {

modal(
"Create Admin",

`

<form id="adminForm">

  <label>
    Name
    <input
      id="mName"
      required>
  </label>

  <label>
    Email
    <input
      id="mEmail"
      type="email"
      required>
  </label>

  <label>
    Password

    <span class="password-wrap">

      <input
        id="mPassword"
        type="password"
        minlength="6"
        required>

      <button
        type="button"
        class="eye"
        id="mEye">
        👁
      </button>

    </span>

  </label>

  <button
    class="primary full">
    Create Admin
  </button>

  <div
    id="mMsg"
    class="message">
  </div>

</form>

`

);

$("mEye").onclick = () => {

$("mPassword").type =
  $("mPassword").type === "password"
    ? "text"
    : "password";

};

$("adminForm").onsubmit =
async event => {

  event.preventDefault();

  try {

    await callable(
      "createAccount",
      {
        name:
          $("mName").value.trim(),

        email:
          $("mEmail").value.trim(),

        password:
          $("mPassword").value,

        role:
          "admin"
      }
    );


    $("modalRoot").innerHTML = "";

    toast("Admin created successfully.");

    await loadData();

    renderAdmins();

  } catch (error) {

    $("mMsg").textContent =
      friendlyError(error);

  }

};

}

function manageAdmin(id) {

const admin =
admins.find(
item => item.id === id
);

if (!admin) return;

modal(
admin.name,

`

<div class="detail-grid">

  <div>
    <span>Email</span>
    <b>${esc(admin.email)}</b>
  </div>

  <div>
    <span>Status</span>
    <b>${esc(admin.status)}</b>
  </div>

  <div>
    <span>Users</span>
    <b>
      ${
        users.filter(
          user =>
            user.createdBy === id
        ).length
      }
    </b>
  </div>

  <div>
    <span>Tasks</span>
    <b>
      ${
        tasks.filter(
          task =>
            task.createdBy === id
        ).length
      }
    </b>
  </div>

</div>


<div class="modal-actions">

  <button
    id="toggleAdmin"
    class="ghost">

    ${
      admin.status === "disabled"
        ? "Enable"
        : "Disable"
    }

  </button>


  <button
    id="deleteAdmin"
    class="danger">
    Delete
  </button>

</div>

`

);

$("toggleAdmin").onclick =
async () => {

  try {

    await callable(
      "setAccountStatus",
      {
        uid: id,

        status:
          admin.status === "disabled"
            ? "active"
            : "disabled"
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderAdmins();

    toast("Account status updated.");

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

$("deleteAdmin").onclick =
async () => {

  if (
    !confirm(
      "Delete this admin account?"
    )
  ) {
    return;
  }


  try {

    await callable(
      "deleteAccount",
      {
        uid: id
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderAdmins();

    toast("Admin deleted.");

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}

/* =====================================================
USERS
===================================================== */

function renderUsers() {

const title =
me.role === "super_admin"
? "All Users"
: "My Users";

$("page-users").innerHTML = `

<div class="page-title">

  <div>

    <h1>${title}</h1>

    <p class="muted">
      Manage users and task progress.
    </p>

  </div>

  <button
    class="primary"
    id="addUser">
    + Add User
  </button>

</div>


<input
  id="userSearch"
  class="search"
  placeholder="Search by name or email">


<div
  id="userList"
  class="list">
</div>

`;

const draw = () => {

const search =
  $("userSearch")
    .value
    .toLowerCase();


const filtered =
  users.filter(
    user =>
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(search)
  );


$("userList").innerHTML =
  filtered.length

    ? filtered.map(user => `

        <div class="card-row">

          <div class="avatar">
            ${esc(
              (user.name || "U")[0]
                .toUpperCase()
            )}
          </div>

          <div class="grow">

            <b>
              ${esc(user.name)}
            </b>

            <small>
              ${esc(user.email)}
            </small>

          </div>

          <div class="row-actions">

            <span class="badge ${user.status}">
              ${esc(user.status)}
            </span>

            <button
              class="ghost"
              data-user="${user.id}">
              Open
            </button>

          </div>

        </div>

      `).join("")

    : `
        <div class="empty">
          No users found.
        </div>
      `;


document
  .querySelectorAll("[data-user]")
  .forEach(button => {

    button.onclick =
      () =>
        userDetails(
          button.dataset.user
        );

  });

};

$("userSearch").oninput =
draw;

$("addUser").onclick =
userModal;

draw();

}

function userModal() {

modal(
"Create User",

`

<form id="userForm">

  <label>
    Full Name
    <input
      id="uName"
      required>
  </label>

  <label>
    Email
    <input
      id="uEmail"
      type="email"
      required>
  </label>

  <label>
    Password

    <span class="password-wrap">

      <input
        id="uPassword"
        type="password"
        minlength="6"
        required>

      <button
        type="button"
        class="eye"
        id="uEye">
        👁
      </button>

    </span>

  </label>

  <button
    class="primary full">
    Create User
  </button>

  <div
    id="uMsg"
    class="message">
  </div>

</form>

`

);

$("uEye").onclick = () => {

$("uPassword").type =
  $("uPassword").type === "password"
    ? "text"
    : "password";

};

$("userForm").onsubmit =
async event => {

  event.preventDefault();

  try {

    await callable(
      "createAccount",
      {
        name:
          $("uName").value.trim(),

        email:
          $("uEmail").value.trim(),

        password:
          $("uPassword").value,

        role:
          "user",

        createdBy:
          me.id
      }
    );


    $("modalRoot").innerHTML = "";

    toast("User created successfully.");

    await loadData();

    renderUsers();

  } catch (error) {

    $("uMsg").textContent =
      friendlyError(error);

  }

};

}

function userDetails(id) {

const user =
users.find(
item => item.id === id
);

if (!user) return;

const userTasks =
tasks.filter(
task =>
task.assignedTo === id
);

const completed =
userTasks.filter(
task =>
task.status === "completed"
).length;

const percentage =
userTasks.length
? Math.round(
completed /
userTasks.length *
100
)
: 0;

modal(
user.name,

`

<div class="detail-grid">

  <div>
    <span>Email</span>
    <b>${esc(user.email)}</b>
  </div>

  <div>
    <span>Status</span>
    <b>${esc(user.status)}</b>
  </div>

  <div>
    <span>Total Tasks</span>
    <b>${userTasks.length}</b>
  </div>

  <div>
    <span>Completed</span>
    <b>${completed}</b>
  </div>

</div>


<h3>Progress</h3>

<div class="bar">
  <i style="width:${percentage}%"></i>
</div>


<div class="modal-actions">

  <button
    id="editUser"
    class="ghost">
    Edit
  </button>

  <button
    id="toggleUser"
    class="ghost">

    ${
      user.status === "disabled"
        ? "Enable"
        : "Disable"
    }

  </button>

  <button
    id="deleteUser"
    class="danger">
    Delete
  </button>

</div>

`

);

$("editUser").onclick =
() =>
editUserModal(user);

$("toggleUser").onclick =
async () => {

  try {

    await callable(
      "setAccountStatus",
      {
        uid: id,

        status:
          user.status === "disabled"
            ? "active"
            : "disabled"
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderUsers();

    toast("User status updated.");

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

$("deleteUser").onclick =
async () => {

  if (
    !confirm(
      "Delete this user account?"
    )
  ) {
    return;
  }


  try {

    await callable(
      "deleteAccount",
      {
        uid: id
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderUsers();

    toast("User deleted.");

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}

function editUserModal(user) {

modal(
"Edit User",

`

<form id="editUserForm">

  <label>
    Name

    <input
      id="eName"
      value="${esc(user.name)}"
      required>
  </label>

  <button
    class="primary full">
    Save Changes
  </button>

</form>

`

);

$("editUserForm").onsubmit =
async event => {

  event.preventDefault();

  try {

    await callable(
      "updateProfile",
      {
        uid: user.id,

        name:
          $("eName")
            .value
            .trim()
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderUsers();

    toast("User updated.");

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}

/* =====================================================
GROUPS
===================================================== */

function renderGroups() {

const canManage =
me.role === "super_admin" ||
me.role === "admin";

$("page-groups").innerHTML = `

<div class="page-title">

  <div>

    <h1>Groups</h1>

    <p class="muted">
      Organize your team into groups.
    </p>

  </div>

  ${
    canManage
      ? `
        <button
          class="primary"
          id="newGroup">
          + New Group
        </button>
      `
      : ""
  }

</div>


<div class="list">

  ${
    groups.length

      ? groups.map(group => {

          const count =
            Array.isArray(
              group.memberIds
            )
              ? group.memberIds.length
              : 0;


          return `

            <div class="card-row">

              <div class="avatar">
                ◎
              </div>

              <div class="grow">

                <b>
                  ${esc(group.name)}
                </b>

                <small>
                  ${
                    esc(
                      group.description ||
                      "No description"
                    )
                  }
                </small>

                <small>
                  ${count} member${count === 1 ? "" : "s"}
                </small>

              </div>

              <div class="row-actions">

                ${
                  canManage
                    ? `
                      <button
                        class="ghost"
                        data-group="${group.id}">
                        Manage
                      </button>
                    `
                    : `
                      <span class="badge active">
                        ${count} members
                      </span>
                    `
                }

              </div>

            </div>

          `;

        }).join("")

      : `

        <div class="empty">

          <div style="font-size:35px;margin-bottom:12px">
            ◎
          </div>

          <b style="display:block;color:white;margin-bottom:7px">
            No groups yet
          </b>

          <span>
            Create your first team group.
          </span>

        </div>

      `
  }

</div>

`;

if (canManage) {

$("newGroup").onclick =
  createGroupModal;


document
  .querySelectorAll("[data-group]")
  .forEach(button => {

    button.onclick =
      () =>
        groupDetails(
          button.dataset.group
        );

  });

}

}

/* =====================================================
CREATE GROUP
===================================================== */

function createGroupModal() {

if (!users.length) {

toast(
  "Create at least one user first."
);

return;

}

modal(
"Create Group",

`

<form id="groupForm">

  <label>
    Group Name

    <input
      id="gName"
      placeholder="e.g. Marketing Team"
      required>
  </label>


  <label>
    Description

    <textarea
      id="gDescription"
      placeholder="What is this group for?">
    </textarea>
  </label>


  <label>
    Select Members

    <div
      style="
        max-height:220px;
        overflow:auto;
        padding:10px;
        border:1px solid rgba(148,163,184,.12);
        border-radius:12px;
        background:rgba(0,0,0,.16);
      ">

      ${
        users.map(user => `

          <label
            style="
              display:flex;
              align-items:center;
              gap:9px;
              margin:0;
              padding:9px 5px;
              cursor:pointer;
            ">

            <input
              type="checkbox"
              class="group-member"
              value="${user.id}"
              style="width:auto;margin:0">

            <span>
              ${esc(user.name)}
              <small>
                ${esc(user.email)}
              </small>
            </span>

          </label>

        `).join("")
      }

    </div>

  </label>


  <button
    class="primary full">
    Create Group
  </button>


  <div
    id="gMsg"
    class="message">
  </div>

</form>

`

);

$("groupForm").onsubmit =
async event => {

  event.preventDefault();


  const memberIds =
    [
      ...document.querySelectorAll(
        ".group-member:checked"
      )
    ].map(
      input => input.value
    );


  try {

    await callable(
      "createGroup",
      {
        name:
          $("gName")
            .value
            .trim(),

        description:
          $("gDescription")
            .value
            .trim(),

        memberIds
      }
    );


    $("modalRoot").innerHTML = "";

    toast(
      "Group created successfully."
    );


    await loadData();

    renderGroups();


  } catch (error) {

    $("gMsg").textContent =
      friendlyError(error);

  }

};

}

/* =====================================================
GROUP DETAILS
===================================================== */

function groupDetails(id) {

const group =
groups.find(
item =>
item.id === id
);

if (!group) return;

const memberIds =
Array.isArray(
group.memberIds
)
? group.memberIds
: [];

const members =
memberIds
.map(
memberId =>
users.find(
user =>
user.id === memberId
)
)
.filter(Boolean);

modal(
group.name,

`

<div class="detail-grid">

  <div>
    <span>Members</span>
    <b>${members.length}</b>
  </div>

  <div>
    <span>Created By</span>
    <b>
      ${
        esc(
          group.createdByRole ||
          "Admin"
        )
      }
    </b>
  </div>

</div>


<p class="muted">
  ${esc(
    group.description ||
    "No description"
  )}
</p>


<h3>Members</h3>


<div class="list">

  ${
    members.length

      ? members.map(member => `

          <div class="card-row">

            <div class="avatar">
              ${esc(
                (member.name || "U")[0]
                  .toUpperCase()
              )}
            </div>

            <div class="grow">

              <b>
                ${esc(member.name)}
              </b>

              <small>
                ${esc(member.email)}
              </small>

            </div>

            <button
              class="danger"
              data-remove-member="${member.id}">
              Remove
            </button>

          </div>

        `).join("")

      : `
          <div class="empty">
            No members in this group.
          </div>
        `
  }

</div>


<div class="modal-actions">

  <button
    id="addMember"
    class="primary">
    + Add Member
  </button>

  <button
    id="editGroup"
    class="ghost">
    Edit
  </button>

  <button
    id="deleteGroup"
    class="danger">
    Delete
  </button>

</div>

`

);

document
.querySelectorAll(
"[data-remove-member]"
)
.forEach(button => {

  button.onclick =
    async () => {

      try {

        await callable(
          "removeGroupMember",
          {
            groupId: id,

            userId:
              button.dataset
                .removeMember
          }
        );


        $("modalRoot").innerHTML = "";

        await loadData();

        renderGroups();

        toast(
          "Member removed."
        );

      } catch (error) {

        toast(
          friendlyError(error)
        );

      }

    };

});

$("addMember").onclick =
() =>
addMemberModal(group);

$("editGroup").onclick =
() =>
editGroupModal(group);

$("deleteGroup").onclick =
async () => {

  if (
    !confirm(
      "Delete this group?"
    )
  ) {
    return;
  }


  try {

    await callable(
      "deleteGroup",
      {
        groupId: id
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderGroups();

    toast(
      "Group deleted."
    );

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}

/* =====================================================
ADD MEMBER
===================================================== */

function addMemberModal(group) {

const current =
Array.isArray(
group.memberIds
)
? group.memberIds
: [];

const available =
users.filter(
user =>
!current.includes(user.id)
);

if (!available.length) {

toast(
  "All available users are already members."
);

return;

}

modal(
"Add Member",

`

<form id="memberForm">

  <label>
    Select User

    <select id="memberUser">

      ${
        available.map(user => `

          <option
            value="${user.id}">

            ${esc(user.name)}
            —
            ${esc(user.email)}

          </option>

        `).join("")
      }

    </select>

  </label>


  <button
    class="primary full">
    Add Member
  </button>

</form>

`

);

$("memberForm").onsubmit =
async event => {

  event.preventDefault();


  try {

    await callable(
      "addGroupMember",
      {
        groupId:
          group.id,

        userId:
          $("memberUser")
            .value
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderGroups();

    toast(
      "Member added."
    );

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}

/* =====================================================
EDIT GROUP
===================================================== */

function editGroupModal(group) {

modal(
"Edit Group",

`

<form id="editGroupForm">

  <label>
    Group Name

    <input
      id="editGroupName"
      value="${esc(group.name)}"
      required>
  </label>


  <label>
    Description

    <textarea
      id="editGroupDescription">${esc(
        group.description || ""
      )}</textarea>
  </label>


  <button
    class="primary full">
    Save Changes
  </button>

</form>

`

);

$("editGroupForm").onsubmit =
async event => {

  event.preventDefault();


  try {

    await callable(
      "updateGroup",
      {
        groupId:
          group.id,

        name:
          $("editGroupName")
            .value
            .trim(),

        description:
          $("editGroupDescription")
            .value
            .trim(),

        memberIds:
          Array.isArray(
            group.memberIds
          )
            ? group.memberIds
            : []
      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderGroups();

    toast(
      "Group updated."
    );

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}

/* =====================================================
TASKS
===================================================== */

function renderTasks() {

const canCreate =
me.role !== "user";

$("page-tasks").innerHTML = `

<div class="page-title">

  <div>

    <h1>
      ${
        me.role === "user"
          ? "My Tasks"
          : "Tasks"
      }
    </h1>

    <p class="muted">
      ${
        me.role === "user"
          ? "Update your task status."
          : "Assign and monitor team tasks."
      }
    </p>

  </div>

  ${
    canCreate
      ? `
        <button
          class="primary"
          id="newTask">
          + Assign Task
        </button>
      `
      : ""
  }

</div>


<div class="task-list">

  ${
    tasks.length

      ? tasks.map(task => `

          <div class="task-card">

            <div class="task-main">

              <b>
                ${esc(task.title)}
              </b>

              <p>
                ${esc(
                  task.description ||
                  "No description"
                )}
              </p>

              <small>
                Assigned to:
                ${esc(
                  task.assignedToName ||
                  task.assignedTo ||
                  "—"
                )}
              </small>

            </div>


            <div class="task-side">

              <span
                class="badge ${task.status}">
                ${esc(
                  String(
                    task.status ||
                    "pending"
                  ).replace(
                    "_",
                    " "
                  )
                )}
              </span>


              ${
                me.role === "user"

                  ? `

                    <select
                      data-status="${task.id}">

                      <option value="pending">
                        Pending
                      </option>

                      <option value="accepted">
                        Accepted
                      </option>

                      <option value="in_progress">
                        In Progress
                      </option>

                      <option value="completed">
                        Completed
                      </option>

                    </select>

                  `

                  : ""
              }

            </div>

          </div>

        `).join("")

      : `

          <div class="empty">
            No tasks yet.
          </div>

        `
  }

</div>

`;

document
.querySelectorAll(
"[data-status]"
)
.forEach(select => {

  const task =
    tasks.find(
      item =>
        item.id ===
        select.dataset.status
    );


  select.value =
    task?.status ||
    "pending";


  select.onchange =
    async () => {

      try {

        await updateDoc(
          doc(
            db,
            "tasks",
            select.dataset.status
          ),
          {
            status:
              select.value,

            updatedAt:
              serverTimestamp()
          }
        );


        await loadData();

        renderTasks();

        toast(
          "Task updated."
        );

      } catch (error) {

        toast(
          friendlyError(error)
        );

      }

    };

});

if (canCreate) {

$("newTask").onclick =
  taskModal;

}

}

/* =====================================================
TASK MODAL
===================================================== */

function taskModal() {

if (!users.length) {

toast(
  "Create a user first."
);

return;

}

modal(
"Assign Task",

`

<form id="taskForm">

  <label>
    Title

    <input
      id="tTitle"
      placeholder="Task title"
      required>
  </label>


  <label>
    Description

    <textarea
      id="tDesc"
      placeholder="Describe the task">
    </textarea>
  </label>


  <label>
    Assign To

    <select id="tUser">

      ${
        users.map(user => `

          <option
            value="${user.id}">

            ${esc(user.name)}
            —
            ${esc(user.email)}

          </option>

        `).join("")
      }

    </select>

  </label>


  <button
    class="primary full">
    Assign Task
  </button>

</form>

`

);

$("taskForm").onsubmit =
async event => {

  event.preventDefault();


  const uid =
    $("tUser").value;


  const user =
    users.find(
      item =>
        item.id === uid
    );


  try {

    await addDoc(
      collection(
        db,
        "tasks"
      ),
      {

        title:
          $("tTitle")
            .value
            .trim(),

        description:
          $("tDesc")
            .value
            .trim(),

        assignedTo:
          uid,

        assignedToName:
          user?.name || "",

        createdBy:
          me.id,

        status:
          "pending",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    $("modalRoot").innerHTML = "";

    await loadData();

    renderTasks();

    toast(
      "Task assigned successfully."
    );

  } catch (error) {

    toast(
      friendlyError(error)
    );

  }

};

}
