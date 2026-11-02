/**
 * ==============================================================================
 * AMB Media V3 - Automated Binary Setup (FFmpeg & Playwright Chromium)
 * ==============================================================================
 * Skrip ini memastikan FFmpeg dan Playwright Chromium terpasang dan siap digunakan:
 * 1. FFmpeg (Full Static Binary) di ./ffmpeg/ffmpeg (atau .exe di Windows)
 * 2. Playwright Chromium di ./.playwright-browsers
 *
 * Dijalankan otomatis saat 'npm run build' dan 'npm install' (postinstall)
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ensureFfmpegBinary, testFfmpegExecutable, getFfmpegPath } from './ensure-ffmpeg';

const projectRoot = process.cwd();
const localBrowsersDir = fs.existsSync(path.resolve(projectRoot, 'playwright-browsers'))
  ? path.resolve(projectRoot, 'playwright-browsers')
  : fs.existsSync(path.resolve(projectRoot, '.playwright-browsers'))
  ? path.resolve(projectRoot, '.playwright-browsers')
  : path.resolve(projectRoot, 'playwright-browsers');

function findLocalChromiumExecutable(): string | undefined {
  if (!fs.existsSync(localBrowsersDir)) return undefined;

  const isWin = process.platform === 'win32';
  const targetExe = isWin ? 'chrome.exe' : 'chrome';

  try {
    const entries = fs.readdirSync(localBrowsersDir, { withFileTypes: true });
    const chromiumDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('chromium-'))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const dir of chromiumDirs) {
      const candidateWin = path.join(localBrowsersDir, dir.name, 'chrome-win', 'chrome.exe');
      const candidateLinux = path.join(localBrowsersDir, dir.name, 'chrome-linux64', 'chrome');
      const candidate = isWin ? candidateWin : candidateLinux;
      if (fs.existsSync(candidate)) {
        if (!isWin) {
          try { fs.chmodSync(candidate, 0o755); } catch (_) {}
        }
        return candidate;
      }
    }
  } catch (_) {}

  // Recursive fallback
  function search(dir: string, depth = 0): string | undefined {
    if (depth > 5) return undefined;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const res = search(fullPath, depth + 1);
          if (res) return res;
        } else if (entry.name.toLowerCase() === targetExe.toLowerCase()) {
          if (process.platform !== 'win32') {
            try { fs.chmodSync(fullPath, 0o755); } catch (_) {}
          }
          return fullPath;
        }
      }
    } catch (_) {}
    return undefined;
  }

  return search(localBrowsersDir);
}

async function setupFFmpeg(): Promise<string> {
  console.log('\n[1/2] 🎬 Memeriksa & Mengatur FFmpeg...');
  const existingPath = getFfmpegPath();
  const existingVersion = await testFfmpegExecutable(existingPath);

  if (existingVersion) {
    console.log(`[FFmpeg] ✓ FFmpeg sudah siap: ${existingPath}`);
    console.log(`[FFmpeg] Versi: ${existingVersion}`);
    return existingPath;
  }

  console.log('[FFmpeg] Mengunduh binary FFmpeg secara otomatis...');
  const info = await ensureFfmpegBinary();
  console.log(`[FFmpeg] ✓ Berhasil diatur di: ${info.binaryPath} (${info.version})`);
  return info.binaryPath;
}

async function setupPlaywright(): Promise<string> {
  console.log('\n[2/2] 🌐 Memeriksa & Mengatur Playwright Chromium...');
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsersDir;

  if (!fs.existsSync(localBrowsersDir)) {
    fs.mkdirSync(localBrowsersDir, { recursive: true });
  }

  let localExe = findLocalChromiumExecutable();

  try {
    const dotBrowsers = path.resolve(projectRoot, '.playwright-browsers');
    if (!fs.existsSync(dotBrowsers)) {
      fs.symlinkSync(localBrowsersDir, dotBrowsers);
    }
    const dotPlaywright = path.resolve(projectRoot, '.playwright');
    if (!fs.existsSync(dotPlaywright)) {
      fs.symlinkSync(localBrowsersDir, dotPlaywright);
    }
  } catch (_) {}

  if (localExe && fs.existsSync(localExe)) {
    console.log(`[Playwright] ✓ Chromium sudah siap di: ${localExe}`);
    return localExe;
  }

  console.log('[Playwright] Mengunduh Playwright Chromium ke .playwright-browsers...');
  try {
    execSync('npx playwright install chromium chromium-headless-shell', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: localBrowsersDir,
        DEBIAN_FRONTEND: 'noninteractive',
      },
    });
  } catch (err: any) {
    console.warn('[Playwright] Peringatan saat menjalankan npx playwright install:', err?.message || err);
  }

  localExe = findLocalChromiumExecutable();
  if (localExe) {
    console.log(`[Playwright] ✓ Berhasil terpasang: ${localExe}`);
    return localExe;
  } else {
    console.warn('[Playwright] ⚠️ Binary Chromium belum ditemukan di folder lokal setelah instalasi. Playwright akan mendownload on-demand saat dibutuhkan.');
    return '';
  }
}

async function main() {
  console.log('======================================================================');
  console.log('🚀 AMB Media V3 - Verifikasi Otomatis FFmpeg & Playwright Dependencies');
  console.log('======================================================================');

  try {
    await setupFFmpeg();
  } catch (err: any) {
    console.error('❌ Gagal menyiapkan FFmpeg:', err?.message || err);
  }

  try {
    await setupPlaywright();
  } catch (err: any) {
    console.error('❌ Gagal menyiapkan Playwright:', err?.message || err);
  }

  console.log('\n======================================================================');
  console.log('🎉 Setup Binaries Selesai!');
  console.log('======================================================================\n');
}

main().catch((e) => {
  console.error('Fatal error saat setup binaries:', e);
});
