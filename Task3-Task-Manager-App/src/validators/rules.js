/**
 * Tiny, dependency-free validation helpers.
 * A rule is a function (value) => { value } | { error }.
 * A schema maps field names to { rule, required?, nullable? }; unknown fields are dropped (whitelisting).
 */
const str = ({ min = 0, max = Infinity } = {}) => (v) => {
  if (typeof v !== "string") return { error: "must be a string" };
  const s = v.trim();
  if (s.length < min) return { error: min === 1 ? "is required" : `must be at least ${min} characters` };
  if (s.length > max) return { error: `must be at most ${max} characters` };
  return { value: s };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const email = () => (v) => {
  if (typeof v !== "string") return { error: "must be a string" };
  const s = v.trim().toLowerCase();
  return s.length <= 254 && EMAIL.test(s) ? { value: s } : { error: "must be a valid email address" };
};

// Passwords are never trimmed. bcrypt only uses the first 72 bytes, so cap the length.
const password = ({ strong = true } = {}) => (v) => {
  if (typeof v !== "string" || !v) return { error: "is required" };
  if (v.length > 72) return { error: "must be at most 72 characters" };
  if (strong && (v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)))
    return { error: "must be at least 8 characters and contain a letter and a number" };
  return { value: v };
};

const oneOf = (list) => (v) =>
  typeof v === "string" && list.includes(v) ? { value: v } : { error: `must be one of: ${list.join(", ")}` };

const objectId = () => (v) =>
  typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v) ? { value: v } : { error: "must be a valid id" };

const date = () => (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(v))
    return { error: "must be an ISO date (YYYY-MM-DD)" };
  const d = new Date(v);
  // reject impossible dates such as 2025-02-30 (JavaScript would silently roll them over)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v.slice(0, 10) ? { error: "is not a valid date" } : { value: d };
};

const int = ({ min = 1, max = Infinity } = {}) => (v) => {
  if (typeof v !== "string" && typeof v !== "number") return { error: "must be a number" };
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? { value: n } : { error: `must be a whole number from ${min}${max === Infinity ? " up" : ` to ${max}`}` };
};

const tags = ({ maxItems = 5, maxLength = 20 } = {}) => (v) => {
  if (!Array.isArray(v)) return { error: "must be an array of strings" };
  if (v.some((t) => typeof t !== "string")) return { error: "must only contain strings" };
  const clean = [...new Set(v.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (clean.length > maxItems) return { error: `can have at most ${maxItems} items` };
  if (clean.some((t) => t.length > maxLength)) return { error: `items must be at most ${maxLength} characters` };
  return { value: clean };
};

function check(input, schema, { partial = false } = {}) {
  const errors = [];
  const value = {};
  for (const [field, { rule, required, nullable }] of Object.entries(schema)) {
    const v = input[field];
    if (v === undefined) {
      if (required && !partial) errors.push({ field, message: `${field} is required` });
      continue;
    }
    if (v === null && nullable) { value[field] = null; continue; }
    const result = rule(v);
    if (result.error) errors.push({ field, message: `${field} ${result.error}` });
    else value[field] = result.value;
  }
  return { errors, value };
}

module.exports = { str, email, password, oneOf, objectId, date, int, tags, check };
