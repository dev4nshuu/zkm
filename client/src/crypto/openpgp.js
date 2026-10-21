import * as openpgp from 'openpgp';

const PRIVATE_KEY_PREFIX = 'zkm_privkey_';

/**
 * Generate a secure ECC (ed25519) OpenPGP key pair client-side.
 * Private key stays on the user's device and is never uploaded to the server.
 */
export async function generateUserKeyPair(name, email, passphrase = '') {
  try {
    const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
      type: 'ecc',
      curve: 'ed25519',
      userIDs: [{ name, email }],
      passphrase: passphrase || undefined,
    });

    return {
      privateKey,
      publicKey,
      revocationCertificate,
    };
  } catch (err) {
    console.error('[OpenPGP KeyGen Error]:', err);
    throw new Error(`Failed to generate OpenPGP key pair: ${err.message}`);
  }
}

/**
 * Save armored private key exclusively in local client storage.
 */
export function savePrivateKeyLocally(userId, armoredPrivateKey) {
  if (!userId || !armoredPrivateKey) return;
  localStorage.setItem(`${PRIVATE_KEY_PREFIX}${userId}`, armoredPrivateKey);
}

/**
 * Retrieve user's armored private key from local client storage.
 */
export function getPrivateKeyLocally(userId) {
  if (!userId) return null;
  return localStorage.getItem(`${PRIVATE_KEY_PREFIX}${userId}`);
}

/**
 * Remove local private key upon device wipe or account switch.
 */
export function clearPrivateKeyLocally(userId) {
  if (!userId) return;
  localStorage.removeItem(`${PRIVATE_KEY_PREFIX}${userId}`);
}

/**
 * Encrypt a plaintext message for BOTH the recipient and the sender.
 * This guarantees the recipient can decrypt upon arrival, and the sender
 * can still access and decrypt their own sent messages.
 */
export async function encryptMessage(plaintext, recipientPublicKeyArmored, senderPublicKeyArmored) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Message text is required for encryption');
  }
  if (!recipientPublicKeyArmored) {
    throw new Error('Recipient public key is missing or not registered yet');
  }

  try {
    const recipientKey = await openpgp.readKey({ armoredKey: recipientPublicKeyArmored });
    const keysToEncryptWith = [recipientKey];

    // If sender public key is available, encrypt to sender as well so sender can read sent messages
    if (senderPublicKeyArmored && senderPublicKeyArmored !== recipientPublicKeyArmored) {
      try {
        const senderKey = await openpgp.readKey({ armoredKey: senderPublicKeyArmored });
        keysToEncryptWith.push(senderKey);
      } catch (e) {
        console.warn('[OpenPGP] Could not add sender key to encryption list:', e.message);
      }
    }

    const message = await openpgp.createMessage({ text: plaintext });
    const encryptedArmored = await openpgp.encrypt({
      message,
      encryptionKeys: keysToEncryptWith,
    });

    return encryptedArmored;
  } catch (err) {
    console.error('[OpenPGP Encryption Error]:', err);
    throw new Error(`Client-side encryption failed: ${err.message}`);
  }
}

/**
 * Decrypt an armored ciphertext message using the local user's private key.
 */
export async function decryptMessage(ciphertextArmored, userPrivateKeyArmored, passphrase = '') {
  if (!ciphertextArmored || !userPrivateKeyArmored) {
    throw new Error('Ciphertext and user private key are required for decryption');
  }

  try {
    let privateKey = await openpgp.readPrivateKey({ armoredKey: userPrivateKeyArmored });

    if (passphrase && !privateKey.isDecrypted()) {
      privateKey = await openpgp.decryptKey({
        privateKey,
        passphrase,
      });
    }

    const message = await openpgp.readMessage({ armoredMessage: ciphertextArmored });
    const { data: decryptedText } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
    });

    return {
      text: decryptedText,
      success: true,
    };
  } catch (err) {
    console.error('[OpenPGP Decryption Error]:', err);
    return {
      text: '[Decryption Error: Unable to decrypt message with local key]',
      success: false,
      error: err.message,
    };
  }
}
