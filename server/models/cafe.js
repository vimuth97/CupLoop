const mongoose = require("mongoose");

const cafeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  location: {
    address: { type: String },
    // GeoJSON Point — enables MongoDB $near geospatial queries
    coordinates: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number] } // [longitude, latitude]
    }
  },
  contactInfo: String,
  cupInventoryCount: { type: Number, default: 0 },
  activeStatus: { type: Boolean, default: false },
  approvedAt: { type: Date },
  rejectedReason: { type: String },
  rating: Number,
  createdAt: { type: Date, default: Date.now }
});

// 2dsphere index enables $near, $geoWithin, and $geoIntersects queries
cafeSchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Cafe", cafeSchema);
