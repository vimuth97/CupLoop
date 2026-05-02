const mongoose = require("mongoose");

const cupTransactionSchema = new mongoose.Schema({
  cupId: { type: mongoose.Schema.Types.ObjectId, ref: "Cup" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true },
  type: {
    type: String,
    enum: ["buy", "rent", "own_cup", "return", "damage"],
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending"
  },
  rewardPointsEarned: { type: Number, default: 0 },
  note: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model("CupTransaction", cupTransactionSchema);
