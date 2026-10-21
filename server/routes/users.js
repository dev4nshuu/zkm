import express from 'express';
import { User } from '../models/User.js';
import { Friendship } from '../models/Friendship.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users/lookup/:zkmId
 * Search for another user using their unique ZKM ID.
 */
router.get('/lookup/:zkmId', authenticateToken, async (req, res) => {
  try {
    const queryId = req.params.zkmId.trim().toUpperCase();

    const user = await User.findOne({ zkmId: queryId }).select('name zkmId publicKey');
    if (!user) {
      return res.status(404).json({ error: `User with ZKM ID "${queryId}" not found` });
    }

    const isSelf = user._id.toString() === req.user._id.toString();
    let relationship = 'none';

    if (isSelf) {
      relationship = 'self';
    } else {
      const areFriends = await Friendship.areFriends(req.user._id, user._id);
      if (areFriends) {
        relationship = 'friends';
      } else {
        const pendingOut = await FriendRequest.findOne({
          sender: req.user._id,
          receiver: user._id,
          status: 'pending',
        });
        if (pendingOut) {
          relationship = 'request_sent';
        } else {
          const pendingIn = await FriendRequest.findOne({
            sender: user._id,
            receiver: req.user._id,
            status: 'pending',
          });
          if (pendingIn) {
            relationship = 'request_received';
          }
        }
      }
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        zkmId: user.zkmId,
        publicKey: user.publicKey,
      },
      relationship,
    });
  } catch (err) {
    console.error('[User Lookup Error]:', err);
    return res.status(500).json({ error: 'Failed to lookup user' });
  }
});

export default router;
