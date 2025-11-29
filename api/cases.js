// api/cases.js
const express = require("express");
const router = express.Router();
const supabase = require("../services/supabaseClient");

// CREATE CASE
router.post("/create", async (req, res) => {
  try {
    console.log("===== REQUEST BODY =====");
    console.log(req.body);

    const { name, case_type } = req.body;

    const { data, error } = await supabase
      .from("cases")
      .insert([{ name, case_type }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, case: data });
  } catch (err) {
    console.log("===== SERVER ERROR =====");
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

// LIST CASES
router.get("/list", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cases")
      .select("id, name");

    if (error) throw error;

    res.json({ cases: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
