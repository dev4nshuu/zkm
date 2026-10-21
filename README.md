# 🛡️ ZKM — Zero-Knowledge Messenger with On-Device AI

> **A privacy-first, real-time messaging application featuring genuine client-side OpenPGP end-to-end encryption and 100% on-device AI chat summarization.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![E2EE](https://img.shields.io/badge/E2EE-OpenPGP.js%20(Ed25519)-10b981.svg)](#-cryptography--security)
[![Storage](https://img.shields.io/badge/Database-Zero%20Message%20Persistence-f59e0b.svg)](#-zero-knowledge-relay)
[![AI](https://img.shields.io/badge/Local%20AI-On--Device%20(No%20Cloud)-8b5cf6.svg)](#-local-ai-chat-summarization)

---

## ⚡ Highlights

- **🔒 Client-Side OpenPGP Cryptography**: Keys (Curve25519/Ed25519) are generated in the browser. Private keys never leave the device.
- **🛡️ Zero Message Persistence**: The backend has **no** `Message` model and stores **0 messages**. Messages are routed strictly in RAM.
- **⚡ Real-Time Socket.IO Relay**: Fast message routing with immediate offline rejection (messages are never queued or stored on the server).
- **👥 Dual-Recipient Encryption**: Messages are encrypted for both recipient and sender, allowing senders to access their own sent history locally.
- **🤖 100% On-Device AI Summarization**: Summaries are generated locally on the user's machine (via the bundled Local AI Runner or Ollama). Decrypted chat plaintext never touches the backend or any cloud AI API.

---

## 🏛️ Architecture & Security Principles

```
User A (Browser)                           Server (RAM Relay)                       User B (Browser)
   |                                              |                                       |
   |-- 1. Encrypt with OpenPGP -----------------> |                                       |
   |      (Recipient PubKey + Sender PubKey)      |                                       |
   |                                              |-- 2. Verify friendship & route ----> |
   |                                              |      (Zero DB persistence)           |
   |                                              |                                       |-- 3. Decrypt locally
   |                                              |                                       |      (Private Key in RAM)
   |                                              |                                       |
   |-- 4. Summarize Chat ----------------------------------------------------------------> Local AI Runtime
          (Direct browser fetch to local port 11435 or Ollama; completely bypasses server)
```

### 1. Cryptography & Security
- **Key Generation**: Asymmetric ECC (Ed25519) keypairs generated in-browser via OpenPGP.js.
- **Key Storage**: Private keys are stored exclusively in client `localStorage`. Only public keys are uploaded to the server.
- **Forward Secrecy Note**: ZKM uses OpenPGP public-key encryption. It does not implement the ephemeral ratchet forward-secrecy properties of protocols like Signal.

### 2. Zero-Knowledge Relay
- **RAM-Only Routing**: The Node.js server relays ciphertexts in memory and discards them immediately upon delivery.
- **No Offline Queuing**: If a recipient is offline, the message is refused with an instant delivery failure notice.
- **Metadata**: Account credentials (bcrypt-hashed), public keys, and mutual friendship records are stored in MongoDB.

### 3. On-Device AI Summarization
When clicking **"Summarize Chat"**, decrypted plaintext is sent directly from the browser to your local runtime:
- **📋 Main Discussion Points**: Synthesizes core conversation topics while filtering out casual greetings.
- **💡 Important Decisions**: Extracts confirmed choices and agreements.
- **✅ Tasks or Action Items**: Identifies tasks, assignments, and action verbs.
- **⏰ Deadlines Mentioned**: Flags time-specific boundaries (e.g. `8:00 PM`, `by tomorrow`).

---

## 📂 Project Structure

```
zkm/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── ai/                 # Local AI client service (Direct to local runtimes)
│   │   ├── components/         # ChatWindow, SummarizeModal, FriendsList, UserSearch
│   │   ├── crypto/             # OpenPGP.js key generation, encryption, decryption
│   │   ├── pages/              # AuthPage, DashboardPage
│   │   └── services/           # REST API & Socket.IO client managers
│   └── vite.config.js
├── server/                     # Node.js + Express Backend
│   ├── config/                 # MongoDB connection
│   ├── models/                 # User, FriendRequest, Friendship (NO Message model)
│   ├── routes/                 # Auth, Users, Friends
│   ├── sockets/                # Socket.IO authenticated E2EE relay
│   ├── local-ai-runner.js      # Bundled local AI inference engine (Port 11435)
│   └── server.js               # Express application entrypoint
├── scripts/
│   └── verify-zkm.js           # Automated end-to-end verification suite
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Quickstart

### Prerequisites
- **Node.js** (v18+)
- **MongoDB** (Local instance on `mongodb://127.0.0.1:27017` or free [MongoDB Atlas](https://www.mongodb.com/atlas) cloud URI)

### 1. Install Dependencies
```bash
git clone <repo-url> zkm
cd zkm
npm install
```

### 2. Configure Environment
```bash
cp .env.example server/.env
```
*(Default settings connect to local MongoDB at `mongodb://127.0.0.1:27017/zkm`).*

### 3. Start Application
Launch Backend, Frontend, and Local AI in one command:
```bash
npm run dev:all
```

Open your browser at **`http://localhost:5173`**.

---

## 🤖 Local AI Configuration

ZKM supports two local inference options out of the box:

### Option A: Bundled ZKM Local AI Engine (Default)
Runs automatically with `npm run dev:all` (or `npm run local-ai`) on `http://localhost:11435`.
- Directly queried by your browser.
- Analyzes and structures discussion points, decisions, tasks, and deadlines on-device.

### Option B: Local Ollama
If you have [Ollama](https://ollama.com/) installed:
```bash
ollama run qwen2.5:0.5b
# or: ollama run llama3.2
```
In the ZKM chat window, click **"Summarize Chat"** → **"⚙️ AI Settings"** and select **Ollama** (`http://localhost:11434`).

---

## 🧪 Testing with Two Users

1. Open **`http://localhost:5173`** and register as **Alice**. Note your ZKM ID.
2. Open an **Incognito Window** at **`http://localhost:5173`** and register as **Bob**.
3. In Bob's window, go to **"+ Add Friend"**, search Alice's ZKM ID, and send a friend request.
4. In Alice's window, go to **"Requests"** and click **"Accept"**.
5. Exchange end-to-end encrypted messages in real-time.
6. Click **"✨ Summarize Chat"** in either window to generate an instant on-device summary!

### Automated Test Suite
Run the full verification test suite anytime:
```bash
npm run test:verify
```

---

## 📄 License
MIT License. Built for zero-knowledge communications and client-side privacy.
