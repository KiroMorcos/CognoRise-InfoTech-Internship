const { DAY, startOfDay, startOfWeek, startOfMonth, addDays, dayKey } = require("./dateTime");

/** [from, to) of a named range, in the user's timezone. */
function resolveRange(range, tz = 0, now = new Date()) {
  const today = startOfDay(now, tz);
  const ranges = {
    today: [today, addDays(today, 1)],
    week: [startOfWeek(now, tz), addDays(startOfWeek(now, tz), 7)],
    month: [startOfMonth(now, tz), startOfMonth(addDays(startOfMonth(now, tz), 32), tz)],
    last7: [addDays(today, -6), addDays(today, 1)],
    last30: [addDays(today, -29), addDays(today, 1)]
  };
  const [from, to] = ranges[range] || ranges.week;
  return { from, to };
}

const seconds = (e, now) => (e.isRunning ? Math.max(0, Math.floor((now - e.startTime) / 1000)) : e.duration);

/**
 * Builds the report: totals, hours per day and time per task.
 * entries: [{ task, startTime, duration, isRunning }]   titles: Map(taskId -> title)
 */
function buildReport(entries, titles, { range, tz = 0, now = new Date() }) {
  const { from, to } = resolveRange(range, tz, now);
  const inRange = entries.filter((e) => e.startTime >= from && e.startTime < to);
  const perDay = new Map(), perTask = new Map();
  let total = 0;
  for (const e of inRange) {
    const s = seconds(e, now), key = dayKey(e.startTime, tz), id = String(e.task);
    total += s;
    perDay.set(key, (perDay.get(key) || 0) + s);
    const row = perTask.get(id) || { taskId: id, title: titles.get(id) || "Deleted task", seconds: 0, sessions: 0 };
    row.seconds += s; row.sessions += 1; perTask.set(id, row);
  }
  const daily = [];
  for (let d = from; d < to; d = addDays(d, 1)) daily.push({ date: dayKey(d, tz), seconds: perDay.get(dayKey(d, tz)) || 0 });
  const elapsedDays = Math.max(1, Math.min(daily.length, Math.round((startOfDay(now, tz) - from) / DAY) + 1));
  return {
    range: { name: range, from, to },
    totalSeconds: total, sessions: inRange.length,
    tasksWorkedOn: perTask.size, averagePerDaySeconds: Math.round(total / elapsedDays),
    daily, byTask: [...perTask.values()].sort((a, b) => b.seconds - a.seconds)
  };
}

module.exports = { resolveRange, buildReport, seconds };
