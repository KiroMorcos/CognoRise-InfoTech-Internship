const User = require("../models/User");

exports.list = async (req, res) => {
  const data = await User.find().sort("-createdAt").limit(100);
  res.json({ success: true, data });
};
