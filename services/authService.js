// services/authService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('./supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

class AuthService {
  
  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        cliqUserId: user.cliq_user_id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // 🔥 REGISTER NEW USER (with password)
  async registerUser(userData) {
    try {
      const { cliq_user_id, email, name, password, avatar_url } = userData;

      console.log('📝 Registering new user:', cliq_user_id);

      // Check if user already exists
      const { data: existingUser } = await supabase
        . from('users')
        .select('*')
        .eq('cliq_user_id', cliq_user_id)
        .single();

      if (existingUser) {
        throw new Error('User already exists.  Please login instead.');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          cliq_user_id,
          email,
          name,
          password: hashedPassword,
          avatar_url,
          role: 'user'
        })
        .select()
        .single();

      if (error) throw error;

      console. log('✅ User registered:', newUser. id);
      return newUser;

    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  }

  // 🔥 LOGIN USER (with password)
  async loginUser(cliqUserId, password) {
    try {
      console.log('🔐 Login attempt for:', cliqUserId);

      // Get user from database
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('cliq_user_id', cliqUserId)
        .single();

      if (error || !user) {
        throw new Error('User not found.  Please signup first.');
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date(). toISOString() })
        .eq('id', user.id);

      console.log('✅ Login successful:', user.  id);
      return user;

    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  // Find or create user from Cliq (for auto-login)
  async findOrCreateUser(cliqUserData) {
    try {
      const { cliq_user_id, email, name, avatar_url } = cliqUserData;

      console.log('🔍 Finding/creating user:', cliq_user_id);

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        . eq('cliq_user_id', cliq_user_id)
        .single();

      if (existingUser) {
        console.log('✅ User found:', existingUser. id);
        
        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', existingUser.id);

        return existingUser;
      }

      // Create new user WITHOUT password (Cliq-only users)
      console.log('➕ Creating new Cliq user...');
      
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          cliq_user_id,
          email,
          name,
          avatar_url,
          role: 'user',
          password: null  // No password for Cliq-only users
        })
        . select()
        .single();

      if (error) throw error;

      console.log('✅ New user created:', newUser.  id);
      return newUser;

    } catch (error) {
      console.error('❌ Auth error:', error);
      throw error;
    }
  }

  // Create session
  async createSession(userId, token) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          token,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Session creation error:', error);
      throw error;
    }
  }

  // Validate session
  async validateSession(token) {
    try {
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*, users(*)')
        .eq('token', token)
        .single();

      if (error || !session) return null;

      if (new Date(session.expires_at) < new Date()) {
        await this.deleteSession(token);
        return null;
      }

      return session. users;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return null;
    }
  }

  // Delete session
  async deleteSession(token) {
    try {
      await supabase
        .from('user_sessions')
        .delete()
        . eq('token', token);
    } catch (error) {
      console.error('❌ Session deletion error:', error);
    }
  }

  // Get user by Cliq ID
  async getUserByCliqId(cliqUserId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        . eq('cliq_user_id', cliqUserId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Get user by Cliq ID error:', error);
      return null;
    }
  }
}

module.exports = new AuthService();