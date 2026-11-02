import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import https from 'https';
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Target folder: <project_root>/ffmpeg
const projectRoot = process.cwd();
const ffmpegDir = path.resolve(projectRoot, 'ffmpeg');

export interface FfmpegInfo {
  binaryPath: string;
  version: string;
  platform: string;
  arch: string;
}

/**
 * Deteksi nama file binary berdasarkan platform
 */
export function getFfmpegBinaryName(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

/**
 * Dapatkan path absolut file binary FFmpeg di folder <root>/ffmpeg/
 */
export function getFfmpegPath(): string {
  return path.join(ffmpegDir, getFfmpegBinaryName());
}

/**
 * Dapatkan URL download binary statis terkompresi (.gz) berdasarkan OS & arsitektur CPU
 */
function getDownloadUrls(platform: string, arch: string): string[] {
  const tag = 'b6.1.1';
  const baseName = `ffmpeg-${platform}-${arch}.gz`;

  return [
    `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/${baseName}`,
    // Fallback mirror jika GitHub redirect utama ada kendala
    `https://raw.githubusercontent.com/eugeneware/ffmpeg-static/b6.1.1/releases/${baseName}`,
  ];
}

/**
 * Helper untuk download stream dengan auto-redirect (HTTP 301/302)
 */
function downloadStreamWithRedirects(url: string, maxRedirects = 8): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Terlalu banyak redirect saat mendownload FFmpeg.'));
    }

    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'AMBMedia-FFmpeg-Installer/2.0' } }, (res) => {
      // Tangani redirect (301, 302, 303, 307, 308)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume(); // Buang data stream lama
        return resolve(downloadStreamWithRedirects(nextUrl, maxRedirects - 1));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Server merespons status ${res.statusCode}: ${res.statusMessage}`));
      }

      resolve(res);
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(60000, () => {
      req.destroy(new Error('Koneksi download FFmpeg timeout setelah 60 detik.'));
    });
  });
}

/**
 * Tes apakah binary FFmpeg sudah ada dan berfungsi normal
 */
export async function testFfmpegExecutable(binaryPath: string): Promise<string | null> {
  if (!fs.existsSync(binaryPath)) return null;

  try {
    const stat = fs.statSync(binaryPath);
    if (stat.size < 1024 * 1024) return null; // Ukuran terlalu kecil / korup

    // Beri izin eksekusi di Linux/macOS
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(binaryPath, 0o755);
      } catch (_) {}
    }

    const { stdout } = await execFileAsync(binaryPath, ['-version']);
    const firstLine = stdout.split('\n')[0] || '';
    return firstLine.trim();
  } catch (e) {
    return null;
  }
}

/**
 * Fungsi Utama: Cek apakah binary FFmpeg ada di folder ffmpeg/.
 * Jika belum ada, otomatis download versi full (MP4/H.264/AAC) dan ekstrak ke folder ffmpeg/.
 */
export async function ensureFfmpegBinary(forceRedownload = false): Promise<FfmpegInfo> {
  const platform = process.platform;
  const arch = process.arch;
  const binaryPath = getFfmpegPath();

  // 1. Cek apakah binary sudah ada & valid
  if (!forceRedownload) {
    const existingVersion = await testFfmpegExecutable(binaryPath);
    if (existingVersion) {
      console.log(`[FFmpeg] ✓ Binary sudah siap di: ${binaryPath}`);
      console.log(`[FFmpeg] Versi: ${existingVersion}`);
      return {
        binaryPath,
        version: existingVersion,
        platform,
        arch,
      };
    }
  }

  // 2. Siapkan folder target <project_root>/ffmpeg
  if (!fs.existsSync(ffmpegDir)) {
    fs.mkdirSync(ffmpegDir, { recursive: true });
  }

  // Cek apakah ada FFmpeg di sistem (PATH atau Playwright browsers) yang bisa dipakai langsung
  try {
    const { execSync } = await import('child_process');
    const whichCmd = platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const sysFfmpeg = execSync(whichCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).split('\n')[0]?.trim();
    if (sysFfmpeg && fs.existsSync(sysFfmpeg) && sysFfmpeg !== binaryPath) {
      const sysVersion = await testFfmpegExecutable(sysFfmpeg);
      if (sysVersion) {
        console.log(`[FFmpeg Setup] ⚡ Menemukan FFmpeg di sistem: ${sysFfmpeg}`);
        try {
          fs.copyFileSync(sysFfmpeg, binaryPath);
          if (platform !== 'win32') fs.chmodSync(binaryPath, 0o755);
          console.log(`[FFmpeg Setup] ✓ Berhasil meng-copy FFmpeg sistem ke folder project: ${binaryPath}`);
          return { binaryPath, version: sysVersion, platform, arch };
        } catch (_) {}
      }
    }
  } catch (_) {}

  console.log(`=======================================================`);
  console.log(`[FFmpeg Setup] Menyiapkan FFmpeg Full (MP4/H.264/AAC)...`);
  console.log(`[FFmpeg Setup] Sistem Terdeteksi: ${platform} (${arch})`);
  console.log(`[FFmpeg Setup] Folder Tujuan   : ${ffmpegDir}`);
  console.log(`=======================================================`);

  const urls = getDownloadUrls(platform, arch);
  const tempPath = path.join(ffmpegDir, `ffmpeg_dl_${Date.now()}.tmp`);

  let downloaded = false;
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      console.log(`[FFmpeg Setup] Mengunduh binary statis dari:\n -> ${url}`);
      const response = await downloadStreamWithRedirects(url);

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let receivedBytes = 0;
      let lastPercent = -1;

      await new Promise<void>((resolve, reject) => {
        const gunzip = zlib.createGunzip();
        const fileWriter = fs.createWriteStream(tempPath);

        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.floor((receivedBytes / totalBytes) * 100);
            if (percent !== lastPercent && percent % 10 === 0) {
              lastPercent = percent;
              process.stdout.write(`[FFmpeg Setup] Progres: ${percent}% (${(receivedBytes / (1024 * 1024)).toFixed(1)} MB)\r`);
            }
          }
        });

        response
          .pipe(gunzip)
          .pipe(fileWriter)
          .on('finish', () => {
            console.log(`\n[FFmpeg Setup] ✓ Download & ekstraksi selesai!`);
            resolve();
          })
          .on('error', (err) => {
            fileWriter.destroy();
            reject(err);
          });

        gunzip.on('error', (err) => {
          fileWriter.destroy();
          reject(new Error(`Gagal mengekstrak gzip FFmpeg: ${err.message}`));
        });
      });

      downloaded = true;
      break;
    } catch (err: any) {
      console.warn(`[FFmpeg Setup] Gagal mengunduh dari sumber: ${err?.message || err}`);
      lastError = err;
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
    }
  }

  if (!downloaded) {
    throw new Error(
      `Gagal mendownload binary FFmpeg untuk ${platform}-${arch}: ${lastError?.message || 'Unknown error'}`
    );
  }

  // 3. Pindahkan file temp ke target permanen
  if (fs.existsSync(binaryPath)) {
    try { fs.unlinkSync(binaryPath); } catch (_) {}
  }
  fs.renameSync(tempPath, binaryPath);

  // 4. Set permission executable jika di Linux / macOS
  if (platform !== 'win32') {
    try {
      fs.chmodSync(binaryPath, 0o755);
      console.log(`[FFmpeg Setup] Berhasil mengatur izin chmod 755 untuk Linux/macOS`);
    } catch (permErr) {
      console.warn(`[FFmpeg Setup] Peringatan izin chmod:`, permErr);
    }
  }

  // 5. Verifikasi binary yang baru saja diunduh
  const verifiedVersion = await testFfmpegExecutable(binaryPath);
  if (!verifiedVersion) {
    throw new Error(`File binary diunduh tetapi gagal dijalankan: ${binaryPath}`);
  }

  console.log(`=======================================================`);
  console.log(`[FFmpeg Setup] BERHASIL! FFmpeg siap digunakan.`);
  console.log(`[FFmpeg Setup] Lokasi Binary: ${binaryPath}`);
  console.log(`[FFmpeg Setup] Versi        : ${verifiedVersion}`);
  console.log(`=======================================================`);

  return {
    binaryPath,
    version: verifiedVersion,
    platform,
    arch,
  };
}

// Jalankan otomatis jika dipanggil langsung via CLI: tsx scripts/ensure-ffmpeg.ts
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('ensure-ffmpeg.ts')) {
  ensureFfmpegBinary()
    .then((info) => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[FFmpeg Error]:`, err);
      process.exit(1);
    });
}

