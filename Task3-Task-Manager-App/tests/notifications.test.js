process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/test";      // the config module insists on these
process.env.JWT_ACCESS_SECRET ||= "a".repeat(40);
process.env.JWT_REFRESH_SECRET ||= "b".repeat(40);

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatTimeLeft, formatElapsed, buildDueEmail, buildTimerEmail } = require("../src/utils/emailTemplates");
const { createReminders } = require("../src/services/reminder.service");
const mailService = require("../src/services/mail.service");

/* ---------- e-mail wording ---------- */
const H = 3600000, M = 60000;

test("time left is written as days and hours, hours and minutes, or minutes", () => {
  assert.equal(formatTimeLeft(2 * 24 * H + 5 * H + 20 * M).text, "2 days and 5 hours");
  assert.equal(formatTimeLeft(24 * H).text, "1 day");
  assert.equal(formatTimeLeft(3 * 24 * H).text, "3 days");
  assert.equal(formatTimeLeft(5 * H + 30 * M).text, "5 hours and 30 minutes");
  assert.equal(formatTimeLeft(H).text, "1 hour");
  assert.equal(formatTimeLeft(45 * M).text, "45 minutes");
  assert.equal(formatTimeLeft(10_000).text, "1 minute");
  assert.deepEqual(Object.values(formatTimeLeft(26 * H + 5 * M)).slice(0, 3), [1, 2, 5]);
});

test("elapsed timer time is written in hours and minutes", () => {
  assert.equal(formatElapsed(3 * 3600 + 12 * 60), "3 hours and 12 minutes");
  assert.equal(formatElapsed(3 * 3600), "3 hours");
  assert.equal(formatElapsed(59), "1 minute");
});

test("due-date e-mail shows the exact time left, the due date and a link; user text is escaped", () => {
  const task = { title: "Ship <script>alert(1)</script>", dueDate: new Date("2026-03-05T00:00:00Z"), priority: "high", status: "todo" };
  const mail = buildDueEmail({ name: "Kirolos Morcos", task, remainingMs: 2 * 24 * H + 5 * H, appUrl: "https://tasks.example.com" });
  assert.match(mail.subject, /is due in 2 days and 5 hours/);
  assert.match(mail.text, /Hi Kirolos,/);
  assert.match(mail.text, /due in 2 days and 5 hours/);
  assert.match(mail.text, /Thursday, 5 March 2026/);
  assert.match(mail.html, /2 days and 5 hours/);
  assert.match(mail.html, /href="https:\/\/tasks\.example\.com"/);
  assert.ok(!mail.html.includes("<script>"), "task titles must be HTML-escaped");
  assert.ok(mail.html.includes("&lt;script&gt;"));
});

test("timer e-mail says how long the timer has been running", () => {
  const mail = buildTimerEmail({ name: "Ann Lee", task: { title: "Report" }, description: "", startedAt: new Date("2026-03-04T08:00:00Z"), elapsedSeconds: 3 * 3600 + 5 * 60, appUrl: "http://localhost:3000" });
  assert.match(mail.subject, /has been running for 3 hours and 5 minutes/);
  assert.match(mail.text, /press Stop/);
  assert.match(mail.html, /Timer running for/);
});

/* ---------- reminder logic with fake models ---------- */
function match(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((f) => match(doc, f));
    const v = doc[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, x]) => {
        if (op === "$ne") return String(v) !== String(x);
        if (op === "$nin") return !(Array.isArray(v) ? v : [v]).some((i) => x.includes(i));
        if (op === "$gte") return v >= x;
        if (op === "$lte") return v <= x;
        if (op === "$lt") return v < x;
        if (op === "$exists") return (v !== undefined) === x;
        throw new Error(`fake model: unsupported ${op}`);
      });
    }
    return String(v) === String(cond);
  });
}
function fakeModel(rows) {
  const clone = (r) => (r ? { ...r } : null);
  return {
    rows,
    find: (f) => ({ lean: async () => rows.filter((r) => match(r, f)).map(clone) }),
    findById: (id) => ({ lean: async () => clone(rows.find((r) => r._id === id)) }),
    updateOne: async (f, u) => {
      const r = rows.find((x) => match(x, f));
      if (!r) return { modifiedCount: 0 };
      if (u.$set) Object.assign(r, u.$set);
      if (u.$addToSet) for (const [k, { $each }] of Object.entries(u.$addToSet)) r[k] = [...new Set([...(r[k] || []), ...$each])];
      if (u.$pull) for (const [k, { $in }] of Object.entries(u.$pull)) r[k] = (r[k] || []).filter((i) => !$in.includes(i));
      return { modifiedCount: 1 };
    }
  };
}

function setup({ now = "2026-03-04T10:00:00Z", tasks = [], entries = [], failSend = false, sendResult = true } = {}) {
  const clock = { t: new Date(now) };
  const sent = [];
  const mail = { send: async (m) => { if (failSend) throw new Error("SMTP down"); if (sendResult) sent.push(m); return sendResult; } };
  const users = [{ _id: "u1", name: "Kirolos Morcos", email: "kiro@example.com" }];
  const models = { Task: fakeModel(tasks), TimeEntry: fakeModel(entries), User: fakeModel(users) };
  const quiet = { info() {}, error() {} };
  const reminders = createReminders({ ...models, mail, config: { dueHours: [24, 72], timerHours: 3, appUrl: "http://localhost:3000" }, now: () => clock.t, log: quiet });
  return { reminders, sent, clock, models, mail };
}
const task = (over = {}) => ({ _id: "t1", owner: "u1", title: "Write report", status: "todo", priority: "high", dueDate: new Date("2026-03-05T00:00:00Z"), dueReminderStages: [], ...over });

test("due reminder: sent once when the deadline is within 72 h, with the exact time left", async () => {
  const { reminders, sent, models } = setup({ tasks: [task()] });          // deadline = end of 5 March → 38 h left
  assert.equal(await reminders.runDueReminders(), 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "kiro@example.com");
  assert.match(sent[0].subject, /due in 1 day and 14 hours/);
  assert.deepEqual(models.Task.rows[0].dueReminderStages, [72]);
  assert.equal(await reminders.runDueReminders(), 0, "no duplicate on the next check");
  assert.equal(sent.length, 1);
});

test("due reminder: a second, final e-mail when 24 h are left", async () => {
  const { reminders, sent, clock, models } = setup({ tasks: [task()] });
  await reminders.runDueReminders();
  clock.t = new Date("2026-03-05T12:00:00Z");                              // 12 h left
  assert.equal(await reminders.runDueReminders(), 1);
  assert.match(sent[1].subject, /due in 12 hours/);
  assert.deepEqual(models.Task.rows[0].dueReminderStages.sort((a, b) => a - b), [24, 72]);
  assert.equal(await reminders.runDueReminders(), 0);
  assert.equal(sent.length, 2);
});

test("due reminder: a task created close to its deadline gets ONE e-mail, not one per stage", async () => {
  const { reminders, sent, models } = setup({ now: "2026-03-04T10:00:00Z", tasks: [task({ dueDate: new Date("2026-03-04T00:00:00Z") })] });   // due today, 14 h left
  assert.equal(await reminders.checkTask(models.Task.rows[0], { email: "kiro@example.com", name: "Kirolos Morcos" }), true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /due in 14 hours/);
  assert.deepEqual(models.Task.rows[0].dueReminderStages.sort((a, b) => a - b), [24, 72]);
});

test("due reminder: nothing is sent for far-away, finished or overdue tasks", async () => {
  const { reminders, sent } = setup({ tasks: [
    task({ _id: "far", dueDate: new Date("2026-03-20T00:00:00Z") }),
    task({ _id: "done", status: "done" }),
    task({ _id: "late", dueDate: new Date("2026-03-01T00:00:00Z") }),
    task({ _id: "none", dueDate: null })
  ] });
  assert.equal(await reminders.runDueReminders(), 0);
  assert.equal(sent.length, 0);
});

test("due reminder: two simultaneous checks send a single e-mail", async () => {
  const { reminders, sent } = setup({ tasks: [task()] });
  await Promise.all([reminders.runDueReminders(), reminders.runDueReminders()]);
  assert.equal(sent.length, 1);
});

test("due reminder: a failed send is retried on the next check", async () => {
  const state = setup({ tasks: [task()], failSend: true });
  assert.equal(await state.reminders.runDueReminders(), 0);
  assert.deepEqual(state.models.Task.rows[0].dueReminderStages, [], "the claim is released after a failure");
  const ok = setup({ tasks: state.models.Task.rows });
  assert.equal(await ok.reminders.runDueReminders(), 1);
});

test("due reminder: disabled mail does not mark reminders as sent", async () => {
  const { reminders, models } = setup({ tasks: [task()], sendResult: false });
  assert.equal(await reminders.runDueReminders(), 0);
  assert.deepEqual(models.Task.rows[0].dueReminderStages, []);
});

test("due reminder: a changed due date starts a new cycle (stages reset by the controller)", async () => {
  const { reminders, sent, models } = setup({ tasks: [task()] });
  await reminders.runDueReminders();
  models.Task.rows[0].dueReminderStages = [];                              // what task.controller does when dueDate is edited
  models.Task.rows[0].dueDate = new Date("2026-03-06T00:00:00Z");
  assert.equal(await reminders.runDueReminders(), 1);
  assert.equal(sent.length, 2);
});

const running = (over = {}) => ({ _id: "e1", owner: "u1", task: "t1", description: "deep work", isRunning: true, startTime: new Date("2026-03-04T10:00:00Z"), reminderCount: 0, ...over });

test("timer reminder: sent after 3 h, then every further 3 h, never twice for the same threshold", async () => {
  const { reminders, sent, clock, models } = setup({ now: "2026-03-04T10:00:00Z", tasks: [task()], entries: [running()] });
  clock.t = new Date("2026-03-04T12:50:00Z");                              // 2 h 50 m
  assert.equal(await reminders.runTimerReminders(), 0);
  clock.t = new Date("2026-03-04T13:05:00Z");                              // 3 h 05 m
  assert.equal(await reminders.runTimerReminders(), 1);
  assert.match(sent[0].subject, /running for 3 hours and 5 minutes/);
  assert.equal(await reminders.runTimerReminders(), 0, "same threshold is not repeated");
  clock.t = new Date("2026-03-04T16:10:00Z");                              // 6 h 10 m
  assert.equal(await reminders.runTimerReminders(), 1);
  assert.match(sent[1].subject, /6 hours and 10 minutes/);
  assert.equal(models.TimeEntry.rows[0].reminderCount, 2);
});

test("timer reminder: ignores stopped timers and timers beyond the 12 h cap; failures are retried", async () => {
  const state = setup({ now: "2026-03-04T14:00:00Z", tasks: [task()], entries: [running({ _id: "stopped", isRunning: false }), running({ _id: "ancient", startTime: new Date("2026-03-03T14:00:00Z") })] });
  assert.equal(await state.reminders.runTimerReminders(), 0);
  const bad = setup({ now: "2026-03-04T14:00:00Z", tasks: [task()], entries: [running()], failSend: true });
  assert.equal(await bad.reminders.runTimerReminders(), 0);
  assert.equal(bad.models.TimeEntry.rows[0].reminderCount, 0, "failed send must not count as sent");
  const retry = setup({ now: "2026-03-04T14:00:00Z", tasks: [task()], entries: bad.models.TimeEntry.rows });
  assert.equal(await retry.reminders.runTimerReminders(), 1);
});

/* ---------- mail service ---------- */
test("mail service hands the message to the configured transport with the sender address", async () => {
  const calls = [];
  mailService.setTransport({ sendMail: async (m) => { calls.push(m); } });
  assert.equal(await mailService.send({ to: "a@b.co", subject: "Hi", text: "t", html: "<p>t</p>" }), true);
  assert.equal(calls[0].to, "a@b.co");
  assert.match(calls[0].from, /TaskFlow/);
  assert.equal((await mailService.verify()).ok, true);
});
