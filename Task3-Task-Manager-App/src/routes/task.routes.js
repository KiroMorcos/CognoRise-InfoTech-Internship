const router = require("express").Router();
const ctrl = require("../controllers/task.controller");
const validate = require("../middleware/validate");
const validateObjectId = require("../middleware/validateObjectId");
const { authenticate } = require("../middleware/auth");
const { taskSchema, listQuerySchema } = require("../validators/task.validator");

router.use(authenticate);
router.param("id", validateObjectId);

router.get("/stats", ctrl.stats);
router.route("/")
  .get(validate(listQuerySchema, { source: "query", partial: true }), ctrl.list)
  .post(validate(taskSchema), ctrl.create);
router.route("/:id")
  .get(ctrl.getOne)
  .put(validate(taskSchema, { partial: true, requireOne: true }), ctrl.update)
  .delete(ctrl.remove);

module.exports = router;
