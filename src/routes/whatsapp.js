const express = require('express');
const router = express.Router();
const { createClient, getQR, getStatus, disconnectClient } = require('../functions/whatsappManager');
const verifyToken = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const fs = require('fs');

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  process.stdout.write(line);
  fs.appendFileSync('server.log', line);
}

// Start WhatsApp connection - generates QR code
router.post('/connect', verifyToken, (req, res) => {
  const businessId = req.user.business_id.toString();
  const status = getStatus(businessId);

  if (status === 'connected') {
    res.json({ success: true, status: 'connected' });
    return;
  }

  createClient(businessId)
    .then(() => {
      res.json({ success: true, message: 'Initializing WhatsApp connection...' });
    })
    .catch((err) => {
      log('Connect error: ' + err.message);
      res.status(500).json({ error: err.message });
    });
});

// Get QR code
router.get('/qr', verifyToken, (req, res) => {
  const businessId = req.user.business_id.toString();
  const status = getStatus(businessId);
  const qr = getQR(businessId);

  res.json({ status, qr });
});

// Get connection status
router.get('/status', verifyToken, (req, res) => {
  const businessId = req.user.business_id.toString();
  const status = getStatus(businessId);
  res.json({ status });
});

// Disconnect WhatsApp
router.post('/disconnect', verifyToken, (req, res) => {
  const businessId = req.user.business_id.toString();
  disconnectClient(businessId);

  const db = mongoose.connection.db;
  db.collection('businesses').updateOne(
    { _id: new mongoose.Types.ObjectId(businessId) },
    { $set: { whatsapp_status: 'disconnected', active: false } }
  ).then(() => {
    res.json({ success: true });
  }).catch((err) => {
    res.status(500).json({ error: err.message });
  });
});

module.exports = router;