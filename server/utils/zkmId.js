import crypto from 'crypto';
import { User } from '../models/User.js';

/**
 * Generate a unique, memorable ZKM ID like "ZKM-8B2F9A"
 */
export async function generateUniqueZkmId() {
  let isUnique = false;
  let zkmId = '';

  while (!isUnique) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    zkmId = `ZKM-${randomHex}`;
    const existing = await User.findOne({ zkmId });
    if (!existing) {
      isUnique = true;
    }
  }

  return zkmId;
}
