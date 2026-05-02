const mongoose = require("mongoose");

/**
 * Redemption — records a consumer redeeming a CafeReward.
 * Used to verify the redemption at the cafe and track usage.
 */
const redemptionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User",       required: true },
  cafeRewardId: { type: mongoose.Schema.Types.ObjectId, ref: "CafeReward", required: true },
  cafeId:       { type: mongoose.Schema.Types.ObjectId, ref: "Cafe",       required: true },
  pointsSpent:  { type: Number, required: true },
  status:       { type: String, enum: ["pending", "used"], default: "pending" },
  redeemedAt:   { type: Date, default: Date.now },
  usedAt:       { type: Date }
});

module.exports = mongoose.model("Redemption", redemptionSchema);
