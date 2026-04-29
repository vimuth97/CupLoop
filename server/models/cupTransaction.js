const transactionSchema = new mongoose.Schema({
  cupId: { type: mongoose.Schema.Types.ObjectId, ref: "Cup" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe" },

  type: {
    type: String,
    enum: ["rent", "return", "transfer", "damage"]
  },

  depositAmount: Number,
  rewardPointsEarned: Number,

  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);