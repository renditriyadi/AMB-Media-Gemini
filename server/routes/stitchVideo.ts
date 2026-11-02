import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { getFfmpegPath, ensureFfmpegBinary } from '../../scripts/ensure-ffmpeg';

const execFileAsync = promisify(execFile);
const router = express.Router();

const mediaCacheDir = path.join(process.cwd(), 'media-cache');
if (!fs.existsSync(mediaCacheDir)) {
  fs.mkdirSync(mediaCacheDir, { recursive: true });
}

/**
 * Cek apakah file video memiliki audio stream dan berapa durasinya
 */
async function probeVideoFile(
  ffmpegPath: string,
  filePath: string
): Promise<{ hasAudio: boolean; duration: number; width?: number; height?: number }> {
  try {
    const { stderr } = await execFileAsync(ffmpegPath, ['-i', filePath]).catch((err) => ({
      stderr: err?.stderr || '',
      stdout: '',
    }));

    const hasAudio = /Stream #\d+:\d+.*Audio:/.test(stderr);
    let duration = 10;
    const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (durMatch) {
      const hours = parseFloat(durMatch[1]);
      const mins = parseFloat(durMatch[2]);
      const secs = parseFloat(durMatch[3]);
      duration = hours * 3600 + mins * 60 + secs;
    }

    const resMatch = stderr.match(/Video:.*,\s*(\d{3,4})x(\d{3,4})/);
    const width = resMatch ? parseInt(resMatch[1], 10) : undefined;
    const height = resMatch ? parseInt(resMatch[2], 10) : undefined;

    return { hasAudio, duration, width, height };
  } catch {
    return { hasAudio: true, duration: 10 };
  }
}

/**
 * Pastikan URL video tersedia di disk lokal (download jika remote)
 */
async function resolveLocalVideoPath(
  url: string,
  tempFiles: string[]
): Promise<string> {
  const cleanUrl = url.trim();

  // 1. Cek apakah ini file lokal dari /media-cache/
  if (cleanUrl.startsWith('/media-cache/') || cleanUrl.includes('/media-cache/')) {
    const filename = cleanUrl.split('/media-cache/')[1].split('?')[0];
    const localPath = path.join(mediaCacheDir, filename);
    if (fs.existsSync(localPath)) {
      return localPath;
    }
  }

  // 2. Cek apakah ini path file lokal langsung
  if (fs.existsSync(cleanUrl)) {
    return cleanUrl;
  }

  // 3. Download file dari URL remote ke mediaCacheDir
  const tempPath = path.join(
    mediaCacheDir,
    `stitch_in_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`
  );
  tempFiles.push(tempPath);

  console.log(`[Video Stitcher] Mendownload video input dari: ${cleanUrl.slice(0, 80)}...`);
  const response = await axios({
    method: 'GET',
    url: cleanUrl,
    responseType: 'stream',
    timeout: 60000,
  });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);
    writer.on('finish', () => resolve());
    writer.on('error', (err) => reject(err));
  });

  return tempPath;
}

/**
 * POST /api/canvas/stitch-video
 * Menggabungkan multi-video clips menjadi satu video utuh menggunakan FFmpeg
 */
router.post('/canvas/stitch-video', async (req, res) => {
  const tempFiles: string[] = [];

  try {
    const {
      videoUrls = [],
      aspectRatio = '9:16',
      resolution = '1080p',
      transition = 'none',
    } = req.body;

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Daftar videoUrls kosong. Sambungkan minimal 1 atau lebih video.',
      });
    }

    const validUrls = videoUrls.filter((u) => typeof u === 'string' && u.trim().length > 0);
    if (validUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada URL video yang valid ditemukan.',
      });
    }

    // 1. Dapatkan binary FFmpeg
    let ffmpegPath = getFfmpegPath();
    if (!fs.existsSync(ffmpegPath)) {
      console.log('[Video Stitcher] Binary FFmpeg belum ada, memulai auto-setup...');
      const info = await ensureFfmpegBinary();
      ffmpegPath = info.binaryPath;
    }

    console.log(`[Video Stitcher] Menyiapkan ${validUrls.length} klip video untuk digabungkan...`);

    // 2. Download / ambil path lokal semua video
    const localVideoPaths: string[] = [];
    for (const url of validUrls) {
      const localPath = await resolveLocalVideoPath(url, tempFiles);
      localVideoPaths.push(localPath);
    }

    // 3. Probe masing-masing video (cek audio dan durasi)
    const probes = await Promise.all(
      localVideoPaths.map((p) => probeVideoFile(ffmpegPath, p))
    );

    const hasAnyAudio = probes.some((p) => p.hasAudio);
    const totalDuration = probes.reduce((acc, p) => acc + (p.duration || 10), 0);

    // 4. Tentukan resolusi target
    let targetW = 1080;
    let targetH = 1920; // Default 9:16
    if (aspectRatio === '16:9') {
      targetW = 1920;
      targetH = 1080;
    } else if (aspectRatio === '1:1') {
      targetW = 1080;
      targetH = 1080;
    }

    if (resolution === '720p') {
      if (aspectRatio === '9:16') {
        targetW = 720;
        targetH = 1280;
      } else if (aspectRatio === '16:9') {
        targetW = 1280;
        targetH = 720;
      } else {
        targetW = 720;
        targetH = 720;
      }
    }

    const outputFileName = `stitched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
    const outputPath = path.join(mediaCacheDir, outputFileName);

    // 5. Susun argumen FFmpeg filter_complex
    const args: string[] = ['-y'];

    // Tambahkan semua input video
    for (const p of localVideoPaths) {
      args.push('-i', p);
    }

    // Jika ada clip yang punya audio dan clip lain tidak punya, kita generate silent audio input tambahan
    let silentAudioIndex = -1;
    const hasMixedAudio = hasAnyAudio && probes.some((p) => !p.hasAudio);
    if (hasMixedAudio) {
      // Buat source virtual silent audio
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
      silentAudioIndex = localVideoPaths.length;
    }

    // Buat filtergraph
    const filterParts: string[] = [];
    const concatVideoInputs: string[] = [];
    const concatAudioInputs: string[] = [];

    localVideoPaths.forEach((_, idx) => {
      // Scale and letterbox/pillarbox to target dimensions smoothly
      filterParts.push(
        `[${idx}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${idx}]`
      );
      concatVideoInputs.push(`[v${idx}]`);

      if (hasAnyAudio) {
        if (probes[idx].hasAudio) {
          filterParts.push(
            `[${idx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${idx}]`
          );
          concatAudioInputs.push(`[a${idx}]`);
        } else if (silentAudioIndex >= 0) {
          // Pakai silent audio yang di-trim sesuai durasi video ini
          const dur = probes[idx].duration || 10;
          filterParts.push(
            `[${silentAudioIndex}:a]atrim=0:${dur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${idx}]`
          );
          concatAudioInputs.push(`[a${idx}]`);
        }
      }
    });

    const vCount = localVideoPaths.length;
    if (hasAnyAudio && concatAudioInputs.length === vCount) {
      // Interleave video and audio streams for each segment: [v0][a0][v1][a1]...
      const interleaved: string[] = [];
      for (let i = 0; i < vCount; i++) {
        interleaved.push(concatVideoInputs[i], concatAudioInputs[i]);
      }
      filterParts.push(
        `${interleaved.join('')}concat=n=${vCount}:v=1:a=1[outv][outa]`
      );
    } else {
      // Concat video saja
      filterParts.push(`${concatVideoInputs.join('')}concat=n=${vCount}:v=1:a=0[outv]`);
    }

    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '[outv]');

    if (hasAnyAudio && concatAudioInputs.length === vCount) {
      args.push('-map', '[outa]');
      args.push('-c:a', 'aac', '-b:a', '192k');
    }

    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath
    );

    console.log(`[Video Stitcher] Menjalankan FFmpeg Concat...`);
    await execFileAsync(ffmpegPath, args);

    if (!fs.existsSync(outputPath)) {
      throw new Error('File hasil stitching video tidak ditemukan.');
    }

    const stat = fs.statSync(outputPath);
    console.log(
      `[Video Stitcher] ✓ Berhasil menggabungkan ${vCount} video! Ukuran: ${(stat.size / (1024 * 1024)).toFixed(1)} MB`
    );

    const mediaUrl = `/media-cache/${outputFileName}`;

    return res.json({
      success: true,
      mediaUrl,
      outputVideo: mediaUrl,
      resultUrl: mediaUrl,
      duration: `${Math.round(totalDuration)}s`,
      inputCount: vCount,
      aspectRatio,
      resolution,
      fileSize: stat.size,
    });
  } catch (err: any) {
    console.error('[Video Stitcher Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan saat menggabungkan video.',
    });
  } finally {
    // Hapus file temporary download
    for (const tmp of tempFiles) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch (_) {}
    }
  }
});

export default router;
