const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
const fs = require("fs");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

// Admin check middleware
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "your@email.com";

function isAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: "Forbidden" });
  next();
}

// Get all businesses + stats
router.get("/businesses", verifyToken, isAdmin, (req, res) => {
  const db = mongoose.connection.db;

  Promise.all([
    db.collection("businesses").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("conversations").countDocuments(),
  ])
    .then(([businesses, convCount]) => {
      const stats = {
        total: businesses.length,
        active: businesses.filter((b) => b.active).length,
        pending: businesses.filter((b) => b.whatsapp_status === "qr_ready")
          .length,
        conversations: convCount,
      };
      res.json({ businesses, stats });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// Activate a business
router.post("/businesses/:id/activate", verifyToken, isAdmin, (req, res) => {
  const db = mongoose.connection.db;
  db.collection("businesses")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { active: true, updatedAt: new Date() } }
    )
    .then(() => res.json({ success: true }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

// Deactivate a business
router.post("/businesses/:id/deactivate", verifyToken, isAdmin, (req, res) => {
  const db = mongoose.connection.db;
  db.collection("businesses")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { active: false, updatedAt: new Date() } }
    )
    .then(() => res.json({ success: true }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

// Delete a business
router.delete("/businesses/:id", verifyToken, isAdmin, (req, res) => {
  const db = mongoose.connection.db;
  db.collection("businesses")
    .deleteOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    .then(() => res.json({ success: true }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

module.exports = router;
