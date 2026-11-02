import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extDir = path.join(rootDir, 'ektension-weavy');
const geminiExtDir = path.join(rootDir, 'ektension-gemini-google');
const publicDir = path.join(rootDir, 'public');
const outputPublicZip = path.join(publicDir, 'ektension-weavy.zip');
const outputRootZip = path.join(rootDir, 'ektension-weavy.zip');
const outputGeminiPublicZip = path.join(publicDir, 'ektension-gemini-google.zip');
const outputGeminiRootZip = path.join(rootDir, 'ektension-gemini-google.zip');

function addDirectoryToZip(zip, folderPath, baseFolderPath) {
  const items = fs.readdirSync(folderPath);

  for (const item of items) {
    // Skip hidden system files or OS metadata if any
    if (item.startsWith('.') && item !== '.github') continue;
    if (item === 'node_modules') continue;

    const fullPath = path.join(folderPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      addDirectoryToZip(zip, fullPath, baseFolderPath);
    } else {
      const relativePath = path.relative(baseFolderPath, fullPath).replace(/\\/g, '/');
      const fileData = fs.readFileSync(fullPath);
      zip.file(relativePath, fileData);
    }
  }
}

async function buildZip() {
  console.log('📦 Membuat file ZIP Chrome Extensions...');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. ektension-weavy
  if (fs.existsSync(extDir)) {
    const zip1 = new JSZip();
    addDirectoryToZip(zip1, extDir, extDir);
    const buf1 = await zip1.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    fs.writeFileSync(outputPublicZip, buf1);
    fs.writeFileSync(outputRootZip, buf1);
    console.log(`✅ ektension-weavy.zip (${(buf1.length / 1024).toFixed(1)} KB)`);
  }

  // 2. ektension-gemini-google
  if (fs.existsSync(geminiExtDir)) {
    const zip2 = new JSZip();
    addDirectoryToZip(zip2, geminiExtDir, geminiExtDir);
    const buf2 = await zip2.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    fs.writeFileSync(outputGeminiPublicZip, buf2);
    fs.writeFileSync(outputGeminiRootZip, buf2);
    console.log(`✅ ektension-gemini-google.zip (${(buf2.length / 1024).toFixed(1)} KB)`);
  }
}

buildZip().catch((err) => {
  console.error('❌ Terjadi kesalahan saat membuat ZIP:', err);
  process.exit(1);
});
