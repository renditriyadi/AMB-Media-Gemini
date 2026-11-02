import https from 'https';
import fs from 'fs';

const cookies = `SEARCH_SAMESITE=CgQInKEB; __Secure-BUCKET=CI0E; HSID=AIUbV-QEf9OT63JfT; SSID=ApMZdh1imlNqn79S7; APISID=La9Ffudd2EOTg02Z/AyL5fr_5sCF6tq6Zc; SAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; __Secure-1PAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; __Secure-3PAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; _ga=GA1.1.1252839589.1788939145; AEC=Aaa9EJoMlF2fvp0xW7wpgLtN7ZB2bPMEk4gYnvEyT6Y8amHNSqSPeFUwhLM; NID=Cv4CCAESsAIBOxGDSEE935euQKd5CiW5HMR90T8xh0-ICiCt0Uo5_nSxL-uBT_0NlhLEOnsRKi9HphM9-h2UHq1JUWfLPPJBseoz_CoLDjdzZHXtMGD6d7h_7z_wxfG6OtpCUHDq8ZTrZ-kyOSUaCRfEr7LdjDiC52N0jxvzCMjEXpdYpNL58zaaTNdUAiBWP2vXh69tg2lDekGrZjj9Jtqn3N3mmY-zBKoCL807GAIPOY99BWPW07V_y782goFy9ZWuzsz8kj5VZundTpkhsgrIdfXl7sZoycV24gbyHxa4z-bQ4HjJgl4t5pebvseQqbcFit1U2KQ7J80qOZ5H7AkcbRqTuTU4oQRh980kJfczmBIjx22VZKvfz_ULTyxilpKd3U_mKsyCyZWKO5yAOYQjSCsbZZbhKAEyRQHSrAfP5pqtqCTbc2z7Q5lEMAFa3Zd5oHj24GS3WPhj7Y3_xyvhR2yWvEJ9ZHRvNKCRn1F7VKRnRtWIMgBwcsEyiXy9BA; SID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaKXBWcQ1bxhxrn6Zc_nfI4KwACgYKAeASARISFQHGX2Mi1ycREURM7mLv2vI8K3ivrxoVAUF8yKpVR1LdXRPbL3mrPOzs_Mz-0076; __Secure-1PSID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaKgKvVoVpqNeUyAC7vE2iibwACgYKAQ8SARISFQHGX2Mi8Tdzrc4eyrkP0iJwhSRBmBoVAUF8yKrsnXil3yAdTdTTzgA51mqS0076; __Secure-3PSID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaK8fwKV39zzykjhkmSiEMMHgACgYKAcsSARISFQHGX2MiX68mIYQaqalnXR4RkYARChoVAUF8yKo5lK2SvAxQIPQenQ4umkK0076; OSID=g.a000DwlDts9xxoVQiQolWj4UNLyMolxYisAn0aN7sXva6ABYol3Sxz8lXpVedQVbJMxbqYvwFQACgYKAdkSARISFQHGX2MiL_szMpDKmSSNqNXmG4t1BBoVAUF8yKpTXSxWe2oZnEDbQcCsCZc20076; __Secure-OSID=g.a000DwlDts9xxoVQiQolWj4UNLyMolxYisAn0aN7sXva6ABYol3SRtQ-G1To4KdTSn_PgQMBMwACgYKAeISARISFQHGX2MiY0oPw6_XaAQRh5f4n29-RxoVAUF8yKp6DhuYxX9tm89hRDfVM5Ok0076; __Secure-1PSIDTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-1PSIDRTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-3PSIDTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-3PSIDRTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; SIDCC=AKEyXzUrM5hohuj54byAsdSmSsT5ePIasOXJVlsRleGvOf-ZwoQWQMFmf4vL-lafXkWpse2V_EU; __Secure-1PSIDCC=AKEyXzWiSWZTIno_PrKk3GauLtV8_owX5KPk9rUAP33FbYdohTu6f7dR7tHddGvasO1mHv-4vA; __Secure-3PSIDCC=AKEyXzVeldaoOCWRScvvadZoXpyk_g2vCCkwb9uIF16l3AQ3ZodDQG-h63kjAl5wgF8OBBAzCdQ; _ga_X2GNH8R5NS=GS2.1.s1792299558$o10$g1$t1792301254$j60$l0$h2087178828`;

function fetchHtml() {
  return new Promise((resolve) => {
    https.get({
      hostname: 'flow.google.com',
      path: '/',
      headers: {
        'cookie': cookies,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function start() {
  const res = await fetchHtml();
  console.log('Status:', res.status);
  if (res.headers && res.headers.location) {
    console.log('Redirect Location:', res.headers.location);
  }
  if (res.body) {
    console.log('Body length:', res.body.length);
    fs.writeFileSync('scripts/flow_index.html', res.body);
    // Find script tags
    const scripts = [...res.body.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
    console.log('Found scripts:', scripts);
    // Find AF_dataServiceRequests or WIZ_global_data
    const wizMatch = res.body.match(/window\.WIZ_global_data\s*=\s*(\{.+?\});/);
    if (wizMatch) {
      console.log('WIZ_global_data found!');
    }
  }
}

start();
