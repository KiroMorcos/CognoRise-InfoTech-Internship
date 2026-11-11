const cfg = require("../config/env");

let transport = null;

function createTransport() {
  if (!cfg.mail.host) {
    // No SMTP server configured: print the e-mail instead of sending it (development only).
    return { sendMail: async (m) => { console.log(`[mail] (not sent — SMTP_HOST is not set)\nTo: ${m.to}\nSubject: ${m.subject}\n${m.text}\n`); return { messageId: "console" }; } };
  }
  let nodemailer;
  try { nodemailer = require("nodemailer"); }
  catch { throw new Error('E-mail is configured but the "nodemailer" package is not installed. Run: npm install'); }
  return nodemailer.createTransport({
    host: cfg.mail.host, port: cfg.mail.port, secure: cfg.mail.secure,
    auth: cfg.mail.user ? { user: cfg.mail.user, pass: cfg.mail.pass } : undefined
  });
}

/** Sends one e-mail. Returns false (and sends nothing) when notifications are disabled. */
async function send({ to, subject, text, html }) {
  if (!cfg.mail.enabled) return false;
  transport ||= createTransport();
  await transport.sendMail({ from: cfg.mail.from, to, subject, text, html });
  return true;
}

/** Checks the SMTP login once at start-up so a wrong password shows up immediately in the logs. */
async function verify() {
  if (!cfg.mail.enabled || !cfg.mail.host) return { ok: true, mode: cfg.mail.enabled ? "console" : "disabled" };
  try { transport ||= createTransport(); await transport.verify(); return { ok: true, mode: "smtp" }; }
  catch (err) { return { ok: false, mode: "smtp", message: err.message }; }
}

const setTransport = (t) => { transport = t; };       // used by tests

module.exports = { send, verify, setTransport };
