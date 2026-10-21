import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Authentication token required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'zkm_dev_jwt_secret_key_93489234892348923';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed: User no longer exists' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired: Please log in again' });
    }
    return res.status(403).json({ error: 'Invalid or forged token' });
  }
}
