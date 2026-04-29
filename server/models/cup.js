const cupSchema = new mongoose.Schema({
  barcode: { type: String, unique: true },
  status: {
    type: String,
    enum: ["available", "in_use", "lost", "damaged"],
    default: "available"
  },
  currentCafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe" },
  currentUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  materialType: String,
  lastUsedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Cup", cupSchema);