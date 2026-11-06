require("dotenv").config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}\nCopy .env.example to .env and fill them in.`);
  process.exit(1);
}

module.exports = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  clientOrigin: process.env.CLIENT_ORIGIN
};
