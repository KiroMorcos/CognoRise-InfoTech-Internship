// "Time tracking" tab: quick start, hours per day, time per task and the list of entries (like Toggl Track reports).
import { api } from "./api.js";
import { $, $$, h, toast } from "./utils.js";
import { dur, getActive, onTimerChange, refreshTotals, startTimer } from "./timer.js";

const NS = "http://www.w3.org/2000/svg";
const svg = (name, attrs = {}, ...kids) => { const el = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.append(...kids); return el; };
const pad = (n) => String(n).padStart(2, "0");
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tz = () => new Date().getTimezoneOffset();
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const label = (key, long) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" }); };
const dayName = (key) => { const t = localDay(new Date()), y = new Date(); y.setDate(y.getDate() - 1); return key === t ? "Today" : key === localDay(y) ? "Yesterday" : label(key, true); };

let range = "week", visible = false, onChange = () => {};

/* ---- charts (plain SVG; colours come from CSS variables, so they follow the theme) ---- */
const STEPS = [900, 1800, 3600, 7200, 14400, 28800];
const tick = (s) => (s % 3600 === 0 ? `${s / 3600}h` : `${Math.round(s / 60)}m`);
function barChart(box, data) {
  const W = 640, H = 220, left = 44, bottom = 28, top = 10, iw = W - left - 8, ih = H - bottom - top;
  const peak = Math.max(0, ...data.map((d) => d.value)), step = STEPS.find((s) => s * 4 >= peak) || 28800, max = step * 4;
  const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Tracked time per day" });
  for (let i = 0; i <= 4; i++) {
    const y = top + ih - (ih * i) / 4;
    el.append(svg("line", { x1: left, x2: W - 8, y1: y, y2: y, class: "grid-line" }), svg("text", { x: left - 6, y: y + 4, class: "axis-text", "text-anchor": "end" }, tick(step * i)));
  }
  const slot = iw / Math.max(1, data.length), bw = Math.min(36, slot * 0.6), every = Math.ceil(data.length / 12);
  data.forEach((d, i) => {
    const bh = Math.max(d.value ? 3 : 0, (d.value / max) * ih), x = left + slot * i + (slot - bw) / 2;
    el.append(svg("rect", { x, y: top + ih - bh, width: bw, height: bh, rx: 5, class: "bar-rect" }, svg("title", {}, `${d.tip}: ${dur(d.value)}`)));
    if (i % every === 0) el.append(svg("text", { x: x + bw / 2, y: H - 8, class: "axis-text", "text-anchor": "middle" }, d.label));
  });
  box.replaceChildren(el);
}
function donut(box, data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const el = svg("svg", { viewBox: "0 0 42 42", class: "chart", role: "img", "aria-label": "Time per task" }, svg("circle", { cx: 21, cy: 21, r: 15.9155, class: "donut-track" }));
  let offset = 25;
  if (total) data.forEach((d, i) => {
    const pct = (d.value / total) * 100, len = Math.max(0.4, pct - 0.6);
    el.append(svg("circle", { cx: 21, cy: 21, r: 15.9155, class: `donut-slice c${i % 8}`, "stroke-dasharray": `${len} ${100 - len}`, "stroke-dashoffset": offset }, svg("title", {}, `${d.label}: ${dur(d.value)}`)));
    offset -= pct;
  });
  el.append(svg("text", { x: 21, y: 20.5, class: "donut-value", "text-anchor": "middle" }, dur(total)), svg("text", { x: 21, y: 25.5, class: "donut-label", "text-anchor": "middle" }, "Total"));
  box.replaceChildren(el);
}

/* ---- data ---- */
async function loadReport() {
  const { data: d } = await api(`/time/report?range=${range}&tzOffset=${tz()}`);
  $("#rTotal").textContent = dur(d.totalSeconds);
  $("#rSessions").textContent = d.sessions;
  $("#rAvg").textContent = dur(d.averagePerDaySeconds);
  $("#rTasks").textContent = d.tasksWorkedOn;
  const long = d.daily.length <= 7;
  barChart($("#dailyChart"), d.daily.map((x) => ({ label: label(x.date, long), tip: label(x.date, true), value: x.seconds })));
  const top = d.byTask.slice(0, 8);
  donut($("#taskChart"), top.map((x) => ({ label: x.title, value: x.seconds })));
  $("#taskLegend").replaceChildren(...(top.length ? top.map((x, i) => h("li", {}, h("i", { class: `swatch c${i % 8}` }), h("span", { class: "lbl" }, x.title), h("strong", {}, dur(x.seconds)))) : [h("li", { class: "muted" }, "No time tracked in this range yet.")]));
  const total = d.totalSeconds || 1;
  $("#taskTable").replaceChildren(...(d.byTask.length ? d.byTask.map((x) => {
    const bar = h("i", {}); bar.style.setProperty("--w", `${Math.round((x.seconds / total) * 100)}%`);
    return h("tr", {}, h("td", {}, x.title), h("td", {}, x.sessions), h("td", {}, h("div", { class: "share" }, h("div", { class: "share-bar" }, bar), h("strong", {}, dur(x.seconds)))));
  }) : [h("tr", {}, h("td", { colspan: 3, class: "muted" }, "Start a timer on a task to build your report."))]));
  await loadEntries(localDay(new Date(d.range.from)), localDay(new Date(new Date(d.range.to) - 1)));
}

async function loadEntries(from, to) {
  const { data } = await api(`/time/entries?from=${from}&to=${to}&limit=200&tzOffset=${tz()}`);
  const days = new Map();
  for (const e of data) { const k = localDay(new Date(e.startTime)); (days.get(k) || days.set(k, []).get(k)).push(e); }
  $("#entryList").replaceChildren(...(data.length ? [...days].map(([day, items]) => h("section", { class: "day-group" },
    h("header", { class: "day-head" }, h("h3", {}, dayName(day)), h("strong", {}, dur(items.reduce((s, e) => s + e.duration, 0)))),
    h("ul", { class: "rows" }, ...items.map((e) => h("li", { class: `row-item${e.isRunning ? " running" : ""}` },
      h("div", { class: "row-main" }, h("strong", {}, e.task.title), h("span", {}, e.description || "No description")),
      h("span", { class: "t muted" }, `${time(e.startTime)} – ${e.endTime ? time(e.endTime) : "now"}`),
      h("strong", { class: "t" }, e.isRunning ? "Running" : dur(e.duration)),
      e.isRunning ? null : h("button", { class: "icon", title: "Delete entry", "aria-label": "Delete time entry", onclick: () => removeEntry(e) }, "✕")))))) : [h("p", { class: "muted" }, "No time entries in this range.")]));
}

function confirmBox(title, message) {
  const d = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmMsg").textContent = message;
  d.returnValue = "";
  d.showModal();
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true }));
}

async function removeEntry(e) {
  if (!(await confirmBox("Delete time entry?", `This ${dur(e.duration)} entry on “${e.task.title}” will be removed from your reports.`))) return;
  try { await api(`/time/entries/${e._id}`, { method: "DELETE" }); toast("Time entry deleted"); await Promise.all([refreshTotals(), loadReport()]); onChange(); }
  catch (err) { toast(err.message, "error"); }
}

async function fillTasks() {
  const { data } = await api("/tasks?limit=100&sort=-createdAt");
  const open = data.filter((t) => t.status !== "done"), select = $("#qTask"), keep = select.value;
  select.replaceChildren(h("option", { value: "" }, open.length ? "Select a task…" : "No open tasks — create one first"), ...open.map((t) => h("option", { value: t._id }, t.title)));
  select.value = keep;
  syncQuick();
}
function syncQuick() {
  const a = getActive(), id = $("#qTask").value;
  $("#qStart").disabled = !id || (a && a.task._id === id);
  $("#qStart").textContent = a ? "⇄ Switch to this task" : "▶ Start timer";
}

export async function showTimeView() { visible = true; try { await Promise.all([fillTasks(), loadReport()]); } catch (e) { toast(e.message, "error"); } }
export const hideTimeView = () => { visible = false; };

/** reload = refresh the task cards after a timer change (the status can change to "in progress"). */
export function initTimeView(reload) {
  onChange = reload;
  $("#qTask").addEventListener("change", syncQuick);
  $("#qStart").addEventListener("click", async () => {
    try { await startTimer($("#qTask").value, $("#qDesc").value.trim()); $("#qDesc").value = ""; await loadReport(); onChange(); } catch (e) { toast(e.message, "error"); }
  });
  $$("[data-range]").forEach((b) => b.addEventListener("click", () => {
    range = b.dataset.range;
    $$("[data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    loadReport().catch((e) => toast(e.message, "error"));
  }));
  onTimerChange(() => { if (visible) { syncQuick(); loadReport().catch(() => {}); } });
}
