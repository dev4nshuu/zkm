/**
 * ZKM Client-Side AI Summarizer Service
 * 
 * ZERO-KNOWLEDGE ENFORCEMENT:
 * - Messages are decrypted on the client device.
 * - Plaintext is NEVER sent to the ZKM Express backend.
 * - Plaintext is NEVER sent to cloud AI providers.
 * - The browser issues requests directly to the local model runtime running on the user's machine
 *   (e.g., Ollama at http://localhost:11434, Local AI Runner at http://localhost:11435, or LM Studio at http://localhost:1234).
 */

export const DEFAULT_AI_CONFIG = {
  // Provider: 'ollama' | 'local-runner' | 'custom'
  provider: 'local-runner',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:0.5b',
  localRunnerUrl: 'http://localhost:11435',
  customUrl: 'http://localhost:11434/api/generate',
};

export function getAiConfig() {
  const saved = localStorage.getItem('zkm_ai_config');
  if (saved) {
    try {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
  }
  return DEFAULT_AI_CONFIG;
}

export function saveAiConfig(config) {
  localStorage.setItem('zkm_ai_config', JSON.stringify(config));
}

/**
 * Build the structured prompt for chat summarization.
 */
function buildSummarizationPrompt(messages) {
  const transcript = messages
    .map((m) => `${m.senderName || (m.isMine ? 'You' : 'Peer')}: ${m.text}`)
    .join('\n');

  return `You are a private meeting assistant. Below is a real-time conversation between users. 
Provide a concise, factual summary strictly organized under these exact 4 headings:

### 📋 Main Discussion Points
[Summarize what was talked about]

### 💡 Important Decisions
[List any agreements or decisions reached, or state "None"]

### ✅ Tasks or Action Items
[List any tasks assigned or promised, or state "None"]

### ⏰ Deadlines Mentioned
[List any deadlines or dates specified, or state "None"]

Conversation:
${transcript}

Summary:`;
}

/**
 * Summarize a list of decrypted chat messages using a local AI runtime.
 * @param {Array<{ text: string, senderName: string, isMine: boolean }>} messages
 * @param {Object} [customConfig]
 */
export async function summarizeChatMessages(messages, customConfig = null) {
  if (!messages || messages.length === 0) {
    throw new Error('No messages available locally to summarize.');
  }

  const config = customConfig || getAiConfig();
  const prompt = buildSummarizationPrompt(messages);

  // 1. Try Local AI Runner (port 11435) if selected
  if (config.provider === 'local-runner') {
    try {
      const response = await fetch(`${config.localRunnerUrl}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          conversationText: messages.map((m) => `${m.senderName || (m.isMine ? 'You' : 'Peer')}: ${m.text}`).join('\n'),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Local runner returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        summary: data.summary,
        model: data.model || 'Local ONNX Runner',
      };
    } catch (err) {
      // If local runner fails, throw an informative error explaining how to start it or switch to Ollama
      throw new Error(
        `Failed to reach ZKM Local AI Runner at ${config.localRunnerUrl}. Make sure "npm run local-ai" is running, or switch the AI engine to Ollama in settings. (${err.message})`
      );
    }
  }

  // 2. Try Ollama (port 11434) if selected
  if (config.provider === 'ollama') {
    try {
      const response = await fetch(`${config.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel || 'qwen2.5:0.5b',
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}. Make sure model "${config.ollamaModel}" is pulled.`);
      }

      const data = await response.json();
      return {
        summary: data.response || 'No summary returned by local model.',
        model: `Ollama (${config.ollamaModel})`,
      };
    } catch (err) {
      throw new Error(
        `Failed to connect to local Ollama at ${config.ollamaUrl}. Ensure Ollama is active on your device ('ollama run ${config.ollamaModel}'). Plaintext is never sent to the server. (${err.message})`
      );
    }
  }

  // 3. Fallback / Custom Endpoint
  try {
    const response = await fetch(config.customUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    return {
      summary: data.response || data.summary || JSON.stringify(data),
      model: 'Custom Local Model',
    };
  } catch (err) {
    throw new Error(`Failed to connect to custom local AI endpoint: ${err.message}`);
  }
}
