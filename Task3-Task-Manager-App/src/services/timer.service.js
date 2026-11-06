const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const ApiError = require("../utils/ApiError");

// Start and stop times always come from the SERVER clock; the browser only displays (now − startTime).
const MAX_SECONDS = 12 * 60 * 60;                      // a forgotten timer is stopped after 12 hours

const running = (owner) => TimeEntry.findOne({ owner, isRunning: true });

/** Closes a running entry. The conditional update makes a double "stop" harmless. */
async function finish(entry, now = new Date()) {
  const duration = Math.min(MAX_SECONDS, Math.max(0, Math.floor((now - entry.startTime) / 1000)));
  const endTime = duration === MAX_SECONDS ? new Date(entry.startTime.getTime() + MAX_SECONDS * 1000) : now;
  const res = await TimeEntry.updateOne({ _id: entry._id, isRunning: true }, { $set: { endTime, duration, isRunning: false } });
  if (!res.modifiedCount) throw new ApiError(409, "This timer was already stopped");
  return { _id: entry._id, task: entry.task, description: entry.description, startTime: entry.startTime, endTime, duration, isRunning: false };
}

async function active(owner) {
  const entry = await running(owner);
  if (entry && Date.now() - entry.startTime > MAX_SECONDS * 1000) { await finish(entry); return null; }
  if (!entry) return null;
  const task = await Task.findOne({ _id: entry.task, owner });
  return { _id: entry._id, task: { _id: entry.task, title: task ? task.title : "Deleted task" }, description: entry.description, startTime: entry.startTime };
}

/** Starts a timer on one of the user's tasks. A timer that is already running is stopped first (switching tasks). */
async function start(owner, taskId, description = "") {
  const task = await Task.findOne({ _id: taskId, owner });
  if (!task) throw new ApiError(404, "Task not found");
  if (task.status === "done") throw new ApiError(409, "This task is done. Reopen it to track time.");
  const current = await running(owner);
  if (current && String(current.task) === String(taskId)) throw new ApiError(409, "A timer is already running on this task");
  const stopped = current ? await finish(current) : null;
  let entry;
  try { entry = await TimeEntry.create({ owner, task: taskId, description, startTime: new Date(), isRunning: true }); }
  catch (err) {
    if (err.code === 11000) throw new ApiError(409, "A timer is already running");     // lost a concurrent race
    throw err;
  }
  if (task.status === "todo") await Task.updateOne({ _id: taskId, owner }, { $set: { status: "in-progress" } });
  return { entry, stopped };
}

async function stop(owner) {
  const entry = await running(owner);
  if (!entry) throw new ApiError(409, "No timer is running");
  return finish(entry);
}

const stopIfRunningOn = async (owner, taskId) => {
  const entry = await TimeEntry.findOne({ owner, task: taskId, isRunning: true });
  if (entry) await finish(entry);
};

/** Finished seconds per task (running timers are added by the browser). */
async function totals(owner) {
  const rows = await TimeEntry.find({ owner, isRunning: false }).lean();
  const out = {};
  for (const e of rows) out[String(e.task)] = (out[String(e.task)] || 0) + e.duration;
  return out;
}

module.exports = { start, stop, active, stopIfRunningOn, totals };
