import React, { useState } from 'react';
import { api } from '../services/api';

export function UserSearch({ onRequestSent }) {
  const [searchZkmId, setSearchZkmId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [relationship, setRelationship] = useState('none');
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchZkmId.trim().toUpperCase();
    if (!query) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setSearchResult(null);

    try {
      const data = await api.users.lookup(query);
      setSearchResult(data.user);
      setRelationship(data.relationship);
    } catch (err) {
      setError(err.message || 'User not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;
    setSendingRequest(true);
    setError('');
    try {
      await api.friends.sendRequest({ receiverZkmId: searchResult.zkmId });
      setSuccessMsg(`Friend request sent to ${searchResult.name}!`);
      setRelationship('request_sent');
      if (onRequestSent) onRequestSent();
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <input
          type="text"
          value={searchZkmId}
          onChange={(e) => setSearchZkmId(e.target.value.toUpperCase())}
          placeholder="Enter ZKM ID (e.g. ZKM-A9B2C4)"
          style={{ flex: 1, textTransform: 'uppercase' }}
        />
        <button type="submit" className="btn-primary" disabled={loading || !searchZkmId.trim()}>
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}
      {successMsg && <div className="info-banner" style={{ color: '#6ee7b7' }}>{successMsg}</div>}

      {searchResult && (
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <h4 style={{ fontSize: 14 }}>{searchResult.name}</h4>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {searchResult.zkmId}
              </div>
            </div>
            <span className="e2ee-badge" style={{ fontSize: 10 }}>
              {searchResult.publicKey ? '🔑 PGP Key Ready' : '⚠️ No PGP Key'}
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            {relationship === 'self' && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This is your own ZKM ID.</span>
            )}
            {relationship === 'friends' && (
              <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>✓ Already Friends</span>
            )}
            {relationship === 'request_sent' && (
              <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>● Friend Request Sent (Pending)</span>
            )}
            {relationship === 'request_received' && (
              <span style={{ fontSize: 12, color: 'var(--accent-blue)' }}>This user already sent you a request! Check Requests tab.</span>
            )}
            {relationship === 'none' && (
              <button
                className="btn-primary"
                onClick={handleSendRequest}
                disabled={sendingRequest || !searchResult.publicKey}
                style={{ width: '100%', fontSize: 13 }}
              >
                {sendingRequest ? 'Sending...' : '+ Send Friend Request'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
