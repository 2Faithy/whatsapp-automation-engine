const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  process.stdout.write(line);
  fs.appendFileSync('server.log', line);
}

const silentLogger = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: function() { return this; },
};

const clients = {};
const qrCodes = {};
const statuses = {};

async function createClient(businessId) {
  if (clients[businessId] && statuses[businessId] === 'connected') return;
  log('Creating Baileys client for business: ' + businessId);
  statuses[businessId] = 'initializing';

  const authDir = path.join(__dirname, '../../.wa_sessions', businessId.toString());
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger,
    browser: ['WA Automation', 'Chrome', '1.0.0'],
  });

  clients[businessId] = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      log('QR received for: ' + businessId);
      statuses[businessId] = 'qr_ready';
      try {
        qrCodes[businessId] = await qrcode.toDataURL(qr);
        await mongoose.connection.db.collection('businesses').updateOne(
          { id: businessId }, { $set: { whatsapp_status: 'qr_ready', updatedAt: new Date() } }
        );
      } catch (err) { log('QR error: ' + err.message); }
    }
    if (connection === 'open') {
      log('Connected: ' + businessId);
      statuses[businessId] = 'connected';
      qrCodes[businessId] = null;
      try {
        const jid = sock.user?.id?.split(':')[0];
        await mongoose.connection.db.collection('businesses').updateOne(
          { id: businessId }, { $set: { whatsapp_status: 'connected', whatsapp_number: jid, active: true, updatedAt: new Date() } }
        );
      } catch (err) { log('Open error: ' + err.message); }
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        delete clients[businessId];
        setTimeout(() => createClient(businessId), 5000);
      } else {
        statuses[businessId] = 'disconnected';
        delete clients[businessId];
        mongoose.connection.db.collection('businesses').updateOne(
          { id: businessId }, { $set: { whatsapp_status: 'disconnected', active: false } }
        ).catch(() => {});
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '');
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !from) continue;
      log('Message for ' + businessId + ' from ' + from + ': ' + text);
      try {
        const business = await mongoose.connection.db.collection('businesses').findOne({ id: businessId });
        if (!business) continue;
        const { processMessage } = require('./aiBrain');
        const { intent, reply } = processMessage(text, business);
        await mongoose.connection.db.collection('conversations').insertOne({
          business_id: business._id, customer_phone: from, message: text,
          intent, reply, direction: 'incoming', createdAt: new Date()
        });
        await sock.sendMessage(msg.key.remoteJid, { text: reply });
        log('Reply sent to ' + from);
      } catch (err) { log('Message error: ' + err.message); }
    }
  });
}

async function restoreActiveSessions() {
  try {
    const businesses = await mongoose.connection.db.collection('businesses')
      .find({ whatsapp_status: 'connected', active: true }).toArray();
    log('Restoring ' + businesses.length + ' sessions...');
    for (const biz of businesses) await createClient(biz.id);
  } catch (err) { log('Restore error: ' + err.message); }
}

function getQR(businessId) { return qrCodes[businessId] || null; }
function getStatus(businessId) { return statuses[businessId] || 'not_started'; }
function disconnectClient(businessId) {
  if (clients[businessId]) {
    try { clients[businessId].end(); } catch (e) {}
    delete clients[businessId];
    delete qrCodes[businessId];
    statuses[businessId] = 'disconnected';
    const authDir = path.join(__dirname, '../../.wa_sessions', businessId.toString());
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true });
  }
}

module.exports = { createClient, getQR, getStatus, disconnectClient, restoreActiveSessions };
