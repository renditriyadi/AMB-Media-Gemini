import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import FormData from 'form-data';
import { getFreshIdToken, cleanErrorMessage } from '../utils/helpers';

const router = Router();

// Configure multer to write files to disk temp directory (/tmp)
// This avoids buffering entire large files in Node.js RAM memory
const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = os.tmpdir();
      cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || '';
      cb(null, `upload-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Standalone Pre-Upload Endpoint for media files (images & videos) directly to Weavy AI asset store
router.post(
  '/upload-media',
  (req, res, next) => {
    uploadDisk.single('file')(req as any, res as any, (err) => {
      next();
    });
  },
  async (req, res) => {
    let filePathToCleanup: string | null = null;
    try {
      let fileStream: fs.ReadStream | Buffer | null = null;
      let originalName = 'upload_file';
      let mimeType = 'application/octet-stream';
      let fileSize = 0;

      if (req.file) {
        filePathToCleanup = req.file.path;
        fileStream = fs.createReadStream(req.file.path);
        originalName = req.file.originalname;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;
      } else if (req.body && (req.body.fileData || req.body.base64)) {
        const fileDataStr = String(req.body.fileData || req.body.base64);
        originalName = req.body.fileName || req.body.name || originalName;
        mimeType = req.body.mimeType || req.body.type || mimeType;

        let buf: Buffer;
        if (fileDataStr.includes(';base64,')) {
          const parts = fileDataStr.split(';base64,');
          const header = parts[0];
          const base64Content = parts[1];
          if (header.startsWith('data:')) {
            mimeType = header.replace('data:', '');
          }
          buf = Buffer.from(base64Content, 'base64');
        } else {
          buf = Buffer.from(fileDataStr, 'base64');
        }
        fileStream = buf;
        fileSize = buf.length;
      }

      const { refreshToken, idToken: providedIdToken, allRefreshTokens } = req.body || {};

      if (!fileStream) {
        return res.status(400).json({ error: 'Tidak ada file yang diterima di server.' });
      }

      console.log(
        `[Server 📤 Pre-Upload Disk Stream] Menerima file ${originalName} (${mimeType}, ${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`
      );

      // Collect candidate tokens to try in sequence
      const tokensToTry: string[] = [];
      if (refreshToken && typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
        tokensToTry.push(refreshToken.trim());
      }
      if (allRefreshTokens) {
        try {
          const parsed = typeof allRefreshTokens === 'string' ? JSON.parse(allRefreshTokens) : allRefreshTokens;
          if (Array.isArray(parsed)) {
            parsed.forEach((t: any) => {
              if (typeof t === 'string' && t.trim().length > 0 && !tokensToTry.includes(t.trim())) {
                tokensToTry.push(t.trim());
              }
            });
          }
        } catch (e) {}
      }

      const isVideo = mimeType.startsWith('video/') || originalName.match(/\.(mp4|mov|avi|webm|mkv)$/i);
      const ext = originalName.split('.').pop() || (isVideo ? 'mp4' : 'png');
      const contentType = mimeType || (isVideo ? 'video/mp4' : 'image/png');

      let lastError: any = null;

      // Loop through tokens until one succeeds
      if (tokensToTry.length > 0) {
        for (const token of tokensToTry) {
          try {
            const idToken = await getFreshIdToken(token);
            const form = new FormData();

            const streamOrBuf = filePathToCleanup ? fs.createReadStream(filePathToCleanup) : fileStream;

            form.append('file', streamOrBuf, {
              filename: originalName || `upload_${Date.now()}.${ext}`,
              contentType: contentType,
              knownLength: fileSize,
            });

            const uploadRes = await axios.post('https://api.weavy.ai/api/v1/assets/upload', form, {
              headers: {
                Authorization: `Bearer ${idToken}`,
                'X-Weavy-Auth-Provider': 'firebase',
                'x-app-version': '4.1.604',
                'User-Agent': 'WeavyApp/4.1.604 (Dart; iOS/17.4)',
                ...form.getHeaders(),
              },
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
              timeout: 300000,
            });

            if (uploadRes.data && uploadRes.data.url) {
              console.log(
                `[Server 🎨 Pre-Upload Success] File ${originalName} berhasil di-upload ke Weavy store:`,
                uploadRes.data.url
              );
              return res.json({
                success: true,
                data: uploadRes.data,
                url: uploadRes.data.url,
                thumbnailUrl: uploadRes.data.thumbnailUrl || uploadRes.data.url,
                workingRefreshToken: token,
              });
            }
          } catch (err: any) {
            console.warn(
              `[Server 📤 Pre-Upload] Percobaan token gagal, mencoba token cadangan berikutnya...`,
              err?.response?.data || err?.message
            );
            lastError = err;
          }
        }
      }

      // Fallback: Provided ID token directly
      if (providedIdToken) {
        try {
          const form = new FormData();
          const streamOrBuf = filePathToCleanup ? fs.createReadStream(filePathToCleanup) : fileStream;

          form.append('file', streamOrBuf, {
            filename: originalName || `upload_${Date.now()}.${ext}`,
            contentType: contentType,
            knownLength: fileSize,
          });

          const uploadRes = await axios.post('https://api.weavy.ai/api/v1/assets/upload', form, {
            headers: {
              Authorization: `Bearer ${providedIdToken}`,
              'X-Weavy-Auth-Provider': 'firebase',
              'x-app-version': '4.1.604',
              'User-Agent': 'WeavyApp/4.1.604 (Dart; iOS/17.4)',
              ...form.getHeaders(),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 300000,
          });

          if (uploadRes.data && uploadRes.data.url) {
            console.log(
              `[Server 🎨 Pre-Upload Success via ID Token] File ${originalName} berhasil di-upload:`,
              uploadRes.data.url
            );
            return res.json({
              success: true,
              data: uploadRes.data,
              url: uploadRes.data.url,
              thumbnailUrl: uploadRes.data.thumbnailUrl || uploadRes.data.url,
            });
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      return res
        .status(500)
        .json({ error: cleanErrorMessage(lastError || 'Semua token autentikasi tidak dapat mengunggah file.') });
    } catch (error: any) {
      console.error('[Server ❌ Pre-Upload Error]:', error?.response?.data || error?.message);
      return res.status(500).json({ error: cleanErrorMessage(error) });
    } finally {
      // Clean up temporary disk file asynchronously to free disk space immediately
      if (filePathToCleanup) {
        fs.unlink(filePathToCleanup, (err) => {
          if (err) console.warn('[Server ⚠️ Temp File Clean Error]:', err.message);
        });
      }
    }
  }
);

export default router;
