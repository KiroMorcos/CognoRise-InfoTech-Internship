const router = require("express").Router();
const ctrl = require("../controllers/time.controller");
const validate = require("../middleware/validate");
const validateObjectId = require("../middleware/validateObjectId");
const { authenticate } = require("../middleware/auth");
const v = require("../validators/time.validator");

router.use(authenticate);
router.param("id", validateObjectId);

router.get("/active", ctrl.active);
router.post("/start", validate(v.startSchema), ctrl.start);
router.post("/stop", ctrl.stop);
router.get("/totals", ctrl.totals);
router.get("/report", validate(v.reportSchema, { source: "query", partial: true }), ctrl.report);
router.get("/entries", validate(v.entriesSchema, { source: "query", partial: true }), ctrl.entries);
router.delete("/entries/:id", ctrl.removeEntry);

module.exports = router;
