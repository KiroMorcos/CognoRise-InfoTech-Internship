const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const cfg = require("../config/env");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const cookieOptions = {
  httpOnly: true,                       // not readable from JavaScript (XSS-safe)
  secure: cfg.isProd,                   // HTTPS only in production
  sameSite: "strict",                   // not sent on cross-site requests (CSRF-safe)
  path: "/api/auth",
  maxAge: cfg.refreshDays * 24 * 60 * 60 * 1000
};
const clearOptions = { ...cookieOptions, maxAge: undefined };

/** Issues a short-lived access token (JSON) and a rotating refresh token (httpOnly cookie). */
async function issueTokens(user, res) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, cfg.accessSecret, { expiresIn: cfg.accessTtl });
  const refreshToken = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, cfg.refreshSecret, { expiresIn: `${cfg.refreshDays}d` });
  await User.updateOne({ _id: user._id }, { refreshTokenHash: sha256(refreshToken) });
  res.cookie("refreshToken", refreshToken, cookieOptions);
  return accessToken;
}

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, "Email is already registered");
  const user = await User.create({ name, email, password });       // role is always "user"
  const accessToken = await issueTokens(user, res);
  res.status(201).json({ success: true, data: { user, accessToken } });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Invalid email or password");
  const accessToken = await issueTokens(user, res);
  res.json({ success: true, data: { user, accessToken } });
};

exports.refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  try {
    if (!token) throw new Error("no token");
    const { sub } = jwt.verify(token, cfg.refreshSecret, { algorithms: ["HS256"] });
    const user = await User.findById(sub).select("+refreshTokenHash");
    if (!user || user.refreshTokenHash !== sha256(token)) throw new Error("revoked");   // reuse of an old token fails
    const accessToken = await issueTokens(user, res);
    res.json({ success: true, data: { user, accessToken } });
  } catch {
    res.clearCookie("refreshToken", clearOptions);
    throw new ApiError(401, "Session expired, please sign in again");
  }
};

exports.logout = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const { sub } = jwt.verify(token, cfg.refreshSecret, { algorithms: ["HS256"] });
      await User.updateOne({ _id: sub }, { $unset: { refreshTokenHash: 1 } });     // revoke server-side
    } catch { /* already invalid — nothing to revoke */ }
  }
  res.clearCookie("refreshToken", clearOptions);
  res.status(204).end();
};

exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });
