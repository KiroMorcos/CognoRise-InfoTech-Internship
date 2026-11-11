const { buildDueEmail, buildTimerEmail } = require("../utils/emailTemplates");
const { startOfDay } = require("../utils/dateTime");

const HOUR = 3600000;
const MAX_TIMER_MS = 12 * HOUR;                                   // timers are capped at 12 h (see timer.service.js)
// A due date counts until the END of that day (UTC): the app marks a task overdue only once the day has passed.
const deadlineOf = (dueDate) => new Date(new Date(dueDate).getTime() + 24 * HOUR);

/**
 * Builds the reminder logic. Dependencies are injected so it can be unit-tested without a database or SMTP server.
 *   Task, TimeEntry, User – Mongoose models      mail – { send }      config – env.notifications + appUrl
 */
function createReminders({ Task, TimeEntry, User, mail, config, now = () => new Date(), log = console }) {
  /** One e-mail per stage: "72 h left", "24 h left"… A stage is claimed in the database BEFORE sending, so
   *  two servers (or two checks) can never send the same reminder twice; a failed send releases the claim. */
  async function remindDue(task, user) {
    if (!task.dueDate || task.status === "done" || !user?.email) return false;
    const remainingMs = deadlineOf(task.dueDate) - now();
    if (remainingMs <= 0) return false;
    const applicable = config.dueHours.filter((h) => remainingMs <= h * HOUR);
    if (!applicable.length) return false;
    const already = task.dueReminderStages || [];
    const tightest = Math.min(...applicable);
    if (already.includes(tightest)) return false;

    const fresh = applicable.filter((h) => !already.includes(h));
    const claim = await Task.updateOne(
      { _id: task._id, status: { $ne: "done" }, dueReminderStages: { $nin: [tightest] } },
      { $addToSet: { dueReminderStages: { $each: applicable } } }
    );
    if (!claim.modifiedCount) return false;

    try {
      const sent = await mail.send({ to: user.email, ...buildDueEmail({ name: user.name, task, remainingMs, appUrl: config.appUrl }) });
      if (!sent) throw new Error("e-mail notifications are disabled");
      log.info(`[mail] due-date reminder sent for "${task.title}" (${Math.round(remainingMs / HOUR)} h left)`);
      return true;
    } catch (err) {
      await Task.updateOne({ _id: task._id }, { $pull: { dueReminderStages: { $in: fresh } } });
      log.error(`[mail] due-date reminder failed: ${err.message}`);
      return false;
    }
  }

  /** Called right after a task is created or edited, so a task that is already close to its deadline gets its e-mail at once. */
  async function checkTask(task, user) {
    try { return await remindDue(task, user); }
    catch (err) { log.error(`[mail] reminder check failed: ${err.message}`); return false; }
  }

  /** Scheduled check of every open task that is inside the largest reminder window. */
  async function runDueReminders() {
    const t = now(), widest = Math.max(...config.dueHours);
    const tasks = await Task.find({ status: { $ne: "done" }, dueDate: { $gte: startOfDay(t, 0), $lte: new Date(t.getTime() + widest * HOUR) } }).lean();
    const users = new Map();
    let sent = 0;
    for (const task of tasks) {
      const key = String(task.owner);
      if (!users.has(key)) users.set(key, await User.findById(task.owner).lean());
      if (await checkTask(task, users.get(key))) sent++;
    }
    return sent;
  }

  /** "Did you forget to stop the timer?" — once per `timerHours` of running time (3 h, 6 h, 9 h…). */
  async function runTimerReminders() {
    const every = config.timerHours;
    if (!(every > 0)) return 0;
    const t = now();
    const entries = await TimeEntry.find({ isRunning: true, startTime: { $lte: new Date(t.getTime() - every * HOUR) } }).lean();
    let sent = 0;
    for (const entry of entries) {
      const elapsedMs = t - new Date(entry.startTime);
      if (elapsedMs > MAX_TIMER_MS) continue;                                    // already beyond the cap; it is closed on the next read
      const due = Math.floor(elapsedMs / (every * HOUR));
      if (due < 1 || (entry.reminderCount || 0) >= due) continue;

      const claim = await TimeEntry.updateOne(
        { _id: entry._id, isRunning: true, $or: [{ reminderCount: { $exists: false } }, { reminderCount: { $lt: due } }] },
        { $set: { reminderCount: due } }
      );
      if (!claim.modifiedCount) continue;
      try {
        const [user, task] = await Promise.all([User.findById(entry.owner).lean(), Task.findById(entry.task).lean()]);
        if (!user?.email || !task) throw new Error("user or task no longer exists");
        const ok = await mail.send({ to: user.email, ...buildTimerEmail({ name: user.name, task, description: entry.description, startedAt: entry.startTime, elapsedSeconds: elapsedMs / 1000, appUrl: config.appUrl }) });
        if (!ok) throw new Error("e-mail notifications are disabled");
        log.info(`[mail] timer reminder sent for "${task.title}" (${Math.round(elapsedMs / HOUR)} h running)`);
        sent++;
      } catch (err) {
        await TimeEntry.updateOne({ _id: entry._id }, { $set: { reminderCount: due - 1 } });
        log.error(`[mail] timer reminder failed: ${err.message}`);
      }
    }
    return sent;
  }

  return { remindDue, checkTask, runDueReminders, runTimerReminders };
}

// Default instance wired to the real models; created on first use so importing this file has no side effects.
let instance;
const real = () => (instance ||= createReminders({
  Task: require("../models/Task"), TimeEntry: require("../models/TimeEntry"), User: require("../models/User"),
  mail: require("./mail.service"), config: { ...require("../config/env").notifications, appUrl: require("../config/env").appUrl }
}));

module.exports = {
  createReminders, deadlineOf,
  checkTask: (task, user) => real().checkTask(task, user),
  runDueReminders: () => real().runDueReminders(),
  runTimerReminders: () => real().runTimerReminders()
};
