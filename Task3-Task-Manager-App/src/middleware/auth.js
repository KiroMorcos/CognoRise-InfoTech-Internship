const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { accessSecret } = require("../config/env");

/** Verifies the Bearer access token and attaches the user to req.user. */
exports.authenticate = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) throw new ApiError(401, "Authentication required");

  let payload;
  try {
    payload = jwt.verify(token, accessSecret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "User no longer exists");
  req.user = user;
  next();
};

/** Role-based access control: authorize("admin") */
exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, "You don't have permission to perform this action"));
