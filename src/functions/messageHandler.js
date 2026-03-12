const axios = require("axios");
const fs = require("fs");
const { WHATSAPP_TOKEN } = require("../config/env");
const { getBusinessByPhone } = require("../config/businessConfig");
const { processMessage } = require("./aiBrain");
const Conversation = require("../models/Conversation");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

async function handleMessage(from, text, businessPhone) {
  log("📩 New message from " + from + ': "' + text + '"');

  // 1. Find which business this message belongs to
  const business = getBusinessByPhone(businessPhone);

  if (!business) {
    log("Business not found for number: " + businessPhone);
    return;
  }

  log("🏪 Business: " + business.name);

  // 2. Run message through AI brain
  const { intent, reply } = processMessage(text, business);

  log("🧠 Intent: " + intent);
  log("💬 Reply: " + reply);

  // 3. Save conversation to database
  try {
    await Conversation.create({
      business_id: business.id,
      customer_phone: from,
      message: text,
      intent: intent,
      reply: reply,
      direction: "incoming",
    });
    log("💾 Conversation saved to database");
  } catch (err) {
    log("❌ Failed to save conversation: " + err.message);
  }

  // 4. Send reply back to customer
  await sendMessage(from, reply);
}

async function sendMessage(to, message) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    log("[TEST MODE] Reply to " + to + ":");
    log(message);
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
    log("❌ Failed to send message: " + error.message);
  }
}

module.exports = { handleMessage };
