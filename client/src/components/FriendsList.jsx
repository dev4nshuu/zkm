import React from 'react';

export function FriendsList({
  friends,
  activeFriend,
  onSelectFriend,
  onRemoveFriend,
  unreadCounts = {},
}) {
  if (!friends || friends.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: 24, marginBottom: 8 }}>👥</p>
        <p style={{ fontSize: 13 }}>You don't have any friends added yet.</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>
          Search for another user using their ZKM ID in the "Add Friend" tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      {friends.map((friend) => {
        const unread = unreadCounts[friend.id] || 0;
        return (
          <div
            key={friend.id}
            className={`friend-item ${activeFriend?.id === friend.id ? 'active' : ''}`}
            onClick={() => onSelectFriend(friend)}
          >
            <div className="friend-info">
              <h4>
                <span
                  className={`status-dot ${friend.isOnline ? 'online' : ''}`}
                  title={friend.isOnline ? 'Online' : 'Offline'}
                />
                {friend.name}
              </h4>
              <span className="friend-zkm-id">{friend.zkmId}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unread > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--accent-blue)',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '2px 7px',
                    fontSize: '11px',
                    fontWeight: 700,
                    animation: 'pulse 1.5s infinite',
                  }}
                  title={`${unread} new unread message(s)`}
                >
                  +{unread}
                </span>
              )}

              <button
                className="btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remove ${friend.name} from friends?`)) {
                    onRemoveFriend(friend.id);
                  }
                }}
                title="Remove Friend"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
