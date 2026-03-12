const express = require("express");
const { PORT } = require("./config/env");
const webhookRoute = require("./routes/webhook");
const fs = require("fs");
function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WhatsApp Automation Engine is running!");
});

app.use("/webhook", webhookRoute);

app.post("/test", (req, res) => {
  log("Test hit: " + JSON.stringify(req.body));
  res.send("Test OK");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});

setInterval(() => {
  console.log("Server alive... " + new Date().toLocaleTimeString());
}, 30000);
