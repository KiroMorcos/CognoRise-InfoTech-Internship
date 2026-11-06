const { str, oneOf, objectId, date, int } = require("./rules");

exports.startSchema = { taskId: { rule: objectId(), required: true }, description: { rule: str({ max: 200 }) } };

const tzOffset = { rule: int({ min: -840, max: 840 }) };
exports.reportSchema = { range: { rule: oneOf(["today", "week", "month", "last7", "last30"]) }, tzOffset };
exports.entriesSchema = { from: { rule: date() }, to: { rule: date() }, limit: { rule: int({ min: 1, max: 200 }) }, tzOffset };
