import React, { useState, useEffect } from 'react';
import { summarizeChatMessages, getAiConfig, saveAiConfig } from '../ai/summarizer';

export function SummarizeModal({ isOpen, onClose, messages, friendName }) {
  const [summary, setSummary] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(getAiConfig());

  useEffect(() => {
    if (isOpen && messages.length > 0 && !summary && !loading) {
      handleGenerate();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleGenerate(customCfg = null) {
    setLoading(true);
    setError('');
    try {
      const result = await summarizeChatMessages(messages, customCfg || config);
      setSummary(result.summary);
      setModelUsed(result.model);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSaveSettings(e) {
    e.preventDefault();
    saveAiConfig(config);
    setShowSettings(false);
    handleGenerate(config);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: 16 }}>🤖 Local AI Chat Summary</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Conversation with {friendName || 'Friend'} ({messages.length} local messages)
            </span>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Local Model"
          >
            ⚙️ AI Settings
          </button>
        </div>

        <div className="modal-body">
          {showSettings && (
            <form onSubmit={handleSaveSettings} style={{ marginBottom: 16, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-primary)' }}>
              <h4 style={{ fontSize: 13, marginBottom: 8 }}>Local AI Configuration</h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Messages are decrypted in your browser and sent directly to your chosen local model runtime. Plaintext never touches the ZKM backend or cloud APIs.
              </p>

              <div className="form-group">
                <label>Runtime Provider</label>
                <select
                  value={config.provider}
                  onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                >
                  <option value="local-runner">ZKM Local AI Runner (port 11435)</option>
                  <option value="ollama">Local Ollama Instance (port 11434)</option>
                  <option value="custom">Custom Local HTTP Endpoint</option>
                </select>
              </div>

              {config.provider === 'ollama' && (
                <>
                  <div className="form-group">
                    <label>Ollama Base URL</label>
                    <input
                      type="text"
                      value={config.ollamaUrl}
                      onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="form-group">
                    <label>Model Name</label>
                    <input
                      type="text"
                      value={config.ollamaModel}
                      onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
                      placeholder="qwen2.5:0.5b or llama3.2"
                    />
                  </div>
                </>
              )}

              {config.provider === 'local-runner' && (
                <div className="form-group">
                  <label>Runner URL</label>
                  <input
                    type="text"
                    value={config.localRunnerUrl}
                    onChange={(e) => setConfig({ ...config, localRunnerUrl: e.target.value })}
                    placeholder="http://localhost:11435"
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Run `npm run local-ai` in your terminal to start this process.
                  </small>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="submit" className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>
                  Save & Re-run
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⚙️</div>
              <p style={{ fontWeight: 500 }}>Generating local AI summary...</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Inference is running locally on your device. Messages remain private.
              </p>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <strong>Local Inference Notice:</strong>
              <div style={{ marginTop: 4 }}>{error}</div>
              <div style={{ marginTop: 8 }}>
                <button className="btn-secondary" onClick={() => handleGenerate()} style={{ fontSize: 12, padding: '4px 8px' }}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && summary && (
            <div>
              <div className="summary-content">{summary}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Model: {modelUsed}</span>
                <span>🔒 Decrypted locally &middot; Zero-Knowledge Preserved</span>
              </div>
            </div>
          )}

          {!loading && !error && !summary && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              No summary generated yet. Click "Generate Summary".
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {!loading && (
            <button className="btn-primary" onClick={() => handleGenerate()}>
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
