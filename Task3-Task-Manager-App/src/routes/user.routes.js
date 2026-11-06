const router = require("express").Router();
const ctrl = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", authenticate, authorize("admin"), ctrl.list);

module.exports = router;
