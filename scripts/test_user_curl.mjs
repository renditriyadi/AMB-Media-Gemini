import https from 'https';

const url = 'https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=o30O0e&source-path=%2F&bl=boq_labs-ai-sandbox-frontend_20261016.00_p1&f.sid=5063157340503016228&hl=en&_reqid=44855&rt=c';

const cookies = `SEARCH_SAMESITE=CgQInKEB; __Secure-BUCKET=CI0E; HSID=AIUbV-QEf9OT63JfT; SSID=ApMZdh1imlNqn79S7; APISID=La9Ffudd2EOTg02Z/AyL5fr_5sCF6tq6Zc; SAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; __Secure-1PAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; __Secure-3PAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; _ga=GA1.1.1252839589.1788939145; AEC=Aaa9EJoMlF2fvp0xW7wpgLtN7ZB2bPMEk4gYnvEyT6Y8amHNSqSPeFUwhLM; NID=Cv4CCAESsAIBOxGDSEE935euQKd5CiW5HMR90T8xh0-ICiCt0Uo5_nSxL-uBT_0NlhLEOnsRKi9HphM9-h2UHq1JUWfLPPJBseoz_CoLDjdzZHXtMGD6d7h_7z_wxfG6OtpCUHDq8ZTrZ-kyOSUaCRfEr7LdjDiC52N0jxvzCMjEXpdYpNL58zaaTNdUAiBWP2vXh69tg2lDekGrZjj9Jtqn3N3mmY-zBKoCL807GAIPOY99BWPW07V_y782goFy9ZWuzsz8kj5VZundTpkhsgrIdfXl7sZoycV24gbyHxa4z-bQ4HjJgl4t5pebvseQqbcFit1U2KQ7J80qOZ5H7AkcbRqTuTU4oQRh980kJfczmBIjx22VZKvfz_ULTyxilpKd3U_mKsyCyZWKO5yAOYQjSCsbZZbhKAEyRQHSrAfP5pqtqCTbc2z7Q5lEMAFa3Zd5oHj24GS3WPhj7Y3_xyvhR2yWvEJ9ZHRvNKCRn1F7VKRnRtWIMgBwcsEyiXy9BA; SID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaKXBWcQ1bxhxrn6Zc_nfI4KwACgYKAeASARISFQHGX2Mi1ycREURM7mLv2vI8K3ivrxoVAUF8yKpVR1LdXRPbL3mrPOzs_Mz-0076; __Secure-1PSID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaKgKvVoVpqNeUyAC7vE2iibwACgYKAQ8SARISFQHGX2Mi8Tdzrc4eyrkP0iJwhSRBmBoVAUF8yKrsnXil3yAdTdTTzgA51mqS0076; __Secure-3PSID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaK8fwKV39zzykjhkmSiEMMHgACgYKAcsSARISFQHGX2MiX68mIYQaqalnXR4RkYARChoVAUF8yKo5lK2SvAxQIPQpEnQ4umkK0076; OSID=g.a000DwlDts9xxoVQiQolWj4UNLyMolxYisAn0aN7sXva6ABYol3Sxz8lXpVedQVbJMxbqYvwFQACgYKAdkSARISFQHGX2MiL_szMpDKmSSNqNXmG4t1BBoVAUF8yKpTXSxWe2oZnEDbQcCsCZc20076; __Secure-OSID=g.a000DwlDts9xxoVQiQolWj4UNLyMolxYisAn0aN7sXva6ABYol3SRtQ-G1To4KdTSn_PgQMBMwACgYKAeISARISFQHGX2MiY0oPw6_XaAQRh5f4n29-RxoVAUF8yKp6DhuYxX9tm89hRDfVM5Ok0076; __Secure-1PSIDTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-1PSIDRTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-3PSIDTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-3PSIDRTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; SIDCC=AKEyXzUrM5hohuj54byAsdSmSsT5ePIasOXJVlsRleGvOf-ZwoQWQMFmf4vL-lafXkWpse2V_EU; __Secure-1PSIDCC=AKEyXzWiSWZTIno_PrKk3GauLtV8_owX5KPk9rUAP33FbYdohTu6f7dR7tHddGvasO1mHv-4vA; __Secure-3PSIDCC=AKEyXzVeldaoOCWRScvvadZoXpyk_g2vCCkwb9uIF16l3AQ3ZodDQG-h63kjAl5wgF8OBBAzCdQ; _ga_X2GNH8R5NS=GS2.1.s1792299558$o10$g1$t1792301254$j60$l0$h2087178828`;

const postBody = 'f.req=%5B%5B%5B%22o30O0e%22%2C%22%5B%5B%5C%22me%5C%22%5D%2C%5B%5B%5B%5C%22person.photo%5C%22%2C%5C%22person.name%5C%22%2C%5C%22person.email%5C%22%2C%5C%22person.metadata%5C%22%5D%5D%2Cnull%2C%5B1%2C7%2C10%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=AFfZSpjq9rdNMPnf7RO3Sf6wB5LZ%3A1792301252106&';

const atToken = 'AFfZSpjq9rdNMPnf7RO3Sf6wB5LZ:1792301252106';

function doRequest(postData, rpcId = 'o30O0e') {
  return new Promise((resolve) => {
    const path = `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${rpcId}&source-path=%2F&bl=boq_labs-ai-sandbox-frontend_20261016.00_p1&f.sid=5063157340503016228&hl=en&_reqid=44855&rt=c`;
    const req = https.request(
      {
        hostname: 'flow.google.com',
        path,
        method: 'POST',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9,id;q=0.8',
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'cookie': cookies,
          'origin': 'https://flow.google.com',
          'referer': 'https://flow.google.com/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
          'x-same-domain': '1',
          'content-length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: b });
        });
      }
    );
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('1. Testing o30O0e with exact user cURL...');
  const res1 = await doRequest(postBody, 'o30O0e');
  console.log('Status:', res1.status);
  console.log('Body:', res1.body?.slice(0, 800));

  console.log('\n2. Testing nzlxg (credits check)...');
  const nzlxgBody = `f.req=%5B%5B%5B%22nzlxg%22%2C%22%5B%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${encodeURIComponent(atToken)}&`;
  const res2 = await doRequest(nzlxgBody, 'nzlxg');
  console.log('nzlxg Status:', res2.status);
  console.log('nzlxg Body:', res2.body?.slice(0, 800));
}

run();
