// `tz` is the browser's Date#getTimezoneOffset() (minutes, UTC minus local) so "today" follows the user's calendar.
const DAY = 86400000;
const shift = (d, tz) => new Date(d.getTime() - tz * 60000);          // read local fields with getUTC*

const startOfDay = (d, tz = 0) => { const s = shift(d, tz); return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) + tz * 60000); };
const startOfWeek = (d, tz = 0) => { const day = startOfDay(d, tz); return new Date(day.getTime() - ((shift(day, tz).getUTCDay() + 6) % 7) * DAY); };   // Monday
const startOfMonth = (d, tz = 0) => { const s = shift(d, tz); return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) + tz * 60000); };
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const dayKey = (d, tz = 0) => shift(d, tz).toISOString().slice(0, 10);

module.exports = { DAY, startOfDay, startOfWeek, startOfMonth, addDays, dayKey };
