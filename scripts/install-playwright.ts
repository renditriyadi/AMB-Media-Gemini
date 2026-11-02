/**
 * ==============================================================================
 * Auto-Install Playwright Chromium ke Dalam Folder Project (Windows & Linux)
 * ==============================================================================
 * 📦 Browser disimpan langsung di: ./.playwright-browsers (dalam folder project)
 * 🚀 Jalankan: npx tsx scripts/install-playwright.ts
 * ==============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const projectRoot = process.cwd();
const localBrowsersDir = path.join(projectRoot, 'playwright-browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsersDir;

if (!fs.existsSync(localBrowsersDir)) {
  fs.mkdirSync(localBrowsersDir, { recursive: true });
}

try {
  const dotBrowsers = path.join(projectRoot, '.playwright-browsers');
  if (!fs.existsSync(dotBrowsers)) {
    fs.symlinkSync(localBrowsersDir, dotBrowsers);
  }
} catch (_) {}

function findLocalChromiumExecutable(): string | undefined {
  if (!fs.existsSync(localBrowsersDir)) return undefined;

  const isWin = process.platform === 'win32';
  const targetExe = isWin ? 'chrome.exe' : 'chrome';

  function searchDir(dir: string, depth = 0): string | undefined {
    if (depth > 5) return undefined;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => (b.name.includes('chromium-') ? 1 : 0) - (a.name.includes('chromium-') ? 1 : 0));
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const res = searchDir(fullPath, depth + 1);
          if (res) return res;
        } else if (entry.name.toLowerCase() === targetExe.toLowerCase()) {
          return fullPath;
        }
      }
    } catch (_) {}
    return undefined;
  }

  return searchDir(localBrowsersDir);
}

async function run() {
  console.log('\n======================================================================');
  console.log('🚀 MENGINSTALL PLAYWRIGHT CHROMIUM KE FOLDER PROJECT...');
  console.log(`📁 Lokasi Penyimpanan: ${localBrowsersDir}`);
  console.log('======================================================================\n');

  try {
    const installCmd = 'npx playwright install --force chromium chromium-headless-shell';

    console.log(`⏳ Menjalankan: ${installCmd}...`);
    execSync(installCmd, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: localBrowsersDir,
        DEBIAN_FRONTEND: 'noninteractive',
      },
    });

    console.log('\n✨ Memverifikasi instalasi Chromium dari folder lokal...');
    const localExe = findLocalChromiumExecutable();
    if (localExe) {
      console.log(`📦 Terdeteksi binary: ${localExe}`);
    }

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      executablePath: localExe || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('✅ Verifikasi Sukses! Browser Chromium siap digunakan langsung dari folder ./.playwright-browsers');
    await browser.close();

    console.log('\n======================================================================');
    console.log('🎉 PLAYWRIGHT CHROMIUM BERHASIL TERPASANG DI FOLDER PROJECT!');
    console.log('👉 Lokasi: ./.playwright-browsers (siap dipindahkan/di-copy bersama project)');
    console.log('======================================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Terjadi kesalahan saat menginstall Playwright:', error.message);
    process.exit(1);
  }
}

run();
