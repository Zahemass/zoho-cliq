// api/uploadLink.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const tokens = {};

router.post("/upload-link", (req, res) => {
  let { case_id, user_id, case_name } = req.body;

  // Case ID fix
  if (typeof case_id === "object" && case_id.value) {
    case_id = case_id.value;
  }

  if (!case_id) {
    return res.status(400).json({ error: "Invalid case_id" });
  }

  const token = crypto. randomBytes(16).toString("hex");
  const expires = Date. now() + 10 * 60 * 1000;

  tokens[token] = { 
    case_id, 
    user_id: user_id || "unknown",
    case_name: case_name || "Unknown Case",
    expires 
  };

  const uploadUrl = `${process.env.PUBLIC_URL}/upload-file?token=${token}`;

  res. json({ upload_url: uploadUrl });
});

module.exports = router;
module.exports.tokens = tokens;
