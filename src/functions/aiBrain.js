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
// 1. INTENT PATTERNS
// ============================================
const intentPatterns = [
  {
    intent: "greeting",
    patterns: [
      "hi",
      "hello",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "howdy",
      "whats up",
      "good day",
    ],
  },
  {
    intent: "pricing",
    patterns: [
      "how much",
      "price",
      "cost",
      "fee",
      "charge",
      "rate",
      "pricing",
      "menu",
      "what do you sell",
      "your prices",
      "how much is",
      "wetin dey cost",
      "how much e go cost",
      "price list",
      "how much for",
      "what is the price",
      "jollof",
      "fried rice",
      "food menu",
      "what do you have",
    ],
  },
  {
    intent: "hours",
    patterns: [
      "opening hours",
      "closing time",
      "when do you open",
      "when do you close",
      "are you open",
      "business hours",
      "what time",
      "you still open",
      "when una dey open",
    ],
  },
  {
    intent: "location",
    patterns: [
      "where are you",
      "your address",
      "location",
      "where is your shop",
      "how do i find you",
      "directions",
      "where una dey",
      "address",
    ],
  },
  {
    intent: "contact",
    patterns: [
      "call you",
      "phone number",
      "email",
      "contact",
      "speak to someone",
      "talk to agent",
      "human",
      "real person",
      "customer service",
      "connect me",
    ],
  },
  {
    intent: "order_status",
    patterns: [
      "order status",
      "track my order",
      "where is my order",
      "my order",
      "check order",
      "order number",
      "delivery status",
      "when will it arrive",
      "my package",
    ],
  },
  {
    intent: "complaint",
    patterns: [
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
    ],
  },
  {
    intent: "thanks",
    patterns: [
      "thank you",
      "thanks",
      "appreciate",
      "grateful",
      "thx",
      "thnks",
      "e dey work",
      "nice one",
    ],
  },
  {
    intent: "goodbye",
    patterns: [
      "bye",
      "goodbye",
      "see you",
      "later",
      "thanks bye",
      "ok thanks",
      "thank you bye",
      "cya",
    ],
  },
];

// ============================================
// 2. GENERIC RESPONSES
// ============================================
const genericResponses = {
  greeting: (business) => business.greeting,
  order_status: () =>
    "Please share your order number and we will check it immediately! 📦",
  complaint: () =>
    "I am really sorry to hear that 😔 Please describe what happened and we will fix it right away.",
  thanks: () =>
    "You are welcome! 😊 Is there anything else I can help you with?",
  goodbye: () =>
    "Goodbye! Have a wonderful day! Feel free to reach out anytime 👋",
  unknown: (business) => business.fallback,
};

// ============================================
// 3. TEXT CLEANER
// ============================================
function cleanText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// 4. INTENT CLASSIFIER
// ============================================
function classifyIntent(text) {
  const cleaned = cleanText(text);

  // Priority keywords — checked first
  const priorityChecks = [
    {
      keywords: [
        "how much",
        "price",
        "cost",
        "menu",
        "fee",
        "rate",
        "pricing",
        "wetin dey cost",
        "jollof",
        "fried rice",
        "food",
      ],
      intent: "pricing",
    },
    {
      keywords: [
        "open",
        "hours",
        "closing",
        "when do you",
        "what time",
        "dey open",
        "una dey",
      ],
      intent: "hours",
    },
    {
      keywords: ["where", "address", "location", "directions", "find you"],
      intent: "location",
    },
    {
      keywords: [
        "call",
        "phone",
        "email",
        "contact",
        "agent",
        "human",
        "person",
      ],
      intent: "contact",
    },
    {
      keywords: ["order", "track", "delivery status", "package", "shipment"],
      intent: "order_status",
    },
    {
      keywords: [
        "complaint",
        "refund",
        "broken",
        "bad",
        "wrong",
        "damaged",
        "problem",
        "issue",
      ],
      intent: "complaint",
    },
    { keywords: ["thank", "thanks", "appreciate", "thx"], intent: "thanks" },
    { keywords: ["bye", "goodbye", "later", "see you"], intent: "goodbye" },
    {
      keywords: [
        "hi",
        "hello",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "good day",
      ],
      intent: "greeting",
    },
  ];

  for (const check of priorityChecks) {
    if (check.keywords.some((keyword) => cleaned.includes(keyword))) {
      return check.intent;
    }
  }

  // Fuzzy match fallback
  const allPatterns = [];
  intentPatterns.forEach((item) => {
    item.patterns.forEach((pattern) => {
      allPatterns.push({ intent: item.intent, pattern });
    });
  });

  const fuse = new Fuse(allPatterns, { keys: ["pattern"], threshold: 0.3 });
  const result = fuse.search(cleaned);
  if (result.length > 0) {
    return result[0].item.intent;
  }

  return "unknown";
}

// ============================================
// 5. ENTITY EXTRACTOR
// ============================================
function extractEntities(text) {
  const doc = nlp(text);
  return {
    names: doc.people().out("array"),
    places: doc.places().out("array"),
    numbers: doc.values().out("array"),
  };
}

// ============================================
// 6. MAIN PROCESS
// ============================================
function processMessage(text, business) {
  // Check FAQs first
  const faqAnswer = checkFAQ(business, text);
  if (faqAnswer) {
    return { intent: "faq", reply: faqAnswer };
  }

  const intent = classifyIntent(text);
  const entities = extractEntities(text);

  let reply;
  switch (intent) {
    case "greeting":
      reply = genericResponses.greeting(business);
      break;
    case "pricing":
      reply = formatPricing(business);
      break;
    case "hours":
      reply = formatHours(business);
      break;
    case "location":
      reply = formatLocation(business);
      break;
    case "contact":
      reply = formatContact(business);
      break;
    case "order_status":
      reply = genericResponses.order_status();
      break;
    case "complaint":
      reply = genericResponses.complaint();
      break;
    case "thanks":
      reply = genericResponses.thanks();
      break;
    case "goodbye":
      reply = genericResponses.goodbye();
      break;
    default:
      reply = genericResponses.unknown(business);
  }

  return { intent, entities, reply };
}

module.exports = { processMessage };
