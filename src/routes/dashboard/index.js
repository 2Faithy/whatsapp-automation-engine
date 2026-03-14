const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authMiddleware = require("../../middleware/authMiddleware");

// Get dashboard data
router.get("/data", authMiddleware, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const business = await db.collection("businesses").findOne({
      id: req.user.business_id,
    });

    if (!business) return res.status(404).json({ error: "Business not found" });

    // Match by BOTH possible business_id formats (string id or ObjectId)
    const bizIdMatch = {
      $or: [
        { business_id: req.user.business_id },
        { business_id: business._id },
        { business_id: business._id.toString() },
      ],
    };

    const conversations = await db
      .collection("conversations")
      .find(bizIdMatch)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const totalMessages = await db
      .collection("conversations")
      .countDocuments(bizIdMatch);

    const uniqueCustomers = await db
      .collection("conversations")
      .distinct("customer_phone", bizIdMatch);

    const intentStats = await db
      .collection("conversations")
      .aggregate([
        { $match: bizIdMatch },
        { $group: { _id: "$intent", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    res.json({
      business,
      conversations,
      analytics: {
        totalMessages,
        uniqueCustomers: uniqueCustomers.length,
        intentStats,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update business
router.put("/business", authMiddleware, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    await db
      .collection("businesses")
      .updateOne(
        { id: req.user.business_id },
        { $set: { ...req.body, updatedAt: new Date() } }
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
