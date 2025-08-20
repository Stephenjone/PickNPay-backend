// models/Items.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    image: String,
    category: {
      type: String,
      enum: ['Juice', 'Noodles', 'Maggie','Fruit Bowl', 'Egg','Sandwich','Shakes'],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
