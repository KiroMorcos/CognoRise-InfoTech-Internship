require("dotenv").config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}\nCopy .env.example to .env and fill them in.`);
  process.exit(1);
}

const isProd = process.env.NODE_ENV === "production";
const number = (value, fallback) => (value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback);
// "72,24" → [24, 72] (ascending, positive, unique)
const hoursList = (value, fallback) => {
  const list = String(value || "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);
  return [...new Set(list.length ? list : fallback)].sort((a, b) => a - b);
};
const smtpPort = number(process.env.SMTP_PORT, 587);
const smtpHost = process.env.SMTP_HOST || "";

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  clientOrigin: process.env.CLIENT_ORIGIN,
  appUrl: (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/$/, ""),   // link used inside e-mails

  // E-mail notifications (due-date and "timer still running" reminders)
  mail: {
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "TaskFlow <no-reply@taskflow.local>",
    // Without an SMTP server the e-mail is printed to the console (development only); production needs SMTP_HOST.
    enabled: process.env.EMAIL_NOTIFICATIONS !== "false" && (Boolean(smtpHost) || !isProd)
  },
  notifications: {
    dueHours: hoursList(process.env.DUE_REMINDER_HOURS, [72, 24]),            // send a reminder when this many hours are left
    timerHours: number(process.env.TIMER_REMINDER_HOURS, 3),                  // remind every N hours while a timer keeps running
    intervalMinutes: number(process.env.NOTIFY_INTERVAL_MINUTES, 5)           // how often the server checks
  }
};
