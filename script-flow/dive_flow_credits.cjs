const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const rawCookies = 'SEARCH_SAMESITE=CgQI0aEB; HSID=Aw3IxTIswhLZrpaJa; SSID=AwQrivB191uch6Faa; APISID=8WQzartv7ni6ZefU/A2r-vxRN5XtMDsvM3; SAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; __Secure-1PAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; __Secure-3PAPISID=CwA-Lmfzan1Fk7C5/ACWiAWICk689nxO0r; AEC=Aaa9EJpg845glN9fIgdVntvfzLBgZ_jkPmHUG9ryC7N_Hln2Xi6M1JrsW_s; SID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-HBRnMdrTWoBfBEEOjUDbHwACgYKAa8SARMSFQHGX2MiiYpLrUFwTCMmvx14u_DHeBoVAUF8yKpdm45Eptp4LBC1B-Akj6t90076; __Secure-1PSID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-i6qse_RKLFyT8GbpX8goAAACgYKAYkSARMSFQHGX2Mi9-0r83ynu1cXKd1ur4qFYRoVAUF8yKpAC8Okn8mpM_EAKgyZVIuw0076; __Secure-3PSID=g.a000Dgm-eKbebGD8Li2LF4POg12InqTY4c14AA4mDsfKOnqGEhR-nRJL9dSBqhoEWxMTkShobQACgYKAXESARMSFQHGX2MiZkKpb0gG4OnPyYn3l6zi2BoVAUF8yKqIXCrLJsuVpuOlNubGeX3-0076; NID=CtsCCAESjQIBOxGDSOp2EmJTOShrvPTSDiGGH7H_t_1zXDY7ehw2hmv1oy8j4tmMRqR-z0p1-lLJf7yGoIdJqC909cNv69443mz7NVrDtRpxtaJezBks6srwcRPIRzHLUca_EOrtMgm0XyC4st7MM_7PIQXZzQibb8kVgbXjOVaquRueM-zAGoIuCy8z8IWGcHqvNe0R2ER_UREayD_EJ7ENra3ttM3Z6TGJYUdVhaYQvOF3bxCfLKwCqAE2kQLoZoOq9yyRoqEQYP8Zf0kSKh3snNg91p0UmtfNUp-RLQiQ1vK1Mhu6bJWL_PgCPgQAW-QeTUjlJeumkTiCWmxEwYqaaNTOXrZj_1U1hf5vQBZr3UGJKygBMkUB0qwHzz9Ymnqgz0LaLFUWbcmrMfDJS3WxA8dNqEUjsvKJRAxCPbM065fXUQwE2TME_SoCH-HluEl1g3ftUEnEV1GEygw; __Secure-1PSIDTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; __Secure-1PSIDRTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; __Secure-3PSIDTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; __Secure-3PSIDRTS=sidts-CjcBkldj_0b-aqZWNLtHfqBbBT0-4u-OXq9nqUNY3t-SNhwcGrNUmKPBfGgTDvkilleDJmZAgbL5EAA; SIDCC=AKEyXzUfcX7-4m6q_LbSV9l6CKX5PkIaLixIdGNVfxrIsN2AN-hZY022emlWERnf3ixEeMfm-Q; __Secure-1PSIDCC=AKEyXzWERG-Xig5Up7EpUSY-OvCAzRO7xpP_o9cTXK28EfpGbEvdKW-T2-7KKdKatM3-ospXtR8; __Secure-3PSIDCC=AKEyXzUEvPeQg7YlyN7P739XnZ_v40kxmUoBJUJ0XreF7MI5AdFd0sRD5BZRS6wDDrYJOfL_cI4';

function parseCookieString(str) {
  return str.split(';').map(item => {
    const parts = item.trim().split('=');
    const name = parts[0]?.trim();
    const value = parts.slice(1).join('=').trim();
    if (!name) return null;
    return {
      name,
      value,
      domain: '.google.com',
      path: '/',
      secure: true,
      httpOnly: name.startsWith('__Secure') || name === 'SID' || name === 'HSID' || name === 'SSID',
      sameSite: 'None',
    };
  }).filter(Boolean);
}

async function diveFlow() {
  const chromePath = path.resolve(process.cwd(), '.playwright-browsers', 'chromium-1243', 'chrome-linux64', 'chrome');
  console.log('Using Chrome executable:', chromePath);

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const cookieList = parseCookieString(rawCookies);
  await context.addCookies(cookieList);
  // Also add for flow.google.com domain
  const flowCookies = cookieList.map(c => ({ ...c, domain: 'flow.google.com' }));
  await context.addCookies(flowCookies);

  const page = await context.newPage();

  const detectedEndpoints = [];

  // Listen to all network requests & responses
  page.on('response', async (res) => {
    const resUrl = res.url();
    const status = res.status();
    const method = res.request().method();

    // Check interesting URLs
    const isInteresting = 
      resUrl.includes('flow') || 
      resUrl.includes('credit') || 
      resUrl.includes('quota') || 
      resUrl.includes('balance') || 
      resUrl.includes('account') || 
      resUrl.includes('user') || 
      resUrl.includes('tier') || 
      resUrl.includes('aisandbox') || 
      resUrl.includes('asyncdata') || 
      resUrl.includes('rpc') || 
      resUrl.includes('clients6') ||
      resUrl.includes('batch');

    if (isInteresting) {
      let bodySnippet = '';
      try {
        const text = await res.text();
        bodySnippet = text.slice(0, 400);
        detectedEndpoints.push({
          url: resUrl,
          method,
          status,
          headers: res.headers(),
          reqHeaders: res.request().headers(),
          postData: res.request().postData(),
          body: text
        });
      } catch (e) {
        // stream or binary
        detectedEndpoints.push({
          url: resUrl,
          method,
          status,
          reqHeaders: res.request().headers(),
          postData: res.request().postData(),
          bodySnippet: '[binary or unavailable]'
        });
      }
    }
  });

  console.log('Navigating to https://flow.google.com/ ...');
  try {
    await page.goto('https://flow.google.com/', { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log('Navigation finished with note:', e.message);
  }

  // Sleep additional 5 seconds to let async calls finish
  await page.waitForTimeout(5000);

  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log('Current URL:', currentUrl);
  console.log('Page Title:', pageTitle);

  // Search DOM text for credits, quota, account email
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  console.log('Page Text Sample (first 1000 chars):');
  console.log(bodyText.slice(0, 1000));

  // Find all elements mentioning credit, sisa, token, veo, tier
  const matchedElements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const results = [];
    for (const el of all) {
      const text = el.innerText?.trim();
      if (text && (
        text.toLowerCase().includes('credit') ||
        text.toLowerCase().includes('credits') ||
        text.toLowerCase().includes('quota') ||
        text.toLowerCase().includes('balance') ||
        text.toLowerCase().includes('kredit') ||
        text.toLowerCase().includes('left') ||
        text.toLowerCase().includes('remaining') ||
        text.toLowerCase().includes('generation') ||
        text.toLowerCase().includes('veo')
      )) {
        if (text.length < 150) {
          results.push({ tag: el.tagName, class: el.className, text });
        }
      }
    }
    return results;
  });

  console.log('\n--- MATCHED DOM ELEMENTS ---');
  console.log(matchedElements.slice(0, 20));

  console.log('\n--- DETECTED ENDPOINTS ---');
  for (const ep of detectedEndpoints) {
    console.log(`\n[${ep.method}] ${ep.status} ${ep.url}`);
    if (ep.postData) console.log('  Payload:', ep.postData.slice(0, 200));
    if (ep.body) {
      console.log('  Body:', ep.body.slice(0, 300));
    }
  }

  // Dump full endpoints report
  fs.writeFileSync('script-flow/detected_flow_endpoints.json', JSON.stringify(detectedEndpoints, null, 2));
  console.log('\nWrote full detected endpoints to script-flow/detected_flow_endpoints.json');

  await browser.close();
}

diveFlow().catch(console.error);
