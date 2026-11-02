// dola-script2/test_guest_flow.ts
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
  console.log(`🚀 [Dola Guest Flow Test] Auto-Close Login & Auto-Confirm Age`);
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

  console.log("Membuka https://www.dola.com/chat/38418121532524817 ...");
  await page.goto('https://www.dola.com/chat/38418121532524817', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 1. Cek & Tutup Modal Login jika muncul
  console.log("1. Memeriksa popup modal login 'Log in to unlock more features'...");
  try {
    const closeLoginBtn = page.locator('button:has(svg), [aria-label*="Close"], button.close').filter({ hasText: '' }).first();
    // Cari tombol X di dialog
    const modalX = await page.$('div[role="dialog"] button, [data-slot="dialog-content"] button');
    if (modalX) {
      console.log("   👉 Menemukan tombol close modal, klik X...");
      await modalX.click({ force: true });
      await page.waitForTimeout(1000);
    } else {
      console.log("   (Tidak ada modal login terbuka saat ini)");
    }
  } catch (e) {
    console.log("   Notice close modal:", e);
  }

  // 2. Cek & Konfirmasi Age Gate ("Confirm your age") jika muncul
  console.log("2. Memeriksa popup 'Confirm your age'...");
  try {
    const confirmBtn = page.locator('button:has-text("Confirm"), button:text-is("Confirm")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      console.log("   👉 Menemukan tombol Confirm usia 18+, klik Confirm...");
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    } else {
      console.log("   (Age gate tidak muncul / sudah terkonfirmasi)");
    }
  } catch (_) {
    console.log("   (Age gate sudah aman)");
  }

  // 3. Ketikkan Prompt ke Input
  console.log("3. Menyiapkan input chat...");
  const editorEl = page.locator('.ProseMirror, [contenteditable="true"]').first();
  await editorEl.waitFor({ state: 'visible', timeout: 10000 });
  await editorEl.click({ force: true });
  await page.waitForTimeout(300);

  console.log(`   Mengetikkan prompt: "${promptText}"...`);
  await page.keyboard.insertText(promptText);
  await page.waitForTimeout(500);

  // 4. Kirim Pesan
  console.log("4. Mengirim pesan (tekan Enter)...");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Jika tombol kirim masih ada, klik juga
  try {
    const sendBtn = page.locator('button.bg-blue-600, button[class*="blue"], button:has(svg)').last();
    if (await sendBtn.isVisible()) {
      await sendBtn.click().catch(() => {});
    }
  } catch (_) {}

  // 5. Cek lagi jika muncul Confirm your age setelah tombol kirim ditekan
  await page.waitForTimeout(1000);
  try {
    const confirmBtnAfter = page.locator('button:has-text("Confirm"), button:text-is("Confirm")').first();
    if (await confirmBtnAfter.isVisible({ timeout: 1500 })) {
      console.log("   👉 Muncul popup Confirm your age setelah enter, klik Confirm...");
      await confirmBtnAfter.click();
      await page.waitForTimeout(1000);
    }
  } catch (_) {}

  // 6. Tunggu balasan dari Dola
  console.log("5. Menunggu Dola merespons...");
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(1000);
    process.stdout.write(".");
  }
  console.log("\n");

  const screenshotPath = path.join(scriptDir, 'guest_chat_flow_result.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Screenshot tersimpan ke: ${screenshotPath}`);

  // Ekstrak pesan terbaru
  const messages = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.message-item, [data-message-id], .markdown-body, .prose'));
    return items.map(el => (el as HTMLElement).innerText?.trim()).filter(t => t && t.length > 15);
  });

  const lastBotMsg = messages.length > 0 ? messages[messages.length - 1] : "";
  console.log(`\n======================================================`);
  console.log(`💬 HASIL BALASAN DOLA:`);
  console.log(`======================================================\n`);
  console.log(lastBotMsg || "(Sedang diproses / cek screenshot)");
  console.log(`\n======================================================\n`);

  fs.writeFileSync(
    path.join(scriptDir, 'guest_chat_result.md'),
    `# Hasil Chat Guest Mode Dola\n\n**Prompt:** ${promptText}\n**Waktu:** ${new Date().toLocaleString('id-ID')}\n\n## Respon Dola:\n\n${lastBotMsg}\n`
  );

  await browser.close();
  console.log("Uji coba selesai!");
}

main().catch(console.error);
