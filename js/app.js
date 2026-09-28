import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, getDoc, orderBy,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-functions.js";
import { auth, db, functions } from "./firebase-config.js";

let me = null;
let users = [];
let admins = [];
let tasks = [];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
}

function modal(title, body) {
  $("modalRoot").innerHTML = `
    <div class="modal show"><div class="modal-card">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="close" id="closeModal">×</button></div>
      ${body}
    </div></div>`;
  $("closeModal").onclick = () => $("modalRoot").innerHTML = "";
}

async function callable(name, data) {
  return (await httpsCallable(functions, name)(data)).data;
}

onAuthStateChanged(auth, async user => {
  if (!user) return location.replace("index.html");
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return location.replace("index.html");
    me = { id: user.uid, ...snap.data() };
    if (me.status === "disabled") {
      await signOut(auth); return location.replace("index.html");
    }
    $("userName").textContent = me.name || me.email;
    $("roleLabel").textContent = me.role === "super_admin" ? "Super Admin" : me.role === "admin" ? "Admin" : "User";
    configureNavigation();
    await loadData();
    renderOverview();
  } catch (e) {
    console.error(e); toast("Unable to load account.");
  }
});

function configureNavigation() {
  document.querySelectorAll(".super-only").forEach(x => x.style.display = me.role === "super_admin" ? "" : "none");
  document.querySelectorAll(".admin-visible").forEach(x => x.style.display = me.role === "user" ? "none" : "");
  document.querySelectorAll(".user-visible").forEach(x => x.style.display = "");
  if (me.role === "user") $("page-users").innerHTML = "";
  document.querySelectorAll(".nav").forEach(btn => btn.onclick = () => showPage(btn.dataset.page));
  $("logoutBtn").onclick = async () => { await signOut(auth); location.replace("index.html"); };
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(x => x.classList.remove("active"));
  $("page-" + page)?.classList.add("active");
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");

  if (page === "overview") renderOverview();
  if (page === "admins") renderAdmins();
  if (page === "users") renderUsers();
  if (page === "groups") renderGroups();
  if (page === "tasks") renderTasks();
}

async function loadData() {
  if (me.role === "super_admin") {
    admins = await readAll("users", "role", "admin");
    users = await readAll("users", "role", "user");
  } else if (me.role === "admin") {
    users = await readAll("users", "createdBy", me.id);
  }
  tasks = await readAll("tasks", "createdBy", me.role === "user" ? null : me.id);
  if (me.role === "user") {
    tasks = await readAll("tasks", "assignedTo", me.id);
  } else if (me.role === "super_admin") {
    tasks = await getAll("tasks");
  }
}

async function readAll(col, field, value) {
  if (value == null) return [];
  const snap = await getDocs(query(collection(db, col), where(field, "==", value)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function getAll(col) {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function statsCards() {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "completed").length;
  const progress = tasks.filter(t => t.status === "in_progress").length;
  return `
    <div class="stats">
      <div class="stat"><b>${users.length}</b><span>Users</span></div>
      ${me.role === "super_admin" ? `<div class="stat"><b>${admins.length}</b><span>Admins</span></div>` : ""}
      <div class="stat"><b>${total}</b><span>Total Tasks</span></div>
      <div class="stat"><b>${progress}</b><span>In Progress</span></div>
      <div class="stat"><b>${done}</b><span>Completed</span></div>
    </div>`;
}

function renderOverview() {
  $("page-overview").innerHTML = `
    <div class="page-title"><div><h1>${me.role === "super_admin" ? "Super Admin Overview" : me.role === "admin" ? "Admin Overview" : "My Tasks"}</h1><p class="muted">Welcome, ${esc(me.name || "")}</p></div></div>
    ${statsCards()}
    <div class="panel"><h2>Task progress</h2>
      <div class="progress-row"><span>Completed</span><b>${tasks.filter(t=>t.status==="completed").length}</b></div>
      <div class="progress-row"><span>In Progress</span><b>${tasks.filter(t=>t.status==="in_progress").length}</b></div>
      <div class="progress-row"><span>Pending</span><b>${tasks.filter(t=>t.status==="pending").length}</b></div>
    </div>`;
}

function renderAdmins() {
  if (me.role !== "super_admin") return;
  $("page-admins").innerHTML = `
    <div class="page-title"><div><h1>Admins</h1><p class="muted">Manage every admin account.</p></div><button class="primary" id="addAdmin">+ Add Admin</button></div>
    <div class="list">${admins.length ? admins.map(a => `
      <div class="card-row"><div><b>${esc(a.name)}</b><small>${esc(a.email)}</small></div>
      <div class="row-actions"><span class="badge ${a.status}">${a.status}</span><button class="ghost" data-admin="${a.id}">Manage</button></div></div>`).join("") : `<div class="empty">No admins found.</div>`}</div>`;
  $("addAdmin").onclick = () => adminModal();
  document.querySelectorAll("[data-admin]").forEach(b => b.onclick = () => manageAdmin(b.dataset.admin));
}

function adminModal() {
  modal("Create Admin", `<form id="adminForm">
    <label>Name<input id="mName" required></label>
    <label>Email<input id="mEmail" type="email" required></label>
    <label>Password<span class="password-wrap"><input id="mPassword" type="password" minlength="6" required><button type="button" class="eye" id="mEye">👁</button></span></label>
    <button class="primary full">Create Admin</button><div id="mMsg" class="message"></div></form>`);
  $("mEye").onclick=()=>{$("mPassword").type=$("mPassword").type==="password"?"text":"password"};
  $("adminForm").onsubmit = async e => {
    e.preventDefault();
    try {
      await callable("createAccount", { name:$("mName").value.trim(), email:$("mEmail").value.trim(), password:$("mPassword").value, role:"admin" });
      $("modalRoot").innerHTML=""; toast("Admin created"); await loadData(); renderAdmins();
    } catch(e) { $("mMsg").textContent=e.message; }
  };
}

function manageAdmin(id) {
  const a = admins.find(x => x.id === id); if (!a) return;
  modal(a.name, `<div class="detail-grid">
    <div><span>Email</span><b>${esc(a.email)}</b></div>
    <div><span>Status</span><b>${esc(a.status)}</b></div>
    <div><span>Users</span><b>${users.filter(u=>u.createdBy===id).length}</b></div>
    <div><span>Tasks</span><b>${tasks.filter(t=>t.createdBy===id).length}</b></div>
  </div>
  <div class="modal-actions"><button id="toggleAdmin" class="ghost">${a.status==="disabled"?"Enable":"Disable"}</button><button id="deleteAdmin" class="danger">Delete</button></div>`);
  $("toggleAdmin").onclick = async()=>{await callable("setAccountStatus",{uid:id,status:a.status==="disabled"?"active":"disabled"}); $("modalRoot").innerHTML=""; await loadData(); renderAdmins();};
  $("deleteAdmin").onclick = async()=>{if(confirm("Delete this admin and its account?")){await callable("deleteAccount",{uid:id}); $("modalRoot").innerHTML=""; await loadData(); renderAdmins();}};
}

function renderUsers() {
  const title = me.role === "super_admin" ? "All Users" : "My Users";
  $("page-users").innerHTML = `
    <div class="page-title"><div><h1>${title}</h1><p class="muted">Manage users and their task progress.</p></div><button class="primary" id="addUser">+ Add User</button></div>
    <input id="userSearch" class="search" placeholder="Search by name or email">
    <div id="userList" class="list"></div>`;
  const draw = () => {
    const q = $("userSearch").value.toLowerCase();
    const arr = users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(q));
    $("userList").innerHTML = arr.length ? arr.map(u => `
      <div class="card-row"><div class="avatar">${esc((u.name||"U")[0].toUpperCase())}</div><div class="grow"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div>
      <div class="row-actions"><span class="badge ${u.status}">${u.status}</span><button class="ghost" data-user="${u.id}">Open</button></div></div>`).join("") : `<div class="empty">No users found.</div>`;
    document.querySelectorAll("[data-user]").forEach(b=>b.onclick=()=>userDetails(b.dataset.user));
  };
  $("userSearch").oninput=draw; $("addUser").onclick=userModal; draw();
}

function userModal() {
  modal("Create User", `<form id="userForm">
    <label>Full Name<input id="uName" required></label>
    <label>Email<input id="uEmail" type="email" required></label>
    <label>Password<span class="password-wrap"><input id="uPassword" type="password" minlength="6" required><button type="button" class="eye" id="uEye">👁</button></span></label>
    <button class="primary full">Create User</button><div id="uMsg" class="message"></div></form>`);
  $("uEye").onclick=()=>{$("uPassword").type=$("uPassword").type==="password"?"text":"password"};
  $("userForm").onsubmit=async e=>{
    e.preventDefault();
    try {
      await callable("createAccount",{name:$("uName").value.trim(),email:$("uEmail").value.trim(),password:$("uPassword").value,role:"user",createdBy:me.id});
      $("modalRoot").innerHTML=""; toast("User created"); await loadData(); renderUsers();
    } catch(e) { $("uMsg").textContent=e.message; }
  };
}

function userDetails(id) {
  const u = users.find(x=>x.id===id); if(!u)return;
  const ut = tasks.filter(t=>t.assignedTo===id);
  modal(u.name, `<div class="detail-grid">
    <div><span>Email</span><b>${esc(u.email)}</b></div><div><span>Status</span><b>${esc(u.status)}</b></div>
    <div><span>Total tasks</span><b>${ut.length}</b></div><div><span>Completed</span><b>${ut.filter(t=>t.status==="completed").length}</b></div>
  </div><h3>Progress</h3><div class="bar"><i style="width:${ut.length?Math.round(ut.filter(t=>t.status==="completed").length/ut.length*100):0}%"></i></div>
  <div class="modal-actions"><button id="editUser" class="ghost">Edit</button><button id="toggleUser" class="ghost">${u.status==="disabled"?"Enable":"Disable"}</button><button id="deleteUser" class="danger">Delete</button></div>`);
  $("editUser").onclick=()=>editUserModal(u);
  $("toggleUser").onclick=async()=>{await callable("setAccountStatus",{uid:id,status:u.status==="disabled"?"active":"disabled"});$("modalRoot").innerHTML="";await loadData();renderUsers()};
  $("deleteUser").onclick=async()=>{if(confirm("Delete user?")){await callable("deleteAccount",{uid:id});$("modalRoot").innerHTML="";await loadData();renderUsers()}};
}

function editUserModal(u) {
  modal("Edit User", `<form id="editUserForm"><label>Name<input id="eName" value="${esc(u.name)}" required></label><button class="primary full">Save Changes</button></form>`);
  $("editUserForm").onsubmit=async e=>{e.preventDefault();await callable("updateProfile",{uid:u.id,name:$("eName").value.trim()});$("modalRoot").innerHTML="";await loadData();renderUsers();toast("Updated")};
}

function renderGroups() {
  $("page-groups").innerHTML = `<div class="page-title"><div><h1>Groups</h1><p class="muted">Create team groups and manage membership.</p></div><button class="primary" id="newGroup">+ New Group</button></div><div class="empty">Group management is ready for the next data layer.</div>`;
  $("newGroup").onclick=()=>toast("Create-group form can be connected to your chosen group structure.");
}

function renderTasks() {
  const canCreate = me.role !== "user";
  $("page-tasks").innerHTML = `<div class="page-title"><div><h1>${me.role==="user"?"My Tasks":"Tasks"}</h1><p class="muted">${me.role==="user"?"Update your task status.":"Assign and monitor team tasks."}</p></div>${canCreate?'<button class="primary" id="newTask">+ Assign Task</button>':""}</div>
  <div class="task-list">${tasks.length?tasks.map(t=>`
  <div class="task-card"><div class="task-main"><b>${esc(t.title)}</b><p>${esc(t.description||"No description")}</p><small>Assigned to: ${esc(t.assignedToName||t.assignedTo||"—")}</small></div>
  <div class="task-side"><span class="badge ${t.status}">${t.status.replace("_"," ")}</span>${me.role==="user"?`<select data-status="${t.id}"><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select>`:""}</div></div>`).join(""):`<div class="empty">No tasks yet.</div>`}</div>`;
  document.querySelectorAll("[data-status]").forEach(s=>{s.value=tasks.find(t=>t.id===s.dataset.status)?.status||"pending";s.onchange=async()=>{await updateDoc(doc(db,"tasks",s.dataset.status),{status:s.value,updatedAt:serverTimestamp()});await loadData();renderTasks();toast("Task updated")}})
  if(canCreate) $("newTask").onclick=taskModal;
}

function taskModal() {
  if(!users.length) return toast("Create a user first.");
  modal("Assign Task", `<form id="taskForm"><label>Title<input id="tTitle" required></label><label>Description<textarea id="tDesc"></textarea></label><label>Assign To<select id="tUser">${users.map(u=>`<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join("")}</select></label><button class="primary full">Assign Task</button></form>`);
  $("taskForm").onsubmit=async e=>{e.preventDefault();const uid=$("tUser").value,u=users.find(x=>x.id===uid);await addDoc(collection(db,"tasks"),{title:$("tTitle").value.trim(),description:$("tDesc").value.trim(),assignedTo:uid,assignedToName:u.name,createdBy:me.id,status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});$("modalRoot").innerHTML="";await loadData();renderTasks();toast("Task assigned")};
}
