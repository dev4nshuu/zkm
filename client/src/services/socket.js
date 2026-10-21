import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export function connectSocket(token) {
  if (socket) {
    if (socket.connected) return socket;
    socket.disconnect();
  }

  socket = io(SOCKET_SERVER_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[ZKM Socket] Connected to real-time relay, socket ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[ZKM Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[ZKM Socket] Disconnected:', reason);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Send encrypted message via Socket.IO real-time relay.
 * Resolves with delivery confirmation or delivery failure.
 */
export function sendEncryptedMessage({ recipientId, ciphertext, tempId }) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error('Real-time connection is offline. Cannot deliver message.'));
    }

    socket.emit('send-message', { recipientId, ciphertext, tempId }, (response) => {
      if (response && response.error) {
        return reject(new Error(response.error));
      }
      resolve(response);
    });
  });
}
