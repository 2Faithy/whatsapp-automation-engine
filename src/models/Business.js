const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    whatsapp_number: { type: String, required: true, unique: true },
    greeting: { type: String },
    pricing: [
      {
        item: String,
        price: String,
      },
    ],
    hours: {
      weekdays: String,
      saturday: String,
      sunday: String,
    },
    location: { type: String },
    contact: {
      phone: String,
      email: String,
    },
    faqs: [
      {
        question: String,
        answer: String,
      },
    ],
    fallback: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);
