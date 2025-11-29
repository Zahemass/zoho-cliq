// api/notifyCliq.js
const express = require("express");
const router = express.Router();

// In-memory notification queue
global. pendingNotifications = global.pendingNotifications || {};

router. post("/notify-cliq", (req, res) => {
  const { userId, caseName, fileName, analysis, caseId } = req.body;  // 🔥 Added caseId
  
  console. log("📬 Queuing notification for user:", userId);
  console.log("📁 Case ID:", caseId);  // 🔥 Log caseId
  
  // Store notification for this user (replace old one)
  global.pendingNotifications[userId] = {
    userId,
    caseName,
    fileName,
    analysis,
    caseId,  // 🔥 Include caseId in stored notification
    timestamp: Date.now()
  };
  
  console.log("✅ Notification queued");
  
  res.json({ success: true, message: "Notification queued" });
});

router.get("/pending-notifications/:userId", (req, res) => {
  const { userId } = req.params;
  const clearAfter = req. query.clear === "true";
  
  console.log("📥 Checking notifications for user:", userId, "Clear:", clearAfter);
  
  const notification = global.pendingNotifications[userId];
  
  if (notification) {
    console.log("📤 Returning notification");
    
    // Only clear if requested
    if (clearAfter) {
      delete global.pendingNotifications[userId];
      console.log("🗑️ Notification cleared");
    }
    
    res.json({ notification: notification });
  } else {
    console.log("📭 No notifications found");
    res.json({ notification: null });
  }
});

module.exports = router;