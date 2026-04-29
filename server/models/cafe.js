const cafeSchema = new mongoose.Schema({
  name: String,
  location: {
    address: String,
    lat: Number,
    lng: Number
  },
  contactInfo: String,
  cupInventoryCount: Number,
  activeStatus: { type: Boolean, default: true },
  rating: Number
});

module.exports = mongoose.model("Cafe", cafeSchema);