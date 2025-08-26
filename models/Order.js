const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    username: String,
    userEmail: String,
    items: [
      {
        name: String,
        quantity: Number,
      },
    ],
    orderId: String,
    token: String,
    status: {
      type: String,
      default: "Pending",   // ✅ initially pending
    },
    isReceived: {
      type: Boolean,
      default: null,        // ✅ can be Yes / No
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
