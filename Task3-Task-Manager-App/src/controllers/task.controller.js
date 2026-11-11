const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const ApiError = require("../utils/ApiError");
const timer = require("../services/timer.service");
const reminders = require("../services/reminder.service");

const startOfToday = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Users only ever touch their own tasks; admins may access any task.
const access = (req) => (req.user.role === "admin" ? {} : { owner: req.user._id });

exports.list = async (req, res) => {
  const q = req.valid;
  const filter = q.scope === "all" && req.user.role === "admin" ? {} : { owner: req.user._id };
  if (q.status) filter.status = q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.overdue === "true") {
    filter.dueDate = { $lt: startOfToday() };
    if (!q.status) filter.status = { $ne: "done" };
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }];
  }
  const page = q.page || 1;
  const limit = q.limit || 50;
  const [data, total] = await Promise.all([
    Task.find(filter).sort(q.sort || "-createdAt").skip((page - 1) * limit).limit(limit),
    Task.countDocuments(filter)
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
};

exports.stats = async (req, res) => {
  const owner = req.user._id;
  const [grouped, overdue] = await Promise.all([
    Task.aggregate([{ $match: { owner } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Task.countDocuments({ owner, status: { $ne: "done" }, dueDate: { $lt: startOfToday() } })
  ]);
  const c = Object.fromEntries(grouped.map((r) => [r._id, r.n]));
  const todo = c.todo || 0, inProgress = c["in-progress"] || 0, done = c.done || 0;
  res.json({ success: true, data: { total: todo + inProgress + done, todo, inProgress, done, overdue } });
};

exports.create = async (req, res) => {
  const task = await Task.create({ ...req.body, owner: req.user._id });
  reminders.checkTask(task.toObject(), req.user);             // a task that is already close to its deadline is e-mailed right away
  res.status(201).json({ success: true, data: task });
};

exports.getOne = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, ...access(req) });
  if (!task) throw new ApiError(404, "Task not found");          // 404 (not 403) so other users' ids aren't revealed
  res.json({ success: true, data: task });
};

exports.update = async (req, res) => {
  if (req.body.status === "done") await timer.stopIfRunningOn(req.user._id, req.params.id);   // finishing a task stops its timer
  const changes = { ...req.body };
  if ("dueDate" in changes) changes.dueReminderStages = [];   // a new due date starts a fresh reminder cycle
  const task = await Task.findOneAndUpdate({ _id: req.params.id, ...access(req) }, { $set: changes }, { new: true, runValidators: true });
  if (!task) throw new ApiError(404, "Task not found");
  if (task.dueDate) reminders.checkTask(task.toObject(), req.user);
  res.json({ success: true, data: task });
};

exports.remove = async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, ...access(req) });
  if (!task) throw new ApiError(404, "Task not found");
  await TimeEntry.deleteMany({ task: task._id });                       // time entries go with the task
  res.status(204).end();
};
