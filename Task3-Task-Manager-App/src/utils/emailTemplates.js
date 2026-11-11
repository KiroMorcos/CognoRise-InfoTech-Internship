// Pure functions: build the subject, plain-text and HTML body of each e-mail (easy to unit test).
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** 190_000_000 ms → { days: 2, hours: 4, minutes: 46, text: "2 days and 4 hours" } */
function formatTimeLeft(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60), minutes = total % 60;
  let text;
  if (days) text = hours ? `${plural(days, "day")} and ${plural(hours, "hour")}` : plural(days, "day");
  else if (hours) text = minutes ? `${plural(hours, "hour")} and ${plural(minutes, "minute")}` : plural(hours, "hour");
  else text = plural(Math.max(1, minutes), "minute");
  return { days, hours, minutes, text };
}

/** 11520 s → "3 hours and 12 minutes" */
function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(total / 60), minutes = total % 60;
  if (!hours) return plural(Math.max(1, minutes), "minute");
  return minutes ? `${plural(hours, "hour")} and ${plural(minutes, "minute")}` : plural(hours, "hour");
}

const dateText = (date) => new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const timeText = (date) => new Date(date).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
const firstName = (name) => String(name || "there").trim().split(/\s+/)[0];

// Inline styles only (e-mail clients ignore <style> blocks). Colours: cream #FEF3E2, amber #F4AE52, orange #D4621A, espresso #2A1A0E.
function layout({ heading, highlight, highlightLabel, rows, buttonText, buttonUrl, note }) {
  const rowHtml = rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6B5238;font-size:14px;width:120px">${escapeHtml(k)}</td><td style="padding:6px 0;color:#2A1A0E;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F4E6CE;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFAF1;border-radius:16px;overflow:hidden;border:1px solid #EBD2AE">
<tr><td style="background:#D4621A;background-image:linear-gradient(135deg,#F4AE52,#D4621A);padding:20px 28px;color:#2A1A0E;font-size:22px;font-weight:800">&#10003; TaskFlow</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 6px;font-size:20px;color:#2A1A0E">${escapeHtml(heading)}</h1>
<div style="margin:18px 0;padding:18px;border-radius:14px;background:#FBE8CC;text-align:center">
<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6B5238">${escapeHtml(highlightLabel)}</div>
<div style="font-size:28px;font-weight:800;color:#A8480F;margin-top:4px">${escapeHtml(highlight)}</div></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">${rowHtml}</table>
<a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#F4AE52;background-image:linear-gradient(135deg,#F4AE52,#D4621A);color:#2A1A0E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:12px">${escapeHtml(buttonText)}</a>
<p style="margin:22px 0 0;font-size:12px;color:#6B5238">${escapeHtml(note)}</p>
</td></tr></table></body></html>`;
}

/** Reminder: a task is due soon. `remainingMs` = time left until the end of the due day. */
function buildDueEmail({ name, task, remainingMs, appUrl }) {
  const left = formatTimeLeft(remainingMs);
  const subject = `⏰ “${task.title}” is due in ${left.text}`;
  const rows = [["Task", task.title], ["Due", `${dateText(task.dueDate)} (end of day)`], ["Priority", task.priority], ["Status", task.status]];
  const text = [`Hi ${firstName(name)},`, "", `Your task "${task.title}" is due in ${left.text}.`, `Due date: ${dateText(task.dueDate)} (until the end of the day, UTC).`,
    `Priority: ${task.priority} · Status: ${task.status}`, "", `Open TaskFlow: ${appUrl}`, "", "You are receiving this because you added this task to TaskFlow."].join("\n");
  const html = layout({ heading: `Hi ${firstName(name)}, a deadline is coming up`, highlightLabel: "Time left", highlight: left.text, rows, buttonText: "Open TaskFlow", buttonUrl: appUrl, note: "You are receiving this because you added this task to TaskFlow. Finish the task to stop reminders." });
  return { subject, text, html };
}

/** Reminder: a timer has been running for a long time (maybe forgotten). */
function buildTimerEmail({ name, task, description, startedAt, elapsedSeconds, appUrl }) {
  const elapsed = formatElapsed(elapsedSeconds);
  const subject = `⏱ Your timer on “${task.title}” has been running for ${elapsed}`;
  const rows = [["Task", task.title], ["Note", description || "No description"], ["Started", timeText(startedAt)]];
  const text = [`Hi ${firstName(name)},`, "", `Your timer on "${task.title}" has been running for ${elapsed}.`, `Started: ${timeText(startedAt)}`,
    "", "If you are finished, open TaskFlow and press Stop so your time report stays accurate.", `Open TaskFlow: ${appUrl}`].join("\n");
  const html = layout({ heading: `Hi ${firstName(name)}, is your timer still needed?`, highlightLabel: "Timer running for", highlight: elapsed, rows, buttonText: "Open TaskFlow and stop the timer", buttonUrl: appUrl, note: "Timers are stopped automatically after 12 hours. You will get another reminder if the timer keeps running." });
  return { subject, text, html };
}

module.exports = { escapeHtml, formatTimeLeft, formatElapsed, buildDueEmail, buildTimerEmail };
