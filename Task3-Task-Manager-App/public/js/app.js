import { api, refresh, setToken } from "./api.js";
import { h, $, $$, store, fmtDate, isOverdue, debounce, toast } from "./utils.js";
import { dur, getActive, refreshTimer, refreshTotals, startTicker, startTimer, stopTicker, stopTimer, totalFor } from "./timer.js";
import { hideTimeView, initTimeView, showTimeView } from "./time.js";

const STATUSES = [["todo", "To do"], ["in-progress", "In progress"], ["done", "Done"]];
const DOT = { todo: "d-todo", "in-progress": "d-prog", done: "d-done" };
const RANK = { high: 0, medium: 1, low: 2 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const S = {
  user: null, tasks: [], stats: null, loadError: false, mode: "login", editing: null, tab: "tasks",
  f: { status: "", priority: "", search: "", overdue: false },
  sort: store.get("tf.sort", "new"), view: store.get("tf.view", "board")
};

/* ---------- theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set("tf.theme", t);
  const dark = t === "dark";
  $$(".theme-btn").forEach((b) => {
    b.textContent = dark ? "☀" : "☾";
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  });
}
$$(".theme-btn").forEach((b) => b.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")));

/* ---------- form helpers ---------- */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function clearErrors(root) {
  $$(".err", root).forEach((e) => (e.textContent = ""));
  $$("[aria-invalid]", root).forEach((e) => e.removeAttribute("aria-invalid"));
  const fe = $(".form-err", root);
  if (fe) fe.textContent = "";
}
function showErrors(root, map) {
  let first;
  for (const [field, msg] of Object.entries(map)) {
    const span = $(`.err[data-for="${field}"]`, root);
    const input = root.elements[field];
    if (span && input) { span.textContent = cap(msg); input.setAttribute("aria-invalid", "true"); first ||= input; }
    else $(".form-err", root).textContent = cap(msg);
  }
  first?.focus();
}
function showApiError(root, err) {
  if (err.details?.length) showErrors(root, Object.fromEntries(err.details.map((d) => [d.field, d.message])));
  else $(".form-err", root).textContent = err.message;
}
const busy = (btn, on, label) => { btn.disabled = on; btn.textContent = on ? "Please wait…" : label; };

/* ---------- auth ---------- */
const authForm = $("#authForm");
function setMode(mode) {
  S.mode = mode;
  const reg = mode === "register";
  $("#tabLogin").setAttribute("aria-selected", String(!reg));
  $("#tabRegister").setAttribute("aria-selected", String(reg));
  $$("[data-only=register]").forEach((e) => (e.hidden = !reg));
  $("#authTitle").textContent = reg ? "Create your account" : "Welcome back";
  $("#authSubmit").textContent = reg ? "Create account" : "Sign in";
  authForm.elements.password.autocomplete = reg ? "new-password" : "current-password";
  clearErrors(authForm);
}
$("#tabLogin").addEventListener("click", () => setMode("login"));
$("#tabRegister").addEventListener("click", () => setMode("register"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(authForm);
  const d = Object.fromEntries(new FormData(authForm));
  const reg = S.mode === "register";
  const errs = {};
  if (reg && (d.name || "").trim().length < 2) errs.name = "enter your name (at least 2 characters)";
  if (!EMAIL.test((d.email || "").trim())) errs.email = "enter a valid email address";
  if (reg ? d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password) : !d.password)
    errs.password = reg ? "use 8+ characters with a letter and a number" : "enter your password";
  if (Object.keys(errs).length) return showErrors(authForm, errs);

  const btn = $("#authSubmit"), label = btn.textContent;
  busy(btn, true);
  try {
    const { data } = await api(`/auth/${S.mode}`, { method: "POST", body: reg ? d : { email: d.email, password: d.password } });
    setToken(data.accessToken);
    enter(data.user);
  } catch (err) { showApiError(authForm, err); }
  finally { busy(btn, false, label); }
});

function enter(user) {
  S.user = user;
  $("#auth").hidden = true;
  $("#app").hidden = false;
  $("#meName").textContent = user.name;
  $("#meEmail").textContent = user.email;
  $("#avatar").textContent = user.name.trim().charAt(0).toUpperCase();
  const hr = new Date().getHours();
  $("#hello").textContent = `${hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"}, ${user.name.split(" ")[0]}`;
  startTicker();
  load();
}
function leave(message) {
  setToken(null);
  stopTicker();
  setTab("tasks");
  Object.assign(S, { user: null, tasks: [], stats: null });
  $("#app").hidden = true;
  $("#auth").hidden = false;
  authForm.reset();
  setMode("login");
  if (message) toast(message, "error");
}
$("#logout").addEventListener("click", async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); leave(); });
window.addEventListener("auth:expired", () => S.user && leave("Your session expired. Please sign in again."));

/* ---------- data ---------- */
let reqId = 0;
async function load(quiet = false) {
  const id = ++reqId;
  if (!quiet) $("#board").replaceChildren(...skeleton());
  try {
    const q = new URLSearchParams({ limit: "100" });
    const { status, priority, search, overdue } = S.f;
    if (status) q.set("status", status);
    if (priority) q.set("priority", priority);
    if (search) q.set("search", search);
    if (overdue) q.set("overdue", "true");
    const [t, s] = await Promise.all([api(`/tasks?${q}`), api("/tasks/stats"), refreshTotals(), refreshTimer()]);
    if (id !== reqId) return;                       // a newer request superseded this one
    S.tasks = t.data; S.stats = s.data; S.loadError = false;
  } catch (err) {
    if (id !== reqId || err.status === 401) return;
    S.loadError = true;
    toast(err.message, "error");
  }
  render();
}

async function move(task, status) {
  if (task.status === status) return;
  const prev = task.status;
  task.status = status;
  render();
  try { await api(`/tasks/${task._id}`, { method: "PUT", body: { status } }); load(true); }
  catch (err) { task.status = prev; render(); toast(err.message, "error"); }
}

/* ---------- render ---------- */
const skeleton = () => STATUSES.map(() => h("div", { class: "col sk" }, h("div", { class: "card sk" }), h("div", { class: "card sk" })));

function sorted() {
  const by = {
    new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    due: (a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"),
    priority: (a, b) => RANK[a.priority] - RANK[b.priority],
    az: (a, b) => a.title.localeCompare(b.title)
  };
  return [...S.tasks].sort(by[S.sort]);
}

function render() {
  const st = S.stats || { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 };
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  const set = (id, v) => ($(id).textContent = v);
  set("#sTotal", st.total); set("#sProg", st.inProgress); set("#sDone", `${st.done}`); set("#sLate", st.overdue);
  $("#sBar").style.setProperty("--w", pct + "%");
  $("#sBar").setAttribute("aria-valuenow", pct);
  set("#nAll", st.total); set("#nTodo", st.todo); set("#nProg", st.inProgress); set("#nDone", st.done); set("#nLate", st.overdue);
  const open = st.total - st.done;
  set("#subhello", !st.total ? "Create your first task to get started." : open ? `${open} open task${open > 1 ? "s" : ""}${st.overdue ? ` · ${st.overdue} overdue` : ""}` : "You're all caught up 🎉");

  const key = S.f.overdue ? "overdue" : S.f.status || "all";
  $$("#nav [data-filter]").forEach((b) => b.classList.toggle("on", S.tab === "tasks" && b.dataset.filter === key));

  const list = sorted(), board = $("#board"), empty = $("#empty");
  board.className = `board ${S.view === "board" ? "is-board" : "is-list"}`;
  empty.hidden = list.length > 0;
  if (!list.length) {
    board.replaceChildren();
    const filtered = S.f.status || S.f.priority || S.f.search || S.f.overdue;
    empty.replaceChildren(...(S.loadError
      ? [h("h2", {}, "Couldn't load your tasks"), h("p", {}, "Something went wrong while contacting the server."), h("button", { class: "btn", onclick: () => load() }, "Try again")]
      : filtered
        ? [h("h2", {}, "No matching tasks"), h("p", {}, "Try a different search or clear the filters."), h("button", { class: "btn", onclick: clearFilters }, "Clear filters")]
        : [h("h2", {}, "No tasks yet"), h("p", {}, "Capture your first task and start getting things done."), h("button", { class: "btn primary", onclick: () => openTask() }, "+ Create a task")]));
    return;
  }
  if (S.view === "list") return board.replaceChildren(...list.map(card));
  board.replaceChildren(...STATUSES.map(([key, label]) => {
    const items = list.filter((t) => t.status === key);
    return h("section", { class: "col", "data-status": key, "aria-label": label },
      h("header", { class: "col-head" }, h("i", { class: `dot ${DOT[key]}` }), label, h("b", {}, items.length)),
      ...(items.length ? items.map(card) : [h("p", { class: "col-empty" }, "Drop tasks here")]));
  }));
}

function card(t) {
  const done = t.status === "done", late = isOverdue(t), running = getActive()?.task._id === t._id;
  return h("article", { class: `card p-${t.priority}${done ? " done" : ""}${running ? " tracking" : ""}`, "data-id": t._id, "data-spot": true, draggable: S.view === "board" ? "true" : null },
    h("div", { class: "card-top" },
      h("button", { type: "button", class: "check", role: "checkbox", "aria-checked": String(done), "aria-label": `${done ? "Reopen" : "Complete"} “${t.title}”`, onclick: () => move(t, done ? "todo" : "done") }, done ? "✓" : ""),
      h("h3", {}, t.title),
      h("span", { class: `pri ${t.priority}` }, t.priority)),
    t.description ? h("p", { class: "desc" }, t.description) : null,
    h("div", { class: "meta" },
      t.dueDate ? h("span", { class: `due${late ? " late" : ""}` }, `${late ? "Overdue · " : "Due "}${fmtDate(t.dueDate)}`) : null,
      t.status !== "todo" && S.view === "list" ? h("span", { class: "chip" }, STATUSES.find(([k]) => k === t.status)[1]) : null,
      ...t.tags.map((x) => h("span", { class: "tag" }, `#${x}`))),
    h("div", { class: "trow" },
      h("div", { class: "tracked" }, h("small", {}, "Tracked"), h("b", { "data-live": t._id }, dur(totalFor(t._id)))),
      running
        ? h("button", { type: "button", class: "btn sm danger", onclick: act(stopTimer) }, "■ Stop")
        : h("button", { type: "button", class: "btn sm primary", disabled: done, title: done ? "Reopen the task to track time" : "Start timer", onclick: act(() => startTimer(t._id)) }, "▶ Start")),
    h("div", { class: "acts" },
      h("button", { type: "button", class: "link", onclick: () => openTask(t) }, "Edit"),
      h("button", { type: "button", class: "link danger", onclick: () => askDelete(t) }, "Delete")));
}

function clearFilters() {
  Object.assign(S.f, { status: "", priority: "", search: "", overdue: false });
  $("#search").value = ""; $("#fPriority").value = "";
  load();
}

/* ---------- timer actions and tabs ---------- */
const act = (fn) => async () => { try { await fn(); await load(true); } catch (err) { toast(err.message, "error"); } };
$("#tbStop").addEventListener("click", act(stopTimer));
initTimeView(() => load(true));

function setTab(tab) {
  S.tab = tab;
  $("#tasksView").hidden = tab !== "tasks";
  $("#timeView").hidden = tab !== "time";
  $(".search").hidden = tab !== "tasks";
  $$("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  if (tab === "time") showTimeView(); else hideTimeView();
  if (S.user) render();
}
$$("[data-tab]").forEach((b) => b.addEventListener("click", () => { setTab(b.dataset.tab); closeMenu(); }));

/* ---------- task dialog ---------- */
const dlg = $("#taskDialog"), tf = $("#taskForm");
function openTask(t = null) {
  S.editing = t;
  clearErrors(tf);
  const el = tf.elements;
  $("#dlgTitle").textContent = t ? "Edit task" : "New task";
  el.title.value = t?.title || "";
  el.description.value = t?.description || "";
  el.status.value = t?.status || "todo";
  el.priority.value = t?.priority || "medium";
  el.dueDate.value = t?.dueDate ? t.dueDate.slice(0, 10) : "";
  el.tags.value = (t?.tags || []).join(", ");
  dlg.showModal();
  el.title.focus();
}
tf.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(tf);
  const el = tf.elements;
  const body = {
    title: el.title.value.trim(), description: el.description.value.trim(), status: el.status.value,
    priority: el.priority.value, dueDate: el.dueDate.value || null,
    tags: el.tags.value.split(",").map((s) => s.trim()).filter(Boolean)
  };
  const errs = {};
  if (!body.title) errs.title = "please enter a title";
  else if (body.title.length > 120) errs.title = "title must be at most 120 characters";
  if (body.tags.length > 5) errs.tags = "use at most 5 tags";
  if (Object.keys(errs).length) return showErrors(tf, errs);

  const btn = $("#taskSave");
  busy(btn, true);
  try {
    await api(S.editing ? `/tasks/${S.editing._id}` : "/tasks", { method: S.editing ? "PUT" : "POST", body });
    dlg.close();
    toast(S.editing ? "Task updated" : "Task created");
    load(true);
  } catch (err) { showApiError(tf, err); }
  finally { busy(btn, false, "Save task"); }
});
$("#taskCancel").addEventListener("click", () => dlg.close());
$("#newTask").addEventListener("click", () => openTask());

/* ---------- delete ---------- */
const cdlg = $("#confirmDialog");
function askDelete(t) {
  $("#confirmTitle").textContent = "Delete this task?";
  $("#confirmMsg").textContent = `“${t.title}” will be permanently deleted.`;
  cdlg.returnValue = "";
  cdlg.showModal();
  cdlg.addEventListener("close", async () => {
    if (cdlg.returnValue !== "ok") return;
    try { await api(`/tasks/${t._id}`, { method: "DELETE" }); toast("Task deleted"); load(true); }
    catch (err) { toast(err.message, "error"); }
  }, { once: true });
}
$$("dialog").forEach((d) => d.addEventListener("click", (e) => e.target === d && d.close()));

/* ---------- filters, sorting, views ---------- */
$("#nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  const k = b.dataset.filter;
  S.f.overdue = k === "overdue";
  S.f.status = STATUSES.some(([s]) => s === k) ? k : "";
  if (S.tab !== "tasks") setTab("tasks");
  closeMenu();
  load(true);
});
$("#search").addEventListener("input", debounce((e) => { S.f.search = e.target.value.trim(); load(true); }, 300));
$("#fPriority").addEventListener("change", (e) => { S.f.priority = e.target.value; load(true); });
$("#fSort").addEventListener("change", (e) => { S.sort = e.target.value; store.set("tf.sort", S.sort); render(); });
function setView(v) {
  S.view = v; store.set("tf.view", v);
  $("#vBoard").setAttribute("aria-pressed", String(v === "board"));
  $("#vList").setAttribute("aria-pressed", String(v === "list"));
  if (S.user) render();
}
$("#vBoard").addEventListener("click", () => setView("board"));
$("#vList").addEventListener("click", () => setView("list"));

/* ---------- drag & drop between columns ---------- */
const board = $("#board");
board.addEventListener("dragstart", (e) => { const c = e.target.closest(".card"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.id); c.classList.add("drag"); } });
board.addEventListener("dragend", () => $$(".drag, .over", board).forEach((x) => x.classList.remove("drag", "over")));
board.addEventListener("dragover", (e) => { const c = e.target.closest(".col"); if (c) { e.preventDefault(); $$(".over", board).forEach((x) => x !== c && x.classList.remove("over")); c.classList.add("over"); } });
board.addEventListener("drop", (e) => {
  const col = e.target.closest(".col");
  if (!col) return;
  e.preventDefault();
  const task = S.tasks.find((t) => t._id === e.dataTransfer.getData("text/plain"));
  if (task) move(task, col.dataset.status);
});

/* ---------- mobile menu, shortcuts, cursor highlight ---------- */
const closeMenu = () => { $("#side").classList.remove("open"); $("#scrim").hidden = true; };
$("#menu").addEventListener("click", () => { $("#side").classList.add("open"); $("#scrim").hidden = false; });
$("#scrim").addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
  if (e.ctrlKey || e.metaKey || e.altKey || !S.user || $("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === "/" && S.tab === "tasks") { e.preventDefault(); $("#search").focus(); }
  else if (e.key === "n") { e.preventDefault(); openTask(); }
});

const glow = $(".glow");
let raf = 0, gx = 0, gy = 0;
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest?.("[data-spot]");
  if (el) { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", `${e.clientX - r.left}px`); el.style.setProperty("--my", `${e.clientY - r.top}px`); }
  gx = e.clientX; gy = e.clientY;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; glow.style.transform = `translate3d(${gx - 320}px, ${gy - 320}px, 0)`; });
});

/* ---------- boot ---------- */
(async function boot() {
  setTheme(document.documentElement.dataset.theme);
  $("#fSort").value = S.sort;
  setView(S.view);
  setMode("login");
  const user = await refresh();               // restores the session from the httpOnly refresh cookie
  if (user) enter(user); else $("#auth").hidden = false;
})();
