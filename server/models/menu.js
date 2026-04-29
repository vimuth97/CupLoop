const menuSchema = new mongoose.Schema({
  cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe" },
  items: [
    {
      name: String,
      price: Number,
      category: String
    }
  ]
});

module.exports = mongoose.model("Menu", menuSchema);