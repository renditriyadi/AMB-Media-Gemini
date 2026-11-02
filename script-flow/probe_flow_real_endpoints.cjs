const https = require('https');
const crypto = require('crypto');

const cookies = 'SEARCH_SAMESITE=CgQI0aEB; HSID=Aw3IxTIswhLZrpaJa; SSID=AwQrivB191uch6Faa; APISID=8WQzartv7ni6ZefU/A2r-vxRN5XtMDsvM3; SAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; __Secure-1PAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; __Secure-3PAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; AEC=Aaa9EJpg845glN9fIgdVntvfzLBgZ_jkPmHUG9ryC7N_Hln2Xi6M1JrsW_s; SID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-HBRnMdrTWoBfBEEOjUDbHwACgYKAa8SARMSFQHGX2MiiYpLrUFwTCMmvx14u_DHeBoVAUF8yKpdm45Eptp4LBC1B-Akj6t90076; __Secure-1PSID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-i6qse_RKLFyT8GbpX8goAAACgYKAYkSARMSFQHGX2Mi9-0r83ynu1cXKd1ur4qFYRoVAUF8yKpAC8Okn8mpM_EAKgyZVIuw0076; __Secure-3PSID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-nRJL9dSBqhoEWxMTkShobQACgYKAXESARMSFQHGX2MiZkKpb0gG4OnPyYn3l6zi2BoVAUF8yKqIXCrLJsuVpuOlNubGeX3-0076; NID=CtsCCAESjQIBOxGDSOp2EmJTOShrvPTSDiGGH7H_t_1zXDY7ehw2hmv1oy8j4tmMRqR-z0p1-lLJf7yGoIdJqC909cNv69443mz7NVrDtRpxtaJezBks6srwcRPIRzHLUca_EOrtMgm0XyC4st7MM_7PIQXZzQibb8kVgbXjOVaquRueM-zAGoIuCy8z8IWGcHqvNe0R2ER_UREayD_EJ7ENra3ttM3Z6TGJYUdVhaYQvOF3bxCfLKwCqAE2kQLoZoOq9yyRoqEQYP8Zf0kSKh3snNg91p0UmtfNUp-RLQiQ1vK1Mhu6bJWL_PgCPgQAW-QeTUjlJeumkTiCWmxEwYqaaNTOXrZj_1U1hf5vQBZr3UGJKygBMkUB0qwHzz9Ymnqgz0LaLFUWbcmrMfDJS3WxA8dNqEUjsvKJRAxCPbM065fXUQwE2TME_SoCH-HluEl1g3ftUEnEV1GEygw; __Secure-1PSIDTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; __Secure-1PSIDRTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; __Secure-3PSIDTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; __Secure-3PSIDRTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; SIDCC=AKEyXzUfcX7-4m6q_LbSV9l6CKX5PkIaLixIdGNVfxrIsN2AN-hZY022emlWERnf3ixEeMfm-Q; __Secure-1PSIDCC=AKEyXzWERG-Xig5Up7EpUSY-OvCAzRO7xpP_o9cTXK28EfpGbEvdKW-T2-7KKdKatM3-ospXtR8; __Secure-3PSIDCC=AKEyXzUEvPeQg7YlyN7P739XnZ_v40kxmUoBJUJ0XreF7MI5AdFd0sRD5BZRS6wDDrYJOfL_cI4';
const authorization = 'SAPISIDHASH 1792238963_178c478da5972b8cf86d52dff030321745169d4d SAPISID1PHASH 1792238963_178c478da5972b8cf86d52dff030321745169d4d SAPISID3PHASH 1792238963_178c478da5972b8cf86d52dff030321745169d4d';
const apiKey = 'AIzaSyCbsbvGCe7C9mCtdaTycZB2eUFuzsYKG_E';

function request(url, options = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookies,
        'Authorization': authorization,
        'Origin': 'https://flow.google.com',
        'Referer': 'https://flow.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'x-goog-api-key': apiKey,
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => {
        if (data.length < 50000) data += c;
      });
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function probe() {
  console.log('Testing potential Google Flow API endpoints...\n');

  const targets = [
    // 1. Google Flow UI batchexecute
    {
      url: 'https://flow.google.com/_/FlowUi/data/batchexecute?rpcids=wHw6Vb&rt=c',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'f.req=' + encodeURIComponent('[[["wHw6Vb","[]",null,"generic"]]]')
    },
    // 2. aisandbox-pa
    {
      url: 'https://aisandbox-pa.clients6.google.com/v1:getProject',
      method: 'GET',
    },
    {
      url: 'https://aisandbox-pa.clients6.google.com/v1:getUser',
      method: 'GET',
    },
    {
      url: 'https://aisandbox-pa.clients6.google.com/v1:getCredits',
      method: 'GET',
    },
    // 3. labs.google fx
    {
      url: 'https://labs.google/fx/api/credits',
      method: 'GET',
    },
    {
      url: 'https://labs.google/fx/api/user',
      method: 'GET',
    },
    // 4. OneGoogle AsyncDataService with different query
    {
      url: 'https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData',
      method: 'POST',
      headers: { 'Content-Type': 'application/json+protobuf' },
      body: JSON.stringify([749,"https://flow.google.com/",749,"id","co.id",1,null,0,0,"","",1,0,null,96797242,[[1,9,13],0,1,0],[1],null,0,1,"CAMSBhUDtu_1NQ==",{"1001":1}])
    }
  ];

  for (const t of targets) {
    console.log(`Checking ${t.method || 'GET'} ${t.url} ...`);
    const res = await request(t.url, t);
    console.log(`-> Status: ${res.status || res.error}`);
    if (res.data) {
      console.log(`-> Preview: ${res.data.slice(0, 200).replace(/\n/g, ' ')}\n`);
    } else {
      console.log('\n');
    }
  }
}

probe();
