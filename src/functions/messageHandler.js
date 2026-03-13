const axios = require("axios");
const fs = require("fs");
const { WHATSAPP_TOKEN } = require("../config/env");
const { processMessage } = require("./aiBrain");
const mongoose = require("mongoose");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

async function handleMessage(from, text, businessPhone) {
  log("📩 New message from " + from + ': "' + text + '"');

  const db = mongoose.connection.db;

  // 1. Find business by phone number, fallback to first active business
  let business = await db
    .collection("businesses")
    .findOne({ whatsapp_number: businessPhone });

  if (!business) {
    log(
      "Business not found by number: " +
        businessPhone +
        " — using first active business"
    );
    business = await db.collection("businesses").findOne({ active: true });
  }

  if (!business) {
    log("❌ No business found at all");
    return;
  }

  log("🏪 Business: " + business.name);

  // 2. Run message through AI brain
  const { intent, reply } = processMessage(text, business);
  log("🧠 Intent: " + intent);
  log("💬 Reply: " + reply);

  // 3. Save conversation to database
  try {
    await db.collection("conversations").insertOne({
      business_id: business._id,
      customer_phone: from,
      message: text,
      intent: intent,
      reply: reply,
      direction: "incoming",
      createdAt: new Date(),
    });
    log("💾 Conversation saved");
  } catch (err) {
    log("❌ Failed to save conversation: " + err.message);
  }

  // 4. Send reply back to customer
  await sendMessage(from, reply);
}

async function sendMessage(to, message) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    log("[TEST MODE] Reply to " + to + ": " + message);
    return;
  }

  try {
    await axios.post(
      "https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages",
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: "Bearer " + WHATSAPP_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    log("✅ Reply sent to " + to);
  } catch (error) {
    log(
      "❌ Failed to send message: " + error.response?.data?.error?.message ||
        error.message
    );
  }
}

module.exports = { handleMessage };
