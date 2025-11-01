const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  rating: { type: Number, default: null }, // ✅ added
  feedback: { type: String, default: "" },  // ✅ added
});

const OrderSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true },
    items: [ItemSchema],
    totalAmount: { type: Number, required: true },
    orderId: { type: String, required: true },
    token: { type: String },
    userStatus: { type: String, default: "Food is getting prepared" },
    adminStatus: { type: String, default: "Pending" },
    notification: { type: String, default: "Your order is being processed" },
    adminDeleted: { type: Boolean, default: false },
    fcmToken: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
