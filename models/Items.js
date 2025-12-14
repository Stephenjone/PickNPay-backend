const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    image: String,
    category: {
      type: String,
      // 💡 FIX 2: Added 'Fruits' and changed 'Shakes' to 'Milk shake' for consistency with client/route logic
      enum: ['Juice', 'Noodles', 'Maggie', 'Fruit Bowl', 'Egg', 'Sandwich', 'Milk shake', 'Fruits'],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);