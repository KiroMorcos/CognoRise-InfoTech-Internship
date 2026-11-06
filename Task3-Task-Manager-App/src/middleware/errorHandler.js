const ApiError = require("../utils/ApiError");
const { isProd } = require("../config/env");

exports.notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Centralised error handling — every error leaves the API in the same JSON shape.
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (err.type === "entity.parse.failed") { status = 400; message = "Malformed JSON in request body"; }
  else if (err.type === "entity.too.large") { status = 413; message = "Request body too large"; }
  else if (err.name === "CastError") { status = 400; message = `Invalid value for ${err.path}`; }
  else if (err.name === "ValidationError" && err.errors) {
    status = 400; message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }
  else if (err.code === 11000) { status = 409; message = "Email is already registered"; }

  if (status >= 500) {
    console.error(err);
    if (isProd) message = "Internal server error";
  }
  res.status(status).json({ success: false, message, ...(details && { details }) });
};
