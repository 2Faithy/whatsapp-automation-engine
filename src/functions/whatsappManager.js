const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

const clients = {};
const qrCodes = {};
const statuses = {};

async function createClient(businessId) {
  if (clients[businessId] && statuses[businessId] === "connected") {
    log("Client already connected for: " + businessId);
    return;
  }

  log("Creating Baileys client for business: " + businessId);
  statuses[businessId] = "initializing";

  const authDir = path.join(
    __dirname,
    "../../.wa_sessions",
    businessId.toString()
  );
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: {
      level: "silent",
      child: () => ({
        level: "silent",
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => ({}),
      }),
    },
    browser: ["WA Automation", "Chrome", "1.0.0"],
  });

  clients[businessId] = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      log("QR received for business: " + businessId);
      statuses[businessId] = "qr_ready";
      try {
        qrCodes[businessId] = await qrcode.toDataURL(qr);
        const db = mongoose.connection.db;
        await db
          .collection("businesses")
          .updateOne(
            { id: businessId },
            { $set: { whatsapp_status: "qr_ready", updatedAt: new Date() } }
          );
      } catch (err) {
        log("QR error: " + err.message);
      }
    }

    if (connection === "open") {
      log("WhatsApp connected for business: " + businessId);
      statuses[businessId] = "connected";
      qrCodes[businessId] = null;
      try {
        const db = mongoose.connection.db;
        const jid = sock.user?.id?.split(":")[0];
        await db
          .collection("businesses")
          .updateOne(
            { id: businessId },
            {
              $set: {
                whatsapp_status: "connected",
                whatsapp_number: jid,
                active: true,
                updatedAt: new Date(),
              },
            }
          );
        log("Business WhatsApp number: " + jid);
      } catch (err) {
        log("Connected update error: " + err.message);
      }
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      log(
        "Connection closed for " +
          businessId +
          " — reconnect: " +
          shouldReconnect
      );
      if (shouldReconnect) {
        setTimeout(() => createClient(businessId), 5000);
      } else {
        statuses[businessId] = "disconnected";
        delete clients[businessId];
        const db = mongoose.connection.db;
        db.collection("businesses")
          .updateOne(
            { id: businessId },
            { $set: { whatsapp_status: "disconnected", active: false } }
          )
          .catch(() => {});
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const from = msg.key.remoteJid?.replace("@s.whatsapp.net", "");
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      if (!text || !from) continue;

      log("Message for " + businessId + " from " + from + ": " + text);

      try {
        const db = mongoose.connection.db;
        const business = await db
          .collection("businesses")
          .findOne({ id: businessId });
        if (!business) continue;

        const { processMessage } = require("./aiBrain");
        const { intent, reply } = processMessage(text, business);

        await db.collection("conversations").insertOne({
          business_id: business._id,
          customer_phone: from,
          message: text,
          intent,
          reply,
          direction: "incoming",
          createdAt: new Date(),
        });

        await sock.sendMessage(msg.key.remoteJid, { text: reply });
        log("Reply sent to " + from + ": " + reply);
      } catch (err) {
        log("Message handler error: " + err.message);
      }
    }
  });
}

async function restoreActiveSessions() {
  try {
    const db = mongoose.connection.db;
    const businesses = await db
      .collection("businesses")
      .find({ whatsapp_status: "connected", active: true })
      .toArray();
    log("Restoring " + businesses.length + " active WhatsApp sessions...");
    for (const biz of businesses) {
      await createClient(biz.id);
    }
  } catch (err) {
    log("Restore sessions error: " + err.message);
  }
}

function getQR(businessId) {
  return qrCodes[businessId] || null;
}

function getStatus(businessId) {
  return statuses[businessId] || "not_started";
}

function disconnectClient(businessId) {
  if (clients[businessId]) {
    try {
      clients[businessId].end();
    } catch (e) {}
    delete clients[businessId];
    delete qrCodes[businessId];
    statuses[businessId] = "disconnected";
    const authDir = path.join(
      __dirname,
      "../../.wa_sessions",
      businessId.toString()
    );
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true });
  }
}

module.exports = {
  createClient,
  getQR,
  getStatus,
  disconnectClient,
  restoreActiveSessions,
};
