// api/auth. js
const express = require('express');
const router = express. Router();
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

// 🔥 POST /api/auth/signup - Register new user
router.post('/signup', async (req, res) => {
  try {
    const { cliq_user_id, email, name, password, avatar_url } = req.body;

    console.log('\n📝 Signup request:', { cliq_user_id, email, name });

    // Validation
    if (!cliq_user_id) {
      return res.status(400).json({ error: 'cliq_user_id is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Register user
    const user = await authService.registerUser({
      cliq_user_id,
      email,
      name,
      password,
      avatar_url
    });

    // Generate JWT
    const token = authService.generateToken(user);

    // Create session
    await authService.createSession(user. id, token);

    console.log('✅ Signup successful:', user.id);

    res.json({
      success: true,
      message: 'Account created successfully!  ',
      user: {
        id: user.id,
        cliq_user_id: user.cliq_user_id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ 
      error: error.message || 'Signup failed'
    });
  }
});

// 🔥 POST /api/auth/login - Login with password
router.post('/login', async (req, res) => {
  try {
    const { cliq_user_id, password, email, name, avatar_url } = req.body;

    console.log('\n🔐 Login request:', { cliq_user_id });

    if (!cliq_user_id) {
      return res.status(400).json({ error: 'cliq_user_id is required' });
    }

    let user;

    // If password provided, use password auth
    if (password) {
      user = await authService. loginUser(cliq_user_id, password);
    } 
    // Otherwise, use Cliq auto-login (find or create)
    else {
      user = await authService.findOrCreateUser({
        cliq_user_id,
        email,
        name,
        avatar_url
      });
    }

    // Generate JWT
    const token = authService.generateToken(user);

    // Create session
    await authService.createSession(user.  id, token);

    console. log('✅ Login successful:', user. id);

    res. json({
      success: true,
      user: {
        id: user. id,
        cliq_user_id: user.  cliq_user_id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: error.message || 'Login failed'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await authService.deleteSession(req. token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        cliq_user_id: req.user.cliq_user_id,
        email: req.user.email,
        name: req.user.name,
        avatar_url: req. user.avatar_url,
        role: req.user.role,
        created_at: req.  user.created_at,
        last_login: req.user.last_login
      }
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// GET /api/auth/user
router.get('/user', async (req, res) => {
  try {
    const { cliq_user_id } = req.query;

    if (!cliq_user_id) {
      return res. status(400).json({ error: 'cliq_user_id is required' });
    }

    const user = await authService. getUserByCliqId(cliq_user_id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        cliq_user_id: user.cliq_user_id,
        email: user. email,
        name: user. name,
        avatar_url: user.avatar_url,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user' 
    });
  }
});

module.exports = router;