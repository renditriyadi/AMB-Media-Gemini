import express from 'express';
import { loginUserWithSpreadsheet, registerUserToSpreadsheet, getUsersSheetData } from '../utils/sheets';
import { createUserSessionToken } from '../utils/userSession';

const router = express.Router();

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username dan Password tidak boleh kosong.',
      });
    }

    const result = await loginUserWithSpreadsheet(username, password);
    if (!result.success) {
      return res.status(401).json(result);
    }

    const session = createUserSessionToken({
      userId: result.user.userId,
      userName: result.user.userName,
    });
    return res.json({ ...result, sessionToken: session.token, sessionExpiresAt: session.expiresAt });
  } catch (error: any) {
    console.error('[Auth Login Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Username atau password salah.',
    });
  }
});

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username dan Password tidak boleh kosong.',
      });
    }

    const result = await registerUserToSpreadsheet(username, password, email || '');
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[Auth Register Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Terjadi kesalahan sistem saat mendaftarkan akun ke Google Sheets.',
    });
  }
});

// GET /api/auth/users-count - quick public info
router.get('/auth/status', async (req, res) => {
  try {
    const data = await getUsersSheetData();
    return res.json({
      success: true,
      userCount: data.users.length,
      headers: data.headers,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
