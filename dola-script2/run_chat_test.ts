// dola-script2/run_chat_test.ts
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
    return { name: trimmed.slice(0, eqIdx).trim(), value: trimmed.slice(eqIdx + 1).trim(), domain: '.dola.com', path: '/' };
  }).filter(Boolean) as any[];
}

const promptText = process.argv[2] || "Halo Dola! Sebutkan 3 tanaman hias indoor paling mudah dirawat untuk pemula?";

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 [Dola Playwright Test] Mengirim Chat ke Dola`);
  console.log(`💬 Prompt: "${promptText}"`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveLocalPlaywrightExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 850 }
  });

  await context.addCookies(parseCookies(rawCookieString));
  const page = await context.newPage();

  console.log("Navigasi ke https://www.dola.com/chat/38418213060839185 ...");
  await page.goto('https://www.dola.com/chat/38418213060839185', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // Ambil screenshot sebelum kirim
  await page.screenshot({ path: path.join(scriptDir, 'step1_before_send.png') });

  // Tekan Escape dulu untuk menutup dialog/overlay jika ada
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Gunakan page.evaluate untuk langsung mengisi dan mengaktifkan input
  console.log("Fokus ke input editor...");
  const focused = await page.evaluate((text) => {
    const editor = document.querySelector('.ProseMirror, [contenteditable="true"]');
    if (editor) {
      (editor as HTMLElement).focus();
      return true;
    }
    const txt = document.querySelector('textarea');
    if (txt) {
      txt.focus();
      return true;
    }
    return false;
  }, promptText);

  console.log(`Status editor focus: ${focused}`);

  // Ketik pesan
  console.log(`Mengetikkan teks pesan...`);
  await page.keyboard.type(promptText, { delay: 15 });
  await page.waitForTimeout(800);

  // Ambil screenshot saat teks terisi
  await page.screenshot({ path: path.join(scriptDir, 'step2_text_typed.png') });

  // Kirim dengan menekan Enter
  console.log("Mengirim pesan (tekan Enter)...");
  await page.keyboard.press('Enter');

  // Dan klik tombol kirim jika ada
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sendBtn = btns.find(b => b.querySelector('svg') && !b.disabled && b.offsetWidth > 0 && b.offsetHeight > 0);
    if (sendBtn) {
      sendBtn.click();
    }
  });

  console.log("Pesan terkirim! Menunggu respon streaming dari Dola (15 detik)...");
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    process.stdout.write(".");
  }
  console.log("\n");

  // Ambil screenshot hasil respon
  const responseScreenshotPath = path.join(scriptDir, 'step3_response.png');
  await page.screenshot({ path: responseScreenshotPath });
  console.log(`📸 Screenshot respon tersimpan ke: ${responseScreenshotPath}`);

  // Ekstrak teks respon dari halaman
  const chatMessages = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[data-message-id], .markdown-body, .prose, .chat-message-item, [class*="message"]'));
    return all.map(el => (el as HTMLElement).innerText?.trim()).filter(t => t && t.length > 15);
  });

  const latestText = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : "";
  console.log(`\n======================================================`);
  console.log(`💬 HASIL RESPON DOLA AI:`);
  console.log(`======================================================\n`);
  console.log(latestText || "Tidak ada respon teks baru di DOM");
  console.log(`\n======================================================\n`);

  fs.writeFileSync(
    path.join(scriptDir, 'hasil_chat_terbaru.md'),
    `# Hasil Chat Terbaru ke Dola AI\n\n**Prompt:** "${promptText}"\n**Waktu:** ${new Date().toLocaleString('id-ID')}\n\n## Respon Dola:\n\n${latestText}\n`
  );

  await browser.close();
  console.log("Proses selesai!");
}

main().catch(console.error);
