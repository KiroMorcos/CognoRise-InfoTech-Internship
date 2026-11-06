const test = require("node:test");
const assert = require("node:assert/strict");
const { check } = require("../src/validators/rules");
const { taskSchema, listQuerySchema } = require("../src/validators/task.validator");
const { registerSchema, loginSchema } = require("../src/validators/auth.validator");

const fields = (r) => r.errors.map((e) => e.field).sort();

test("task: valid payload is sanitised", () => {
  const r = check({ title: "  Write docs ", status: "done", dueDate: "2030-01-31", tags: ["A", "a", "b"], hack: 1 }, taskSchema);
  assert.equal(r.errors.length, 0);
  assert.equal(r.value.title, "Write docs");
  assert.deepEqual(r.value.tags, ["a", "b"]);
  assert.ok(r.value.dueDate instanceof Date);
  assert.equal("hack" in r.value, false);                 // unknown fields are dropped
});

test("task: missing or blank title is rejected", () => {
  assert.deepEqual(fields(check({}, taskSchema)), ["title"]);
  assert.deepEqual(fields(check({ title: "   " }, taskSchema)), ["title"]);
});

test("task: invalid status, priority and due date are rejected", () => {
  const r = check({ title: "x", status: "finished", priority: "urgent", dueDate: "2025-13-45" }, taskSchema);
  assert.deepEqual(fields(r), ["dueDate", "priority", "status"]);
  assert.equal(check({ title: "x", dueDate: "tomorrow" }, taskSchema).errors.length, 1);
});

test("task: dueDate may be cleared with null; partial updates skip required fields", () => {
  assert.equal(check({ title: "x", dueDate: null }, taskSchema).errors.length, 0);
  assert.equal(check({ status: "done" }, taskSchema, { partial: true }).errors.length, 0);
});

test("task: wrong types are rejected (NoSQL-injection style payloads)", () => {
  assert.equal(check({ title: { $gt: "" } }, taskSchema).errors.length, 1);
  assert.equal(check({ title: "x", status: { $ne: "done" } }, taskSchema).errors.length, 1);
});

test("task: title length limit", () => {
  assert.equal(check({ title: "a".repeat(121) }, taskSchema).errors.length, 1);
});

test("list query: enums, pagination bounds and array injection", () => {
  assert.equal(check({ status: "todo", limit: "10", page: "2" }, listQuerySchema, { partial: true }).errors.length, 0);
  assert.deepEqual(fields(check({ status: "nope", limit: "1000" }, listQuerySchema, { partial: true })), ["limit", "status"]);
  assert.equal(check({ status: ["todo", "done"] }, listQuerySchema, { partial: true }).errors.length, 1);
});

test("register: strong password and valid email required", () => {
  assert.equal(check({ name: "Ann", email: "ANN@Example.com", password: "Passw0rd!" }, registerSchema).value.email, "ann@example.com");
  assert.deepEqual(fields(check({ name: "A", email: "bad", password: "short" }, registerSchema)), ["email", "name", "password"]);
  assert.deepEqual(fields(check({ name: "Ann", email: "a@b.co", password: "onlyletters" }, registerSchema)), ["password"]);
  assert.deepEqual(fields(check({ name: "Ann", email: "a@b.co", password: "a1".repeat(40) }, registerSchema)), ["password"]);
});

test("login: any non-empty password is accepted by the validator", () => {
  assert.equal(check({ email: "a@b.co", password: "x" }, loginSchema).errors.length, 0);
  assert.deepEqual(fields(check({ email: "a@b.co" }, loginSchema)), ["password"]);
});
