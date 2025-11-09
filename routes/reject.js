const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");

// Helper function to send push notification
async function sendPushNotification(email, message) {
    try {
        const user = await User.findOne({ email }).select("fcmToken");
        if (!user?.fcmToken) {
            console.warn(`No FCM token found for user: ${email}`);
            return;
        }

        // Get the admin instance from the app
        const admin = require("../server").admin;
        
        const notification = {
            token: user.fcmToken,
            notification: {
                title: "Order Update",
                body: message
            }
        };

        await admin.messaging().send(notification);
        console.log(`Push notification sent to ${email}`);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

// Route to reject an order
router.post("/:orderId", async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Update order status
        order.adminStatus = "Rejected";
        order.userStatus = "Order Rejected";
        await order.save();

        // Send push notification
        await sendPushNotification(
            order.email,
            "Oops! Your order cannot be accepted at the moment, please try again later."
        );

        res.json({
            success: true,
            order: order
        });
    } catch (error) {
        console.error("Error rejecting order:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to reject order",
            error: error.message 
        });
    }
});

module.exports = router;