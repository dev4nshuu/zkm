import jwt from 'jsonwebtoken';
import { Friendship } from '../models/Friendship.js';

// Map of userId -> Set of socketId
const userSockets = new Map();
// Map of socketId -> userId
const socketUserMap = new Map();

let ioInstance = null;

export function isUserOnline(userId) {
  if (!userId) return false;
  const sockets = userSockets.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
}

export function emitToUser(userId, event, data) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId.toString()}`).emit(event, data);
}

/**
 * Setup and configure Socket.IO real-time message routing.
 * Note: ZKM is zero-knowledge with respect to message persistence.
 * Plaintext is never seen by the server; ciphertexts are never persisted to MongoDB.
 */
export function setupChatSockets(io) {
  ioInstance = io;

  // Handshake authentication middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization &&
        socket.handshake.headers.authorization.split(' ')[1]);

    if (!token) {
      return next(new Error('Authentication failed: Missing JWT token'));
    }

    const secret = process.env.JWT_SECRET || 'zkm_dev_jwt_secret_key_93489234892348923';
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        return next(new Error('Authentication failed: Invalid or expired token'));
      }
      socket.userId = decoded.userId;
      socket.zkmId = decoded.zkmId;
      next();
    });
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId.toString();
    socket.join(`user:${userId}`);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketUserMap.set(socket.id, userId);

    console.log(`[ZKM Realtime] User connected: ${socket.zkmId} (socket: ${socket.id})`);

    // Notify friends that this user is now online
    try {
      const friendships = await Friendship.find({
        $or: [{ user1: userId }, { user2: userId }],
      });
      for (const f of friendships) {
        const friendId = f.user1.toString() === userId ? f.user2.toString() : f.user1.toString();
        emitToUser(friendId, 'user-status-changed', {
          userId,
          isOnline: true,
        });
      }
    } catch (err) {
      console.error('[Socket Status Error]:', err.message);
    }

    /**
     * Handle Real-Time Encrypted Message Transmission
     * Expected data: { recipientId, ciphertext, tempId }
     */
    socket.on('send-message', async (data, callback) => {
      try {
        const { recipientId, ciphertext, tempId } = data || {};

        if (!recipientId || !ciphertext) {
          const errMsg = 'Invalid payload: recipientId and ciphertext are required';
          if (callback) callback({ error: errMsg });
          socket.emit('message-delivery-error', { tempId, error: errMsg });
          return;
        }

        // 1. Backend Authorization Check: Ensure mutual friendship exists
        const areFriends = await Friendship.areFriends(userId, recipientId);
        if (!areFriends) {
          const errMsg = 'Permission denied: You can only exchange messages with confirmed friends';
          if (callback) callback({ error: errMsg });
          socket.emit('message-delivery-error', { tempId, recipientId, error: errMsg });
          return;
        }

        // 2. Check if recipient is currently online
        const recipientOnline = isUserOnline(recipientId);
        if (!recipientOnline) {
          // Zero-knowledge policy: Do NOT store messages on the server for later delivery
          const statusPayload = {
            tempId,
            recipientId,
            delivered: false,
            reason:
              'Recipient is offline. ZKM zero-knowledge architecture does not store messages on the server.',
          };
          if (callback) callback(statusPayload);
          socket.emit('message-delivery-status', statusPayload);
          return;
        }

        // 3. Forward ciphertext to recipient in real time without storing or logging content
        const timestamp = Date.now();
        io.to(`user:${recipientId}`).emit('receive-message', {
          senderId: userId,
          ciphertext,
          timestamp,
        });

        // 4. Acknowledge successful delivery to sender
        const deliveryAck = {
          tempId,
          recipientId,
          delivered: true,
          timestamp,
        };

        if (callback) callback(deliveryAck);
        socket.emit('message-delivery-status', deliveryAck);

        // Security note: We log ONLY routing metadata, never message content or ciphertext
        console.log(`[ZKM Router] Forwarded E2EE packet: ${userId} -> ${recipientId}`);
      } catch (err) {
        console.error('[ZKM Router Error]:', err.message);
        const errMsg = 'Internal error during message routing';
        if (callback) callback({ error: errMsg });
        socket.emit('message-delivery-error', { tempId: data?.tempId, error: errMsg });
      }
    });

    /**
     * Handle Disconnect
     */
    socket.on('disconnect', async () => {
      const uId = socketUserMap.get(socket.id);
      socketUserMap.delete(socket.id);

      if (uId && userSockets.has(uId)) {
        const set = userSockets.get(uId);
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(uId);
          console.log(`[ZKM Realtime] User went offline: ${uId}`);

          // Broadcast offline status to friends
          try {
            const friendships = await Friendship.find({
              $or: [{ user1: uId }, { user2: uId }],
            });
            for (const f of friendships) {
              const friendId = f.user1.toString() === uId ? f.user2.toString() : f.user1.toString();
              emitToUser(friendId, 'user-status-changed', {
                userId: uId,
                isOnline: false,
              });
            }
          } catch (err) {
            console.error('[Socket Offline Broadcast Error]:', err.message);
          }
        }
      }
    });
  });
}
