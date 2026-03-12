const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    business_id: { type: String, required: true },
    role: { type: String, enum: ["owner", "admin"], default: "owner" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compare password on login
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
