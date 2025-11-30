// services/openaiClient.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔥 Export the instance directly (not as object)
module.exports = openai;

// 🔥 Also export as named export for flexibility
module.exports.openai = openai;
module.exports.client = openai;
