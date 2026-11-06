const mongoose = require("mongoose");
const { mongoUri } = require("./env");

module.exports = async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};
