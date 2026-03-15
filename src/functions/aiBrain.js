const nlp = require("compromise");
const Fuse = require("fuse.js");
const {
  formatPricing,
  formatHours,
  formatLocation,
  formatContact,
  checkFAQ,
} = require("../config/businessConfig");

// ============================================
// INTENT PATTERNS — English + Pidgin
// ============================================
const intentPatterns = [
  {
    intent: "greeting",
    keywords: [
      "hi",
      "hello",
      "hey",
      "howdy",
      "good morning",
      "good afternoon",
      "good evening",
      "good day",
      "good night",
      "sup",
      "whats up",
      "how are you",
      "how you dey",
      "how far",
      "oga",
      "madam",
      "abeg",
      "bros",
      "sis",
    ],
  },
  {
    intent: "pricing",
    keywords: [
      "how much",
      "price",
      "cost",
      "fee",
      "charge",
      "rate",
      "pricing",
      "menu",
      "price list",
      "what do you sell",
      "your prices",
      "how much is",
      "wetin dey cost",
      "how much e go cost",
      "how much for",
      "what is the price",
      "cost of",
      "how much dem dey sell",
      "na how much",
      "tell me the price",
      "what can i buy",
      "what do you have",
      "show me your menu",
      "catalogue",
      "list of services",
      "services",
    ],
  },
  {
    intent: "hours",
    keywords: [
      "open",
      "close",
      "opening",
      "closing",
      "hours",
      "when do you",
      "what time",
      "business hours",
      "you still open",
      "una dey open",
      "dey open",
      "when una dey",
      "are you open",
      "you open",
      "open now",
      "still open",
      "when do you open",
      "when do you close",
      "working hours",
      "operation hours",
    ],
  },
  {
    intent: "location",
    keywords: [
      "where",
      "address",
      "location",
      "directions",
      "find you",
      "how to get",
      "where are you",
      "where is your",
      "where una dey",
      "your shop",
      "your office",
      "your store",
      "google maps",
      "map",
      "how far",
      "near me",
      "closest",
      "branch",
    ],
  },
  {
    intent: "contact",
    keywords: [
      "call",
      "phone",
      "email",
      "contact",
      "agent",
      "human",
      "person",
      "talk to",
      "speak to",
      "customer service",
      "support",
      "reach you",
      "how to contact",
      "your number",
      "whatsapp number",
      "connect me",
      "real person",
      "operator",
    ],
  },
  {
    intent: "delivery",
    keywords: [
      "deliver",
      "delivery",
      "shipping",
      "ship",
      "send to me",
      "bring it",
      "do you deliver",
      "home delivery",
      "dispatch",
      "courier",
      "logistics",
      "collect",
      "pickup",
      "drop off",
      "delivery fee",
      "how long delivery",
      "how long will it take",
    ],
  },
  {
    intent: "order_status",
    keywords: [
      "order status",
      "track",
      "my order",
      "check order",
      "where is my order",
      "order number",
      "when will it arrive",
      "my package",
      "my item",
      "i ordered",
      "i paid",
      "i already paid",
      "waiting for",
    ],
  },
  {
    intent: "payment",
    keywords: [
      "payment",
      "pay",
      "how to pay",
      "payment method",
      "transfer",
      "bank account",
      "account number",
      "pos",
      "cash",
      "card",
      "online payment",
      "paystack",
      "flutterwave",
      "opay",
      "palmpay",
      "momo",
      "do you accept",
      "can i pay",
    ],
  },
  {
    intent: "booking",
    keywords: [
      "book",
      "booking",
      "reserve",
      "reservation",
      "appointment",
      "schedule",
      "slot",
      "availability",
      "available",
      "when can i come",
      "can i come",
      "visit",
      "walk in",
      "i want to come",
    ],
  },
  {
    intent: "complaint",
    keywords: [
      "complaint",
      "not working",
      "broken",
      "bad service",
      "unhappy",
      "disappointed",
      "problem",
      "issue",
      "wrong",
      "damaged",
      "refund",
      "scam",
      "i want my money back",
      "bad product",
      "not satisfied",
      "rubbish",
      "nonsense",
      "terrible",
      "worst",
      "cheated",
      "fraud",
    ],
  },
  {
    intent: "thanks",
    keywords: [
      "thank you",
      "thanks",
      "appreciate",
      "grateful",
      "thx",
      "thnks",
      "e dey work",
      "nice one",
      "you too much",
      "well done",
      "good job",
      "amazing",
      "excellent",
      "great",
    ],
  },
  {
    intent: "goodbye",
    keywords: [
      "bye",
      "goodbye",
      "see you",
      "later",
      "thanks bye",
      "ok thanks",
      "thank you bye",
      "cya",
      "take care",
      "good night",
      "talk later",
      "i go come back",
      "will come back",
    ],
  },
];

// ============================================
// CHECK IF BUSINESS IS OPEN RIGHT NOW
// ============================================
function isBusinessOpen(business) {
  if (!business.hours) return null;
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const hour = now.getHours();

  let hoursStr = "";
  if (day === 0) hoursStr = business.hours.sunday || "";
  else if (day === 6) hoursStr = business.hours.saturday || "";
  else hoursStr = business.hours.weekdays || "";

  if (!hoursStr || hoursStr.toLowerCase() === "closed") return false;

  // Parse "8am - 9pm" or "8:00 - 21:00"
  const match = hoursStr.match(
    /(\d+)(?::(\d+))?\s*(am|pm)?\s*[-–]\s*(\d+)(?::(\d+))?\s*(am|pm)?/i
  );
  if (!match) return null;

  let openH = parseInt(match[1]);
  let closeH = parseInt(match[4]);
  if (match[3]?.toLowerCase() === "pm" && openH < 12) openH += 12;
  if (match[6]?.toLowerCase() === "pm" && closeH < 12) closeH += 12;
  if (match[3]?.toLowerCase() === "am" && openH === 12) openH = 0;

  return hour >= openH && hour < closeH;
}

// ============================================
// TEXT CLEANER
// ============================================
function cleanText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// INTENT CLASSIFIER
// ============================================
function classifyIntent(text) {
  const cleaned = cleanText(text);

  // Priority order matters — check specific before general
  for (const { intent, keywords } of intentPatterns) {
    if (keywords.some((k) => cleaned.includes(k))) return intent;
  }

  // Fuzzy fallback
  const allPatterns = intentPatterns.flatMap((item) =>
    item.keywords.map((k) => ({ intent: item.intent, pattern: k }))
  );
  const fuse = new Fuse(allPatterns, { keys: ["pattern"], threshold: 0.35 });
  const result = fuse.search(cleaned);
  if (result.length > 0) return result[0].item.intent;

  return "unknown";
}

// ============================================
// RESPONSE BUILDER
// ============================================
function buildReply(intent, business) {
  const name = business.name || "us";

  switch (intent) {
    case "greeting": {
      const open = isBusinessOpen(business);
      const statusNote =
        open === true
          ? " We are currently open! 🟢"
          : open === false
          ? " Note: We are currently closed, but feel free to leave a message."
          : "";
      return (
        (business.greeting || `Welcome to ${name}! How can I help you today?`) +
        statusNote
      );
    }

    case "pricing":
      return formatPricing(business);

    case "hours": {
      const open = isBusinessOpen(business);
      const status =
        open === true
          ? "\n\n✅ We are currently OPEN!"
          : open === false
          ? "\n\n❌ We are currently CLOSED."
          : "";
      return formatHours(business) + status;
    }

    case "location":
      return formatLocation(business);

    case "contact":
      return formatContact(business);

    case "delivery":
      if (business.delivery_info) return business.delivery_info;
      return `For delivery enquiries at ${name}, please contact us directly:\n${formatContact(
        business
      )}`;

    case "payment":
      if (business.payment_info) return business.payment_info;
      return `For payment options at ${name}, please contact us:\n${formatContact(
        business
      )}`;

    case "booking":
      if (business.booking_info) return business.booking_info;
      return `To make a booking at ${name}, please contact us:\n${formatContact(
        business
      )}\n\nOr visit us at:\n${formatLocation(business)}`;

    case "order_status":
      return `To check your order status, please share your order number or contact us directly:\n${formatContact(
        business
      )}`;

    case "complaint":
      return `We are really sorry to hear that 😔 Your satisfaction is our priority.\n\nPlease describe what happened and contact us so we can resolve this immediately:\n${formatContact(
        business
      )}`;

    case "thanks":
      return `You are welcome! 😊 We are happy to help. Is there anything else I can assist you with?`;

    case "goodbye":
      return `Thank you for reaching out to ${name}! Have a wonderful day 👋 Feel free to message us anytime.`;

    default:
      return (
        business.fallback ||
        `I'm not sure I understand. Here's how I can help you:\n\n1️⃣ Prices & Menu\n2️⃣ Opening Hours\n3️⃣ Location\n4️⃣ Contact us\n5️⃣ Delivery info\n\nJust type what you need! 😊`
      );
  }
}

// ============================================
// MAIN PROCESS FUNCTION
// ============================================
function processMessage(text, business) {
  if (!text || !business)
    return { intent: "unknown", reply: "Hi! How can I help you?" };

  // FAQ check first
  const faqAnswer = checkFAQ(business, text);
  if (faqAnswer) return { intent: "faq", reply: faqAnswer };

  // Number shortcuts (1, 2, 3, 4, 5)
  const trimmed = text.trim();
  if (trimmed === "1")
    return { intent: "pricing", reply: buildReply("pricing", business) };
  if (trimmed === "2")
    return { intent: "hours", reply: buildReply("hours", business) };
  if (trimmed === "3")
    return { intent: "location", reply: buildReply("location", business) };
  if (trimmed === "4")
    return { intent: "contact", reply: buildReply("contact", business) };
  if (trimmed === "5")
    return { intent: "delivery", reply: buildReply("delivery", business) };

  const intent = classifyIntent(text);
  const reply = buildReply(intent, business);
  return { intent, reply };
}

module.exports = { processMessage };
