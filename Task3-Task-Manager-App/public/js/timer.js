// Timer state. The running timer is stored on the SERVER (start timestamp in MongoDB). The browser only shows
// elapsed = (server time + clock skew) − startTime, so refreshes, closed tabs and idle tabs stay accurate.
import { api } from "./api.js";
import { $, $$, toast } from "./utils.js";

const S = { active: null, skew: 0, totals: {}, timer: 0 };
const listeners = new Set();
const pad = (n) => String(n).padStart(2, "0");

export const getActive = () => S.active;
export const onTimerChange = (fn) => listeners.add(fn);
export const elapsed = () => (S.active ? Math.max(0, (Date.now() + S.skew - new Date(S.active.startTime).getTime()) / 1000) : 0);
export const totalFor = (taskId) => (S.totals[taskId] || 0) + (S.active && S.active.task._id === taskId ? elapsed() : 0);

export function clock(sec) {                                         // 3725 → { hm: "01:02", s: "05" }
  sec = Math.max(0, Math.floor(sec));
  return { hm: `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}`, s: pad(sec % 60) };
}
export function dur(sec) {                                           // 5400 → "1h 30m"
  sec = Math.max(0, Math.round(sec));
  const hrs = Math.floor(sec / 3600), min = Math.floor((sec % 3600) / 60);
  if (!hrs && !min) return sec ? "<1m" : "0m";
  return hrs ? `${hrs}h ${pad(min)}m` : `${min}m`;
}

function paint() {
  const a = S.active, c = clock(elapsed());
  $("#timerBar").hidden = !a;
  if (a) { $("#tbTask").textContent = a.task.title; $("#tbNote").textContent = a.description || "No description"; }
  $$("[data-clock]").forEach((el) => { el.firstChild.textContent = c.hm; el.lastChild.textContent = `:${c.s}`; });
  $$("[data-live]").forEach((el) => { el.textContent = dur(totalFor(el.dataset.live)); });
}

export async function refreshTimer() {
  const { data } = await api("/time/active");
  const before = S.active && S.active._id;
  S.skew = new Date(data.serverNow).getTime() - Date.now();
  S.active = data.active;
  paint();
  if (before !== (S.active && S.active._id)) listeners.forEach((fn) => fn(S.active));
}
export async function refreshTotals() { S.totals = (await api("/time/totals")).data.totals; paint(); }

export async function startTimer(taskId, description = "") {
  const { data } = await api("/time/start", { method: "POST", body: { taskId, ...(description && { description }) } });
  await Promise.all([refreshTimer(), refreshTotals()]);
  toast(data.stopped ? "Switched task" : "Timer started");
}
export async function stopTimer() {
  const { data } = await api("/time/stop", { method: "POST" });
  await Promise.all([refreshTimer(), refreshTotals()]);
  toast(`Timer stopped · ${dur(data.entry.duration)} tracked`);
}

/** Called after sign-in / sign-out. */
export function startTicker() {
  stopTicker();
  S.timer = setInterval(paint, 1000);                                // the interval only repaints; time comes from timestamps
  S.poll = setInterval(() => refreshTimer().catch(() => {}), 60000);
}
export function stopTicker() { clearInterval(S.timer); clearInterval(S.poll); Object.assign(S, { active: null, totals: {} }); paint(); }
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.timer) refreshTimer().catch(() => {}); });
