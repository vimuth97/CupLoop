const mongoose = require("mongoose");

/**
 * CafeReward — a redeemable offer created by a cafe.
 *
 * type:
 *   "discount"  — percentage off the consumer's order (e.g. 20% off)
 *   "free_item" — a specific menu item given for free (e.g. free coffee)
 *
 * Consumers spend `pointsCost` loyalty points to redeem the offer.
 * The offer is only available between `validFrom` and `validUntil`.
 */
const cafeRewardSchema = new mongoose.Schema({
  cafeId:      { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true },
  title:       { type: String, required: true },
  description: { type: String },
  type:        { type: String, enum: ["discount", "free_item"], required: true },
  pointsCost:  { type: Number, required: true, min: 1 },   // points needed to redeem
  // For discount type
  discountPercentage: { type: Number, min: 1, max: 100 },
  // For free_item type
  itemName:    { type: String },
  validFrom:   { type: Date, required: true },
  validUntil:  { type: Date, required: true },
  active:      { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model("CafeReward", cafeRewardSchema);
