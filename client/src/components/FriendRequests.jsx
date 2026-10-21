import React from 'react';

export function FriendRequests({
  incomingRequests,
  outgoingRequests,
  onAccept,
  onReject,
  loading,
}) {
  return (
    <div>
      {/* Incoming Requests */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Incoming Requests ({incomingRequests.length})
        </h4>

        {incomingRequests.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No pending incoming requests.</p>
        ) : (
          incomingRequests.map((req) => (
            <div
              key={req._id}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{req.sender?.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {req.sender?.zkmId}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--accent-amber)' }}>● Pending</span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-success"
                  onClick={() => onAccept(req._id)}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  ✓ Accept
                </button>
                <button
                  className="btn-danger"
                  onClick={() => onReject(req._id)}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Outgoing Requests */}
      <div>
        <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Outgoing Pending ({outgoingRequests.length})
        </h4>

        {outgoingRequests.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No outgoing pending requests.</p>
        ) : (
          outgoingRequests.map((req) => (
            <div
              key={req._id}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{req.receiver?.name}</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {req.receiver?.zkmId}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Waiting for recipient to accept...
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
