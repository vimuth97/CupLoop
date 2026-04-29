const mongoose = require("mongoose");

const cafeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  location: {
    address: String,
    lat: Number,
    lng: Number
  },
  contactInfo: String,
  cupInventoryCount: { type: Number, default: 0 },
  activeStatus: { type: Boolean, default: false },
  approvedAt: { type: Date },
  rejectedReason: { type: String },
  rating: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Cafe", cafeSchema);
