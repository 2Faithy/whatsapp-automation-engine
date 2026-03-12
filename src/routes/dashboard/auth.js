const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Register
router.post("/register", (req, res) => {
  console.log("Register route hit");
  const { name, email, password, business_name, whatsapp_number } = req.body;
  console.log("Body received:", name, email, business_name);
  const cleanPhone = whatsapp_number.replace(/\+/g, "").trim();
  const db = mongoose.connection.db;
  const bcryptLib = require("bcryptjs");
  const jwtLib = require("jsonwebtoken");

  db.collection("users")
    .findOne({ email })
    .then((existingUser) => {
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      return db
        .collection("businesses")
        .findOne({ whatsapp_number: cleanPhone });
    })
    .then((existingBusiness) => {
      if (existingBusiness && existingBusiness.whatsapp_number) {
        return res
          .status(400)
          .json({ error: "WhatsApp number already registered" });
      }
      const businessId = "biz_" + Date.now();
      return db
        .collection("businesses")
        .insertOne({
          id: businessId,
          name: business_name,
          whatsapp_number: cleanPhone,
          greeting:
            "Welcome to " + business_name + "! How can I help you today?",
          pricing: [],
          hours: {
            weekdays: "9am - 6pm",
            saturday: "10am - 4pm",
            sunday: "Closed",
          },
          location: "Please update your location",
          contact: { phone: whatsapp_number, email: email },
          faqs: [],
          fallback:
            "I did not understand that. Please type:\n1. Prices\n2. Hours\n3. Location\n4. Contact",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .then(() => businessId);
    })
    .then((businessId) => {
      if (!businessId) return;
      return bcryptLib.hash(password, 10).then((hashedPassword) => {
        return db
          .collection("users")
          .insertOne({
            name,
            email,
            password: hashedPassword,
            business_id: businessId,
            role: "owner",
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .then((userResult) => {
            const token = jwtLib.sign(
              { id: userResult.insertedId, email, business_id: businessId },
              process.env.JWT_SECRET,
              { expiresIn: "7d" }
            );
            res.cookie("token", token, {
              httpOnly: true,
              maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            return res.json({ success: true, redirect: "/dashboard" });
          });
      });
    })
    .catch((err) => {
      console.error("Register error:", err.message);
      return res.status(500).json({ error: err.message });
    });
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = mongoose.connection.db;

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, business_id: user.business_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, redirect: "/dashboard" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ success: true, redirect: "/" });
});

module.exports = router;
