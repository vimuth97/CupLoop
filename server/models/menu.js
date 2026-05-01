const mongoose = require("mongoose");

const menuSchema = new mongoose.Schema({
  cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true, unique: true },
  items: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      category: { type: String }
    }
  ]
});

module.exports = mongoose.model("Menu", menuSchema);
