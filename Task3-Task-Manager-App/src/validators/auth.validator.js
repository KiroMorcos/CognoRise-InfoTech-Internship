const { str, email, password } = require("./rules");

exports.registerSchema = {
  name: { rule: str({ min: 2, max: 50 }), required: true },
  email: { rule: email(), required: true },
  password: { rule: password(), required: true }
};

exports.loginSchema = {
  email: { rule: email(), required: true },
  password: { rule: password({ strong: false }), required: true }
};
