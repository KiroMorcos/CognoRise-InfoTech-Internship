const router = require("express").Router();

router.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
router.use("/auth", require("./auth.routes"));
router.use("/tasks", require("./task.routes"));
router.use("/time", require("./time.routes"));
router.use("/users", require("./user.routes"));

module.exports = router;
