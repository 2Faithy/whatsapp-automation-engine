const fs = require("fs");
const path = require("path");

// Load all businesses from JSON file
function getBusinesses() {
  const filePath = path.join(__dirname, "../data/businesses.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw).businesses;
}

// Get one business by their WhatsApp number
function getBusinessByPhone(whatsappNumber) {
  const businesses = getBusinesses();
  return businesses.find((b) => b.whatsapp_number === whatsappNumber) || null;
}

// Get one business by their ID
function getBusinessById(id) {
  const businesses = getBusinesses();
  return businesses.find((b) => b.id === id) || null;
}

// Format pricing list into readable message
function formatPricing(business) {
  let msg = `Here are our prices at ${business.name}:\n\n`;
  business.pricing.forEach((item) => {
    msg += `• ${item.item}: ${item.price}\n`;
  });
  return msg;
}

// Format business hours into readable message
function formatHours(business) {
  return `Our opening hours:\n\n📅 Weekdays: ${business.hours.weekdays}\n📅 Saturday: ${business.hours.saturday}\n📅 Sunday: ${business.hours.sunday}`;
}

// Format location into readable message
function formatLocation(business) {
  return `📍 We are located at:\n${business.location}\n\nNeed help finding us? Just ask!`;
}

// Format contact into readable message
function formatContact(business) {
  return `You can reach us at:\n\n📞 Phone: ${business.contact.phone}\n📧 Email: ${business.contact.email}\n\nOr type "talk to agent" to speak with someone now.`;
}

// Check FAQs for a match
function checkFAQ(business, text) {
  const cleaned = text.toLowerCase();
  const match = business.faqs.find((faq) => {
    const question = faq.question.toLowerCase();
    const questionWords = question.split(" ").filter((w) => w.length > 3);
    const matchCount = questionWords.filter((word) =>
      cleaned.includes(word)
    ).length;
    return matchCount >= 2 || cleaned.includes(question);
  });
  return match ? match.answer : null;
}

module.exports = {
  getBusinesses,
  getBusinessByPhone,
  getBusinessById,
  formatPricing,
  formatHours,
  formatLocation,
  formatContact,
  checkFAQ,
};
