const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const fs = require("fs");
const mongoose = require("mongoose");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

// Store active clients per business
const clients = {};
const qrCodes = {};
const statuses = {};

async function createClient(businessId) {
  if (clients[businessId]) {
    log("Client already exists for business: " + businessId);
    return;
  }

  log("Creating WhatsApp client for business: " + businessId);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: businessId.toString() }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
  });

  clients[businessId] = client;
  statuses[businessId] = "initializing";

  client.on("qr", async (qr) => {
    log("QR received for business: " + businessId);
    statuses[businessId] = "qr_ready";
    try {
      qrCodes[businessId] = await qrcode.toDataURL(qr);
      // Save QR status to database
      const db = mongoose.connection.db;
      await db
        .collection("businesses")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(businessId) },
          { $set: { whatsapp_status: "qr_ready", updatedAt: new Date() } }
        );
    } catch (err) {
      log("QR error: " + err.message);
    }
  });

  client.on("ready", async () => {
    log("WhatsApp ready for business: " + businessId);
    statuses[businessId] = "connected";
    qrCodes[businessId] = null;
    try {
      const info = client.info;
      const db = mongoose.connection.db;
      await db.collection("businesses").updateOne(
        { _id: new mongoose.Types.ObjectId(businessId) },
        {
          $set: {
            whatsapp_status: "connected",
            whatsapp_number: info.wid.user,
            active: true,
            updatedAt: new Date(),
          },
        }
      );
      log("Business number saved: " + info.wid.user);
    } catch (err) {
      log("Ready error: " + err.message);
    }
  });

  client.on("message", async (message) => {
    try {
      if (message.fromMe) return;
      const from = message.from.replace("@c.us", "");
      const text = message.body;
      log("Message for business " + businessId + " from " + from + ": " + text);

      const db = mongoose.connection.db;
      const business = await db.collection("businesses").findOne({
        _id: new mongoose.Types.ObjectId(businessId),
      });

      if (!business) return;

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

      await message.reply(reply);
      log("Reply sent to " + from + ": " + reply);
    } catch (err) {
      log("Message error: " + err.message);
    }
  });

  client.on("disconnected", async (reason) => {
    log(
      "Client disconnected for business: " + businessId + " reason: " + reason
    );
    statuses[businessId] = "disconnected";
    delete clients[businessId];
    try {
      const db = mongoose.connection.db;
      await db
        .collection("businesses")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(businessId) },
          {
            $set: {
              whatsapp_status: "disconnected",
              active: false,
              updatedAt: new Date(),
            },
          }
        );
    } catch (err) {
      log("Disconnect error: " + err.message);
    }
  });

  client.on("auth_failure", (msg) => {
    log("Auth failure for business: " + businessId + ": " + msg);
    statuses[businessId] = "auth_failed";
    delete clients[businessId];
  });

  await client.initialize();
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
      await createClient(biz._id.toString());
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
    clients[businessId].destroy();
    delete clients[businessId];
    delete qrCodes[businessId];
    statuses[businessId] = "disconnected";
  }
}

module.exports = {
  createClient,
  getQR,
  getStatus,
  disconnectClient,
  restoreActiveSessions,
};
