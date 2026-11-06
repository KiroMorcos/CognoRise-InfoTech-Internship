const { STATUSES, PRIORITIES } = require("../constants");
const { str, oneOf, date, int, tags } = require("./rules");

exports.taskSchema = {
  title: { rule: str({ min: 1, max: 120 }), required: true },
  description: { rule: str({ max: 1000 }) },
  status: { rule: oneOf(STATUSES) },
  priority: { rule: oneOf(PRIORITIES) },
  dueDate: { rule: date(), nullable: true },
  tags: { rule: tags() }
};

exports.listQuerySchema = {
  status: { rule: oneOf(STATUSES) },
  priority: { rule: oneOf(PRIORITIES) },
  search: { rule: str({ max: 100 }) },
  overdue: { rule: oneOf(["true", "false"]) },
  scope: { rule: oneOf(["mine", "all"]) },
  sort: { rule: oneOf(["createdAt", "-createdAt", "dueDate", "-dueDate", "title", "-title"]) },
  page: { rule: int({ min: 1 }) },
  limit: { rule: int({ min: 1, max: 100 }) }
};
