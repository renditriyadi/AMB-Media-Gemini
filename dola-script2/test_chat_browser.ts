// dola-script2/test_chat_browser.ts
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';
import { resolveLocalPlaywrightExecutable } from '../server/initPlaywright';

const scriptDir = path.resolve(process.cwd(), 'dola-script2');

const rawCookieString = `hook_slardar_session_id=202610201913337970F675FAF47207C5D0; i18next=en; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; flow_user_country=ID; s_v_web_id=verify_mvgl45k1_Jxnx5kNN_fS1J_4T2W_99Up_jzV6wB1QR9On; passport_csrf_token=49b72a814cbb923e3161bfc94bd6fb36; passport_csrf_token_default=49b72a814cbb923e3161bfc94bd6fb36; odin_tt=f7f11b6a0ea1790e63b07563779d80ebd27166470c05af710ed93d78a1bc3c9a52174716ced8457cb1633bc2c4b03a73ecf59f10fa3810da134affb80d9c1d8d72aa30a933eaf5604dfe349bd7d98fce; ttwid=1%7C3s4nOI48eNSbiZhNjVNh1IyXdKJfGQwtc8TMYqpfuIc%7C1792494814%7C1820c5e242c764ca552a3f5ff4314a946bacf18b57c2c4a808c2cba228b42fcd; flow_ssr_sidebar_expand=0`;

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
      domain: '.dola.com',
      path: '/',
    };
  }).filter(Boolean) as any[];
}

const promptText = process.argv[2] || "Halo Dola! Sebutkan 3 tips singkat merawat tanaman di pot kecil dalam ruangan?";

async function main() {
  console.log(`\n========================================`);
  console.log(`[Dola Playwright Test] Memulai uji chat ke Dola`);
  console.log(`Prompt: "${promptText}"`);
  console.log(`========================================\n`);

  const localExe = resolveLocalPlaywrightExecutable();
  console.log(`Chromium path: ${localExe}`);

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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const cookies = parseCookies(rawCookieString);
  await context.addCookies(cookies);

  const page = await context.newPage();

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/chat/completion')) {
      console.log(`\n[Network] /chat/completion response status: ${res.status()}`);
    }
  });

  console.log("Membuka halaman chat Dola...");
  try {
    await page.goto('https://www.dola.com/chat/38418213060839185', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
  } catch (e: any) {
    console.log("Navigasi domcontentloaded:", e.message);
  }

  await page.waitForTimeout(4000);

  // Cari elemen input ProseMirror atau contenteditable
  console.log("Mendeteksi elemen input...");
  const inputInfo = await page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (editable) {
      return {
        found: true,
        tag: editable.tagName,
        className: editable.className,
        placeholder: editable.getAttribute('placeholder') || editable.getAttribute('data-placeholder'),
      };
    }
    const txt = document.querySelector('textarea');
    if (txt) {
      return { found: true, tag: 'TEXTAREA', className: txt.className, placeholder: txt.placeholder };
    }
    return { found: false };
  });

  console.log("Info input element:", inputInfo);

  // Klik dan isi input
  const inputLocator = page.locator('[contenteditable="true"]').first();
  await inputLocator.waitFor({ state: 'visible', timeout: 5000 });
  await inputLocator.click();
  await page.waitForTimeout(300);

  console.log(`Mengetik prompt: "${promptText}"...`);
  // Gunakan insertText atau type agar ProseMirror menerima input secara reaktif
  await page.keyboard.insertText(promptText);
  await page.waitForTimeout(600);

  console.log("Menekan Enter untuk mengirim...");
  await page.keyboard.press('Enter');

  // Coba juga klik tombol send arrow jika ada
  await page.waitForTimeout(500);
  try {
    const sendButton = page.locator('button:has(svg), [aria-label*="Send"], [aria-label*="send"]').last();
    if (await sendButton.isVisible()) {
      console.log("Klik tombol kirim...");
      await sendButton.click();
    }
  } catch (_) {}

  console.log("Menunggu respon dari Dola...");
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    process.stdout.write(".");
  }
  console.log("\n");

  const respondedScreenshot = path.join(scriptDir, 'dola_page_responded.png');
  await page.screenshot({ path: respondedScreenshot, fullPage: true });
  console.log("📸 Screenshot tersimpan:", respondedScreenshot);

  // Ambil semua pesan terakhir di halaman
  const messages = await page.evaluate(() => {
    // Ambil paragraf dan teks di area chat
    const items = Array.from(document.querySelectorAll('p, li, .prose, [data-message-id]'))
      .map(el => (el as HTMLElement).innerText?.trim())
      .filter(t => t && t.length > 15);
    return items;
  });

  console.log("\n=== RINGKASAN TEKS TERDETEKSI ===");
  const uniqueMessages = Array.from(new Set(messages));
  const recentTexts = uniqueMessages.slice(-6); // 6 teks terakhir
  recentTexts.forEach((t, idx) => {
    console.log(`\n[#${idx + 1}]: ${t}`);
  });

  fs.writeFileSync(
    path.join(scriptDir, 'browser_chat_result.json'),
    JSON.stringify({ prompt: promptText, recentTexts }, null, 2)
  );

  await browser.close();
  console.log("\n Uji coba chat selesai!");
}

main().catch(console.error);
