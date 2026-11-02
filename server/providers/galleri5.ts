import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Galleri5 Account Verification Endpoint
router.post('/galleri5/accounts/verify', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return res.status(400).json({ error: 'Refresh token Galleri5 wajib diisi.' });
    }

    let cleanToken = accessToken.trim();
    if (cleanToken.toLowerCase().startsWith('bearer ')) {
      cleanToken = cleanToken.slice(7).trim();
    }

    let bearerToken = cleanToken;
    let savedRefreshToken = cleanToken;

    try {
      const refreshRes = await axios.post(
        'https://securetoken.googleapis.com/v1/token?key=AIzaSyBejuWIKZ7yQT9bdG_jnb4RrkW3DoFCNNo',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: cleanToken,
        }).toString(),
        {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            origin: 'https://aistudio.galleri5.com',
            referer: 'https://aistudio.galleri5.com/',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
          },
          timeout: 10000,
        }
      );

      if (refreshRes.data) {
        bearerToken = refreshRes.data.id_token || refreshRes.data.access_token || bearerToken;
        savedRefreshToken = refreshRes.data.refresh_token || savedRefreshToken;
      }
    } catch (refreshErr: any) {
      console.log('[Galleri5] SecureToken exchange skipped/failed:', refreshErr?.message);
    }

    const response = await axios.post(
      'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/auth/me/info',
      {},
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          authorization: `Bearer ${bearerToken}`,
          'content-type': 'application/json',
          origin: 'https://aistudio.galleri5.com',
          referer: 'https://aistudio.galleri5.com/',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        },
        timeout: 12000,
      }
    );

    const data = response.data || {};
    const displayName = data.display_name || data.email || 'Galleri5 User';

    return res.json({
      success: true,
      displayName: displayName,
      email: data.email || '',
      credits: data.available_credits !== undefined ? data.available_credits : 0,
      totalCredits: data.total_credits !== undefined ? data.total_credits : 0,
      creditsUsed: data.credits_used !== undefined ? data.credits_used : 0,
      userId: data.user_id || data.firebase_uid || '',
      photoUrl: data.photo_url || '',
      cleanToken: savedRefreshToken,
    });
  } catch (err: any) {
    console.error('[Galleri5 Account Verify Error]:', err?.response?.data || err?.message);
    const msg =
      err?.response?.data?.message || err?.message || 'Refresh token Galleri5 tidak valid atau kadaluarsa.';
    return res.status(500).json({ error: msg });
  }
});

export default router;
