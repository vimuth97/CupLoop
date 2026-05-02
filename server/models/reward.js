const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  points: { type: Number, required: true },
  source: {
    type: String,
    enum: ["buy", "rent", "own_cup", "redemption"],
    required: true
  },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "CupTransaction" },
  redeemed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Reward", rewardSchema);
