// Background job: every few minutes, e-mail users about approaching due dates and timers that run too long.
const cfg = require("../config/env");
const reminders = require("../services/reminder.service");
const mail = require("../services/mail.service");

let interval = null, busy = false;

async function runOnce() {
  if (busy) return;                                             // never overlap two runs
  busy = true;
  try {
    const due = await reminders.runDueReminders();
    const timers = await reminders.runTimerReminders();
    if (due || timers) console.log(`[notifier] sent ${due} due-date and ${timers} timer reminder(s)`);
  } catch (err) {
    console.error("[notifier] run failed:", err.message);
  } finally { busy = false; }
}

async function start() {
  if (!cfg.mail.enabled) {
    console.log(cfg.isProd && !cfg.mail.host ? "[notifier] e-mail reminders are off: set SMTP_HOST (and the other SMTP_* values) to enable them" : "[notifier] e-mail reminders are disabled");
    return;
  }
  const status = await mail.verify();
  if (!status.ok) console.error(`[notifier] SMTP login failed: ${status.message}. Reminders will keep retrying.`);
  else console.log(`[notifier] e-mail reminders on (${status.mode === "smtp" ? "SMTP" : "console preview — set SMTP_HOST to really send"}), checking every ${cfg.notifications.intervalMinutes} min`);
  interval = setInterval(runOnce, cfg.notifications.intervalMinutes * 60000);
  interval.unref();
  setTimeout(runOnce, 5000).unref();                            // first check shortly after start-up
}

const stop = () => clearInterval(interval);

module.exports = { start, stop, runOnce };
