import { Router } from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { getFreshIdToken, cleanErrorMessage, getWeavyHeaders, FIREBASE_API_KEY } from '../utils/helpers';

const router = Router();

export interface FrameObservation {
  frameIndex: number;
  timestamp: string;
  timeSec: number;
  subject: string;
  action: string;
  camera: string;
  style: string;
  lighting: string;
  composition: string;
  onScreenText?: string;
  mood?: string;
  rawDescription?: string;
}

/**
 * 1. Video Ingestion & Metadata Scraper (TikWM / oEmbed)
 * Downloads video stream to local media-cache for frame extraction
 */
async function extractAndDownloadVideo(videoUrl: string): Promise<{
  title: string;
  author: string;
  audioName: string;
  thumbnailUrl: string;
  duration: number;
  tags: string[];
  playUrl: string;
  rawUrl: string;
  localFilePath?: string;
  downloaderType: 'tikwm' | 'oembed' | 'direct' | 'sample';
} | null> {
  const cleanUrl = (videoUrl || '').trim();
  if (!cleanUrl) return null;

  const mediaCacheDir = path.join(process.cwd(), 'media-cache');
  if (!fs.existsSync(mediaCacheDir)) {
    fs.mkdirSync(mediaCacheDir, { recursive: true });
  }

  // 0. Check if cleanUrl is already a local file or media-cache path
  if (cleanUrl.startsWith('media-cache/') || cleanUrl.startsWith('/media-cache/') || fs.existsSync(cleanUrl)) {
    const candidatePath = fs.existsSync(cleanUrl)
      ? cleanUrl
      : path.join(process.cwd(), cleanUrl.replace(/^\//, ''));
    
    if (fs.existsSync(candidatePath)) {
      console.log(`[Studio Downloader] Found local cached video at: ${candidatePath}`);
      return {
        title: 'Video Referensi TikTok',
        author: 'TikTok Creator',
        audioName: 'Original Audio',
        thumbnailUrl: '',
        duration: 30,
        tags: ['#semangka', '#viral'],
        playUrl: `/${cleanUrl.replace(/^\//, '')}`,
        rawUrl: cleanUrl,
        localFilePath: candidatePath,
        downloaderType: 'direct',
      };
    }
  }

  // Generate deterministic filename from URL hash
  const urlHash = crypto.createHash('md5').update(cleanUrl).digest('hex').substring(0, 16);
  let localVideoPath = path.join(mediaCacheDir, `studio_vid_${urlHash}.mp4`);

  try {
    // 1. Try TikWM API
    console.log(`[Studio Downloader] Fetching TikWM metadata for: ${cleanUrl}...`);
    const tikUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`;
    const tikRes = await axios.get(tikUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 20000,
    });

    if (tikRes.data && tikRes.data.code === 0 && tikRes.data.data) {
      const d = tikRes.data.data;
      const title = d.title || 'TikTok Video';
      const tags = (title.match(/#[\w\d_]+/g) || []).map((t: string) => t.trim());
      const duration = typeof d.duration === 'number' && d.duration > 0 ? d.duration : 15;
      const playUrl = d.hdplay || d.play || d.wmplay || '';
      const videoId = d.id || urlHash;
      localVideoPath = path.join(mediaCacheDir, `studio_vid_${videoId}.mp4`);

      // Download video buffer if not already present
      if (!fs.existsSync(localVideoPath) && playUrl) {
        try {
          const downloadUrl = playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`;
          console.log(`[Studio Downloader] Downloading video stream to ${localVideoPath}...`);
          const videoResp = await axios.get(downloadUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.tikwm.com/',
            },
            responseType: 'arraybuffer',
            timeout: 30000,
          });

          if (videoResp.data && videoResp.data.byteLength > 1000) {
            fs.writeFileSync(localVideoPath, Buffer.from(videoResp.data));
            console.log(`[Studio Downloader] Successfully downloaded ${videoResp.data.byteLength} bytes.`);
          }
        } catch (dlErr: any) {
          console.warn('[Studio Downloader] Failed to download video stream:', dlErr.message);
        }
      }

      return {
        title: d.title || 'TikTok Video',
        author: d.author?.nickname ? `${d.author.nickname} (@${d.author.unique_id || ''})` : (d.author?.unique_id || 'TikTok Creator'),
        audioName: d.music || d.music_info?.title || 'Original Sound',
        thumbnailUrl: d.cover || d.origin_cover || '',
        duration,
        tags,
        playUrl,
        rawUrl: cleanUrl,
        localFilePath: fs.existsSync(localVideoPath) ? localVideoPath : undefined,
        downloaderType: 'tikwm',
      };
    }
  } catch (e: any) {
    console.warn('[Studio Downloader] TikWM fetch error, trying oEmbed fallback:', e.message);
  }

  try {
    // 2. Try TikTok oEmbed API fallback
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const oembedRes = await axios.get(oembedUrl, { timeout: 10000 });
    if (oembedRes.data && oembedRes.data.title) {
      const d = oembedRes.data;
      const title = d.title || '';
      const tags = (title.match(/#[\w\d_]+/g) || []).map((t: string) => t.trim());
      return {
        title: d.title,
        author: d.author_name ? `${d.author_name} (@${d.author_unique_id || ''})` : (d.author_unique_id || 'TikTok Creator'),
        audioName: 'Original Audio',
        thumbnailUrl: d.thumbnail_url || '',
        duration: 15,
        tags,
        playUrl: '',
        rawUrl: cleanUrl,
        localFilePath: undefined,
        downloaderType: 'oembed',
      };
    }
  } catch (e2: any) {
    console.warn('[Studio Downloader] oEmbed fallback error:', e2.message);
  }

  return {
    title: 'Custom Video Project',
    author: 'Creator',
    audioName: 'Original Sound',
    thumbnailUrl: '',
    duration: 15,
    tags: [],
    playUrl: '',
    rawUrl: cleanUrl,
    localFilePath: undefined,
    downloaderType: 'sample',
  };
}

/**
 * 2. Frame Extractor (ffmpeg spawned as child process)
 * Extracts video frames at 1 fps (or adapted interval) into a temporary directory
 */
async function extractVideoFrames(
  videoFilePath: string,
  targetDuration: number = 30,
  maxKeyFrames: number = 8
): Promise<{
  tempDir: string;
  frameFiles: Array<{ filePath: string; timestamp: string; timeSec: number; frameIndex: number }>;
  cleanup: () => void;
}> {
  const tempDir = path.join('/tmp', `studio_frames_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('[Studio Frame Cleanup Error]:', e);
    }
  };

  // Determine fps sampling rate: 1 fps for short videos <= 40s, 0.5 fps for longer videos
  const fps = targetDuration > 45 ? '0.5' : '1';
  const outputPattern = path.join(tempDir, 'frame_%03d.jpg');

  console.log(`[Studio Frame Extractor] Spawning ffmpeg on ${videoFilePath} (fps=${fps}, scale=640:-1)...`);

  await new Promise<void>((resolve, reject) => {
    // ffmpeg -i <file> -vf "fps=1,scale=640:-1" -q:v 2 /tmp/.../frame_%03d.jpg -y
    execFile(
      'ffmpeg',
      ['-i', videoFilePath, '-vf', `fps=${fps},scale=640:-1`, '-q:v', '2', outputPattern, '-y'],
      { timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          console.warn('[Studio Frame Extractor Warning]:', error.message);
          // If error occurs, we still check if any frames were created
          resolve();
        } else {
          resolve();
        }
      }
    );
  });

  const allFiles = fs.readdirSync(tempDir)
    .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'))
    .sort();

  console.log(`[Studio Frame Extractor] Extracted ${allFiles.length} raw frames.`);

  if (allFiles.length === 0) {
    return { tempDir, frameFiles: [], cleanup };
  }

  // Select evenly distributed key frames across the extracted set (up to maxKeyFrames)
  const sampledFiles: Array<{ filePath: string; timestamp: string; timeSec: number; frameIndex: number }> = [];
  const count = Math.min(allFiles.length, maxKeyFrames);
  const step = allFiles.length / count;

  for (let i = 0; i < count; i++) {
    const idx = Math.min(Math.floor(i * step), allFiles.length - 1);
    const fileName = allFiles[idx];
    const filePath = path.join(tempDir, fileName);
    
    // Estimate seconds based on frame index and fps
    const rawIndex = parseInt(fileName.replace(/\D/g, ''), 10) || (idx + 1);
    const timeSec = fps === '0.5' ? (rawIndex - 1) * 2 : (rawIndex - 1);
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    const timestamp = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    sampledFiles.push({
      filePath,
      timestamp,
      timeSec,
      frameIndex: i + 1,
    });
  }

  console.log(`[Studio Frame Extractor] Selected ${sampledFiles.length} key frames for VLM perception.`);
  return { tempDir, frameFiles: sampledFiles, cleanup };
}

/**
 * 3. JSON Schema Validator for Frame Observation
 */
function validateAndNormalizeFrameObservation(raw: any, fallbackTimestamp: string, fallbackTimeSec: number, frameIndex: number): FrameObservation {
  return {
    frameIndex,
    timestamp: typeof raw?.timestamp === 'string' && raw.timestamp.trim() ? raw.timestamp.trim() : fallbackTimestamp,
    timeSec: typeof raw?.timeSec === 'number' ? raw.timeSec : fallbackTimeSec,
    subject: String(raw?.subject || 'Product / Subject presentation').trim(),
    action: String(raw?.action || 'Movement or interaction on camera').trim(),
    camera: String(raw?.camera || 'Eye-level medium shot').trim(),
    style: String(raw?.style || 'Commercial photorealistic').trim(),
    lighting: String(raw?.lighting || 'Natural studio lighting').trim(),
    composition: String(raw?.composition || 'Centered product focus').trim(),
    onScreenText: raw?.onScreenText ? String(raw.onScreenText).trim() : undefined,
    mood: raw?.mood ? String(raw.mood).trim() : 'Engaging & dynamic',
    rawDescription: raw?.rawDescription || raw?.description || undefined,
  };
}

/**
 * Helper to convert image string (Data URL or HTTP URL) to Gemini inlineData part
 */
async function imageToPart(imageStr: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!imageStr || typeof imageStr !== 'string') return null;
  const clean = imageStr.trim();
  if (!clean) return null;

  try {
    if (clean.startsWith('data:')) {
      const match = clean.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          inlineData: {
            mimeType: match[1] || 'image/jpeg',
            data: match[2],
          },
        };
      }
    } else if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const resp = await axios.get(clean, { responseType: 'arraybuffer', timeout: 15000 });
      const ct = String(resp.headers['content-type'] || 'image/jpeg');
      const base64 = Buffer.from(resp.data).toString('base64');
      return {
        inlineData: {
          mimeType: ct.includes('png') ? 'image/png' : (ct.includes('webp') ? 'image/webp' : 'image/jpeg'),
          data: base64,
        },
      };
    }
  } catch (err: any) {
    console.warn('[Studio VLM Image Part Conversion Error]:', err?.message);
  }
  return null;
}

/**
 * Performs Gemini VLM inspection of uploaded brief input images (Product, Model, Background)
 */
async function analyzeBriefInputImagesVLM(
  productImage?: string,
  modelImage?: string,
  backgroundImage?: string
): Promise<{
  productImageAnalysis?: string;
  modelImageAnalysis?: string;
  backgroundImageAnalysis?: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    return {};
  }

  const result: {
    productImageAnalysis?: string;
    modelImageAnalysis?: string;
    backgroundImageAnalysis?: string;
  } = {};

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  const modelToUse = 'gemini-3.8-flash';

  // 1. Product Image VLM Analysis
  if (productImage) {
    const pPart = await imageToPart(productImage);
    if (pPart) {
      try {
        console.log('[Studio VLM] Analyzing Product Image with Gemini VLM...');
        const resp = await ai.models.generateContent({
          model: modelToUse,
          contents: [{
            role: 'user',
            parts: [
              pPart,
              {
                text: `Analisis gambar produk yang diunggah ini secara mendalam dalam Bahasa Indonesia.
Sebutkan rincian spesifik:
1. Jenis produk & nama merek/label (jika ada)
2. Bentuk kemasan, botol, atau kontainer
3. Warna utama, tekstur, dan ciri khas fisik produk
4. Elemen visual utama yang harus dipertahankan di setiap scene promo.
Tuliskan hasil analisis secara ringkas dan padat (1-2 paragraf) dalam Bahasa Indonesia.`
              }
            ]
          }]
        });
        if (resp.text) {
          result.productImageAnalysis = resp.text.trim();
          console.log('[Studio VLM Product Analysis Success]:', result.productImageAnalysis.slice(0, 100));
        }
      } catch (e: any) {
        console.warn('[Studio VLM Product Image Analysis Error]:', e.message);
      }
    }
  }

  // 2. Model Image VLM Analysis
  if (modelImage) {
    const mPart = await imageToPart(modelImage);
    if (mPart) {
      try {
        console.log('[Studio VLM] Analyzing Model/Talent Image with Gemini VLM...');
        const resp = await ai.models.generateContent({
          model: modelToUse,
          contents: [{
            role: 'user',
            parts: [
              mPart,
              {
                text: `Analisis HANYA karakter fisik model/talent yang diunggah ini secara mendalam dalam Bahasa Indonesia.
PENTING: Fokuslah HANYA pada orangnya (wajah, tubuh, pakaian, topi, aksesoris tubuh). JANGAN memasukkan atau mendeskripsikan produk/kemasan/benda yang dipegang oleh model sebagai bagian dari model.
Sebutkan rincian spesifik:
1. Jenis kelamin, perkiraan usia, dan etnisitas/fitur wajah
2. Gaya rambut, warna rambut, penutup kepala (topi caping/dsb jika ada), dan pakaian/outfit (warna baju, celana)
3. Ekspresi wajah dan postur tubuh
4. Ciri-ciri visual orang yang harus dipertahankan agar karakter talent konsisten di seluruh storyboard.
Tuliskan hasil analisis secara ringkas dan padat (1-2 paragraf) dalam Bahasa Indonesia.`
              }
            ]
          }]
        });
        if (resp.text) {
          result.modelImageAnalysis = resp.text.trim();
          console.log('[Studio VLM Model Analysis Success]:', result.modelImageAnalysis.slice(0, 100));
        }
      } catch (e: any) {
        console.warn('[Studio VLM Model Image Analysis Error]:', e.message);
      }
    }
  }

  // 3. Background Image VLM Analysis
  if (backgroundImage) {
    const bPart = await imageToPart(backgroundImage);
    if (bPart) {
      try {
        console.log('[Studio VLM] Analyzing Background Image with Gemini VLM...');
        const resp = await ai.models.generateContent({
          model: modelToUse,
          contents: [{
            role: 'user',
            parts: [
              bPart,
              {
                text: `Analisis gambar latar tempat / background yang diunggah ini secara mendalam dalam Bahasa Indonesia.
Sebutkan rincian spesifik:
1. Jenis lokasi/ruangan (misal: kamar mandi minimalis, studio, dapur, outdoor estetik)
2. Skema warna utama dan nuansa pencahayaan (lighting tone)
3. Dekorasi, furnitur, dan estetika lingkungan
4. Elemen latar belakang yang wajib konsisten di setiap scene.
Tuliskan hasil analisis secara ringkas dan padat (1-2 paragraf) dalam Bahasa Indonesia.`
              }
            ]
          }]
        });
        if (resp.text) {
          result.backgroundImageAnalysis = resp.text.trim();
          console.log('[Studio VLM Background Analysis Success]:', result.backgroundImageAnalysis.slice(0, 100));
        }
      } catch (e: any) {
        console.warn('[Studio VLM Background Image Analysis Error]:', e.message);
      }
    }
  }

  return result;
}

/**
 * Performs Gemini VLM inspection of uploaded custom reference assets
 */
async function analyzeCustomAssetsVLM(
  customAssets?: Array<{ id: string; title: string; textDescription: string; image?: string }>
): Promise<string> {
  if (!customAssets || customAssets.length === 0 || !process.env.GEMINI_API_KEY) {
    return '';
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  const modelToUse = 'gemini-3.8-flash';
  let resultText = '\n=== ADDITIONAL REFERENCE ASSETS (CUSTOM ASSETS) ===\n';

  for (const asset of customAssets) {
    resultText += `Asset: "${asset.title}"\n- User Description: "${asset.textDescription}"\n`;
    if (asset.image) {
      const part = await imageToPart(asset.image);
      if (part) {
        try {
          console.log(`[Studio VLM] Analyzing Custom Asset [${asset.title}] with Gemini VLM...`);
          const resp = await ai.models.generateContent({
            model: modelToUse,
            contents: [{
              role: 'user',
              parts: [
                part,
                {
                  text: `Analisis gambar aset tambahan bernama "${asset.title}" secara mendalam dalam Bahasa Indonesia.
Sebutkan rincian spesifik mengenai visualnya, warna utamanya, bentuknya, fungsinya, dan detail visual penting yang harus dipertahankan secara konsisten di seluruh storyboard.
Tuliskan hasil analisis secara ringkas (1 paragraf) dalam Bahasa Indonesia.`
                }
              ]
            }]
          });
          if (resp.text) {
            resultText += `- AI Visual Analysis: "${resp.text.trim()}"\n`;
          }
        } catch (e: any) {
          console.warn(`[Studio VLM Custom Asset ${asset.title} Analysis Error]:`, e.message);
        }
      }
    }
    resultText += '\n';
  }
  return resultText;
}

/**
 * 4. VLM Per-Frame / Segment Analysis
 * Calls Gemini directly (multimodal) or Weavy Any LLM to perceive visual elements in each frame
 */
async function analyzeFramesWithVLM(
  frames: Array<{ filePath: string; timestamp: string; timeSec: number; frameIndex: number }>,
  aiModel: string,
  extraContext?: { title: string; author: string; tags: string[] }
): Promise<FrameObservation[]> {
  if (frames.length === 0) return [];

  const results: FrameObservation[] = [];

  // If Gemini API key is available, we can send all key frames in a single fast multimodal call or parallel calls
  if (process.env.GEMINI_API_KEY) {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    let preferredModel = 'gemini-3.8-flash';
    if (aiModel.includes('pro')) {
      preferredModel = 'gemini-3.1-pro-preview';
    } else if (aiModel.includes('gemini-')) {
      const raw = aiModel.replace('google/', '');
      preferredModel = (raw === 'gemini-2.5-flash' || raw === 'gemini-2.0-flash' || raw === 'gemini-1.5-flash') ? 'gemini-3.8-flash' : raw;
    }

    const candidateModels = Array.from(new Set([
      preferredModel,
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ]));

    const parts: any[] = [
      {
        text: `You are an expert computer vision and video analysis model.
Analyze the following sequential video frames extracted from a viral video titled "${extraContext?.title || 'TikTok Video'}".

For EACH frame image provided, analyze the visual contents and return a JSON array containing structured observations with exact schema:
[
  {
    "frameIndex": 1,
    "timestamp": "00:00",
    "subject": "Clear description of main subject/person/object",
    "action": "Specific movement or physical interaction happening",
    "camera": "Camera shot type and angle (e.g. Extreme Macro Close-up, Low Angle, Top Down)",
    "style": "Visual style (e.g. Photorealistic commercial, Cinematic 8k, Organic vlog)",
    "lighting": "Lighting setup (e.g. Direct sunlight, Soft studio ring light, Neon contrast)",
    "composition": "Composition layout (e.g. Centered product, Rule of thirds)",
    "onScreenText": "Any visible text/captions/stickers (if none, leave blank)",
    "mood": "Emotional tone (e.g. Curious, Appetizing, High-energy, Premium)"
  }
]

Respond STRICTLY with valid JSON array only, without markdown code fences or conversational text.`
      }
    ];

    // Add each frame image inline
    for (const frame of frames) {
      if (fs.existsSync(frame.filePath)) {
        const imageBuffer = fs.readFileSync(frame.filePath);
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBuffer.toString('base64'),
          }
        });
        parts.push({
          text: `[Frame ${frame.frameIndex} at Timestamp ${frame.timestamp}]`
        });
      }
    }

    for (const modelName of candidateModels) {
      try {
        console.log(`[Studio VLM] Performing multi-frame visual inspection using ${modelName}...`);
        const vlmResponse = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          }
        });

        const responseText = (vlmResponse.text || '').trim();
        let cleaned = responseText;
        if (cleaned.includes('```')) {
          const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (m && m[1]) cleaned = m[1].trim();
        }

        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((item: any, i: number) => {
            const frameRef = frames[i] || frames[frames.length - 1];
            results.push(validateAndNormalizeFrameObservation(item, frameRef.timestamp, frameRef.timeSec, i + 1));
          });
          console.log(`[Studio VLM] Successfully parsed ${results.length} structured frame observations using ${modelName}.`);
          return results;
        }
      } catch (geminiErr: any) {
        console.warn(`[Studio VLM ${modelName} failed]:`, geminiErr.message?.slice(0, 100));
      }
    }
  }

  // Fallback: If multimodal fails or no frames extracted, return structured temporal baseline
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    results.push(validateAndNormalizeFrameObservation({
      subject: extraContext?.title || 'Video Content Subject',
      action: `Action sequence at ${frame.timestamp}`,
      camera: i === 0 ? 'Close-up Hook Shot' : 'Medium Commercial View',
      style: 'Photorealistic commercial',
      lighting: 'Bright natural lighting',
      composition: 'Centered subject presentation',
      mood: 'Engaging & viral',
    }, frame.timestamp, frame.timeSec, i + 1));
  }

  return results;
}

/**
 * 5. Temporal Aggregator & Prompt Enhancer
 * Takes structured frame observations + video metadata and constructs the complete storyboard breakdown
 */
async function aggregateTimelineAndBuildStoryboard(params: {
  videoTitle: string;
  videoAuthor: string;
  videoAudio: string;
  videoDuration: number;
  videoTags: string[];
  rawPrompt?: string;
  productName?: string;
  productDescription?: string;
  productImage?: string;
  modelTalent?: string;
  modelImage?: string;
  backgroundSetting?: string;
  backgroundImage?: string;
  mainBrief?: string;
  numScenes?: number;
  aspectRatio: string;
  imageModel: string;
  aiModel: string;
  frameObservations: FrameObservation[];
  inputImageAnalysis?: {
    productImageAnalysis?: string;
    modelImageAnalysis?: string;
    backgroundImageAnalysis?: string;
  };
  customAssetsAnalysis?: string;
  refreshToken?: string;
  idToken?: string;
  allRefreshTokens?: string[];
}): Promise<any> {
  const {
    videoTitle,
    videoAuthor,
    videoAudio,
    videoDuration,
    videoTags,
    rawPrompt,
    productName,
    productDescription,
    productImage,
    modelTalent,
    modelImage,
    backgroundSetting,
    backgroundImage,
    mainBrief,
    numScenes,
    aspectRatio,
    imageModel,
    aiModel,
    frameObservations,
    inputImageAnalysis,
    customAssetsAnalysis,
    refreshToken,
    idToken,
    allRefreshTokens,
  } = params;

  // Build the chronological frame timeline summary for the LLM
  const frameTimelineSummary = frameObservations.length > 0
    ? frameObservations.map((f) => 
        `- [Frame ${f.frameIndex} @ ${f.timestamp}]: Subject: "${f.subject}", Action: "${f.action}", Camera: "${f.camera}", Lighting: "${f.lighting}", Composition: "${f.composition}", Mood: "${f.mood}"${f.onScreenText ? `, Text: "${f.onScreenText}"` : ''}`
      ).join('\n')
    : 'No visual frames available; construct scenes based on title, brief, product, model, background, and creative instruction.';

  const hasBriefInputs = Boolean(
    productName || productDescription || productImage ||
    modelTalent || modelImage ||
    backgroundSetting || backgroundImage || mainBrief || customAssetsAnalysis
  );

  const aiImageAnalysisPromptText = inputImageAnalysis ? `
AI VLM DETAILED VISUAL INSPECTION OF UPLOADED INPUT IMAGES:
${inputImageAnalysis.productImageAnalysis ? `- DETECTED PRODUCT VISUAL FEATURES: "${inputImageAnalysis.productImageAnalysis}"` : ''}
${inputImageAnalysis.modelImageAnalysis ? `- DETECTED MODEL/TALENT VISUAL FEATURES: "${inputImageAnalysis.modelImageAnalysis}"` : ''}
${inputImageAnalysis.backgroundImageAnalysis ? `- DETECTED BACKGROUND VISUAL FEATURES: "${inputImageAnalysis.backgroundImageAnalysis}"` : ''}
` : '';

  const briefConsistencyRules = hasBriefInputs
    ? `
CRITICAL VISUAL CONSISTENCY MANDATE:
You are constructing a multi-scene storyboard based on custom user brief inputs and uploaded reference images. You MUST maintain 100% VISUAL CONSISTENCY across ALL generated scenes!
- PRODUCT SPECS: ${productName || 'Produk Utama'} ${productDescription ? `(${productDescription})` : ''} ${productImage ? '[Gambar Referensi Produk Diunggah]' : ''}
- MODEL / TALENT SPECS: ${modelTalent || 'Karakter / Model Utama'} ${modelImage ? '[Gambar Referensi Model Diunggah]' : ''}
- BACKGROUND / SETTING SPECS: ${backgroundSetting || 'Latar Tempat / Setting Environment'} ${backgroundImage ? '[Gambar Referensi Background Diunggah]' : ''}
- MAIN CREATIVE BRIEF: ${mainBrief || rawPrompt || 'Promosi produk viral TikTok'}

${customAssetsAnalysis ? `
CRITICAL ADDITIONAL REFERENCE ASSETS TO INTEGRATE:
The user has uploaded extra reference assets. You MUST weave these custom assets naturally into the appropriate scenes (either visually or in their visual prompts/descriptions):
${customAssetsAnalysis}
` : ''}

${aiImageAnalysisPromptText}

STRICT PROMPT RULES FOR VISUAL CONSISTENCY:
1. STRICT PRODUCT ISOLATION: The product being advertised is EXCLUSIVELY "${productName || 'the main product'}". If the reference photo for Model/Talent or Background originally contained a different product/package/fruit (for example, if the model photo shows a watermelon pouch or another brand), you MUST COMPLETELY DISREGARD that foreign item. The Model MUST ONLY interact with or hold the Main Product: "${productName || 'the main product'}" (${inputImageAnalysis?.productImageAnalysis || 'melon seed package'}).
2. Every scene's \`imagePrompt\` MUST explicitly describe the EXACT same Model/Talent (${inputImageAnalysis?.modelImageAnalysis ? `visual traits: ${inputImageAnalysis.modelImageAnalysis}` : (modelTalent || 'the main model')}), the EXACT same Product (${inputImageAnalysis?.productImageAnalysis ? `visual traits: ${inputImageAnalysis.productImageAnalysis}` : (productName || 'the main product')}), and the EXACT same Background (${inputImageAnalysis?.backgroundImageAnalysis ? `visual traits: ${inputImageAnalysis.backgroundImageAnalysis}` : (backgroundSetting || 'the setting background')}), while varying the camera angle, body posture, gesture, action, and lighting to fit that specific scene's story beat.
3. In every scene's \`visualDescription\`, describe in Indonesian how the Model interacts with the Product in the Background setting.
4. Maintain the exact same character age, attire, hairstyle, product colors, and room decor from Scene 1 to Scene ${numScenes || 'N'} so that all generated images look like a single coherent commercial shoot.
` : '';

  const systemPrompt = `You are a master creative director, e-commerce content strategist, and world-class AI video prompt engineer specializing in viral TikTok/Reels product funnels.
Your task is to act as a TEMPORAL AGGREGATOR and BRIEF SYNTHESIZER that constructs a professional, highly engaging multi-scene storyboard.

${briefConsistencyRules}

ACCURATE DURATION & SCENE BREAKDOWN RULES:
- The total video duration is: ${videoDuration} seconds.
- You MUST divide the storyboard scenes to match this exact total duration of ${videoDuration} seconds!
${numScenes ? `- You MUST create EXACTLY ${numScenes} scenes!` : `- Create a logical breakdown (e.g. 4 to 6 scenes) that evenly divides ${videoDuration} seconds.`}
- Calculate sequential timecodes for each scene starting from 00:00 to the end (e.g., Scene 1: [00:00 - 00:05] (Durasi: 5 detik), Scene 2: [00:05 - 00:10] (Durasi: 5 detik), etc.).
- The sum of durationSec across all scenes MUST equal ${videoDuration} seconds!

For each scene, you MUST provide:
1. sceneNumber: (1, 2, 3...)
2. title: Catchy scene title (e.g. "Scene 1: The Hook")
3. timecode: Precise timecode string (e.g. "00:00 - 00:05 (Durasi: 5 detik)")
4. durationSec: Number of seconds (e.g. 5)
5. visualDescription: Detailed visual direction in Indonesian ("Arah Visual: Model di kamar mandi estetik...")
6. voiceover: Exact script or voiceover in Indonesian ("Voiceover (VO): Narasi ucapan di scene ini...")
7. onScreenText: Catchy on-screen caption/headline with emojis ("Teks di Layar: GLOWING INSTAN CUMA 7 HARI! ✨")
8. cameraAngle: Specific camera angle and framing (e.g. "Macro extreme close-up", "Eye-level medium shot", "Top-down flatlay")
9. imagePrompt: Master-grade photorealistic commercial English prompt for AI Image Generator (${imageModel} / FLUX) with vertical ${aspectRatio}, incorporating the exact same Model (${modelTalent || 'character'}), Product (${productName || 'product'}), and Background (${backgroundSetting || 'setting'}), crisp lighting, 8k resolution.
10. videoPrompt: English camera & subject motion prompt for AI Video Generator (Minimax / Hailuo / Kling / Wan2.1) detailing camera trajectory and subject motion.

CRITICAL: You MUST respond ONLY with valid JSON in the exact structure below without any markdown code fences, chatter, or explanations:
{
  "metadata": {
    "title": "${videoTitle.replace(/"/g, "'")}",
    "author": "${videoAuthor.replace(/"/g, "'")}",
    "audio": "${videoAudio.replace(/"/g, "'")}",
    "duration": ${videoDuration},
    "tags": [${videoTags.map((t: string) => `"${t}"`).join(',')}]
  },
  "analysis": {
    "hookAnalysis": "Detailed explanation of why the hook grabs instant attention",
    "productOrTopicName": "${(productName || videoTitle).replace(/"/g, "'")}",
    "modelTalent": "${(modelTalent || '').replace(/"/g, "'")}",
    "backgroundSetting": "${(backgroundSetting || '').replace(/"/g, "'")}",
    "mainBrief": "${(mainBrief || rawPrompt || '').replace(/"/g, "'")}",
    "targetAudience": "Specific target buyers",
    "coreUSPs": [
      "Key selling point 1",
      "Key selling point 2",
      "Key selling point 3",
      "Key selling point 4"
    ],
    "visualProofStrategy": "Why visual proof and model interaction builds trust",
    "callToActionAnalysis": "Clear purchase direction for checkout / yellow shopping cart",
    "transcript": "Transkrip narasi suara",
    "contentSummary": "Ringkasan alur promosi"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene 1: The Hook",
      "timecode": "00:00 - 00:05 (Durasi: 5 detik)",
      "durationSec": 5,
      "sceneGoal": "Stop scrolling instantly",
      "visualDescription": "Close-up model memperlihatkan produk...",
      "voiceover": "Siapa yang masih bingung cari skincare glowing?",
      "onScreenText": "CUMA 7 HARI BISA GLOWING BANGET?! ✨",
      "cameraAngle": "Close-up dramatic eye-level",
      "imagePrompt": "Vertical ${aspectRatio}, close-up shot, [Model Description], holding [Product Description], [Background Description], photorealistic 8k, studio commercial lighting.",
      "videoPrompt": "Slow zoom in on model holding the product with natural smiling expression."
    }
  ]
}`;

  const briefContextText = hasBriefInputs ? `
=== USER BRIEF & CONSISTENCY INPUTS ===
- Product Name: ${productName || '-'}
- Product Description / Appearance: ${productDescription || '-'}
- Model / Talent Specs: ${modelTalent || '-'}
- Background / Setting Specs: ${backgroundSetting || '-'}
- Main Brief / Creative Direction: ${mainBrief || rawPrompt || '-'}
- Target Total Duration: ${videoDuration} seconds
- Target Scene Count: ${numScenes ? `${numScenes} scenes` : 'Auto-divide logically'}
` : '';

  const userPrompt = `${briefContextText}
Video Title / Caption: ${videoTitle}
Author / Account: ${videoAuthor}
Audio: ${videoAudio}
Tags: ${videoTags.join(', ')}
Total Duration: ${videoDuration} seconds
User Extra Instruction: ${rawPrompt || mainBrief || 'Buatkan storyboard komersial yang konsisten dengan rincian scene lengkap.'}
Aspect Ratio: ${aspectRatio}
${numScenes ? `Requested Scene Count: ${numScenes}` : `Scene Count: Tentukan jumlah scene pas membagi total durasi ${videoDuration} detik`}

EXTRACTED SEQUENTIAL FRAME OBSERVATIONS:
${frameTimelineSummary}

Please aggregate these inputs, enforce 100% visual consistency for Model, Product, and Background across all scenes, divide into scenes strictly matching ${videoDuration}s duration, and return valid JSON now.`;

  let llmText = '';
  let confirmedModel = aiModel;

  // Direct Gemini call helper
  const tryDirectGemini = async (modelToUse: string = 'gemini-flash-lite-latest') => {
    if (!process.env.GEMINI_API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let preferred = 'gemini-flash-lite-latest';
    if (modelToUse.includes('pro')) {
      preferred = 'gemini-3.8-flash';
    } else if (modelToUse.includes('gemini-')) {
      const raw = modelToUse.replace('google/', '');
      preferred = (raw === 'gemini-2.5-flash' || raw === 'gemini-2.0-flash' || raw === 'gemini-1.5-flash') ? 'gemini-flash-lite-latest' : raw;
    }

    const candidateModels = Array.from(new Set([
      preferred,
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ]));

    for (const modelName of candidateModels) {
      try {
        console.log(`[Studio Aggregator] Calling Google GenAI directly with ${modelName}...`);
        const resp = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
            }
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          }
        });
        if (resp.text) return resp.text;
      } catch (geminiErr: any) {
        console.warn(`[Studio Aggregator Direct Gemini Failed with ${modelName}]:`, geminiErr.message?.slice(0, 100));
      }
    }
    return null;
  };

  // If Google model selected and GEMINI_API_KEY available, try direct Gemini first
  if (aiModel.includes('google/') && process.env.GEMINI_API_KEY) {
    const directResult = await tryDirectGemini(aiModel);
    if (directResult) {
      llmText = directResult;
      confirmedModel = aiModel;
    }
  }

  // If not yet answered, try Weavy enhance-prompt
  if (!llmText) {
    try {
      const enhanceResp = await axios.post('http://127.0.0.1:3000/api/enhance-prompt', {
        prompt: userPrompt,
        systemPrompt,
        isAnyLLM: true,
        model: aiModel,
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseFormat: 'json',
        refreshToken,
        idToken,
        allRefreshTokens,
      }, { timeout: 60000 });

      llmText = enhanceResp.data?.enhancedPrompt || enhanceResp.data?.text || '';
      if (enhanceResp.data?.model) {
        confirmedModel = enhanceResp.data.model;
      }
    } catch (e: any) {
      console.warn('[Studio Aggregator] Internal enhance-prompt call failed, trying direct Gemini fallback:', e.message);
    }
  }

  // If still empty, fallback to Gemini 2.5 Flash
  if (!llmText && process.env.GEMINI_API_KEY) {
    const fallbackResult = await tryDirectGemini('gemini-2.5-flash');
    if (fallbackResult) {
      llmText = fallbackResult;
      confirmedModel = 'google/gemini-2.5-flash';
    }
  }

  if (!llmText) {
    throw new Error('Gagal mendapatkan respon agregasi timeline dari AI model.');
  }

  // Clean JSON response
  let cleanedJsonStr = llmText.trim();
  if (cleanedJsonStr.includes('```')) {
    const match = cleanedJsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanedJsonStr = match[1].trim();
    } else {
      cleanedJsonStr = cleanedJsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
  }

  let parsedResult: any = null;
  try {
    parsedResult = JSON.parse(cleanedJsonStr);
  } catch (parseErr) {
    const firstBrace = cleanedJsonStr.indexOf('{');
    const lastBrace = cleanedJsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleanedJsonStr.slice(firstBrace, lastBrace + 1);
      try {
        parsedResult = JSON.parse(candidate);
      } catch (innerErr: any) {
        const sanitized = candidate
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[\u0000-\u001F]+/g, (m) => (m.includes('\n') ? '\\n' : ''));
        parsedResult = JSON.parse(sanitized);
      }
    } else {
      throw new Error('Gagal mem-parsing format JSON dari AI model.');
    }
  }

  if (parsedResult && inputImageAnalysis) {
    if (!parsedResult.analysis) parsedResult.analysis = {};
    if (inputImageAnalysis.productImageAnalysis) parsedResult.analysis.productImageAnalysis = inputImageAnalysis.productImageAnalysis;
    if (inputImageAnalysis.modelImageAnalysis) parsedResult.analysis.modelImageAnalysis = inputImageAnalysis.modelImageAnalysis;
    if (inputImageAnalysis.backgroundImageAnalysis) parsedResult.analysis.backgroundImageAnalysis = inputImageAnalysis.backgroundImageAnalysis;
  }

  return { parsedResult, confirmedModel };
}

/**
 * 6. Verification Loop Placeholder (Interface for future embedding similarity validation)
 */
export async function verifyPromptSimilarity(
  scenePrompt: string,
  frameObservation: FrameObservation
): Promise<{
  isSimilar: boolean;
  similarityScore: number;
  needsRevision: boolean;
  notes?: string;
}> {
  // Placeholder implementation: will be expanded with visual/text embedding comparison in next phase
  return {
    isSimilar: true,
    similarityScore: 1.0,
    needsRevision: false,
    notes: 'Placeholder verification: embedding similarity model ready for integration.',
  };
}

/**
 * POST /api/studio/analyze-video
 * Full pipeline: Ingest -> Frame Extraction -> VLM -> Schema Validation -> Temporal Aggregator -> Prompt Enhancement -> Response
 */
router.post('/studio/analyze-video', async (req, res) => {
  let frameExtractionCleanup: (() => void) | null = null;

  try {
    const {
      videoUrl,
      title: manualTitle,
      productName,
      productDescription,
      productImage,
      modelTalent,
      modelImage,
      backgroundSetting,
      backgroundImage,
      mainBrief,
      totalDurationSec,
      rawPrompt,
      numScenes,
      aspectRatio = '9:16',
      imageModel = 'GPT Image 2.5',
      aiModel,
      model,
      customAssets,
      refreshToken,
      idToken,
      allRefreshTokens,
    } = req.body || {};

    const selectedAiModel = aiModel || model || 'google/gemini-2.5-flash';
    console.log(`[Studio Ingest Pipeline] Starting video analysis with model: ${selectedAiModel}`);

    // Step 1: Video Ingestion & Download
    let videoDetails: any = null;
    if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim()) {
      videoDetails = await extractAndDownloadVideo(videoUrl.trim());
    } else {
      videoDetails = {
        title: manualTitle || productName || 'Custom Video Project',
        author: 'Creator',
        audioName: 'Original Sound',
        thumbnailUrl: '',
        duration: totalDurationSec || 15,
        tags: [],
        playUrl: '',
        rawUrl: '',
        localFilePath: undefined,
        downloaderType: 'sample',
      };
    }

    const videoTitle = videoDetails?.title || manualTitle || productName || 'Produk Unggulan';
    const videoAuthor = videoDetails?.author || 'Creator';
    const videoAudio = videoDetails?.audioName || 'Original Sound';
    const videoTags = Array.isArray(videoDetails?.tags) ? videoDetails.tags : [];
    const videoDuration = totalDurationSec || (typeof videoDetails?.duration === 'number' && videoDetails.duration > 0 ? videoDetails.duration : 30);
    const localFilePath = videoDetails?.localFilePath;

    // Step 2: Frame Extractor (ffmpeg child process)
    let frameObservations: FrameObservation[] = [];
    let framesExtractedCount = 0;

    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        console.log(`[Studio Pipeline] Local video file found at ${localFilePath}. Extracting frames...`);
        const extraction = await extractVideoFrames(localFilePath, videoDuration, numScenes ? Math.max(numScenes, 6) : 8);
        frameExtractionCleanup = extraction.cleanup;
        framesExtractedCount = extraction.frameFiles.length;

        // Step 3: VLM Per-Frame / Segment Analysis
        if (extraction.frameFiles.length > 0) {
          console.log(`[Studio Pipeline] Analyzing ${extraction.frameFiles.length} frames with VLM...`);
          frameObservations = await analyzeFramesWithVLM(extraction.frameFiles, selectedAiModel, {
            title: videoTitle,
            author: videoAuthor,
            tags: videoTags,
          });
        }
      } catch (extractErr: any) {
        console.warn('[Studio Pipeline Frame Extraction Skipped]:', extractErr.message);
      }
    } else {
      console.log('[Studio Pipeline] No local video downloaded; relying on metadata-driven temporal synthesis.');
    }

    // Step 3.5: Analyze Uploaded Input Images with Gemini VLM (Product, Model, Background)
    let inputImageAnalysis: { productImageAnalysis?: string; modelImageAnalysis?: string; backgroundImageAnalysis?: string } = {};
    if (productImage || modelImage || backgroundImage) {
      console.log('[Studio Pipeline] Analyzing uploaded input images (Product, Model, Background) with Gemini VLM...');
      inputImageAnalysis = await analyzeBriefInputImagesVLM(productImage, modelImage, backgroundImage);
    }

    // Step 3.6: Analyze Custom Reference Assets with Gemini VLM
    let customAssetsAnalysis = '';
    if (customAssets && Array.isArray(customAssets) && customAssets.length > 0) {
      console.log('[Studio Pipeline] Analyzing uploaded custom reference assets with Gemini VLM...');
      customAssetsAnalysis = await analyzeCustomAssetsVLM(customAssets);
    }

    // Step 4 & 5: Temporal Aggregator & Scene Breakdown
    console.log(`[Studio Pipeline] Aggregating timeline & synthesizing scene breakdown (${frameObservations.length} frame observations)...`);
    const { parsedResult, confirmedModel } = await aggregateTimelineAndBuildStoryboard({
      videoTitle,
      videoAuthor,
      videoAudio,
      videoDuration,
      videoTags,
      rawPrompt,
      productName,
      productDescription,
      productImage,
      modelTalent,
      modelImage,
      backgroundSetting,
      backgroundImage,
      mainBrief,
      numScenes,
      aspectRatio,
      imageModel,
      aiModel: selectedAiModel,
      frameObservations,
      inputImageAnalysis,
      customAssetsAnalysis,
      refreshToken,
      idToken,
      allRefreshTokens,
    });

    // Step 6: Attach Metadata, Frame Observations & Pipeline Telemetry
    if (!parsedResult.metadata || !parsedResult.metadata.thumbnailUrl) {
      parsedResult.metadata = {
        title: videoTitle,
        author: videoAuthor,
        audio: videoAudio,
        duration: videoDuration,
        tags: videoTags,
        thumbnailUrl: videoDetails?.thumbnailUrl || '',
        playUrl: videoDetails?.playUrl || '',
        rawUrl: videoDetails?.rawUrl || '',
        ...(parsedResult.metadata || {}),
      };
    }

    // Ensure scenes have UUIDs, formatted timecodes & status
    if (Array.isArray(parsedResult.scenes)) {
      let accumulatedSec = 0;
      parsedResult.scenes = parsedResult.scenes.map((s: any, idx: number) => {
        const dur = Number(s.durationSec) || 5;
        const startSec = accumulatedSec;
        const endSec = startSec + dur;
        accumulatedSec = endSec;

        const formatTime = (secs: number) => {
          const m = Math.floor(secs / 60);
          const sc = Math.floor(secs % 60);
          return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
        };

        const calculatedTimecode = s.timecode || `${formatTime(startSec)} - ${formatTime(endSec)} (Durasi: ${dur} detik)`;

        return {
          id: `scene_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
          sceneNumber: s.sceneNumber || idx + 1,
          title: s.title || `Scene ${idx + 1}`,
          durationSec: dur,
          timecode: calculatedTimecode,
          startSec,
          endSec,
          sceneGoal: s.sceneGoal || '',
          visualDescription: s.visualDescription || s.visual || '',
          voiceover: s.voiceover || s.narasi || s.vo || '',
          onScreenText: s.onScreenText || s.teksDiLayar || s.caption || '',
          cameraAngle: s.cameraAngle || 'Medium close-up',
          imagePrompt: s.imagePrompt || '',
          videoPrompt: s.videoPrompt || s.motionPrompt || s.videoMotionPrompt || '',
          status: 'idle',
        };
      });
    }

    if (!parsedResult.analysis) {
      parsedResult.analysis = {
        hookAnalysis: parsedResult.hookAnalysis || 'Hook visual memikat perhatian audiens sejak awal.',
        productOrTopicName: parsedResult.productOrTopicName || videoTitle,
        targetAudience: parsedResult.targetAudience || 'Target audiens potensial',
        coreUSPs: Array.isArray(parsedResult.coreUSPs) ? parsedResult.coreUSPs : [],
        visualProofStrategy: parsedResult.visualProofStrategy || 'Bukti visual autentik dan komparasi hasil panen.',
        callToActionAnalysis: parsedResult.callToActionAnalysis || 'Arahan beli yang jelas mengarahkan ke keranjang kuning.',
        transcript: parsedResult.transcript || '',
        contentSummary: parsedResult.contentSummary || '',
      };
    }

    parsedResult.analysis.frameObservations = frameObservations;
    parsedResult.analysis.pipelineMetadata = {
      downloader: videoDetails?.downloaderType || 'sample',
      framesExtracted: framesExtractedCount,
      framesAnalyzed: frameObservations.length,
      vlmModelUsed: confirmedModel || selectedAiModel,
      temporalAggregationCompleted: true,
      promptEnhancementApplied: true,
      verificationStatus: 'skipped_placeholder',
    };

    parsedResult.aiModel = confirmedModel || selectedAiModel;

    console.log(`[Studio Pipeline Completed] Successfully generated ${parsedResult.scenes?.length || 0} scenes with ${frameObservations.length} frame observations.`);

    return res.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('[Studio Analyze Video Pipeline Error]:', error?.response?.data || error?.message);
    return res.status(500).json({
      success: false,
      error: cleanErrorMessage(error),
    });
  } finally {
    // Cleanup temporary frame images
    if (frameExtractionCleanup) {
      frameExtractionCleanup();
    }
  }
});

/**
 * POST /api/studio/remix-storyboard
 * ATM (Amati - Tiru - Modifikasi) Engine:
 * Takes existing analysis + user's target duration + character input + product + style modifiers
 * Re-architects a superior storyboard version + new Master Visual Sheet Prompt
 */
router.post('/studio/remix-storyboard', async (req, res) => {
  try {
    const {
      baseAnalysis,
      baseMetadata,
      targetDurationSec = 30,
      numScenes,
      numCameraAngles,
      preferredAngles,
      remixStyle = 'viral-hook-pain-agitate',
      customStyleNotes,
      characterTalent,
      characterImage,
      productName,
      productDescription,
      productImage,
      backgroundSetting,
      backgroundImage,
      creativeAngle,
      aspectRatio = '9:16',
      imageModel = 'ChatGPT Images 2.0 Edit',
      aiModel = 'google/gemini-2.5-flash',
      refreshToken,
      idToken,
      allRefreshTokens,
    } = req.body || {};

    console.log(`[Studio ATM Remix] Starting remix pipeline: targetDuration=${targetDurationSec}s, numScenes=${numScenes}, cameraAngles=${numCameraAngles}, style=${remixStyle}, aiModel=${aiModel}`);

    // Step 1: Analyze any newly provided character/talent image or product image with Gemini VLM
    let inputImageAnalysis: { productImageAnalysis?: string; modelImageAnalysis?: string; backgroundImageAnalysis?: string } = {};
    if (characterImage || productImage || backgroundImage) {
      console.log('[Studio ATM Remix] Analyzing uploaded character/product reference images with Gemini VLM...');
      inputImageAnalysis = await analyzeBriefInputImagesVLM(productImage, characterImage, backgroundImage);
    }

    // Step 2: Build ATM Style descriptor
    const styleDescriptions: Record<string, string> = {
      'viral-hook-pain-agitate': 'Hook Agresif & Solusi Masalah Nyata (Pain-Agitate-Solve) - Langsung to the point menyoroti masalah audiens di detik pertama, lalu memberikan solusi instan lewat produk.',
      'ugc-honest-review': 'UGC Review Jujur & Spontan (High Trust) - Gaya creator natural seperti teman bercerita, unboxing santai, memperlihatkan tekstur asli dan hasil langsung.',
      'daily-vlog-storytelling': 'Daily Vlog & Emotional Storytelling - Alur cerita keseharian yang relate dengan target audiens, memperlihatkan rutinitas sebelum & sesudah menggunakan produk.',
      'hard-sell-fomo': 'Hard-Selling Promo & FOMO (TikTok Shop Flash Sale) - Penekanan pada urgensi diskon terbatas, bonus eksklusif, dan ajakan checkout keranjang kuning detik ini juga.',
      'extreme-demo-proof': 'Pembuktian Ekstrem & Demo Visual (Extreme Proof) - Fokus pada tes ketahanan, perbandingan langsung (before-after ekstrem), dan close-up detail keunggulan produk.',
      'educational-unboxing': 'Edukasi Produk & Unboxing Elegan - Penjelasan bahan/kelebihan teknis dengan cara sederhana, visual bersih berkelas, dan tips pemakaian terbaik.',
      'custom': customStyleNotes || creativeAngle || 'Gaya modifikasi kustom yang disesuaikan dengan permintaan pengguna.',
    };

    const chosenStyleDescription = styleDescriptions[remixStyle] || styleDescriptions['viral-hook-pain-agitate'];

    // Determine target scene count if not explicitly set
    const calculatedNumScenes = numScenes || (
      targetDurationSec <= 15 ? 4 :
      targetDurationSec <= 30 ? 6 :
      targetDurationSec <= 45 ? 7 : 8
    );

    const calculatedCameraAngles = numCameraAngles || Math.min(calculatedNumScenes, 4);

    const charSpec = characterTalent || (inputImageAnalysis.modelImageAnalysis ? `Karakter Model: ${inputImageAnalysis.modelImageAnalysis}` : 'Model / Talent Utama');
    const prodSpec = productName || baseAnalysis?.productOrTopicName || 'Produk Utama';
    const bgSpec = backgroundSetting || 'Latar Tempat Sesuai Produk';

    const anglesDirective = preferredAngles && preferredAngles.length > 0
      ? `Prioritize using these specific camera angles: ${preferredAngles.join(', ')}.`
      : `Use varied dynamic angles like Macro Close-Up, Dutch Tilt, Low Angle Hero, High Angle Overhead, Medium OTS (Over-The-Shoulder), Tracking Side-View, etc.`;

    const systemPrompt = `You are a world-class creative director, conversion copywriter, and viral video strategist specializing in the Indonesian TikTok Shop & Reels market.
Your task is to execute the "ATM METHOD (Amati, Tiru, Modifikasi)" on an existing video analysis:
1. AMATI (Observe): Study what made the original video captivating (the hooks, product selling points, demonstration style, audience psychology).
2. TIRU (Emulate): Keep the proven retention curve, high-converting pacing, and psychological triggers.
3. MODIFIKASI (Modify): Elevate the content into a BRAND-NEW, SUPERIOR VERSION specifically tailored to:
   - Target Total Duration: EXACTLY ${targetDurationSec} seconds (divided into ${calculatedNumScenes} sequential scenes).
   - CAMERA ANGLE DIVERSITY: You MUST utilize and distribute EXACTLY ${calculatedCameraAngles} DISTINCT camera angles across all ${calculatedNumScenes} scenes. ${anglesDirective}
   - Character / Talent Persona: ${charSpec}
   ${inputImageAnalysis.modelImageAnalysis ? `- Detected Character Visual Features: "${inputImageAnalysis.modelImageAnalysis}"` : ''}
   - Product Specifications: ${prodSpec} ${productDescription ? `(${productDescription})` : ''}
   ${inputImageAnalysis.productImageAnalysis ? `- Detected Product Visual Features: "${inputImageAnalysis.productImageAnalysis}"` : ''}
   - Background / Setting: ${bgSpec}
   ${inputImageAnalysis.backgroundImageAnalysis ? `- Detected Background Visual Features: "${inputImageAnalysis.backgroundImageAnalysis}"` : ''}
   - Selected Creative Angle / Formula: "${chosenStyleDescription}"
   ${creativeAngle ? `- User Creative Direction: "${creativeAngle}"` : ''}

CRITICAL RULES FOR ATM STORYBOARD REMIX:
- TOTAL DURATION: The sum of durationSec across all ${calculatedNumScenes} scenes MUST equal EXACTLY ${targetDurationSec} seconds!
- CAMERA ANGLE PRECISION: Distribute ${calculatedCameraAngles} unique camera shot angles across the storyboard. Each scene's \`cameraAngle\`, \`imagePrompt\`, and \`videoPrompt\` MUST clearly reflect its designated camera angle (e.g. "Low-angle heroic shot looking up", "Top-down 90-degree flat lay", "Close-up macro on texture", "Over-the-shoulder POV holding product").
- 100% VISUAL CONSISTENCY: Every single scene's \`imagePrompt\` MUST describe the EXACT same Character/Talent (${charSpec}), holding/interacting with the EXACT same Product (${prodSpec}), in the specified setting.
- ALL PROMPTS:
  * \`cameraAngle\`: Specific unique camera angle (e.g. "Dynamic Low-Angle", "Macro Product Close-up", "Eye-Level Medium Shot", "Top-Down Overhead Flatlay").
  * \`visualDescription\`: Detailed scene action in natural Indonesian.
  * \`voiceover\`: High-converting, punchy Indonesian script/voiceover matching the target duration.
  * \`onScreenText\`: Eye-catching Indonesian captions with emojis.
  * \`imagePrompt\`: Ultra-high quality commercial English prompt for ${imageModel} with vertical ${aspectRatio}, photorealistic 8k, studio commercial lighting.
  * \`videoPrompt\`: Dynamic camera and character motion direction in English reflecting the camera angle.
- MASTER PRODUCTION SHEET PROMPT (Peta Visual Produksi 16:9):
  Create a single unified 4-panel master prompt that showcases:
  [Panel 1: Product Close-Up & Details] + [Panel 2: Full Body / Portrait of ${charSpec}] + [Panel 3: Environment Setting] + [Panel 4: Action/Key Interaction of Character with Product].

You MUST respond ONLY with valid JSON in the exact structure below without markdown fences:
{
  "remixedAnalysis": {
    "hookAnalysis": "Penjelasan mengapa hook versi baru ini jauh lebih memikat dan relevan",
    "productOrTopicName": "${prodSpec.replace(/"/g, "'")}",
    "modelTalent": "${charSpec.replace(/"/g, "'")}",
    "backgroundSetting": "${bgSpec.replace(/"/g, "'")}",
    "mainBrief": "Konsep ATM Remix: ${chosenStyleDescription.replace(/"/g, "'")}",
    "targetAudience": "${(baseAnalysis?.targetAudience || 'Target audiens potensial').replace(/"/g, "'")}",
    "coreUSPs": ${JSON.stringify(baseAnalysis?.coreUSPs || ['Keunggulan utama 1', 'Keunggulan utama 2', 'Keunggulan utama 3'])},
    "visualProofStrategy": "Strategi pembuktian visual yang ditingkatkan dengan karakter baru",
    "callToActionAnalysis": "Ajakan bertindak / CTA yang persuasif",
    "transcript": "Transkrip naskah lengkap seluruh scene yang telah dirancang ulang",
    "contentSummary": "Ringkasan konsep ATM baru berdurasi ${targetDurationSec} detik"
  },
  "masterProductionSheetPrompt": "Split-screen 4-panel master visual production sheet in 16:9 aspect ratio, showing [Panel 1: Photorealistic commercial product shot of ${prodSpec.replace(/"/g, "'")}], [Panel 2: Ultra-detailed character portrait of ${charSpec.replace(/"/g, "'")}], [Panel 3: Cinematic commercial background of ${bgSpec.replace(/"/g, "'")}], [Panel 4: Character dynamically interacting with product]. 8k resolution, photorealistic studio lighting, cohesive color grading, hyper-detailed textures.",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene 1: The Upgraded Hook",
      "timecode": "00:00 - 00:05 (Durasi: 5 detik)",
      "durationSec": 5,
      "sceneGoal": "Stop scrolling instantly with powerful problem/curiosity hook",
      "visualDescription": "Close-up karakter memperlihatkan ekspresi terkejut dan produk...",
      "voiceover": "Script narasi scene 1 dalam bahasa Indonesia...",
      "onScreenText": "TEKS VIRAL DI LAYAR! 🔥",
      "cameraAngle": "Dynamic eye-level close-up",
      "imagePrompt": "Vertical ${aspectRatio}, close-up shot of ${charSpec.replace(/"/g, "'")}, holding ${prodSpec.replace(/"/g, "'")}, ${bgSpec.replace(/"/g, "'")}, photorealistic 8k, cinematic commercial lighting, crystal clear details.",
      "videoPrompt": "Smooth zoom in on talent holding product with expressive eye contact and smile."
    }
  ]
}`;

    const userPrompt = `ORIGINAL VIDEO BASELINE:
- Title / Context: ${baseMetadata?.title || baseAnalysis?.productOrTopicName || 'Video Original'}
- Original Hook Analysis: ${baseAnalysis?.hookAnalysis || '-'}
- Original Core USPs: ${(baseAnalysis?.coreUSPs || []).join(', ')}
- Original Proof Strategy: ${baseAnalysis?.visualProofStrategy || '-'}
- Original Transcript: ${baseAnalysis?.transcript || '-'}

NEW ATM REMIX PARAMETERS:
- Target Total Duration: ${targetDurationSec} seconds
- Total Scenes: ${calculatedNumScenes} scenes
- Camera Angle Diversity: ${calculatedCameraAngles} distinct camera angles${preferredAngles && preferredAngles.length > 0 ? ` (${preferredAngles.join(', ')})` : ''}
- Remix Formula / Angle: ${chosenStyleDescription}
- Character / Model: ${charSpec}
- Product: ${prodSpec}
- Background: ${bgSpec}
- Aspect Ratio: ${aspectRatio}
- Image Model: ${imageModel}

Execute the ATM (Amati, Tiru, Modifikasi) method now and output the complete remixed JSON structure.`;

    let llmText = '';
    let confirmedModel = aiModel;

    // Direct Gemini execution
    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let preferred = 'gemini-flash-lite-latest';
      if (aiModel.includes('pro')) {
        preferred = 'gemini-3.8-flash';
      } else if (aiModel.includes('gemini-')) {
        const raw = aiModel.replace('google/', '');
        preferred = (raw === 'gemini-2.5-flash' || raw === 'gemini-2.0-flash' || raw === 'gemini-1.5-flash') ? 'gemini-flash-lite-latest' : raw;
      }

      const candidateModels = Array.from(new Set([
        preferred,
        'gemini-flash-lite-latest',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
      ]));

      for (const mName of candidateModels) {
        try {
          console.log(`[Studio ATM Remix] Calling Gemini with ${mName}...`);
          const resp = await ai.models.generateContent({
            model: mName,
            contents: [
              {
                role: 'user',
                parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
              },
            ],
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          });

          if (resp && resp.text) {
            llmText = resp.text.trim();
            confirmedModel = mName;
            break;
          }
        } catch (err: any) {
          console.warn(`[Studio ATM Remix Gemini ${mName} failed]:`, err.message?.slice(0, 100));
        }
      }
    }

    // Fallback to Weavy LLM if Gemini direct was not configured
    if (!llmText) {
      console.log('[Studio ATM Remix] Calling Weavy LLM proxy via enhance-prompt...');
      try {
        const enhanceResp = await axios.post('http://127.0.0.1:3000/api/enhance-prompt', {
          prompt: userPrompt,
          systemPrompt,
          isAnyLLM: true,
          model: aiModel,
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseFormat: 'json',
          refreshToken,
          idToken,
          allRefreshTokens,
        }, { timeout: 60000 });

        llmText = enhanceResp.data?.enhancedPrompt || enhanceResp.data?.text || '';
        if (enhanceResp.data?.model) {
          confirmedModel = enhanceResp.data.model;
        }
      } catch (e: any) {
        console.warn('[Studio ATM Remix] enhance-prompt call failed:', e.message);
      }
    }

    let parsedResult: any = null;
    try {
      const cleanJson = llmText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('[Studio ATM Remix JSON Parse Error]:', parseErr, llmText.slice(0, 300));
      throw new Error('Gagal memproses hasil JSON dari AI Remix. Silakan coba kembali.');
    }

    // Calculate scene timecodes and sequential structure
    if (Array.isArray(parsedResult.scenes)) {
      let accumulatedSec = 0;
      parsedResult.scenes = parsedResult.scenes.map((s: any, idx: number) => {
        const dur = Number(s.durationSec) || Math.round(targetDurationSec / parsedResult.scenes.length);
        const startSec = accumulatedSec;
        const endSec = startSec + dur;
        accumulatedSec = endSec;

        const formatTime = (secs: number) => {
          const m = Math.floor(secs / 60);
          const sc = Math.floor(secs % 60);
          return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
        };

        const calculatedTimecode = `${formatTime(startSec)} - ${formatTime(endSec)} (Durasi: ${dur} detik)`;

        return {
          id: `scene_remix_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
          sceneNumber: s.sceneNumber || idx + 1,
          title: s.title || `Scene ${idx + 1}: ${s.sceneGoal || 'Story Beat'}`,
          durationSec: dur,
          timecode: s.timecode || calculatedTimecode,
          startSec,
          endSec,
          sceneGoal: s.sceneGoal || '',
          visualDescription: s.visualDescription || '',
          voiceover: s.voiceover || '',
          onScreenText: s.onScreenText || '',
          cameraAngle: s.cameraAngle || 'Eye-level medium shot',
          imagePrompt: s.imagePrompt || '',
          videoPrompt: s.videoPrompt || '',
          status: 'idle',
        };
      });
    }

    // Inject VLM image features into remixed analysis if analyzed
    if (inputImageAnalysis.modelImageAnalysis && parsedResult.remixedAnalysis) {
      parsedResult.remixedAnalysis.modelImageAnalysis = inputImageAnalysis.modelImageAnalysis;
    }
    if (inputImageAnalysis.productImageAnalysis && parsedResult.remixedAnalysis) {
      parsedResult.remixedAnalysis.productImageAnalysis = inputImageAnalysis.productImageAnalysis;
    }

    return res.json({
      success: true,
      data: {
        remixedAnalysis: parsedResult.remixedAnalysis,
        masterProductionSheetPrompt: parsedResult.masterProductionSheetPrompt,
        scenes: parsedResult.scenes,
        inputImageAnalysis,
        aiModel: confirmedModel,
      },
    });
  } catch (error: any) {
    console.error('[Studio ATM Remix Error]:', error?.response?.data || error?.message);
    return res.status(500).json({
      success: false,
      error: cleanErrorMessage(error),
    });
  }
});

export default router;

