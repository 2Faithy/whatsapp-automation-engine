const mongoose = require("mongoose");
const fs = require("fs");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log("✅ MongoDB connected successfully");
  } catch (error) {
    log("❌ MongoDB connection failed: " + error.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
