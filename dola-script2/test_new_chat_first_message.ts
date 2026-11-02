// dola-script2/test_new_chat_first_message.ts
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';
import { resolveLocalPlaywrightExecutable } from '../server/initPlaywright';

const scriptDir = path.resolve(process.cwd(), 'dola-script2');

// Cookie terbaru dari cURL user
const rawCookieString = `i18next=en; flow_user_country=ID; odin_tt=637c9af402ce896ab2b4426362ea58c0bcc1089b981b5d6fa6ea043f2392a3952b55db00540fa22709f640c4f38ca8592f2972dbf429ead063ea2b77e174da20; sid_guard=73ef52f81963c753108886878048904e%7C1784896550%7C5184000%7CTue%2C+22-Sep-2026+12%3A35%3A50+GMT; store-idc=mya; store-country-code=id; store-country-code-src=uid; msToken=t7_iu94SXz-lkD1hZPum1fa6nkVcaN8U-GN_BaKfoq6zOY2l4w7sQCA0kp45WXyoQ6xcX2avW_uKwgiVYo3N1da3CTerQi0JQfzMsND5pRcj5yC6itbxuA==; dbx-web-theme=light; conversation_list_v2_group_mode=none; flow_cur_user_sec_id=; s_v_web_id=verify_mvgmct75_PPk8X8Eb_egEc_4FmS_99E7_FIte5jnRgTpC; passport_csrf_token=3a32a9fc2e0fa689b592352d25585c2c; passport_csrf_token_default=3a32a9fc2e0fa689b592352d25585c2c; ttwid=1%7CEAgkhtRSL7oT34ZKBpMiGIeIKVteXDmXL7dgQbQbgvM%7C1792496926%7C8acf44868c8eee950f842526a46bcbd80322a9cc746d754359b7591d0492b6c8`;

function parseCookies(str: string) {
  return str.split(';').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return null;
    return { name: trimmed.slice(0, eqIdx).trim(), value: trimmed.slice(eqIdx + 1).trim(), domain: '.dola.com', path: '/' };
  }).filter(Boolean) as any[];
}

const promptText = process.argv[2] || "Coba buatkan resep nasi goreng kampung spesial yang gurih dan mudah dibuat";

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 [Dola New Chat Test] Membuka Chat Baru & Konfirmasi Age Gate`);
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

  console.log("Navigasi ke https://www.dola.com/chat/ (New Chat)...");
  await page.goto('https://www.dola.com/chat/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Jika muncul modal login, klik tombol X
  const closeLoginBtn = await page.$('div[role="dialog"] button, [data-slot="dialog-content"] button, button:has(svg.lucide-x)');
  if (closeLoginBtn) {
    console.log("Menutup modal login awal dengan klik X...");
    await closeLoginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }

  // Fokus ke input editor
  console.log("Fokus dan ketikkan prompt di New Chat...");
  const editorEl = page.locator('.ProseMirror, [contenteditable="true"]').first();
  await editorEl.waitFor({ state: 'visible', timeout: 10000 });
  await editorEl.click({ force: true });
  await page.waitForTimeout(300);

  await page.keyboard.insertText(promptText);
  await page.waitForTimeout(500);

  console.log("Mengirim pesan...");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Cek apakah popup Confirm your age muncul
  console.log("Mengecek popup 'Confirm your age'...");
  const confirmBtn = page.locator('button:has-text("Confirm"), button:text-is("Confirm")').first();
  if (await confirmBtn.isVisible({ timeout: 4000 })) {
    console.log("👉 Popup 'Confirm your age' terdeteksi! Mengklik tombol Confirm...");
    await confirmBtn.click();
    console.log("Tombol Confirm berhasil diklik!");
  } else {
    console.log("Popup confirm age tidak muncul (sudah pass)");
  }

  console.log("Menunggu respon balasan dari Dola (15 detik)...");
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    process.stdout.write(".");
  }
  console.log("\n");

  const finalUrl = page.url();
  console.log("URL Chat Sekarang:", finalUrl);

  const screenshotPath = path.join(scriptDir, 'new_chat_result.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Screenshot tersimpan: ${screenshotPath}`);

  // Ekstrak pesan yang ada di layar
  const messages = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.message-item, [data-message-id], .markdown-body, .prose'));
    return items.map(el => (el as HTMLElement).innerText?.trim()).filter(t => t && t.length > 20);
  });

  console.log(`\n======================================================`);
  console.log(`💬 HASIL BALASAN CHAT BARU DOLA:`);
  console.log(`======================================================\n`);
  if (messages.length > 0) {
    console.log(messages[messages.length - 1]);
  } else {
    console.log("Tidak ada teks terdeteksi di selector standar, cek screenshot.");
  }
  console.log(`\n======================================================\n`);

  fs.writeFileSync(
    path.join(scriptDir, 'hasil_new_chat.md'),
    `# Hasil Chat Baru Dola AI\n\n**Prompt:** ${promptText}\n**URL Chat:** ${finalUrl}\n\n## Respon Dola:\n\n${messages[messages.length - 1] || 'Lihat screenshot'}\n`
  );

  await browser.close();
  console.log("Selesai!");
}

main().catch(console.error);
