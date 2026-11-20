const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { PORT } = require("./config/env");
const webhookRoute = require("./routes/webhook");
const twilioWebhookRoute = require("./routes/twilioWebhook");
const authRoute = require("./routes/dashboard/auth");
const dashboardRoute = require("./routes/dashboard/index");
const whatsappRoute = require("./routes/whatsapp");
const adminRoute = require("./routes/admin");
const { connectDB } = require("./database/connection");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// API Routes FIRST
app.use("/webhook", webhookRoute);
app.use("/webhook/twilio", twilioWebhookRoute);
app.use("/auth", authRoute);
app.use("/dashboard", dashboardRoute);
app.use("/whatsapp", whatsappRoute);
app.use("/admin", adminRoute);

// Static files
app.use(express.static(path.join(__dirname, "../public"), { index: false }));

// Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../public/landing.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "../public/dashboard.html")));
app.get("/onboarding", (req, res) => res.sendFile(path.join(__dirname, "../public/onboarding.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "../public/admin.html")));

// Error handler
app.use((err, req, res, next) => {
  log("Express error: " + err.stack);
  res.status(500).json({ error: err.message });
});

process.on("unhandledRejection", (err) => {
  log("Unhandled rejection: " + err.stack);
});

connectDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    log("Server running on port " + PORT);
  });
});

setInterval(() => {
  log("Server alive... " + new Date().toLocaleTimeString());
}, 30000);
