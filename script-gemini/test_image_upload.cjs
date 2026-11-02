const fs = require('fs');
const path = require('path');
const https = require('https');
const { GeminiWebClient } = require('./gemini_chat.cjs');

const USER_COOKIES = `NID=CsgCCAES-gEBOxGDSLrl4AnLPcW2us0YYAyiHP5NVglZTtTuPhHGHBhONt_6fzlZQtorD-jCr35c9H-X57FPKHnP4vO5k2Zxqgx-rXtDk8kIm94fnH80bSQfmXm_93uEiZRRs9Ewnso4pmp86VUuYog15dEFpRy0bbmlAKl0OkEQJaj_mtZiK_Dc4WHoS3-WomYWkgFU7IFaia7sdy_109OP0TIvWyvlz7If3N-nPZy7JLcQQx-Ziswrup_jfVLdRiLezATfkYV5Srx_psXN5XL-lb43yZqcU3OH2yz1SHNwpTYweqEiDWwYPFXEdqCRiBIPNM6gYGbk3ifeApMoM6_gKAEyRQHSrAfP2ZJGOo0ohgeILogOw_M7Mt5Y4loCn87HT62bpfMekT-K7gMgb40ru9xyHHr5BtN0tH5XYvQWN61TgtyNgvroCw; HSID=AdfvHWAOs6pKbr-9a; SSID=AiLh6pjvaOYBmGcRz; APISID=MkdQt1C8n45dy82s/Ar7k58TzeNuiImGyQ; SAPISID=7AISgYk1ZRUcTCJl/ABzrId-dOTeMd09uo; __Secure-1PAPISID=7AISgYk1ZRUcTCJl/ABzrId-dOTeMd09uo; __Secure-3PAPISID=7AISgYk1ZRUcTCJl/ABzrId-dOTeMd09uo; SID=g.a000DAlExKEsLIHH1oe2qQqnAmBDmXHudNq-stUzaYdLOgQhe4ObX7w5EWF3RN77K1XwkJovQAACgYKAY8SARASFQHGX2Mi2fSgezF-cBBI8Jwj-ZHz9xoVAUF8yKrsnouuUe0e6dPzhe_e4LRX0076; __Secure-1PSID=g.a000DAlExKEsLIHH1oe2qQqnAmBDmXHudNq-stUzaYdLOgQhe4Ob76rpm9MTmovw9-5BhvA0cAACgYKAaYSARASFQHGX2MitCXC2IwwVRNI7dIv8Q-OKhoVAUF8yKri-tukCytWqxcnHo8vZCeF0076; __Secure-3PSID=g.a000DAlExKEsLIHH1oe2qQqnAmBDmXHudNq-stUzaYdLOgQhe4ObCFEZSkwEQXyAW_GvPmBo6AACgYKAf8SARASFQHGX2MiFF95OSMLEmwsqGwU9D6E1hoVAUF8yKo9zGBxfmmw3-1DQ09i0ij70076; __Secure-1PSIDTS=sidts-CjcBkldj__dAjZXGe8svt-xr3zBcsTpaiQRIiLgNG2DEuat4cfzoWjGrV-QGlV4Nn0by1INN8j8fEAA; __Secure-1PSIDRTS=sidts-CjcBkldj__dAjZXGe8svt-xr3zBcsTpaiQRIiLgNG2DEuat4cfzoWjGrV-QGlV4Nn0by1INN8j8fEAA; __Secure-3PSIDTS=sidts-CjcBkldj__dAjZXGe8svt-xr3zBcsTpaiQRIiLgNG2DEuat4cfzoWjGrV-QGlV4Nn0by1INN8j8fEAA; __Secure-3PSIDRTS=sidts-CjcBkldj__dAjZXGe8svt-xr3zBcsTpaiQRIiLgNG2DEuat4cfzoWjGrV-QGlV4Nn0by1INN8j8fEAA; SIDCC=AKEyXzU8-qwVBHuNWmCdpqE4oYOnt_reeQXo8FHkR7A2iN2CHsa5HH5wllA1yQTYVmUXOP81; __Secure-1PSIDCC=AKEyXzV0v08OjPZxUVkucpol1yaaLvuuw57qG0nq0dha2U0mFLnLVDFCU2V2rkbXm48mD_fRQg; __Secure-3PSIDCC=AKEyXzXcKZ_g7sDatjfkiOzFMZkPrDBpLWmGyeZqr0eSRsqA5h9vxy0zOvP_dVdDH3f_t_S9`;

async function testUpload() {
  const client = new GeminiWebClient(USER_COOKIES);
  await client.initSession();

  const sampleImagePath = path.join(__dirname, '../media-cache/frames_test_1789626545078/frame_001.jpg');
  const imageBuffer = fs.readFileSync(sampleImagePath);
  const sapisidHash = client.getSapisidHash('https://gemini.google.com');

  const feedNames = [
    'bard_storage',
    'bard',
    'bard_attachment',
    'bard_user_upload',
    'assistant',
    'content_push',
    'social',
  ];

  for (const fn of feedNames) {
    console.log(`\nTesting feed name: ${fn}...`);
    const uploadOptions = {
      hostname: 'content-push.googleapis.com',
      path: '/upload/',
      method: 'POST',
      headers: {
        'Push-Type': 'file',
        'X-Goog-Upload-Header-Feed-Name': fn,
        'X-Goog-Upload-Header-Client-Id': fn,
        'x-goog-upload-header-feed-name': fn,
        'x-goog-upload-command': 'start',
        'x-goog-upload-header-content-length': imageBuffer.length.toString(),
        'x-goog-upload-header-content-type': 'image/jpeg',
        'x-goog-upload-protocol': 'resumable',
        'Authorization': `SAPISIDHASH ${sapisidHash}`,
        'Cookie': client.cookies,
        'Origin': 'https://gemini.google.com',
        'Referer': 'https://gemini.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      }
    };

    const res = await new Promise((resolve, reject) => {
      const req = https.request(uploadOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`Status: ${res.status}`);
    console.log(`Upload URL header:`, res.headers['x-goog-upload-url']);
    console.log(`Body:`, res.body.slice(0, 200));

    if (res.headers['x-goog-upload-url']) {
      console.log('🎉 FOUND WORKING UPLOAD URL FOR FEED:', fn);
      const uploadUrl = res.headers['x-goog-upload-url'];
      const parsed = new URL(uploadUrl);
      const sendRes = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'x-goog-upload-command': 'upload, finalize',
            'x-goog-upload-offset': '0',
            'Content-Length': imageBuffer.length.toString(),
            'Authorization': `SAPISIDHASH ${sapisidHash}`,
            'Cookie': client.cookies,
            'Origin': 'https://gemini.google.com',
            'Referer': 'https://gemini.google.com/',
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        req.write(imageBuffer);
        req.end();
      });

      console.log('Upload Result Status:', sendRes.status);
      console.log('Upload Result Body:', sendRes.body);
      break;
    }
  }
}

testUpload().catch(console.error);
