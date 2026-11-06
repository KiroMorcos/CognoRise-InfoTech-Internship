const test = require("node:test");
const assert = require("node:assert/strict");
const { check } = require("../src/validators/rules");
const { startSchema, reportSchema, entriesSchema } = require("../src/validators/time.validator");
const { buildReport, resolveRange } = require("../src/utils/timeReport");
const dt = require("../src/utils/dateTime");

const fields = (r) => r.errors.map((e) => e.field).sort();

test("start timer: needs a valid task id; description is length-limited", () => {
  assert.deepEqual(fields(check({}, startSchema)), ["taskId"]);
  assert.deepEqual(fields(check({ taskId: "abc" }, startSchema)), ["taskId"]);
  assert.deepEqual(fields(check({ taskId: { $ne: 1 } }, startSchema)), ["taskId"]);
  assert.deepEqual(fields(check({ taskId: "64b7f0c2a1b2c3d4e5f60718", description: "x".repeat(201) }, startSchema)), ["description"]);
  assert.equal(check({ taskId: "64b7f0c2a1b2c3d4e5f60718", description: "deep work" }, startSchema).errors.length, 0);
});

test("report / entries queries are validated", () => {
  assert.deepEqual(fields(check({ range: "forever", tzOffset: "9999" }, reportSchema, { partial: true })), ["range", "tzOffset"]);
  assert.equal(check({ range: "week", tzOffset: "-120" }, reportSchema, { partial: true }).errors.length, 0);
  assert.deepEqual(fields(check({ from: "2025-02-30", limit: "999" }, entriesSchema, { partial: true })), ["from", "limit"]);
});

test("date helpers respect the timezone offset (Monday-based weeks)", () => {
  const now = new Date("2026-03-04T23:30:00Z");                    // Wed 23:30 UTC = Thu 01:30 in UTC+2
  assert.equal(dt.dayKey(now, 0), "2026-03-04");
  assert.equal(dt.dayKey(now, -120), "2026-03-05");
  assert.equal(dt.startOfDay(now, -120).toISOString(), "2026-03-04T22:00:00.000Z");
  assert.equal(dt.startOfWeek(now, -120).toISOString(), "2026-03-01T22:00:00.000Z");
  assert.equal(dt.startOfMonth(now, -120).toISOString(), "2026-02-28T22:00:00.000Z");
});

test("named ranges", () => {
  const now = new Date("2026-03-04T12:00:00Z");
  assert.equal(resolveRange("today", 0, now).from.toISOString(), "2026-03-04T00:00:00.000Z");
  assert.equal(resolveRange("week", 0, now).from.toISOString(), "2026-03-02T00:00:00.000Z");
  assert.equal(resolveRange("month", 0, now).to.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(resolveRange("last7", 0, now).from.toISOString(), "2026-02-26T00:00:00.000Z");
});

test("report: totals, per-day series and per-task breakdown (running timers count)", () => {
  const now = new Date("2026-03-04T12:00:00Z");
  const at = (s) => new Date(s);
  const entries = [
    { task: "a", startTime: at("2026-03-02T09:00:00Z"), duration: 3600, isRunning: false },
    { task: "a", startTime: at("2026-03-04T08:00:00Z"), duration: 1800, isRunning: false },
    { task: "b", startTime: at("2026-03-04T10:00:00Z"), duration: 0, isRunning: true },        // running for 2h
    { task: "a", startTime: at("2026-02-20T09:00:00Z"), duration: 999, isRunning: false }      // outside the week
  ];
  const r = buildReport(entries, new Map([["a", "Alpha"], ["b", "Beta"]]), { range: "week", tz: 0, now });
  assert.equal(r.totalSeconds, 3600 + 1800 + 7200);
  assert.equal(r.sessions, 3);
  assert.equal(r.tasksWorkedOn, 2);
  assert.equal(r.daily.length, 7);
  assert.deepEqual(r.daily.map((d) => d.seconds), [3600, 0, 9000, 0, 0, 0, 0]);
  assert.deepEqual(r.byTask.map((t) => [t.title, t.seconds, t.sessions]), [["Beta", 7200, 1], ["Alpha", 5400, 2]]);
  assert.equal(r.averagePerDaySeconds, Math.round(12600 / 3));          // Mon–Wed elapsed
});

test("report: empty range gives zeros and one bucket per day", () => {
  const r = buildReport([], new Map(), { range: "last7", tz: 0, now: new Date("2026-03-04T12:00:00Z") });
  assert.deepEqual([r.totalSeconds, r.sessions, r.daily.length, r.byTask.length], [0, 0, 7, 0]);
});
