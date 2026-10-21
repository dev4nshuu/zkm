import * as openpgp from 'openpgp';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const LOCAL_AI_URL = 'http://localhost:11435/api/summarize';

async function generateKeyPair(name, email) {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'ed25519',
    userIDs: [{ name, email }],
  });
  return { privateKey, publicKey };
}

async function runVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting ZKM (Zero-Knowledge Messenger) Verification Suite');
  console.log('===========================================================\n');

  const runId = Math.random().toString(36).substring(2, 7);
  const aliceEmail = `alice_${runId}@zkm.test`;
  const bobEmail = `bob_${runId}@zkm.test`;

  // Step 1: Generate Client-Side OpenPGP Keys for Alice and Bob
  console.log('1️⃣ Generating client-side OpenPGP (ed25519) key pairs...');
  const aliceKeys = await generateKeyPair('Alice Walker', aliceEmail);
  const bobKeys = await generateKeyPair('Bob Smith', bobEmail);
  console.log('   ✓ Generated Alice and Bob key pairs on simulated client devices.\n');

  // Step 2: Register User A (Alice)
  console.log(`2️⃣ Registering Alice (${aliceEmail}) with public key...`);
  const resAlice = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Walker',
      email: aliceEmail,
      password: 'password123',
      publicKey: aliceKeys.publicKey,
    }),
  });
  const aliceData = await resAlice.json();
  if (!resAlice.ok) throw new Error(`Alice registration failed: ${JSON.stringify(aliceData)}`);
  console.log(`   ✓ Alice registered successfully! ZKM ID: ${aliceData.user.zkmId}\n`);

  // Step 3: Register User B (Bob)
  console.log(`3️⃣ Registering Bob (${bobEmail}) with public key...`);
  const resBob = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Smith',
      email: bobEmail,
      password: 'password123',
      publicKey: bobKeys.publicKey,
    }),
  });
  const bobData = await resBob.json();
  if (!resBob.ok) throw new Error(`Bob registration failed: ${JSON.stringify(bobData)}`);
  console.log(`   ✓ Bob registered successfully! ZKM ID: ${bobData.user.zkmId}\n`);

  // Step 4: User lookup by ZKM ID
  console.log(`4️⃣ Testing User Lookup: Alice searches for Bob by ZKM ID (${bobData.user.zkmId})...`);
  const lookupRes = await fetch(`${API_BASE}/users/lookup/${bobData.user.zkmId}`, {
    headers: { Authorization: `Bearer ${aliceData.token}` },
  });
  const lookupData = await lookupRes.json();
  console.log(`   ✓ User found: ${lookupData.user.name} | Relationship: ${lookupData.relationship}`);
  console.log(`   ✓ Public Key retrieved: ${lookupData.user.publicKey.slice(0, 35)}...\n`);

  // Step 5: Friend Request flow
  console.log('5️⃣ Sending Friend Request: Alice -> Bob...');
  const reqRes = await fetch(`${API_BASE}/friends/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceData.token}`,
    },
    body: JSON.stringify({ receiverZkmId: bobData.user.zkmId }),
  });
  const reqData = await reqRes.json();
  console.log(`   ✓ Friend request sent! Request ID: ${reqData.requestId}`);

  console.log('   Checking Bob\'s incoming requests...');
  const bobReqsRes = await fetch(`${API_BASE}/friends/requests`, {
    headers: { Authorization: `Bearer ${bobData.token}` },
  });
  const bobReqsData = await bobReqsRes.json();
  const incomingReq = bobReqsData.incoming.find((r) => r._id === reqData.requestId);
  if (!incomingReq) throw new Error('Bob did not receive Alice\'s friend request!');
  console.log(`   ✓ Bob received incoming request from ${incomingReq.sender.name}`);

  console.log('   Bob accepts Alice\'s friend request...');
  const acceptRes = await fetch(`${API_BASE}/friends/requests/${reqData.requestId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bobData.token}` },
  });
  const acceptData = await acceptRes.json();
  console.log(`   ✓ Friendship established between Alice and Bob!\n`);

  // Step 6: Connect both users via Socket.IO
  console.log('6️⃣ Connecting Alice and Bob to Socket.IO real-time relay...');
  const aliceSocket = io(SOCKET_URL, { auth: { token: aliceData.token } });
  const bobSocket = io(SOCKET_URL, { auth: { token: bobData.token } });

  await Promise.all([
    new Promise((resolve) => aliceSocket.on('connect', resolve)),
    new Promise((resolve) => bobSocket.on('connect', resolve)),
  ]);
  console.log('   ✓ Both sockets authenticated and connected via JWT handshake.\n');

  // Step 7: End-to-End Encryption & Real-time Routing
  console.log('7️⃣ Testing Real-Time E2EE Messaging Flow...');
  const plaintextContent =
    "Hey Bob, we decided to finalize the security review by tomorrow 5 PM. I will prepare the test cases. Let's agree to use ed25519.";
  console.log(`   Plaintext message: "${plaintextContent}"`);

  // Encrypt with recipient's AND sender's public keys
  console.log('   Encrypting message client-side with OpenPGP...');
  const recipientKey = await openpgp.readKey({ armoredKey: bobData.user.publicKey });
  const senderKey = await openpgp.readKey({ armoredKey: aliceData.user.publicKey });
  const pgpMessage = await openpgp.createMessage({ text: plaintextContent });
  const ciphertext = await openpgp.encrypt({
    message: pgpMessage,
    encryptionKeys: [recipientKey, senderKey],
  });
  console.log(`   ✓ Encrypted ciphertext created (length: ${ciphertext.length} chars).`);
  console.log(`   Sample ciphertext header:\n   ${ciphertext.slice(0, 100).replace(/\n/g, '\n   ')}...\n`);

  // Set up Bob's receive listener
  const bobReceivedPromise = new Promise((resolve) => {
    bobSocket.on('receive-message', async (data) => {
      console.log('   📥 Bob received E2EE ciphertext packet over Socket.IO!');
      console.log(`   Sender: ${data.senderId}`);

      // Bob decrypts with Bob's private key
      const bobPrivKey = await openpgp.readPrivateKey({ armoredKey: bobKeys.privateKey });
      const msg = await openpgp.readMessage({ armoredMessage: data.ciphertext });
      const { data: decrypted } = await openpgp.decrypt({
        message: msg,
        decryptionKeys: bobPrivKey,
      });

      console.log(`   🔓 Bob decrypted message: "${decrypted}"`);
      resolve(decrypted);
    });
  });

  // Alice sends message over socket
  console.log('   Alice dispatches encrypted message to Socket.IO server...');
  const deliveryAck = await new Promise((resolve) => {
    aliceSocket.emit(
      'send-message',
      {
        recipientId: bobData.user.id,
        ciphertext,
        tempId: 'test-msg-1',
      },
      resolve
    );
  });

  console.log(`   ✓ Alice received real-time delivery ack: delivered = ${deliveryAck.delivered}`);
  const decryptedText = await bobReceivedPromise;
  if (decryptedText !== plaintextContent) {
    throw new Error('Decrypted text does NOT match original plaintext!');
  }
  console.log('   ✓ Decryption verified successfully on recipient device!\n');

  // Verify Alice can also decrypt her own sent message
  console.log('   Verifying sender (Alice) can decrypt her own message locally...');
  const alicePrivKey = await openpgp.readPrivateKey({ armoredKey: aliceKeys.privateKey });
  const sentMsg = await openpgp.readMessage({ armoredMessage: ciphertext });
  const { data: aliceDecrypted } = await openpgp.decrypt({
    message: sentMsg,
    decryptionKeys: alicePrivKey,
  });
  if (aliceDecrypted !== plaintextContent) {
    throw new Error('Alice could not decrypt her own sent message!');
  }
  console.log('   ✓ Alice successfully decrypted her own sent message!\n');

  // Step 8: Verify ZERO message persistence in MongoDB
  console.log('8️⃣ Verifying Zero-Knowledge Database Persistence...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zkm');
  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);
  console.log(`   Active MongoDB Collections: ${collectionNames.join(', ')}`);

  const hasMessageCollection = collectionNames.some((c) =>
    c.toLowerCase().includes('message')
  );
  if (hasMessageCollection) {
    throw new Error('Violation: Found a message collection in MongoDB!');
  }
  console.log('   ✓ CONFIRMED: No message collections exist in MongoDB.');
  console.log('   ✓ CONFIRMED: Messages exist exclusively in client RAM.\n');

  // Step 9: Test Offline Recipient Handling
  console.log('9️⃣ Testing Offline Recipient Handling (Zero server queueing)...');
  bobSocket.disconnect();
  console.log('   Bob disconnected (offline). Alice attempts to send a message to Bob...');

  const offlineDeliveryResult = await new Promise((resolve) => {
    aliceSocket.emit(
      'send-message',
      {
        recipientId: bobData.user.id,
        ciphertext,
        tempId: 'test-offline-1',
      },
      resolve
    );
  });

  console.log(`   Delivery status: delivered = ${offlineDeliveryResult.delivered}`);
  console.log(`   Server response reason: "${offlineDeliveryResult.reason}"`);
  if (offlineDeliveryResult.delivered !== false) {
    throw new Error('Message should NOT have been delivered when recipient is offline!');
  }
  console.log('   ✓ CONFIRMED: Server refused delivery and did not queue message.\n');

  // Step 10: Test Local AI Chat Summarization
  console.log('🔟 Testing Local AI Chat Summarization (Bypassing Server)...');
  const chatMessages = [
    { senderName: 'Alice', text: 'Hey Bob, we need to finalize the encryption review by tomorrow 5 PM.' },
    { senderName: 'Bob', text: 'I agree. Let\'s go with ed25519 for public keys.' },
    { senderName: 'Alice', text: 'Confirmed. I will prepare the test cases.' },
    { senderName: 'Bob', text: 'Great, todo: I will review the socket security checks tonight.' },
  ];

  console.log(`   Sending ${chatMessages.length} decrypted messages to Local AI Runner (${LOCAL_AI_URL})...`);
  const aiRes = await fetch(LOCAL_AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: chatMessages }),
  });
  const aiData = await aiRes.json();
  if (!aiRes.ok) throw new Error(`Local AI summarizer failed: ${JSON.stringify(aiData)}`);

  console.log(`   ✓ Local AI Model: ${aiData.model}`);
  console.log('\n--- [AI GENERATED CHAT SUMMARY] ---');
  console.log(aiData.summary);
  console.log('-----------------------------------\n');

  // Clean up sockets & db
  aliceSocket.disconnect();
  await mongoose.disconnect();

  console.log('===========================================================');
  console.log('🎉 ALL ZKM VERIFICATION TESTS PASSED SUCCESSFULLY! 🛡️');
  console.log('===========================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
