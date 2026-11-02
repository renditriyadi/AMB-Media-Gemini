import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const CHAT_SESSIONS_FILE = path.join(DATA_DIR, 'chat_sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('[ChatSessions] Gagal membuat direktori data:', e);
  }
}

// Helper to read sessions from file
function readSessionsFromFile(): any[] {
  try {
    if (!fs.existsSync(CHAT_SESSIONS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(CHAT_SESSIONS_FILE, 'utf-8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[ChatSessions] Gagal membaca chat_sessions.json:', e);
    return [];
  }
}

// Helper to write sessions safely to file
function writeSessionsToFile(sessions: any[]): boolean {
  try {
    const tmpFile = `${CHAT_SESSIONS_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(sessions, null, 2), 'utf-8');
    fs.renameSync(tmpFile, CHAT_SESSIONS_FILE);
    return true;
  } catch (e) {
    console.error('[ChatSessions] Gagal menulis chat_sessions.json:', e);
    return false;
  }
}

// GET /api/chat-sessions - Fetch all saved chat sessions
router.get('/chat-sessions', (req, res) => {
  try {
    const sessions = readSessionsFromFile();
    return res.json({ success: true, count: sessions.length, sessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Gagal membaca riwayat chat server.' });
  }
});

// POST /api/chat-sessions - Save / update all chat sessions
router.post('/chat-sessions', (req, res) => {
  try {
    const { sessions } = req.body || {};
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: 'Format "sessions" harus berupa array.' });
    }

    // Clean very large base64 from sessions before saving to server file to avoid unbounded file bloat
    const sanitizedSessions = sessions.map((sess: any) => ({
      ...sess,
      messages: (sess.messages || []).map((msg: any) => ({
        ...msg,
        attachments: (msg.attachments || []).map((att: any) => ({
          ...att,
          // If attachment url is already an http(s) URL or if base64 is too huge, keep url but strip heavy base64
          base64: typeof att.base64 === 'string' && att.base64.length > 50000 ? '' : att.base64,
        })),
      })),
    }));

    const ok = writeSessionsToFile(sanitizedSessions);
    if (!ok) {
      return res.status(500).json({ success: false, error: 'Gagal menyimpan riwayat chat ke disk server.' });
    }

    return res.json({ success: true, count: sanitizedSessions.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Gagal menyimpan riwayat chat.' });
  }
});

// DELETE /api/chat-sessions/:id - Delete a single session from server
router.delete('/chat-sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Session ID diperlukan.' });
    }

    const sessions = readSessionsFromFile();
    const updated = sessions.filter((s: any) => s.id !== id);
    writeSessionsToFile(updated);

    return res.json({ success: true, remaining: updated.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Gagal menghapus sesi chat di server.' });
  }
});

export default router;
