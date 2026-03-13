const express = require("express");
const router = express.Router();
const fs = require("fs");
const twilio = require("twilio");
const { getBusinessByPhone } = require("../config/businessConfig");
const { processMessage } = require("../functions/aiBrain");
const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

router.post("/", (req, res) => {
  const body = req.body;
  const from = body.From?.replace("whatsapp:", "");
  const to = body.To?.replace("whatsapp:", "");
  const text = body.Body;

  log("📩 Twilio message from " + from + ": " + text);
  log("📬 To number: " + to);

  // Clean the business phone number
  const businessPhone = to?.replace(/\+/g, "").trim();

  // Try to find business in database first
  const db = mongoose.connection.db;

  db.collection("businesses")
    .findOne({ whatsapp_number: businessPhone })
    .then((business) => {
      if (!business) {
        log("❌ Business not found for: " + businessPhone);
        // Use fallback business data
        business = {
          id: "default",
          name: "Business",
          greeting: "Hello! How can I help you today?",
          pricing: [],
          hours: {
            weekdays: "9am-6pm",
            saturday: "10am-4pm",
            sunday: "Closed",
          },
          location: "Contact us for location",
          contact: { phone: to, email: "" },
          faqs: [],
          fallback: "Please type: 1. Prices 2. Hours 3. Location 4. Contact",
        };
      }

      const { intent, reply } = processMessage(text, business);
      log("🧠 Intent: " + intent);
      log("💬 Reply: " + reply);

      // Save to database
      db.collection("conversations")
        .insertOne({
          business_id: business.id,
          customer_phone: from,
          message: text,
          intent: intent,
          reply: reply,
          direction: "incoming",
          createdAt: new Date(),
        })
        .catch((err) => log("❌ Save error: " + err.message));

      // Send reply via Twilio
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const client = twilio(accountSid, authToken);

      return client.messages.create({
        from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
        to: "whatsapp:" + from,
        body: reply,
      });
    })
    .then((message) => {
      log("✅ Reply sent via Twilio: " + message.sid);
      res.status(200).send("<Response></Response>");
    })
    .catch((err) => {
      log("❌ Twilio error: " + err.message);
      res.status(200).send("<Response></Response>");
    });
});

module.exports = router;
