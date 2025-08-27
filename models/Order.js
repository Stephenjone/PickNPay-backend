const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    items: [
      {
        name: String,
        quantity: Number,
      },
    ],
    orderId: String,
    token: String,
    status: { type: String, default: "Pending" },
    isReceived: { type: Boolean, default: null },
    notification: { type: String, default: "" }, // ✅ only user sees this
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
