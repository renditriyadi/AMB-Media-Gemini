// canvas-storage.js - Canvas Files Persistence & Management (100% Pola Project Utama)

import { storage } from '../core/storage.js';
import {
  createNanoBananaPreset,
  createSeedreamEditPreset,
  createGrokImaginePreset,
  createGptImage25Preset,
  createPromptEnhancerPreset,
  createGeminiOmniPreset,
  createEmptyCanvasRecipe,
} from './canvas-recipes.js';

const CANVAS_FILES_KEY = 'weavy_canvas_files_v1';
const CANVAS_ACTIVE_FILE_KEY = 'weavy_canvas_active_file_id';

export async function loadAllCanvasFiles() {
  try {
    const raw = await storage.get(CANVAS_FILES_KEY);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw;
    }

    // Seed file awal jika storage masih kosong (persis seperti di project utama)
    const initialFiles = [
      {
        id: 'file_gemini_omni_default',
        name: 'Gemini Omni Flash (Image to Video)',
        description: 'Workflow multimodal video 10 detik Google Gemini.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recipe: createGeminiOmniPreset(),
        isTrash: false,
      },
      {
        id: 'file_nano_banana_default',
        name: 'Nano Banana Pro (Text to Image)',
        description: 'Workflow generasi gambar Google Gemini Nano Banana Pro.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recipe: createNanoBananaPreset(),
        isTrash: false,
      },
      {
        id: 'file_seedream_default',
        name: 'Seedream 5.0 Pro Edit',
        description: 'Workflow Image-to-Image ByteDance Seedream.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recipe: createSeedreamEditPreset(),
        isTrash: false,
      },
      {
        id: 'file_grok_default',
        name: 'Grok Imagine Image',
        description: 'Workflow Text-to-Image xAI Grok.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recipe: createGrokImaginePreset(),
        isTrash: false,
      },
      {
        id: 'file_enhancer_default',
        name: 'Prompt Enhancer & Master Generator',
        description: 'Workflow pengembangan prompt otomatis via LLM.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recipe: createPromptEnhancerPreset(),
        isTrash: false,
      },
    ];

    await storage.set(CANVAS_FILES_KEY, initialFiles);
    return initialFiles;
  } catch (err) {
    console.warn('[Canvas Storage] Gagal load files, return default empty:', err);
    return [];
  }
}

export async function saveAllCanvasFiles(files) {
  try {
    await storage.set(CANVAS_FILES_KEY, files);
  } catch (err) {
    console.error('[Canvas Storage] Gagal menyimpan berkas canvas:', err);
  }
}

export async function createNewCanvasFile(presetRecipe = null, title = '') {
  const files = await loadAllCanvasFiles();
  const recipe = presetRecipe || createEmptyCanvasRecipe(title || 'untitled');
  const fileName = title || recipe.name || 'untitled';

  const newFile = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: fileName,
    description: recipe.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recipe,
    isTrash: false,
  };

  const updated = [newFile, ...files];
  await saveAllCanvasFiles(updated);
  await setActiveCanvasFileId(newFile.id);
  return newFile;
}

export async function updateCanvasFile(fileId, patch = {}) {
  const files = await loadAllCanvasFiles();
  const idx = files.findIndex((f) => f.id === fileId);
  if (idx === -1) return null;

  files[idx] = {
    ...files[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await saveAllCanvasFiles(files);
  return files[idx];
}

export async function duplicateCanvasFile(fileId) {
  const files = await loadAllCanvasFiles();
  const target = files.find((f) => f.id === fileId);
  if (!target) return null;

  const duplicatedRecipe = JSON.parse(JSON.stringify(target.recipe));
  duplicatedRecipe.id = `recipe_${Date.now()}`;

  const duplicatedFile = {
    ...JSON.parse(JSON.stringify(target)),
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: `${target.name} (Salinan)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recipe: duplicatedRecipe,
    isTrash: false,
  };

  const updated = [duplicatedFile, ...files];
  await saveAllCanvasFiles(updated);
  return duplicatedFile;
}

export async function deleteCanvasFile(fileId, permanent = false) {
  const files = await loadAllCanvasFiles();
  let updated;
  if (permanent) {
    updated = files.filter((f) => f.id !== fileId);
  } else {
    updated = files.map((f) => (f.id === fileId ? { ...f, isTrash: true, updatedAt: new Date().toISOString() } : f));
  }
  await saveAllCanvasFiles(updated);
  return updated;
}

export async function restoreCanvasFile(fileId) {
  const files = await loadAllCanvasFiles();
  const updated = files.map((f) => (f.id === fileId ? { ...f, isTrash: false, updatedAt: new Date().toISOString() } : f));
  await saveAllCanvasFiles(updated);
  return updated;
}

export async function getActiveCanvasFileId() {
  return storage.get(CANVAS_ACTIVE_FILE_KEY);
}

export async function setActiveCanvasFileId(fileId) {
  return storage.set(CANVAS_ACTIVE_FILE_KEY, fileId);
}

export async function deleteAllEmptyCanvasFiles() {
  const files = await loadAllCanvasFiles();
  const updated = files.filter((f) => {
    if (f.isTrash) return true;
    const isUntitled = !f.name || f.name.toLowerCase() === 'untitled';
    const isEmpty = !f.recipe || !f.recipe.nodes || f.recipe.nodes.length === 0;
    return !(isUntitled && isEmpty);
  });
  await saveAllCanvasFiles(updated);
  return updated;
}
