const express = require('express');
const router = express.Router();
const { VERIFY_TOKEN } = require('../config/env');
const { handleMessage } = require('../functions/messageHandler');

// WhatsApp verification handshake
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified ✅');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receives incoming WhatsApp messages
router.post('/', (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;        // customer phone number
      const text = message.text?.body;  // what customer typed
      console.log(`Message from ${from}: ${text}`);
      handleMessage(from, text);
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;