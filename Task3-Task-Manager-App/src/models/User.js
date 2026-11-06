const { Schema, model } = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../constants");

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },          // bcrypt hash, never returned
    role: { type: String, enum: ROLES, default: "user" },
    refreshTokenHash: { type: String, select: false }                   // sha256 of the current refresh token
  },
  { timestamps: true }
);

// Hash the password whenever it is set or changed (cost factor 12).
userSchema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = model("User", userSchema);
