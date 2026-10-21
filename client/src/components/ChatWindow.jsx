import React, { useState, useEffect, useRef } from 'react';
import { encryptMessage } from '../crypto/openpgp';
import { sendEncryptedMessage } from '../services/socket';
import { SummarizeModal } from './SummarizeModal';

export function ChatWindow({
  activeFriend,
  currentUser,
  messages = [],
  onAddSentMessage,
  onUpdateMessageStatus,
}) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSummarizeOpen, setIsSummarizeOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    if (!activeFriend.publicKey) {
      alert(`Cannot encrypt: ${activeFriend.name} has not registered an OpenPGP public key yet.`);
      return;
    }

    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const optimisticMessage = {
      id: tempId,
      tempId,
      text: textToSend,
      isMine: true,
      senderName: currentUser.name || 'You',
      timestamp: Date.now(),
      status: 'encrypting',
    };

    // Add optimistic message to global session state
    if (onAddSentMessage) {
      onAddSentMessage(activeFriend.id, optimisticMessage);
    }

    setInputText('');
    setIsSending(true);

    try {
      // 1. Genuine client-side encryption using recipient's public key AND sender's public key
      const ciphertext = await encryptMessage(
        textToSend,
        activeFriend.publicKey,
        currentUser.publicKey
      );

      // Update state to sending over relay
      if (onUpdateMessageStatus) {
        onUpdateMessageStatus(activeFriend.id, tempId, 'sending', null);
      }

      // 2. Deliver encrypted ciphertext to the server via Socket.IO
      const deliveryResult = await sendEncryptedMessage({
        recipientId: activeFriend.id,
        ciphertext,
        tempId,
      });

      // 3. Update delivery state based on real-time server check
      if (deliveryResult && !deliveryResult.delivered) {
        if (onUpdateMessageStatus) {
          onUpdateMessageStatus(
            activeFriend.id,
            tempId,
            'failed',
            deliveryResult.reason || 'Recipient is offline.'
          );
        }
      } else {
        if (onUpdateMessageStatus) {
          onUpdateMessageStatus(activeFriend.id, tempId, 'delivered', null);
        }
      }
    } catch (err) {
      console.error('[Send Error]:', err);
      if (onUpdateMessageStatus) {
        onUpdateMessageStatus(
          activeFriend.id,
          tempId,
          'failed',
          err.message || 'Delivery error'
        );
      }
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>
            <span
              className={`status-dot ${activeFriend.isOnline ? 'online' : ''}`}
              title={activeFriend.isOnline ? 'Online' : 'Offline'}
            />
            {activeFriend.name}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              ({activeFriend.zkmId})
            </span>
          </h3>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' }}>
            <span className="e2ee-badge" title="Ciphertext routed via RAM; never saved to disk">
              🔒 OpenPGP E2EE Active
            </span>
            <span
              style={{
                fontSize: 11,
                color: activeFriend.isOnline ? 'var(--accent-green)' : 'var(--text-muted)',
              }}
            >
              {activeFriend.isOnline ? '● Active now' : '○ Offline'}
            </span>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setIsSummarizeOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <span>✨</span> Summarize Chat
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-placeholder">
            <div style={{ fontSize: 32 }}>🔒</div>
            <p style={{ fontWeight: 500 }}>End-to-End Encrypted Session</p>
            <p style={{ fontSize: 12, maxWidth: 360 }}>
              Messages in this session are encrypted on your device. The server only routes ciphertext in real time and never persists conversation history.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`message-row ${m.isMine ? 'sent' : 'received'}`}>
              <div className="message-bubble">{m.text}</div>
              <div className="message-meta">
                <span>{formatTime(m.timestamp)}</span>
                {m.isMine && (
                  <>
                    {m.status === 'encrypting' && <span>🔐 Encrypting...</span>}
                    {m.status === 'sending' && <span>⚡ Sending...</span>}
                    {m.status === 'delivered' && (
                      <span className="status-delivered" title="Delivered in real-time">
                        ✓ Delivered
                      </span>
                    )}
                    {m.status === 'failed' && (
                      <span
                        className="status-failed"
                        title={m.failureReason || 'Failed to deliver'}
                      >
                        ✕ {m.failureReason || 'Undelivered'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <form className="chat-input-bar" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Type a private message to ${activeFriend.name}...`}
          disabled={isSending}
        />
        <button type="submit" className="btn-primary" disabled={isSending || !inputText.trim()}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>

      {/* Local AI Summarize Modal */}
      <SummarizeModal
        isOpen={isSummarizeOpen}
        onClose={() => setIsSummarizeOpen(false)}
        messages={messages}
        friendName={activeFriend.name}
      />
    </div>
  );
}
