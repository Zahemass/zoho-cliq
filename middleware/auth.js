// middleware/auth.js
const authService = require('../services/authService');

// Protect routes - requires valid JWT
async function requireAuth(req, res, next) {
  try {
    // Get token from header or cookie
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?. auth_token;

    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No token provided' 
      });
    }

    // Verify JWT
    const decoded = authService. verifyToken(token);
    
    if (!decoded) {
      return res.status(401). json({ 
        error: 'Unauthorized', 
        message: 'Invalid or expired token' 
      });
    }

    // Validate session in database
    const user = await authService.validateSession(token);

    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Session expired' 
      });
    }

    // Attach user to request
    req. user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication failed' 
    });
  }
}

// Optional auth - doesn't block if no token
async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?. replace('Bearer ', '') || 
                  req.cookies?.auth_token;

    if (token) {
      const decoded = authService.verifyToken(token);
      
      if (decoded) {
        const user = await authService.validateSession(token);
        if (user) {
          req. user = user;
          req.token = token;
        }
      }
    }

    next();
  } catch (error) {
    console.error('⚠️ Optional auth error:', error);
    next();
  }
}

// Check if user has specific role
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401). json({ error: 'Unauthorized' });
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res. status(403).json({ 
        error: 'Forbidden', 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole
};