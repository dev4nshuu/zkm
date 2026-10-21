import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { decryptMessage, getPrivateKeyLocally } from '../crypto/openpgp';
import { FriendsList } from '../components/FriendsList';
import { FriendRequests } from '../components/FriendRequests';
import { UserSearch } from '../components/UserSearch';
import { ChatWindow } from '../components/ChatWindow';

export function DashboardPage({ currentUser, token, onLogout }) {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests' | 'search'
  const [friends, setFriends] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Store in-memory decrypted messages per friend for the active session
  // Key: friend.id -> Array of messages
  const [messagesByFriend, setMessagesByFriend] = useState({});
  // Unread message counters per friend
  const [unreadCounts, setUnreadCounts] = useState({});

  // Refs for access in socket listeners
  const activeFriendRef = useRef(activeFriend);
  activeFriendRef.current = activeFriend;

  const friendsRef = useRef(friends);
  friendsRef.current = friends;

  // Fetch Friends List
  const loadFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);
      const data = await api.friends.getFriendsList();
      const loaded = data.friends || [];
      setFriends(loaded);

      // Keep activeFriend synchronized with latest presence & keys
      setActiveFriend((prev) => {
        if (!prev) return null;
        const updated = loaded.find((f) => f.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('[Dashboard] Error loading friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // Fetch Friend Requests
  const loadRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const data = await api.friends.getRequests();
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
    } catch (err) {
      console.error('[Dashboard] Error loading requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // Connect Socket.IO on mount & listen globally for incoming messages
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    // Initial data load
    loadFriends();
    loadRequests();

    // 1. Online / Offline Presence Updates
    const handleStatusChanged = ({ userId, isOnline }) => {
      setFriends((prev) =>
        prev.map((f) => (f.id === userId ? { ...f, isOnline } : f))
      );
      setActiveFriend((prev) =>
        prev && prev.id === userId ? { ...prev, isOnline } : prev
      );
    };

    // 2. Incoming Encrypted Message Handler (Active globally across all screens)
    const handleReceiveMessage = async (data) => {
      const senderId = data.senderId;
      const privateKey = getPrivateKeyLocally(currentUser.id);

      let text = '[Decrypted message unavailable]';
      let success = false;

      if (privateKey) {
        const decrypted = await decryptMessage(data.ciphertext, privateKey);
        text = decrypted.text;
        success = decrypted.success;
      } else {
        text = '[Decryption Error: No local private key on this device]';
      }

      const senderFriend = friendsRef.current.find((f) => f.id === senderId);
      const senderName = senderFriend ? senderFriend.name : 'Peer';

      const incomingMsg = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        text,
        isMine: false,
        senderName,
        timestamp: data.timestamp || Date.now(),
        status: success ? 'received' : 'decryption-failed',
      };

      // Add to session message state for this sender
      setMessagesByFriend((prev) => ({
        ...prev,
        [senderId]: [...(prev[senderId] || []), incomingMsg],
      }));

      // If user is not currently viewing this friend's chat, increment unread badge
      if (!activeFriendRef.current || activeFriendRef.current.id !== senderId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
      }

      // If the sender is not in our friends list yet (e.g. mutual acceptance in flight), refresh
      if (!senderFriend) {
        loadFriends();
      }
    };

    // 3. Message Delivery Status Acknowledgement
    const handleDeliveryStatus = (statusData) => {
      const recipientId = statusData.recipientId;
      if (!recipientId) return;

      setMessagesByFriend((prev) => {
        const friendMsgs = prev[recipientId] || [];
        return {
          ...prev,
          [recipientId]: friendMsgs.map((m) =>
            m.tempId === statusData.tempId
              ? {
                  ...m,
                  status: statusData.delivered ? 'delivered' : 'failed',
                  failureReason: statusData.reason,
                }
              : m
          ),
        };
      });
    };

    // 4. Friend Request Notifications
    const handleRequestReceived = () => {
      loadRequests();
    };

    const handleRequestAccepted = ({ friend }) => {
      loadFriends();
      loadRequests();
      // Auto-focus chat with the newly confirmed friend if user has no chat open
      if (!activeFriendRef.current && friend) {
        setActiveFriend(friend);
        setActiveTab('friends');
      }
    };

    const handleFriendRemoved = ({ friendId }) => {
      loadFriends();
      setActiveFriend((prev) => (prev && prev.id === friendId ? null : prev));
    };

    socket.on('user-status-changed', handleStatusChanged);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('message-delivery-status', handleDeliveryStatus);
    socket.on('friend-request-received', handleRequestReceived);
    socket.on('friend-request-accepted', handleRequestAccepted);
    socket.on('friend-removed', handleFriendRemoved);

    return () => {
      socket.off('user-status-changed', handleStatusChanged);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('message-delivery-status', handleDeliveryStatus);
      socket.off('friend-request-received', handleRequestReceived);
      socket.off('friend-request-accepted', handleRequestAccepted);
      socket.off('friend-removed', handleFriendRemoved);
      disconnectSocket();
    };
  }, [token, currentUser.id, loadFriends, loadRequests]);

  const handleCopyZkmId = () => {
    if (currentUser?.zkmId) {
      navigator.clipboard.writeText(currentUser.zkmId);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleSelectFriend = (friend) => {
    setActiveFriend(friend);
    // Clear unread count when opening friend's chat
    setUnreadCounts((prev) => ({
      ...prev,
      [friend.id]: 0,
    }));
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await api.friends.acceptRequest(requestId);
      await loadRequests();
      await loadFriends();

      // Immediately select the newly accepted friend and switch to friends tab
      if (res.friend) {
        setActiveFriend(res.friend);
        setActiveTab('friends');
      }
    } catch (err) {
      alert(err.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.friends.rejectRequest(requestId);
      loadRequests();
    } catch (err) {
      alert(err.message || 'Failed to reject request');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await api.friends.removeFriend(friendId);
      if (activeFriend?.id === friendId) {
        setActiveFriend(null);
      }
      loadFriends();
    } catch (err) {
      alert(err.message || 'Failed to remove friend');
    }
  };

  // Helper callbacks passed to ChatWindow
  const handleAddSentMessage = (friendId, msg) => {
    setMessagesByFriend((prev) => ({
      ...prev,
      [friendId]: [...(prev[friendId] || []), msg],
    }));
  };

  const handleUpdateMessageStatus = (friendId, tempId, status, failureReason) => {
    setMessagesByFriend((prev) => {
      const friendMsgs = prev[friendId] || [];
      return {
        ...prev,
        [friendId]: friendMsgs.map((m) =>
          m.tempId === tempId ? { ...m, status, failureReason } : m
        ),
      };
    });
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-brand">
          <h1>🛡️ ZKM</h1>
          <span className="e2ee-badge" title="OpenPGP Client-Side Encryption Enabled">
            🔒 E2EE Active (OpenPGP)
          </span>
        </div>

        <div className="nav-user">
          <div className="zkm-id-badge" title="Share this ID with others so they can add you">
            <span>ID:</span>
            <strong>{currentUser?.zkmId}</strong>
            <button
              className="btn-secondary"
              onClick={handleCopyZkmId}
              style={{ padding: '2px 6px', fontSize: 11 }}
            >
              {copyFeedback ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ fontSize: 13 }}>
            <strong>{currentUser?.name}</strong>
          </div>

          <button className="btn-secondary" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </nav>

      {/* Main Split Layout */}
      <div className="main-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Friends ({friends.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Requests {incomingRequests.length > 0 && `(${incomingRequests.length})`}
            </button>
            <button
              className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              + Add Friend
            </button>
          </div>

          <div className="sidebar-content">
            {activeTab === 'friends' && (
              <FriendsList
                friends={friends}
                activeFriend={activeFriend}
                onSelectFriend={handleSelectFriend}
                onRemoveFriend={handleRemoveFriend}
                unreadCounts={unreadCounts}
              />
            )}

            {activeTab === 'requests' && (
              <FriendRequests
                incomingRequests={incomingRequests}
                outgoingRequests={outgoingRequests}
                onAccept={handleAcceptRequest}
                onReject={handleRejectRequest}
                loading={loadingRequests}
              />
            )}

            {activeTab === 'search' && (
              <UserSearch onRequestSent={loadRequests} />
            )}
          </div>
        </aside>

        {/* Right Main Window: Chat Window or Placeholder */}
        <main style={{ flex: 1, display: 'flex' }}>
          {activeFriend ? (
            <ChatWindow
              activeFriend={activeFriend}
              currentUser={currentUser}
              messages={messagesByFriend[activeFriend.id] || []}
              onAddSentMessage={handleAddSentMessage}
              onUpdateMessageStatus={handleUpdateMessageStatus}
            />
          ) : (
            <div className="chat-placeholder" style={{ flex: 1 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
              <h2>Select a Conversation</h2>
              <p style={{ maxWidth: 440, fontSize: 13, lineHeight: 1.6 }}>
                Choose a contact from your friends list to open an end-to-end encrypted chat session.
                Or share your ZKM ID (<strong>{currentUser?.zkmId}</strong>) to connect.
              </p>
              <div
                style={{
                  marginTop: 20,
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  fontSize: 12,
                  textAlign: 'left',
                  maxWidth: 440,
                }}
              >
                <div>🛡️ <strong>Zero-Knowledge Relay:</strong> Ciphertexts are never stored in MongoDB.</div>
                <div style={{ marginTop: 6 }}>🤖 <strong>Local AI Summarization:</strong> Summaries are processed on your device, not on cloud servers.</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
