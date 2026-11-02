import '../server/initPlaywright';
import { resolveLocalPlaywrightExecutable } from '../server/initPlaywright';
import { chromium } from 'playwright';
import fs from 'fs';

const cookieString = `SEARCH_SAMESITE=CgQInKEB; __Secure-BUCKET=CI0E; HSID=AIUbV-QEf9OT63JfT; SSID=ApMZdh1imlNqn79S7; APISID=La9Ffudd2EOTg02Z/AyL5fr_5sCF6tq6Zc; SAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; __Secure-1PAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; __Secure-3PAPISID=WtK8YTVS7S8EDI-A/ADtMxyArPV1Kguvk_; _ga=GA1.1.1252839589.1788939145; AEC=Aaa9EJoMlF2fvp0xW7wpgLtN7ZB2bPMEk4gYnvEyT6Y8amHNSqSPeFUwhLM; NID=Cv4CCAESsAIBOxGDSEE935euQKd5CiW5HMR90T8xh0-ICiCt0Uo5_nSxL-uBT_0NlhLEOnsRKi9HphM9-h2UHq1JUWfLPPJBseoz_CoLDjdzZHXtMGD6d7h_7z_wxfG6OtpCUHDq8ZTrZ-kyOSUaCRfEr7LdjDiC52N0jxvzCMjEXpdYpNL58zaaTNdUAiBWP2vXh69tg2lDekGrZjj9Jtqn3N3mmY-zBKoCL807GAIPOY99BWPW07V_y782goFy9ZWuzsz8kj5VZundTpkhsgrIdfXl7sZoycV24gbyHxa4z-bQ4HjJgl4t5pebvseQqbcFit1U2KQ7J80qOZ5H7AkcbRqTuTU4oQRh980kJfczmBIjx22VZKvfz_ULTyxilpKd3U_mKsyCyZWKO5yAOYQjSCsbZZbhKAEyRQHSrAfP5pqtqCTbc2z7Q5lEMAFa3Zd5oHj24GS3WPhj7Y3_xyvhR2yWvEJ9ZHRvNKCRn1F7VKRnRtWIMgBwcsEyiXy9BA; SID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaKXBWcQ1bxhxrn6Zc_nfI4KwACgYKAeASARISFQHGX2Mi1ycREURM7mLv2vI8K3ivrxoVAUF8yKpVR1LdXRPbL3mrPOzs_Mz-0076; __Secure-1PSID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaKgKvVoVpqNeUyAC7vE2iibwACgYKAQ8SARISFQHGX2Mi8Tdzrc4eyrkP0iJwhSRBmBoVAUF8yKrsnXil3yAdTdTTzgA51mqS0076; __Secure-3PSID=g.a000DwlDtkqrpPKY_Oewvfsxarj2_UeerD-tsReccbd7Prz53zaK8fwKV39zzykjhkmSiEMMHgACgYKAcsSARISFQHGX2MiX68mIYQaqalnXR4RkYARChoVAUF8yKo5lK2SvAxQIPQenQ4umkK0076; OSID=g.a000DwlDts9xxoVQiQolWj4UNLyMolxYisAn0aN7sXva6ABYol3Sxz8lXpVedQVbJMxbqYvwFQACgYKAdkSARISFQHGX2MiL_szMpDKmSSNqNXmG4t1BBoVAUF8yKpTXSxWe2oZnEDbQcCsCZc20076; __Secure-OSID=g.a000DwlDts9xxoVQiQolWj4UNLyMolxYisAn0aN7sXva6ABYol3SRtQ-G1To4KdTSn_PgQMBMwACgYKAeISARISFQHGX2MiY0oPw6_XaAQRh5f4n29-RxoVAUF8yKp6DhuYxX9tm89hRDfVM5Ok0076; __Secure-1PSIDTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-1PSIDRTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-3PSIDTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; __Secure-3PSIDRTS=sidts-CjYBkldj_6E-kwoMZBjEPlE0lrREGbVCQl2XSgBOYzfmoWvO1oAGHSAt4rdpSVTKRleUITqGEp4QAA; SIDCC=AKEyXzUrM5hohuj54byAsdSmSsT5ePIasOXJVlsRleGvOf-ZwoQWQMFmf4vL-lafXkWpse2V_EU; __Secure-1PSIDCC=AKEyXzWiSWZTIno_PrKk3GauLtV8_owX5KPk9rUAP33FbYdohTu6f7dR7tHddGvasO1mHv-4vA; __Secure-3PSIDCC=AKEyXzVeldaoOCWRScvvadZoXpyk_g2vCCkwb9uIF16l3AQ3ZodDQG-h63kjAl5wgF8OBBAzCdQ; _ga_X2GNH8R5NS=GS2.1.s1792299558$o10$g1$t1792301254$j60$l0$h2087178828`;

function parseCookies(str: string) {
  return str.split(';').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return null;
    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    return {
      name,
      value,
      domain: '.google.com',
      path: '/',
      secure: name.startsWith('__Secure') || ['SID', 'SSID', 'SAPISID', 'APISID', 'OSID'].includes(name),
      sameSite: 'None' as const,
    };
  }).filter(Boolean) as any[];
}

async function testPlaywrightFlow() {
  console.log('🚀 Launching Chromium with user session on flow.google.com...');
  const localExe = resolveLocalPlaywrightExecutable();
  console.log('Using executable:', localExe);

  const browser = await chromium.launch({
    headless: true,
    executablePath: localExe,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const cookies = parseCookies(cookieString);
  // Also add cookies specifically for flow.google.com
  const flowCookies = cookies.map(c => ({ ...c, domain: 'flow.google.com' }));
  await context.addCookies([...cookies, ...flowCookies]);

  const page = await context.newPage();

  page.on('request', req => {
    const u = req.url();
    if (u.includes('batchexecute') || u.includes('$rpc') || u.includes('FlowService') || u.includes('VideoFxService')) {
      console.log(`[REQ] ${req.method()} ${u.slice(0, 150)}`);
      if (req.postData()) {
        console.log(`[REQ DATA] ${req.postData()?.slice(0, 300)}`);
      }
    }
  });

  page.on('response', async res => {
    const u = res.url();
    if (u.includes('batchexecute') || u.includes('$rpc')) {
      console.log(`[RESP ${res.status()}] ${u.slice(0, 150)}`);
      try {
        const text = await res.text();
        console.log(`[RESP BODY] ${text.slice(0, 400)}`);
      } catch (e) {}
    }
  });

  console.log('Navigating to https://flow.google.com/ ...');
  try {
    await page.goto('https://flow.google.com/', { waitUntil: 'networkidle', timeout: 30000 });
  } catch (err: any) {
    console.log('Goto warning/timeout:', err.message);
  }

  const currentUrl = page.url();
  console.log('Final URL:', currentUrl);
  const title = await page.title();
  console.log('Page Title:', title);

  // Take screenshot
  await page.screenshot({ path: 'scripts/flow_screenshot.png' });
  console.log('📸 Screenshot saved to scripts/flow_screenshot.png');

  // Look for text or elements
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body Text snippet:', bodyText.slice(0, 800));

  await browser.close();
}

testPlaywrightFlow().catch(console.error);
