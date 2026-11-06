const TimeEntry = require("../models/TimeEntry");
const Task = require("../models/Task");
const ApiError = require("../utils/ApiError");
const timer = require("../services/timer.service");
const { buildReport, resolveRange } = require("../utils/timeReport");
const { startOfDay, addDays } = require("../utils/dateTime");

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const titlesFor = async (owner, entries) => {
  const ids = [...new Set(entries.map((e) => String(e.task)))];
  const tasks = await Task.find({ owner, _id: { $in: ids } }).lean();
  return new Map(tasks.map((t) => [String(t._id), t.title]));
};

exports.active = async (req, res) => ok(res, { active: await timer.active(req.user._id), serverNow: new Date() });
exports.start = async (req, res) => ok(res, await timer.start(req.user._id, req.body.taskId, req.body.description), 201);
exports.stop = async (req, res) => ok(res, { entry: await timer.stop(req.user._id) });
exports.totals = async (req, res) => ok(res, { totals: await timer.totals(req.user._id) });

exports.entries = async (req, res) => {
  const { from, to, limit = 100, tzOffset = 0 } = req.valid;
  const filter = { owner: req.user._id };
  if (from || to) {
    filter.startTime = {};
    if (from) filter.startTime.$gte = startOfDay(from, tzOffset);
    if (to) filter.startTime.$lt = addDays(startOfDay(to, tzOffset), 1);
  }
  const rows = await TimeEntry.find(filter).sort({ startTime: -1 }).limit(limit).lean();
  const titles = await titlesFor(req.user._id, rows);
  ok(res, rows.map((e) => ({ _id: e._id, task: { _id: e.task, title: titles.get(String(e.task)) || "Deleted task" }, description: e.description, startTime: e.startTime, endTime: e.endTime, duration: e.duration, isRunning: e.isRunning })));
};

exports.report = async (req, res) => {
  const { range = "week", tzOffset = 0 } = req.valid;
  const { from, to } = resolveRange(range, tzOffset);
  const rows = await TimeEntry.find({ owner: req.user._id, startTime: { $gte: from, $lt: to } }).lean();
  ok(res, buildReport(rows, await titlesFor(req.user._id, rows), { range, tz: tzOffset }));
};

exports.removeEntry = async (req, res) => {
  const entry = await TimeEntry.findOne({ _id: req.params.id, owner: req.user._id });
  if (!entry) throw new ApiError(404, "Time entry not found");
  if (entry.isRunning) throw new ApiError(409, "Stop the timer before deleting this entry");
  await TimeEntry.deleteOne({ _id: entry._id });
  res.status(204).end();
};
