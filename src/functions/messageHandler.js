const axios = require('axios');
const { WHATSAPP_TOKEN } = require('../config/env');

async function handleMessage(from, text) {
  const reply = generateReply(text);
  await sendMessage(from, reply);
}

function generateReply(text) {
  const msg = text?.toLowerCase();

  if (msg?.includes('order')) {
    return 'Please share your order number and we will check it for you!';
  } else if (msg?.includes('price') || msg?.includes('cost')) {
    return 'Here are our current prices:\n\n• Basic: ₦5,000\n• Standard: ₦10,000\n• Premium: ₦20,000';
  } else if (msg?.includes('hello') || msg?.includes('hi')) {
    return 'Hello! 👋 Welcome. How can we help you today?';
  } else if (msg?.includes('hours') || msg?.includes('open')) {
    return 'We are open Monday to Friday, 8am - 6pm. Saturday 9am - 3pm.';
  } else {
    return 'Thanks for your message! An agent will get back to you shortly. 🙏';
  }
}

async function sendMessage(to, message) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`Reply sent to ${to} ✅`);
  } catch (error) {
    console.error('Failed to send message:', error.message);
  }
}

module.exports = { handleMessage };
