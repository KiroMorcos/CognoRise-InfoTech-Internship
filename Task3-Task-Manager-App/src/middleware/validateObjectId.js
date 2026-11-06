const ApiError = require("../utils/ApiError");

// Used with router.param — rejects malformed ids before they reach MongoDB.
module.exports = (req, res, next, id) =>
  /^[0-9a-fA-F]{24}$/.test(id) ? next() : next(new ApiError(400, "Invalid id"));
