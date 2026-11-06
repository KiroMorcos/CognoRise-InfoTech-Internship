const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const cfg = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);                                   // correct client IPs behind Render/Railway/Nginx

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: cfg.isProd ? [] : null
    }
  }
}));
if (cfg.clientOrigin) app.use(cors({ origin: cfg.clientOrigin.split(","), credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use("/api", routes);
app.use(express.static(path.join(__dirname, "..", "public")));   // the web client
app.use(notFound);
app.use(errorHandler);

module.exports = app;
