import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { generateUniqueZkmId } from '../utils/zkmId.js';

const router = express.Router();

function createToken(userId, email, zkmId) {
  const secret = process.env.JWT_SECRET || 'zkm_dev_jwt_secret_key_93489234892348923';
  return jwt.sign({ userId, email, zkmId }, secret, { expiresIn: '7d' });
}

/**
 * POST /api/auth/register
 * Register a new user with name, email, password, and optional initial publicKey.
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, publicKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const zkmId = await generateUniqueZkmId();

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      zkmId,
      publicKey: publicKey || null,
    });

    await user.save();

    const token = createToken(user._id, user.email, user.zkmId);

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        zkmId: user.zkmId,
        publicKey: user.publicKey,
      },
    });
  } catch (err) {
    console.error('[Auth Error - Register]:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

/**
 * POST /api/auth/login
 * Log in using email and password.
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createToken(user._id, user.email, user.zkmId);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        zkmId: user.zkmId,
        publicKey: user.publicKey,
      },
    });
  } catch (err) {
    console.error('[Auth Error - Login]:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * GET /api/auth/me
 * Retrieve the current authenticated user's profile.
 */
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      zkmId: req.user.zkmId,
      publicKey: req.user.publicKey,
      createdAt: req.user.createdAt,
    },
  });
});

/**
 * PUT /api/auth/public-key
 * Upload or update the user's OpenPGP public key.
 */
router.put('/public-key', authenticateToken, async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'A valid OpenPGP public key string is required' });
    }

    if (!publicKey.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
      return res.status(400).json({ error: 'Invalid OpenPGP public key format' });
    }

    req.user.publicKey = publicKey;
    await req.user.save();

    return res.json({
      message: 'Public key updated successfully',
      publicKey: req.user.publicKey,
    });
  } catch (err) {
    console.error('[Auth Error - Public Key]:', err);
    return res.status(500).json({ error: 'Failed to update public key' });
  }
});

export default router;
