const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["consumer", "admin", "cafe"], default: "consumer" },
  loyaltyPoints: { type: Number, default: 0 },
  activeCups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cup" }],
  accountStatus: { type: String, enum: ["active", "inactive"], default: "active" },
  emailVerified: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);