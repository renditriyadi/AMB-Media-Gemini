import path from 'path';
import fs from 'fs';

// Force PLAYWRIGHT_BROWSERS_PATH to project root playwright-browsers folder (or .playwright-browsers)
const projectRoot = process.cwd();
const localBrowsersDir = fs.existsSync(path.resolve(projectRoot, 'playwright-browsers'))
  ? path.resolve(projectRoot, 'playwright-browsers')
  : path.resolve(projectRoot, '.playwright-browsers');

process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsersDir;

/**
 * Cari file binary chrome/chrome.exe di dalam folder .playwright-browsers di root project
 */
export function resolveLocalPlaywrightExecutable(): string | undefined {
  if (!fs.existsSync(localBrowsersDir)) return undefined;

  const isWin = process.platform === 'win32';
  const targetExe = isWin ? 'chrome.exe' : 'chrome';

  // 1. Cek folder chromium-* dinamis langsung di root .playwright-browsers
  try {
    const entries = fs.readdirSync(localBrowsersDir, { withFileTypes: true });
    const chromiumDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('chromium-'))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const cDir of chromiumDirs) {
      const winCandidates = [
        path.join(localBrowsersDir, cDir.name, 'chrome-win64', 'chrome.exe'),
        path.join(localBrowsersDir, cDir.name, 'chrome-win', 'chrome.exe'),
      ];
      const linuxCandidates = [
        path.join(localBrowsersDir, cDir.name, 'chrome-linux64', 'chrome'),
        path.join(localBrowsersDir, cDir.name, 'chrome-linux', 'chrome'),
      ];
      const candidates = isWin ? winCandidates : linuxCandidates;
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            if (!isWin) fs.chmodSync(candidate, 0o755);
          } catch (_) {}
          return candidate;
        }
      }
    }

    // 2. Cek jalur Chromium Headless Shell jika standar tidak ada
    const headlessDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('chromium_headless_shell-'))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const hDir of headlessDirs) {
      const hWin = path.join(localBrowsersDir, hDir.name, 'chrome-headless-shell-win', 'chrome-headless-shell.exe');
      const hLinux = path.join(localBrowsersDir, hDir.name, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      const hCandidate = isWin ? hWin : hLinux;
      if (fs.existsSync(hCandidate)) {
        try {
          if (!isWin) fs.chmodSync(hCandidate, 0o755);
        } catch (_) {}
        return hCandidate;
      }
    }
  } catch (_) {}

  // 3. Scan rekursif direktori .playwright-browsers jika folder berstruktur berbeda
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
        } else if (
          entry.name.toLowerCase() === targetExe.toLowerCase() ||
          entry.name.toLowerCase() === (isWin ? 'chrome-headless-shell.exe' : 'chrome-headless-shell')
        ) {
          try {
            if (!isWin) fs.chmodSync(fullPath, 0o755);
          } catch (_) {}
          return fullPath;
        }
      }
    } catch (_) {}
    return undefined;
  }

  return searchDir(localBrowsersDir);
}

const localExecutable = resolveLocalPlaywrightExecutable();
if (localExecutable) {
  process.env.PLAYWRIGHT_CHROMIUM_PATH = localExecutable;
  console.log(`[Playwright Config] 🎯 Menggunakan browser dari root: ${localExecutable}`);
} else {
  console.log(`[Playwright Config] 📁 PLAYWRIGHT_BROWSERS_PATH diatur ke: ${localBrowsersDir}`);
}

let installPromise: Promise<string | undefined> | null = null;

/**
 * Otomatis mendownload browser Playwright Chromium jika belum ada di container sandbox
 */
export async function ensurePlaywrightInstalled(onLog?: (msg: string) => void): Promise<string | undefined> {
  const currentExe = resolveLocalPlaywrightExecutable();
  if (currentExe && fs.existsSync(currentExe)) {
    return currentExe;
  }

  // Hindari proses instalasi ganda secara bersamaan
  if (installPromise) {
    onLog?.('⏳ Instalasi Playwright Chromium sedang berjalan di background...');
    return installPromise;
  }

  installPromise = (async () => {
    try {
      const msg = '📦 Mengunduh binary Playwright Chromium ke .playwright-browsers...';
      onLog?.(msg);
      console.log(`[Playwright Self-Heal] ${msg}`);

      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      await execAsync('npx playwright install --force chromium chromium-headless-shell', {
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: localBrowsersDir,
          DEBIAN_FRONTEND: 'noninteractive',
        },
      });

      const installedExe = resolveLocalPlaywrightExecutable();
      if (installedExe) {
        process.env.PLAYWRIGHT_CHROMIUM_PATH = installedExe;
        const successMsg = `✅ Playwright Chromium siap digunakan: ${installedExe}`;
        onLog?.(successMsg);
        console.log(`[Playwright Self-Heal] ${successMsg}`);
        return installedExe;
      }
    } catch (err: any) {
      console.error('[Playwright Self-Heal Error]:', err?.message || err);
      onLog?.(`⚠️ Gagal download otomatis Playwright: ${err?.message || err}`);
    } finally {
      installPromise = null;
    }
    return resolveLocalPlaywrightExecutable();
  })();

  return installPromise;
}

// Background self-heal saat server boot jika belum ada browser terpasang
if (!localExecutable) {
  setTimeout(() => {
    ensurePlaywrightInstalled().catch(() => {});
  }, 1000);
}

export { localBrowsersDir, localExecutable };
