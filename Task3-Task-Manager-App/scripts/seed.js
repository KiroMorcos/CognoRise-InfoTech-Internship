// Creates demo data:  npm run seed
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Task = require("../src/models/Task");
const TimeEntry = require("../src/models/TimeEntry");

const day = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; };

(async () => {
  await connectDB();
  await User.deleteMany({ email: { $in: ["demo@taskflow.dev", "admin@taskflow.dev"] } });
  await User.create({ name: "Admin", email: "admin@taskflow.dev", password: "Admin1234", role: "admin" });
  const demo = await User.create({ name: "Demo User", email: "demo@taskflow.dev", password: "Demo1234" });
  await Task.deleteMany({ owner: demo._id });
  await TimeEntry.deleteMany({ owner: demo._id });
  const tasks = await Task.insertMany([
    { title: "Design the database schema", description: "Draw the ERD for users and tasks.", status: "done", priority: "high", dueDate: day(-3), tags: ["design", "backend"] },
    { title: "Build REST endpoints", description: "CRUD for tasks with validation and error handling.", status: "in-progress", priority: "high", dueDate: day(2), tags: ["backend"] },
    { title: "Write the README", description: "Features, setup steps and API reference.", status: "todo", priority: "medium", dueDate: day(5), tags: ["docs"] },
    { title: "Test with Postman", description: "Cover invalid ids and missing fields.", status: "todo", priority: "medium", dueDate: day(-1), tags: ["testing"] },
    { title: "Deploy to Render", status: "todo", priority: "low", dueDate: day(10), tags: ["devops"] },
    { title: "Polish the UI", description: "Dark mode, responsive layout and empty states.", status: "in-progress", priority: "medium", tags: ["frontend"] }
  ].map((t) => ({ ...t, owner: demo._id })));

  // Finished time entries over the last week: [task index, days ago, start hour, minutes]
  for (const [i, ago, hour, mins] of [[0, 6, 9, 70], [1, 5, 13, 95], [1, 3, 9, 120], [5, 3, 14, 45], [1, 2, 10, 80], [3, 1, 11, 35], [5, 1, 14, 90], [0, 0, 0.1, 20]]) {
    const start = new Date(); start.setDate(start.getDate() - ago); start.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
    if (start > new Date()) continue;
    await TimeEntry.create({ owner: demo._id, task: tasks[i]._id, description: "Focused work", startTime: start, endTime: new Date(start.getTime() + mins * 60000), duration: mins * 60, isRunning: false });
  }
  console.log("Seeded. Demo login: demo@taskflow.dev / Demo1234  |  Admin: admin@taskflow.dev / Admin1234");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
