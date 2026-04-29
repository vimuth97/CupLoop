const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["consumer", "admin"], default: "consumer" },
  loyaltyPoints: { type: Number, default: 0 },
  activeCups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cup" }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);