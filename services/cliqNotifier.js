// services/cliqNotifier.js
const axios = require("axios");

async function sendAnalysisToCliq(userId, caseName, fileName, analysis, caseId) {  // 🔥 Added caseId parameter
  const backendUrl = process.env.PUBLIC_URL || "http://localhost:3000";
  
  try {
    console.log("📬 Queuing analysis for user:", userId);
    console.log("📁 Case ID:", caseId);  // 🔥 Log caseId
    
    await axios.post(`${backendUrl}/api/notify-cliq`, {
      userId,
      caseName,
      fileName,
      analysis,
      caseId  // 🔥 Include caseId
    });
    
    console. log("✅ Analysis queued successfully!");
    
  } catch (error) {
    console. error("❌ Failed to queue:", error.message);
  }
}

module.exports = { sendAnalysisToCliq };