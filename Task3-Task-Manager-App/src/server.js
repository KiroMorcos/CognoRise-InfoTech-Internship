const cfg = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");
const notifier = require("./jobs/notifier");

(async () => {
  await connectDB();
  const server = app.listen(cfg.port, () => console.log(`TaskFlow running on http://localhost:${cfg.port}`));

  notifier.start().catch((err) => console.error("[notifier] could not start:", err.message));

  const shutdown = () => { notifier.stop(); server.close(() => process.exit(0)); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
