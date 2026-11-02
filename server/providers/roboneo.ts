import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Helper parser for RoboNeo Access Tokens
export function parseRoboneoAccessToken(token: string) {
  try {
    let clean = (token || '').trim();
    let rawToken = clean;
    if (clean.startsWith('_v2')) clean = clean.slice(3);
    else if (clean.startsWith('v2')) clean = clean.slice(2);

    const decoded = Buffer.from(clean, 'base64').toString('utf-8');
    const parts = decoded.split('#');
    const uid = parts[1] || '1793409526';

    let paramToken = parts[4] || '';
    if (!/^[a-fA-F0-9]{32,34}$/.test(paramToken)) {
      for (const p of parts) {
        if (/^[a-fA-F0-9]{32,34}$/.test(p)) {
          paramToken = p;
          break;
        }
      }
    }

    if (paramToken.length > 32) {
      paramToken = paramToken.slice(-32);
    }

    if (!paramToken) {
      paramToken = '8946153dc2fbd49bd964cbe0348334805';
    }

    return { rawToken, uid, paramToken, decoded };
  } catch (err) {
    return {
      rawToken: token,
      uid: '1793409526',
      paramToken: '8946153dc2fbd49bd964cbe0348334805',
      decoded: '',
    };
  }
}

// RoboNeo Account Verification Endpoint
router.post('/roboneo/accounts/verify', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return res.status(400).json({ error: 'Access token RoboNeo wajib diisi.' });
    }

    const cleanToken = accessToken.trim();
    const parsed = parseRoboneoAccessToken(cleanToken);

    const clientId = '1189857647';
    const cookieStr = `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${parsed.uid}; __mt_uid__=${parsed.uid}`;

    let screenName = '';
    let userEmail = '';
    let userAvatar = '';

    try {
      const profileRes = await axios.get(
        'https://api.account.meitu.com/users/show_current?client_id=1189857647&client_language=en&overseas=1&client_type=2&web_version=4.9.0&zip_version=4.76000&is_web=1&client_accept_cookies=1&country_code=ID&with_member_info=1&with_watsons_member=1',
        {
          headers: {
            Accept: '*/*',
            'Access-Token': cleanToken,
            Cookie: cookieStr,
            Origin: 'https://www.roboneo.com',
            Referer: 'https://www.roboneo.com/',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
          },
          timeout: 10000,
        }
      );

      const userData = profileRes.data?.response?.user || profileRes.data?.user || profileRes.data?.data;
      if (userData) {
        screenName = userData.screen_name || userData.name || userData.nickname || '';
        userEmail = userData.email || '';
        userAvatar = userData.avatar || '';
      }
    } catch (err: any) {
      console.warn('[RoboNeo Profile Fetch Warning]:', err.message);
    }

    let credits: number | string = 0;
    let totalCredits: number | string = 0;
    let isVip = false;

    const headers = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Cookie: cookieStr,
      Origin: 'https://www.roboneo.com',
      Referer: 'https://www.roboneo.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'access-token': cleanToken,
      'client-id': clientId,
    };

    const payload = {
      token: parsed.paramToken,
      gid: '19f8ec82bc32e65-0daaafa24c3ed4-26071951-1440000-19f8ec82bc43751',
      uid: parsed.uid,
      client_id: clientId,
      app_scene: 'roboneo',
      area_code: 'ID',
      lang: 'en',
      time_zone: 'Asia/Jakarta',
    };

    try {
      const memRes = await axios.post('https://agent-api-roboneo.meitu.com/api/commerce/membership_info', payload, {
        headers,
        timeout: 10000,
      });

      const resData = memRes.data?.result || memRes.data?.data || memRes.data?.response || memRes.data || {};
      if (resData.is_vip === 1 || resData.is_vip === true) {
        isVip = true;
      }

      if (resData.total_amount !== undefined && resData.total_amount !== null) {
        const rawStr = String(resData.total_amount);
        const num = parseInt(rawStr.replace(/[^0-9]/g, ''), 10);
        credits = !isNaN(num) ? num : rawStr;
        totalCredits = credits;
      }
    } catch (err: any) {
      console.warn('[RoboNeo Membership Info Warning]:', err.message);
    }

    const finalName = screenName || (parsed.uid ? `RoboNeo (${parsed.uid})` : 'RoboNeo Account');
    const finalEmail = userEmail || screenName || (parsed.uid ? `${parsed.uid}@roboneo.com` : 'roboneo@account');

    return res.json({
      success: true,
      accessToken: cleanToken,
      paramToken: parsed.paramToken,
      uid: parsed.uid,
      name: finalName,
      email: finalEmail,
      avatar: userAvatar,
      credits: credits,
      totalCredits: totalCredits,
      isVip: isVip,
    });
  } catch (err: any) {
    console.error('[RoboNeo Account Verify Error]:', err?.message);
    return res.status(500).json({ error: err?.message || 'Gagal memverifikasi token RoboNeo.' });
  }
});

export default router;
