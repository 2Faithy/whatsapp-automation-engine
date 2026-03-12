const express = require("express");
const router = express.Router();
const fs = require("fs");
const { VERIFY_TOKEN } = require("../config/env");
const { handleMessage } = require("../functions/messageHandler");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

// WhatsApp verification
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive incoming WhatsApp messages
router.post("/", (req, res) => {
  log("POST hit on webhook");
  const body = req.body;
  log("Body: " + JSON.stringify(body));

  if (body.object === "whatsapp_business_account") {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const businessPhone = value?.metadata?.display_phone_number
      ?.replace(/\+/g, "")
      .trim();

    log("Business phone: " + businessPhone);

    if (message && message.type === "text") {
      const from = message.from;
      const text = message.text.body;
      handleMessage(from, text, businessPhone);
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(200);
  }
});

module.exports = router;
