// api/sessions.js
const express = require("express");
const router = express. Router();  // 🔥 THIS WAS MISSING!
const supabase = require("../services/supabaseClient");

// POST /api/sessions/upsert - Create or update session
router.post("/upsert", async (req, res) => {
  try {
    const { case_id, user_id } = req.body;

    console. log("\n🔄 Session upsert:");
    console.log("- user_id:", user_id);
    console.log("- case_id:", case_id);

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Check if session exists
    const { data: existing, error: fetchError } = await supabase
      .from("sessions")
      .select("*")
      . eq("user_id", user_id)
      .maybeSingle();

    if (existing) {
      // Update existing session
      const { data, error } = await supabase
        .from("sessions")
        .update({
          case_id: case_id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user_id)
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Session updated");
      return res.json({ success: true, session: data });
    } else {
      // Create new session
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id,
          case_id,
        })
        .select()
        .single();

      if (error) throw error;

      console. log("✅ Session created");
      return res.json({ success: true, session: data });
    }
  } catch (error) {
    console.error("❌ Session upsert error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sessions/get - Get user's current session
router.get("/get", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) throw error;

    res.json(session || {});
  } catch (error) {
    console.error("❌ Session get error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔥 DELETE /api/sessions/delete - Clear user session
router.delete('/delete', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    console.log('🗑️ Deleting sessions for user:', user_id);

    // Get user's UUID from cliq_user_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('cliq_user_id', user_id)
      .single();

    if (userError || !user) {
      console. log('⚠️ User not found, clearing regular session');
      
      // Also clear from sessions table
      await supabase
        .from('sessions')
        .delete()
        .eq('user_id', user_id);

      return res.json({ 
        success: true, 
        message: 'Session cleared' 
      });
    }

    // Delete from user_sessions (auth sessions)
    const { error: deleteAuthError } = await supabase
      .from('user_sessions')
      .delete()
      . eq('user_id', user. id);

    if (deleteAuthError) {
      console.error('⚠️ Auth session delete error:', deleteAuthError);
    }

    // Delete from sessions (case sessions)
    const { error: deleteSessionError } = await supabase
      .from('sessions')
      .delete()
      . eq('user_id', user_id);

    if (deleteSessionError) {
      console.error('⚠️ Case session delete error:', deleteSessionError);
    }

    console.log('✅ Sessions deleted');

    res.json({ 
      success: true, 
      message: 'All sessions cleared' 
    });

  } catch (error) {
    console.error('❌ Session delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;  // 🔥 EXPORT IT!