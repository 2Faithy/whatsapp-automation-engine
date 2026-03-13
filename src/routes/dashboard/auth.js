const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Register
router.post("/register", (req, res) => {
  const { name, email, password, business_name, whatsapp_number, phone } =
    req.body;
  const phoneNumber = whatsapp_number || phone || "";
  const cleanPhone = phoneNumber.replace(/\+/g, "").trim();

  const db = mongoose.connection.db;

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
          contact: { phone: phoneNumber, email: email },
          faqs: [],
          fallback:
            "I did not understand that. Please type:\n1. Prices\n2. Hours\n3. Location\n4. Contact",
          active: true,
          onboarding_complete: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .then(() => businessId);
    })
    .then((businessId) => {
      if (!businessId) return;
      return bcrypt.hash(password, 10).then((hashedPassword) => {
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
            const token = jwt.sign(
              {
                id: userResult.insertedId,
                email,
                business_id: businessId,
                name,
              },
              process.env.JWT_SECRET,
              { expiresIn: "7d" }
            );
            res.cookie("token", token, {
              httpOnly: true,
              maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            return res.json({ success: true, redirect: "/onboarding" });
          });
      });
    })
    .catch((err) => {
      console.error("Register error:", err.message);
      return res.status(500).json({ error: err.message });
    });
});

// Login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const db = mongoose.connection.db;

  db.collection("users")
    .findOne({ email })
    .then((user) => {
      if (!user)
        return res.status(400).json({ error: "Invalid email or password" });
      return bcrypt.compare(password, user.password).then((valid) => {
        if (!valid)
          return res.status(400).json({ error: "Invalid email or password" });
        const token = jwt.sign(
          {
            id: user._id,
            email: user.email,
            business_id: user.business_id,
            name: user.name,
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
        res.cookie("token", token, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.json({ success: true, redirect: "/dashboard" });
      });
    })
    .catch((err) => res.status(500).json({ error: err.message }));
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ success: true });
});

module.exports = router;
