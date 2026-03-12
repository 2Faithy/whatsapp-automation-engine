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

    const conversations = await db
      .collection("conversations")
      .find({ business_id: req.user.business_id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const totalMessages = await db.collection("conversations").countDocuments({
      business_id: req.user.business_id,
    });

    const uniqueCustomers = await db
      .collection("conversations")
      .distinct("customer_phone", { business_id: req.user.business_id });

    const intentStats = await db
      .collection("conversations")
      .aggregate([
        { $match: { business_id: req.user.business_id } },
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
