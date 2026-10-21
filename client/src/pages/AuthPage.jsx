import React, { useState } from 'react';
import { api } from '../services/api';
import {
  generateUserKeyPair,
  savePrivateKeyLocally,
  getPrivateKeyLocally,
} from '../crypto/openpgp';

export function AuthPage({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cryptoProgress, setCryptoProgress] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        setCryptoProgress('Generating client-side OpenPGP key pair...');
        // 1. Generate genuine OpenPGP key pair client-side
        const { privateKey, publicKey } = await generateUserKeyPair(name, email);

        setCryptoProgress('Registering account with server (uploading public key only)...');
        // 2. Upload account details and ONLY public key to backend
        const res = await api.auth.register({
          name,
          email,
          password,
          publicKey,
        });

        // 3. Keep private key strictly on the client device
        savePrivateKeyLocally(res.user.id, privateKey);
        localStorage.setItem('zkm_token', res.token);

        onAuthSuccess(res.user, res.token);
      } else {
        // Log in
        setCryptoProgress('Authenticating credentials...');
        const res = await api.auth.login({ email, password });

        localStorage.setItem('zkm_token', res.token);

        // Check if local private key is already stored on this device
        let localPrivKey = getPrivateKeyLocally(res.user.id);
        if (!localPrivKey) {
          // If user logs in on a new device, generate a fresh device keypair and register new public key
          setCryptoProgress('Generating new device OpenPGP key pair...');
          const { privateKey, publicKey } = await generateUserKeyPair(res.user.name, res.user.email);
          savePrivateKeyLocally(res.user.id, privateKey);
          await api.auth.updatePublicKey(publicKey);
          res.user.publicKey = publicKey;
        }

        onAuthSuccess(res.user, res.token);
      }
    } catch (err) {
      console.error('[Auth Error]:', err);
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
      setCryptoProgress('');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>🔐</div>
          <h2>{isRegister ? 'Create ZKM Account' : 'Welcome to ZKM'}</h2>
          <p className="auth-subtitle">
            Zero-Knowledge Messenger with Client-Side OpenPGP Encryption & Local AI Summarization
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {cryptoProgress && (
          <div className="info-banner">
            <span>⚙️ {cryptoProgress}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alice Walker"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
            {isRegister && (
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                At least 6 characters. Passwords are securely hashed with bcrypt.
              </small>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: 12, padding: '10px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegister ? 'Register & Generate Key' : 'Log In'}
          </button>
        </form>

        <div className="form-toggle">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <a onClick={() => !loading && setIsRegister(false)}>Log In</a>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <a onClick={() => !loading && setIsRegister(true)}>Create One</a>
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 24,
            padding: '12px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          🔒 <strong>Zero-Knowledge Guarantee:</strong> Your private keys are generated in your browser
          and never leave this device. Messages are encrypted before dispatch and never persisted to the server.
        </div>
      </div>
    </div>
  );
}
