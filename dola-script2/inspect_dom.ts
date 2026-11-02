import { chromium } from 'playwright';
import { resolveLocalPlaywrightExecutable } from '../server/initPlaywright';

const rawCookieString = `hook_slardar_session_id=202610201913337970F675FAF47207C5D0; i18next=en; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; flow_user_country=ID; s_v_web_id=verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On; passport_csrf_token=49b72a814cbb923e3161bfc94bd6fb36; passport_csrf_token_default=49b72a814cbb923e3161bfc94bd6fb36; odin_tt=f7f11b6a0ea1790e63b07563779d80ebd27166470c05af710ed93d78a1bc3c9a52174716ced8457cb1633bc2c4b03a73ecf59f10fa3810da134affb80d9c1d8d72aa30a933eaf5604dfe349bd7d98fce; ttwid=1%7C3s4nOI48eNSbiZhNjVNh1IyXdKJfGQwtc8TMYqpfuIc%7C1792494814%7C1820c5e242c764ca552a3f5ff4314a946bacf18b57c2c4a808c2cba228b42fcd; flow_ssr_sidebar_expand=0`;

function parseCookies(str: string) {
  return str.split(';').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return null;
    return { name: trimmed.slice(0, eqIdx).trim(), value: trimmed.slice(eqIdx + 1).trim(), domain: '.dola.com', path: '/' };
  }).filter(Boolean) as any[];
}

async function inspect() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveLocalPlaywrightExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  await context.addCookies(parseCookies(rawCookieString));
  const page = await context.newPage();
  await page.goto('https://www.dola.com/chat/38418213060839185', { waitUntil: 'load', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(6000);

  const elements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all.filter(el => {
      const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '';
      const text = el.textContent || '';
      return ph.toLowerCase().includes('message') || text.includes('Message...');
    }).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder'),
      contentEditable: el.getAttribute('contenteditable'),
      role: el.getAttribute('role')
    }));
  });

  console.log("Found message elements:", JSON.stringify(elements, null, 2));
  await browser.close();
}

inspect();
