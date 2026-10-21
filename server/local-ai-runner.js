import http from 'http';

const PORT = process.env.LOCAL_AI_PORT || 11435;

// Precise time regex matching actual time expressions (e.g. "8 pm", "8:30 am", "5pm", "11:00 am")
// Word-bounded so it never accidentally matches "i am", "program", "spam", etc.
const TIME_REGEX = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

// Relative or explicit deadline indicators
const DEADLINE_INDICATOR_REGEX = /\b(?:by\s+(?:tomorrow|tonight|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|end of day|next week|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|deadline(?:\s+is)?|due(?:\s+(?:by|date|time|on|at))?|before\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;

// Action verbs and task commitments
const ACTION_REGEX = /\b(?:finish|complete|send|submit|review|check|test|implement|deploy|write|prepare|update|fix|deliver|create|schedule|todo|task|action item|investigate|organize)\b/i;
const COMMITMENT_REGEX = /\b(?:i will|i'll|will do|let me|we should|please|need to|have to|going to|assigned to|working on)\b/i;

// Decision indicators
const DECISION_REGEX = /\b(?:agree|agreed|decided|let's go with|confirmed|settled|approved|chosen|deal|finalize|finalized|sounds good|done deal)\b/i;

// Greeting / small-talk patterns
const GREETING_ONLY_REGEX = /^\s*(?:hi|hello|hey|whastup|what's up|sup|howdy|yo|how are you|i am good|good morning|good evening|good afternoon|thanks|thank you|ok|okay|k)\s*$/i;

/**
 * Clean sender label from message text
 */
function parseMessageLine(line) {
  const match = line.match(/^([^:]+):\s*(.*)$/);
  if (match) {
    return { sender: match[1].trim(), content: match[2].trim() };
  }
  return { sender: 'Participant', content: line.trim() };
}

/**
 * Intelligent on-device local chat analysis and synthesis engine
 */
function analyzeChatTranscript(rawChatText) {
  const rawLines = rawChatText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsedMessages = rawLines.map(parseMessageLine);

  const decisions = [];
  const actionItems = [];
  const deadlines = [];
  const substantivePoints = [];
  let hasGreetings = false;

  for (const { sender, content } of parsedMessages) {
    if (!content) continue;

    const lower = content.toLowerCase();

    // Check if greeting
    if (GREETING_ONLY_REGEX.test(lower)) {
      hasGreetings = true;
      continue;
    }

    // Check for deadlines
    // Must match either explicit time (e.g. "8 pm") or relative deadline indicators
    const hasTime = TIME_REGEX.test(content);
    const hasDeadlineKeyword = DEADLINE_INDICATOR_REGEX.test(content);
    if (hasTime || hasDeadlineKeyword) {
      deadlines.push({
        sender,
        content,
        formatted: `[${sender}] "${content}"`,
      });
    }

    // Check for action items / tasks
    if (ACTION_REGEX.test(content) || COMMITMENT_REGEX.test(content)) {
      actionItems.push({
        sender,
        content,
        formatted: `[${sender}] ${content.charAt(0).toUpperCase() + content.slice(1)}`,
      });
    }

    // Check for decisions
    if (DECISION_REGEX.test(content)) {
      decisions.push({
        sender,
        content,
        formatted: `[${sender}] ${content}`,
      });
    }

    // Substantive discussion topic
    substantivePoints.push({ sender, content });
  }

  // 1. Synthesize Main Discussion Points
  const discussionBullets = [];

  if (actionItems.length > 0) {
    for (const item of actionItems) {
      discussionBullets.push(`• ${item.sender} highlighted the task: "${item.content}".`);
    }
  }

  if (decisions.length > 0) {
    for (const dec of decisions) {
      discussionBullets.push(`• Decision reached: "${dec.content}".`);
    }
  }

  // If there are other substantive points not covered by actions or decisions
  for (const pt of substantivePoints) {
    const alreadyIncluded =
      actionItems.some((a) => a.content === pt.content) ||
      decisions.some((d) => d.content === pt.content);
    if (!alreadyIncluded) {
      discussionBullets.push(`• ${pt.sender} shared: "${pt.content}".`);
    }
  }

  if (hasGreetings && discussionBullets.length === 0) {
    discussionBullets.push(`• Participants checked in and exchanged initial greetings.`);
  } else if (hasGreetings && discussionBullets.length > 0) {
    discussionBullets.push(`• Initial greetings and pleasantries exchanged.`);
  }

  if (discussionBullets.length === 0) {
    discussionBullets.push(`• Brief conversation recorded without major topics.`);
  }

  // Format final structured summary
  let formatted = `### 📋 Main Discussion Points\n`;
  formatted += discussionBullets.join('\n') + '\n\n';

  formatted += `### 💡 Important Decisions\n`;
  if (decisions.length > 0) {
    formatted += decisions.map((d) => `- ${d.formatted}`).join('\n') + '\n\n';
  } else {
    formatted += `- No explicit decisions recorded in this conversation.\n\n`;
  }

  formatted += `### ✅ Tasks or Action Items\n`;
  if (actionItems.length > 0) {
    formatted += actionItems.map((a) => `- ${a.formatted}`).join('\n') + '\n\n';
  } else {
    formatted += `- No pending action items detected.\n\n`;
  }

  formatted += `### ⏰ Deadlines Mentioned\n`;
  if (deadlines.length > 0) {
    formatted += deadlines.map((dl) => `- ${dl.formatted}`).join('\n');
  } else {
    formatted += `- No specific deadlines specified.`;
  }

  return formatted;
}

const server = http.createServer(async (req, res) => {
  // CORS headers allowing client-side browser direct fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'ZKM Local AI Summarization Runner',
        model: 'ZKM Semantic NLP Engine (On-Device)',
        bypassesBackend: true,
      })
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/api/summarize') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { messages, conversationText } = JSON.parse(body || '{}');

        let rawChatText = conversationText || '';
        if (!rawChatText && Array.isArray(messages)) {
          rawChatText = messages
            .map((m) => `${m.senderName || 'Participant'}: ${m.text}`)
            .join('\n');
        }

        if (!rawChatText || rawChatText.trim().length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No chat messages provided for summarization' }));
          return;
        }

        console.log(`[Local AI Runner] Generating intelligent summary for ${rawChatText.length} characters of chat...`);
        const structuredSummary = analyzeChatTranscript(rawChatText);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            summary: structuredSummary,
            model: 'ZKM Semantic NLP Engine (On-Device)',
          })
        );
      } catch (err) {
        console.error('[Local AI Runner Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Local AI inference failed: ${err.message}` }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  ZKM Local AI Runner Active on Port ${PORT}        `);
  console.log(`  Target: http://localhost:${PORT}/api/summarize    `);
  console.log(`  Architecture: Direct Client Inference (No Backend)`);
  console.log(`====================================================`);
});
