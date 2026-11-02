// chat-session.js - Canonical Conversation Data Model & Persistence (CHAT V2)
// Fundamental Rule: ONE SESSION = ONE CONTINUOUS CONVERSATION

/**
 * Ensures the session object has all canonical fields initialized IN-PLACE on the exact same object reference.
 * Returns the exact same mutable canonical session reference.
 */
export function ensureCanonicalSession(session) {
  if (!session || typeof session !== 'object') {
    return createChatSessionRecord();
  }

  if (!session.id) {
    session.id = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }
  if (!session.title) {
    session.title = 'Percakapan Baru';
  }
  if (!session.createdAt) {
    session.createdAt = new Date().toISOString();
  }
  if (!session.updatedAt) {
    session.updatedAt = session.createdAt;
  }
  if (!Array.isArray(session.messages)) {
    session.messages = [];
  }
  if (!Array.isArray(session.assets)) {
    session.assets = [];
  }
  if (!Array.isArray(session.references)) {
    session.references = [];
  }
  if (!Array.isArray(session.artifacts)) {
    session.artifacts = [];
  }
  if (!session.metadata || typeof session.metadata !== 'object') {
    session.metadata = {};
  }

  // Ensure isolated provider runtime structure in-place
  if (!session.providerRuntime || typeof session.providerRuntime !== 'object') {
    session.providerRuntime = {};
  }
  if (!session.providerRuntime.dola) {
    session.providerRuntime.dola = {
      convId: session.dolaConvId || null,
      sectionId: session.dolaSectionId || null,
      messageIndex: typeof session.dolaMessageIndex === 'number' ? session.dolaMessageIndex : null,
    };
  }
  if (!session.providerRuntime.gemini) {
    session.providerRuntime.gemini = {
      lastModel: null,
    };
  }
  if (!session.providerRuntime.weavy) {
    session.providerRuntime.weavy = {
      canvasId: null,
    };
  }

  return session;
}

/**
 * Normalizes and deep-sanitizes a session for read-only / export contexts.
 */
export function normalizeChatSession(session) {
  if (!session || typeof session !== 'object') {
    return createChatSessionRecord();
  }

  const canonical = ensureCanonicalSession(session);
  const rawMessages = Array.isArray(canonical.messages) ? canonical.messages : [];

  const normalizedMessages = rawMessages.map((msg, idx) => {
    if (!msg || typeof msg !== 'object') {
      return {
        id: `msg_${Date.now()}_${idx}`,
        role: 'user',
        content: String(msg || ''),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }

    return {
      id: msg.id || `msg_${Date.now()}_${idx}`,
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || '',
      timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
      extractedProducts: Array.isArray(msg.extractedProducts) ? msg.extractedProducts : [],
      videoPreviews: Array.isArray(msg.videoPreviews) ? msg.videoPreviews : [],
      tiktokData: msg.tiktokData || null,
      generatedImage: msg.generatedImage || null,
      generatedVideo: msg.generatedVideo || null,
      modelDisplayName: msg.modelDisplayName || null,
      isError: Boolean(msg.isError),
      execution: msg.execution || (msg.modelDisplayName ? {
        provider: msg.modelDisplayName.toLowerCase().includes('dola') ? 'dola' : (msg.modelDisplayName.toLowerCase().includes('gemini') ? 'gemini' : 'weavy'),
        model: msg.modelDisplayName,
      } : null),
    };
  });

  return {
    id: canonical.id,
    title: canonical.title || (normalizedMessages[0]?.content ? normalizedMessages[0].content.slice(0, 25) : 'Percakapan Baru'),
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
    messages: normalizedMessages,
    assets: Array.isArray(canonical.assets) ? canonical.assets : [],
    references: Array.isArray(canonical.references) ? canonical.references : [],
    artifacts: Array.isArray(canonical.artifacts) ? canonical.artifacts : [],
    metadata: canonical.metadata || {},
    providerRuntime: {
      dola: { ...canonical.providerRuntime.dola },
      gemini: { ...canonical.providerRuntime.gemini },
      weavy: { ...canonical.providerRuntime.weavy },
    },
  };
}

/**
 * Returns the exact mutable Canonical Session from the chatSessions array.
 * IMPORTANT: Must return the same reference so mutations like session.messages.push()
 * directly mutate the canonical session in chatSessions.
 */
export function getCurrentChatSession(chatSessions, currentSessionId) {
  if (!Array.isArray(chatSessions) || chatSessions.length === 0) {
    return null;
  }
  const found = chatSessions.find((s) => s && s.id === currentSessionId) || chatSessions[0] || null;
  return found ? ensureCanonicalSession(found) : null;
}

export function createChatSessionRecord() {
  const now = new Date().toISOString();
  return {
    id: `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: 'Percakapan Baru',
    createdAt: now,
    updatedAt: now,
    messages: [],
    assets: [],
    references: [],
    artifacts: [],
    metadata: {},
    providerRuntime: {
      dola: { convId: null, sectionId: null, messageIndex: null },
      gemini: { lastModel: null },
      weavy: { canvasId: null },
    },
  };
}

export async function persistChatSessions({ storage, chatSessions, currentSessionId }) {
  if (!storage) return;

  // Deep-sanitize chat sessions to avoid QuotaExceeded errors from giant video Base64 strings
  const sanitizedSessions = (chatSessions || []).map((session) => {
    if (!session || typeof session !== 'object') return session;
    const canonical = ensureCanonicalSession(session);

    return {
      id: canonical.id,
      title: canonical.title,
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
      assets: canonical.assets,
      references: canonical.references,
      artifacts: canonical.artifacts,
      metadata: canonical.metadata,
      providerRuntime: canonical.providerRuntime,
      messages: (canonical.messages || []).map((msg) => {
        if (!msg || !Array.isArray(msg.attachments)) return msg;
        return {
          ...msg,
          attachments: msg.attachments.map((att) => {
            if (!att) return att;
            const isVideo = att.type === 'video' || (att.name && /\.(mp4|mov|webm|avi|mkv)$/i.test(att.name));
            // If video base64 payload is large (> 250KB), don't store full raw video base64 in local storage
            if (isVideo && typeof att.base64 === 'string' && att.base64.length > 250000) {
              return {
                ...att,
                base64: att.url?.startsWith('http') ? att.url : '', // keep URL if http, clear huge dataUrl
                url: att.url?.startsWith('http') ? att.url : '',
                isCachedVideo: true,
              };
            }
            return att;
          }),
        };
      }),
    };
  });

  await storage.set('weavy_chat_sessions', sanitizedSessions);
  if (currentSessionId) {
    await storage.set('weavy_current_session_id', currentSessionId);
  }
}
