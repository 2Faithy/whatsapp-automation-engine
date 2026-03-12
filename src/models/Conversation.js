const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    business_id: { type: String, required: true },
    customer_phone: { type: String, required: true },
    message: { type: String, required: true },
    intent: { type: String },
    reply: { type: String },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      default: "incoming",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
