import express from 'express';
import {
  getAllProvidersAccountsFromSheet,
  getProviderAccountsFromSheet,
  saveProviderAccountsToSheet,
} from '../utils/sheets';

const router = express.Router();

// GET /api/providers/accounts?userId=USR-... -> returns all provider accounts for this user
router.get('/providers/accounts', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "userId" wajib disertakan.',
      });
    }

    const data = await getAllProvidersAccountsFromSheet(userId);
    return res.json({
      success: true,
      userId,
      accounts: data,
    });
  } catch (error: any) {
    console.error('[Provider Accounts GET All Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengambil akun provider dari Google Sheets.',
    });
  }
});

// GET /api/providers/:provider/accounts?userId=USR-...
router.get('/providers/:provider/accounts', async (req, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    const userId = String(req.query.userId || '').trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "userId" wajib disertakan.',
      });
    }

    const accounts = await getProviderAccountsFromSheet(userId, provider);
    return res.json({
      success: true,
      provider,
      userId,
      accounts,
    });
  } catch (error: any) {
    console.error(`[Provider Accounts GET ${req.params.provider} Error]:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengambil data akun dari sheet provider.',
    });
  }
});

// POST /api/providers/:provider/accounts -> Saves / updates accounts for specific provider & user in real-time
router.post('/providers/:provider/accounts', async (req, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    const { userId, accounts } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User_id wajib disertakan dalam body request.',
      });
    }

    if (!Array.isArray(accounts)) {
      return res.status(400).json({
        success: false,
        error: 'Data "accounts" harus berupa array.',
      });
    }

    const result = await saveProviderAccountsToSheet(userId, provider, accounts);
    return res.json({
      success: true,
      provider,
      userId,
      count: result.count,
      message: `Berhasil sinkronisasi ${result.count} akun ke sheet provider ${provider}.`,
    });
  } catch (error: any) {
    console.error(`[Provider Accounts POST ${req.params.provider} Error]:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal menyimpan akun ke sheet provider.',
    });
  }
});

export default router;
