const { Schema, model } = require("mongoose");
const { STATUSES, PRIORITIES } = require("../constants");

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    status: { type: String, enum: STATUSES, default: "todo" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    dueDate: { type: Date, default: null },
    tags: { type: [String], default: [] },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

taskSchema.index({ owner: 1, status: 1, dueDate: 1 });
taskSchema.set("toJSON", { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = model("Task", taskSchema);
