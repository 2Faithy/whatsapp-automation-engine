const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { PORT } = require("./config/env");
const webhookRoute = require("./routes/webhook");
const authRoute = require("./routes/dashboard/auth");
const dashboardRoute = require("./routes/dashboard/index");
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

// API Routes FIRST — before static files
app.use("/webhook", webhookRoute);
app.use("/auth", authRoute);
app.use("/dashboard", dashboardRoute);

// Test route
app.post("/test-register", (req, res) => {
  const mongoose = require("mongoose");
  const bcrypt = require("bcryptjs");
  const db = mongoose.connection.db;
  bcrypt
    .hash("password123", 10)
    .then((hash) =>
      db.collection("testusers").insertOne({
        name: "Faith",
        email: "faith@test.com",
        password: hash,
      })
    )
    .then((r) => res.json({ success: true, id: r.insertedId }))
    .catch((err) =>
      res.status(500).json({ error: err.message, stack: err.stack })
    );
});

// Static files AFTER routes
app.use(express.static(path.join(__dirname, "../public")));

// Pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

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
