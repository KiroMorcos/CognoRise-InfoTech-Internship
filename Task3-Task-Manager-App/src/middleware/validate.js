const ApiError = require("../utils/ApiError");
const { check } = require("../validators/rules");

/**
 * validate(schema, { source, partial, requireOne })
 * Sanitised data ends up in req.valid (and replaces req.body for body validation).
 */
module.exports = (schema, { source = "body", partial = false, requireOne = false } = {}) => (req, res, next) => {
  const input = req[source] ?? {};
  if (typeof input !== "object" || Array.isArray(input))
    return next(new ApiError(400, "Request body must be a JSON object"));

  const { errors, value } = check(input, schema, { partial });
  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  if (requireOne && !Object.keys(value).length)
    return next(new ApiError(400, "Validation failed", [{ field: "body", message: "Provide at least one valid field to update" }]));

  req.valid = value;
  if (source === "body") req.body = value;
  next();
};
