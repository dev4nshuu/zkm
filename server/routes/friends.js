import express from 'express';
import { User } from '../models/User.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { Friendship } from '../models/Friendship.js';
import { authenticateToken } from '../middleware/auth.js';
import { isUserOnline, emitToUser } from '../sockets/chatSocket.js';

const router = express.Router();

/**
 * POST /api/friends/request
 * Send a friend request to a user by their ZKM ID or User ID.
 */
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { receiverZkmId, receiverId } = req.body;

    let targetUser = null;
    if (receiverZkmId) {
      targetUser = await User.findOne({ zkmId: receiverZkmId.trim().toUpperCase() });
    } else if (receiverId) {
      targetUser = await User.findById(receiverId);
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    // Check if already friends
    const alreadyFriends = await Friendship.areFriends(req.user._id, targetUser._id);
    if (alreadyFriends) {
      return res.status(400).json({ error: 'You are already friends with this user' });
    }

    // Check if an existing pending request exists from current user to target
    const existingOutgoing = await FriendRequest.findOne({
      sender: req.user._id,
      receiver: targetUser._id,
      status: 'pending',
    });
    if (existingOutgoing) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Check if target already sent a request to current user
    const existingIncoming = await FriendRequest.findOne({
      sender: targetUser._id,
      receiver: req.user._id,
      status: 'pending',
    });
    if (existingIncoming) {
      return res.status(400).json({
        error: 'This user already sent you a friend request. Please check your incoming requests to accept it.',
      });
    }

    const friendRequest = new FriendRequest({
      sender: req.user._id,
      receiver: targetUser._id,
      status: 'pending',
    });
    await friendRequest.save();

    // Real-time socket notification to recipient
    emitToUser(targetUser._id.toString(), 'friend-request-received', {
      requestId: friendRequest._id,
      sender: {
        id: req.user._id,
        name: req.user.name,
        zkmId: req.user.zkmId,
        publicKey: req.user.publicKey,
      },
      createdAt: friendRequest.createdAt,
    });

    return res.status(201).json({
      message: 'Friend request sent successfully',
      requestId: friendRequest._id,
    });
  } catch (err) {
    console.error('[Friend Request Error]:', err);
    return res.status(500).json({ error: 'Failed to send friend request' });
  }
});

/**
 * GET /api/friends/requests
 * View all incoming and outgoing friend requests.
 */
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const incoming = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending',
    })
      .populate('sender', 'name zkmId publicKey')
      .sort({ createdAt: -1 });

    const outgoing = await FriendRequest.find({
      sender: req.user._id,
      status: 'pending',
    })
      .populate('receiver', 'name zkmId publicKey')
      .sort({ createdAt: -1 });

    return res.json({ incoming, outgoing });
  } catch (err) {
    console.error('[Fetch Requests Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

/**
 * POST /api/friends/requests/:requestId/accept
 * Accept an incoming friend request.
 */
router.post('/requests/:requestId/accept', authenticateToken, async (req, res) => {
  try {
    const request = await FriendRequest.findOne({
      _id: req.params.requestId,
      receiver: req.user._id,
      status: 'pending',
    }).populate('sender', 'name zkmId publicKey');

    if (!request) {
      return res.status(404).json({ error: 'Pending friend request not found' });
    }

    request.status = 'accepted';
    await request.save();

    // Create mutual friendship
    const friendship = new Friendship({
      user1: request.sender._id,
      user2: req.user._id,
    });
    await friendship.save();

    // Real-time notification to the sender that their request was accepted
    emitToUser(request.sender._id.toString(), 'friend-request-accepted', {
      friend: {
        id: req.user._id,
        name: req.user.name,
        zkmId: req.user.zkmId,
        publicKey: req.user.publicKey,
      },
    });

    return res.json({
      message: 'Friend request accepted',
      friend: {
        id: request.sender._id,
        name: request.sender.name,
        zkmId: request.sender.zkmId,
        publicKey: request.sender.publicKey,
      },
    });
  } catch (err) {
    console.error('[Accept Request Error]:', err);
    return res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

/**
 * POST /api/friends/requests/:requestId/reject
 * Reject an incoming friend request.
 */
router.post('/requests/:requestId/reject', authenticateToken, async (req, res) => {
  try {
    const request = await FriendRequest.findOne({
      _id: req.params.requestId,
      receiver: req.user._id,
      status: 'pending',
    });

    if (!request) {
      return res.status(404).json({ error: 'Pending friend request not found' });
    }

    request.status = 'rejected';
    await request.save();

    return res.json({ message: 'Friend request rejected' });
  } catch (err) {
    console.error('[Reject Request Error]:', err);
    return res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

/**
 * GET /api/friends/list
 * Retrieve the current user's friends list with online statuses and public keys.
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ user1: req.user._id }, { user2: req.user._id }],
    });

    const friendIds = friendships.map((f) =>
      f.user1.toString() === req.user._id.toString() ? f.user2 : f.user1
    );

    const friends = await User.find({ _id: { $in: friendIds } }).select('name zkmId publicKey');

    const friendsWithStatus = friends.map((friend) => ({
      id: friend._id,
      name: friend.name,
      zkmId: friend.zkmId,
      publicKey: friend.publicKey,
      isOnline: isUserOnline(friend._id.toString()),
    }));

    return res.json({ friends: friendsWithStatus });
  } catch (err) {
    console.error('[Friends List Error]:', err);
    return res.status(500).json({ error: 'Failed to load friends list' });
  }
});

/**
 * DELETE /api/friends/:friendId
 * Remove a friend from user's friends list.
 */
router.delete('/:friendId', authenticateToken, async (req, res) => {
  try {
    const friendId = req.params.friendId;

    const deleted = await Friendship.findOneAndDelete({
      $or: [
        { user1: req.user._id, user2: friendId },
        { user1: friendId, user2: req.user._id },
      ],
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    // Clean up any historical requests
    await FriendRequest.deleteMany({
      $or: [
        { sender: req.user._id, receiver: friendId },
        { sender: friendId, receiver: req.user._id },
      ],
    });

    emitToUser(friendId, 'friend-removed', { friendId: req.user._id.toString() });

    return res.json({ message: 'Friend removed successfully' });
  } catch (err) {
    console.error('[Remove Friend Error]:', err);
    return res.status(500).json({ error: 'Failed to remove friend' });
  }
});

export default router;
