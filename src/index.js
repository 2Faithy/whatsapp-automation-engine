const express = require('express');
const { PORT } = require('./config/env');
const webhookRoute = require('./routes/webhook');

const app = express();
app.use(express.json());

app.use('/webhook', webhookRoute);

app.get('/', (req, res) => {
  res.send('WhatsApp Automation Engine is running 🚀');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});