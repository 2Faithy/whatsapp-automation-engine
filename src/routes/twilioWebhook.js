const express = require("express");
const router = express.Router();
const fs = require("fs");
const twilio = require("twilio");
const { processMessage } = require("../functions/aiBrain");
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

  const businessPhone = to?.replace(/\+/g, "").trim();
  const db = mongoose.connection.db;

  db.collection("businesses")
    .findOne({ whatsapp_number: businessPhone })
    .then((business) => {
      if (business) return business;
      log("Business not found by number — using first active business");
      return db.collection("businesses").findOne({ active: true });
    })
    .then((business) => {
      if (!business) {
        log("No business found at all");
        res.status(200).send("<Response></Response>");
        return null;
      }

      log("🏪 Business: " + business.name);

      const { intent, reply } = processMessage(text, business);
      log("🧠 Intent: " + intent);
      log("💬 Reply: " + reply);

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

      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      return client.messages.create({
        from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
        to: "whatsapp:" + from,
        body: reply,
      });
    })
    .then((message) => {
      if (message) log("✅ Reply sent: " + message.sid);
      res.status(200).send("<Response></Response>");
    })
    .catch((err) => {
      log("❌ Error: " + err.message);
      res.status(200).send("<Response></Response>");
    });
});

module.exports = router;
