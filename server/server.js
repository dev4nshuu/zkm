import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import friendRoutes from './routes/friends.js';
import { setupChatSockets } from './sockets/chatSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '500kb' }));

// Health and information route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'ZKM — Zero-Knowledge Messenger',
    e2ee: 'OpenPGP.js Client-Side Encryption',
    persistence: 'Zero message persistence (RAM relay only)',
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);

// Safe centralized error handler (ensures no sensitive stack traces in production)
app.use((err, req, res, next) => {
  console.error('[ZKM Server Error]:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupChatSockets(io);

// Initialize DB and start listening
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  ZKM — Zero-Knowledge Messenger Server Active      `);
    console.log(`  Listening on: http://localhost:${PORT}            `);
    console.log(`  Client Origin: ${CLIENT_URL}                      `);
    console.log(`  E2EE: OpenPGP Client-Side (No Message Storage)    `);
    console.log(`====================================================`);
  });
});

export { app, server, io };
