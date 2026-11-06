/** Error with an HTTP status; handled by the central error middleware. */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
module.exports = ApiError;
