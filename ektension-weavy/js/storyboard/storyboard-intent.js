import { extractStoryboardProjectFromData } from '../chat/chat-render.js';

export function resolveCopilotReference(referenceToken, referenceImages = []) {
  if (!referenceToken) return null;
  const images = Array.isArray(referenceImages) ? referenceImages : [];
  if (typeof referenceToken === 'object') {
    if (images.includes(referenceToken)) return referenceToken;
    const match = images.find((img) => (
      img === referenceToken ||
      (img.url && img.url === referenceToken.url) ||
      (img.base64 && img.base64 === referenceToken.base64) ||
      (img.name && img.name === referenceToken.name)
    ));
    return match || referenceToken;
  }
  const str = String(referenceToken).trim();
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('blob:')) {
    const match = images.find((img) => img.url === str || img.base64 === str);
    return match || { url: str, base64: str.startsWith('data:') ? str : null, name: 'Referensi' };
  }
  if (images.length === 0) return null;
  const match = str.match(/@?ref(\d+)/i) || str.match(/^(\d+)$/);
  if (match) {
    const idx = Number(match[1]) - 1;
    return images[idx] || null;
  }
  // Try matching by filename or URL substring
  const tokenLower = str.toLowerCase();
  const foundByName = images.find((img) => {
    const name = (img.name || '').toLowerCase();
    const url = (img.url || '').toLowerCase();
    return (name && (name === tokenLower || name.includes(tokenLower) || tokenLower.includes(name))) ||
      (url && (url === str || url.endsWith(str)));
  });
  return foundByName || null;
}

export function getReferenceByRole(role, project, referenceImages = []) {
  if (project?.references?.[role] === 'none' || project?.references?.[role] === false) {
    return null;
  }
  const images = Array.isArray(referenceImages) ? referenceImages : [];

  // 1. If explicit token/value is provided in project.references or project top-level fields
  const rawRoleRefs = project?.references?.[role] ||
    (role === 'product' ? (project?.references?.produk || project?.references?.productImage || project?.references?.product_image || project?.productImage || project?.productAsset || project?.productRef || project?.product_ref || project?.inputState?.productAsset) : null) ||
    (role === 'model' ? (project?.references?.talent || project?.references?.modelTalent || project?.references?.model_talent || project?.modelTalent || project?.modelAsset || project?.modelRef || project?.model_ref || project?.inputState?.modelAsset) : null) ||
    (role === 'background' ? (project?.references?.latar || project?.references?.bg || project?.references?.bgSetting || project?.references?.bg_setting || project?.bgSetting || project?.bgAsset || project?.bgRef || project?.bg_ref || project?.inputState?.bgAsset) : null);

  const tokenCandidate = Array.isArray(rawRoleRefs) ? rawRoleRefs[0] : (typeof rawRoleRefs === 'string' || typeof rawRoleRefs === 'object' ? rawRoleRefs : null);
  if (tokenCandidate) {
    const configuredImage = resolveCopilotReference(tokenCandidate, images);
    if (configuredImage) return configuredImage;
  }

  if (images.length === 0) return null;

  // 2. Exact match by explicit role on the image object (Library or assigned role)
  const explicitMatch = images.find((image) => {
    const imgRole = String(image?.referenceRole || image?.role || image?.weavyAsset?.role || '').toLowerCase();
    if (role === 'product') return ['product', 'produk', 'item', 'barang'].includes(imgRole);
    if (role === 'model') return ['model', 'talent', 'person', 'orang', 'character', 'karakter'].includes(imgRole);
    if (role === 'background') return ['background', 'latar', 'bg', 'setting', 'lokasi'].includes(imgRole);
    return imgRole === role;
  });
  if (explicitMatch) return explicitMatch;

  // 3. Prioritize E-Commerce product images specifically for Product
  if (role === 'product') {
    const ecomProduct = images.find((img) => Boolean(img.isEcomProduct || img.source === 'ecom_product' || (img.referenceRole === 'product' && !/model|talent|orang|person|face|wajah/i.test(img.name || ''))));
    if (ecomProduct) return ecomProduct;
  }

  // 4. Prioritize human/person images for Model/Talent
  if (role === 'model') {
    const humanModel = images.find((img) => {
      const imgRole = String(img.referenceRole || img.role || img.weavyAsset?.role || '').toLowerCase();
      if (['model', 'talent', 'person', 'orang', 'character', 'karakter'].includes(imgRole)) return true;
      const name = (img.name || '').toLowerCase();
      const isPlantOrProduct = /pepaya|papaya|buah|benih|bibit|pohon|tanaman|jambu|kemasan|botol|sachet|box/i.test(name);
      return !isPlantOrProduct && /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|man|woman|cewek|cowok|selfie|pose|rendi|budi|siti|andi|agus|dewi|petani|host/i.test(name);
    });
    if (humanModel) return humanModel;
  }

  // 5. Prioritize background images for Background
  if (role === 'background') {
    const bgImage = images.find((img) => {
      const imgRole = String(img.referenceRole || img.role || img.weavyAsset?.role || '').toLowerCase();
      if (['background', 'latar', 'bg', 'setting', 'lokasi'].includes(imgRole)) return true;
      const name = (img.name || '').toLowerCase();
      return /bg|background|latar|studio|ruangan|outdoor|indoor|setting|kebun|sawah|taman|ladang/i.test(name);
    });
    if (bgImage) return bgImage;
  }

  // 6. Match by image name heuristic
  const nameMatch = images.find((image) => {
    const name = (image.name || '').toLowerCase();
    if (role === 'product') return /produk|product|barang|item|botol|kemasan|bibit|benih|sachet|pack|box|snack|buah|bunga|tanaman/i.test(name);
    if (role === 'model') {
      const isPlantOrProduct = /pepaya|papaya|buah|benih|bibit|pohon|tanaman|jambu|kemasan|botol|sachet|box/i.test(name);
      return !isPlantOrProduct && /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|petani|man|woman|rendi|budi|siti|andi|agus|dewi/i.test(name);
    }
    if (role === 'background') return /bg|background|latar|studio|ruangan|outdoor|indoor|setting|kebun|sawah|taman|ladang/i.test(name);
    return false;
  });
  if (nameMatch) return nameMatch;

  // 7. Intelligent index fallback for unassigned chat uploads
  const hasEcom = images.some((img) => Boolean(img.isEcomProduct || img.source === 'ecom_product'));
  if (hasEcom) {
    if (role === 'product') {
      return images.find((img) => img.isEcomProduct || img.source === 'ecom_product') || images[0];
    }
    if (role === 'model') {
      // Must NOT pick an e-commerce product or fruit/plant if avoidable
      return images.find((img) => {
        if (img.isEcomProduct || img.source === 'ecom_product') return false;
        const name = (img.name || '').toLowerCase();
        return !/pepaya|buah|tanaman|pohon|bibit|benih|kemasan|botol/i.test(name);
      }) || null;
    }
  }

  const unassigned = images.filter((image) => {
    const r = String(image.referenceRole || image.role || image.weavyAsset?.role || '').toLowerCase();
    return !['product', 'produk', 'model', 'talent', 'background', 'bg', 'latar'].includes(r);
  });

  if (role === 'product') {
    return unassigned[0] || images[0] || null;
  }
  if (role === 'model') {
    if (unassigned.length > 1) return unassigned[1];
    if (images.length > 1) return images[1];
  }
  if (role === 'background') {
    if (unassigned.length > 2) return unassigned[2];
    if (images.length > 2) return images[2];
  }

  return null;
}

export function getCopilotReferenceAsset(image) {
  if (!image) return null;
  if (typeof image === 'string') {
    if (image.startsWith('data:')) {
      return { base64: image, weavyAsset: null };
    }
    return { base64: null, weavyAsset: { url: image, type: 'image' } };
  }
  const asset = image.asset || image.weavyAsset || null;
  if (asset?.url || asset?.id) {
    return { base64: null, weavyAsset: asset };
  }
  if (typeof image.url === 'string' && (image.url.startsWith('http://') || image.url.startsWith('https://') || image.url.startsWith('blob:'))) {
    return { base64: null, weavyAsset: { ...image, type: 'image' } };
  }
  const base64Data = image.base64 || image.thumbnailUrl || (typeof image.url === 'string' && image.url.startsWith('data:') ? image.url : null);
  if (base64Data) {
    return { base64: base64Data, weavyAsset: null };
  }
  if (image.url) {
    return { base64: null, weavyAsset: { ...image, type: 'image' } };
  }
  return null;
}

export function getStoryboardBudgetEstimate({
  scene = null,
  project = null,
  currentCredits = 0,
  selectedModelId = null,
  recommendStoryboardImageModel = null,
} = {}) {
  const candidateScene = scene || (Array.isArray(project?.scenes) ? project.scenes[0] : null);
  if (!candidateScene && !selectedModelId) {
    return {
      type: 'budget_estimate',
      text: 'Belum ada scene yang bisa diestimasi saat ini.',
    };
  }

  const modelId = selectedModelId || (typeof recommendStoryboardImageModel === 'function'
    ? recommendStoryboardImageModel(candidateScene)
    : 'gpt_image_2_5');

  const modelCatalog = [
    { id: 'nano_banana_pro', credits: 11 },
    { id: 'seedream_v5_pro_edit', credits: 12 },
    { id: 'gpt_image_2_5', credits: 4 },
    { id: 'gpt_image_1_edit', credits: 9 },
    { id: 'gpt_image_2', credits: 9 },
    { id: 'grok_imagine', credits: 4 },
  ];

  const selectedModel = modelCatalog.find((model) => model.id === modelId) || modelCatalog[2];
  const estimate = Number(selectedModel.credits || 4);
  const safeToGenerate = Number(currentCredits || 0) >= estimate;
  const remainingAfter = Number(currentCredits || 0) - estimate;

  return {
    type: 'budget_estimate',
    text: safeToGenerate
      ? `Estimasi biaya untuk scene ${candidateScene?.sceneNumber || 1}: ${estimate} koin. Saldo kamu saat ini ${currentCredits} koin, masih cukup untuk generate. Sisa saldo: ${remainingAfter} koin.`
      : `Estimasi biaya untuk scene ${candidateScene?.sceneNumber || 1}: ${estimate} koin. Saldo kamu saat ini ${currentCredits} koin, jadi kemungkinan kurang untuk generate. Model yang lebih hemat: GPT Image 2.5 (4 koin) atau Grok Imagine (4 koin).`,
    estimate,
    currentCredits,
    remainingAfter,
    safeToGenerate,
    modelId: selectedModel.id,
  };
}

export function buildStoryboardConsistencyGuard(project, references = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  if (!scenes.length) {
    return {
      type: 'consistency_guard',
      text: 'Consistency guard: belum ada scene yang bisa divalidasi.',
      issues: [],
    };
  }

  const collectSceneLabels = (key) => scenes
    .map((scene) => {
      const value = [scene[key], scene.productName, scene.modelTalent, scene.bgSetting, scene.title, scene.visualDescription, scene.imagePrompt]
        .filter(Boolean)
        .join(' ')
        .trim();
      return value ? value.toLowerCase() : null;
    })
    .filter(Boolean);

  const productTerms = collectSceneLabels('productName');
  const modelTerms = collectSceneLabels('modelTalent');
  const bgTerms = collectSceneLabels('bgSetting');

  const issues = [];

  const uniqueProductNames = [...new Set(productTerms.map((value) => value.split(/\s+/).slice(0, 5).join(' ')))];
  const uniqueModelNames = [...new Set(modelTerms.map((value) => value.split(/\s+/).slice(0, 5).join(' ')))];
  const uniqueBgNames = [...new Set(bgTerms.map((value) => value.split(/\s+/).slice(0, 6).join(' ')))];

  if (uniqueProductNames.length > 1) {
    issues.push(`Produk/brand berubah antar scene: ${uniqueProductNames.slice(0, 3).join(', ')}.`);
  }
  if (uniqueModelNames.length > 1) {
    issues.push(`Model/talent berubah antar scene: ${uniqueModelNames.slice(0, 3).join(', ')}.`);
  }
  if (uniqueBgNames.length > 1) {
    issues.push(`Background berubah antar scene: ${uniqueBgNames.slice(0, 3).join(', ')}.`);
  }

  const hasMissingProductReference = !references.productImage && scenes.some((scene) => /(produk|product|brand|bottle|packaging|kemasan)/i.test([scene.title, scene.visualDescription, scene.onScreenText, scene.voiceover, scene.imagePrompt].filter(Boolean).join(' ')));
  const hasMissingModelReference = !references.modelImage && scenes.some((scene) => /(model|talent|orang|person|face|fashion|outfit|wajah)/i.test([scene.title, scene.visualDescription, scene.onScreenText, scene.voiceover, scene.imagePrompt].filter(Boolean).join(' ')));
  const hasMissingBackgroundReference = !references.backgroundImage && scenes.some((scene) => /(background|latar|interior|studio|pantai|kota|landscape|room|office)/i.test([scene.title, scene.visualDescription, scene.onScreenText, scene.voiceover, scene.imagePrompt].filter(Boolean).join(' ')));

  if (hasMissingProductReference) issues.push('Referensi produk belum dipetakan ke scene, sehingga konsistensi visual produk bisa turun.');
  if (hasMissingModelReference) issues.push('Referensi model/talent belum dipetakan ke scene, sehingga wajah atau outfit bisa tidak konsisten.');
  if (hasMissingBackgroundReference) issues.push('Referensi background belum dipetakan ke scene, sehingga setting visual bisa berubah terlalu cepat.');

  const text = issues.length
    ? `Consistency guard: ada ${issues.length} area yang perlu dicek.\n- ${issues.join('\n- ')}`
    : 'Consistency guard: seluruh scene terlihat konsisten untuk produk, model, dan background.';

  return {
    type: 'consistency_guard',
    text,
    issues,
  };
}

export function buildStoryboardNextStepActions(project, references = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const pendingScenes = scenes.filter((scene) => !(scene.status === 'completed' && scene.imageUrl));
  const missingReferences = [
    !references.productImage ? 'produk' : null,
    !references.modelImage ? 'model/talent' : null,
    !references.backgroundImage ? 'background' : null,
  ].filter(Boolean);

  const primaryActions = [];

  if (!scenes.length) {
    primaryActions.push('Buat draft storyboard baru dan isi brief produk, talent, serta background utama.');
  } else {
    if (pendingScenes.length) {
      const sceneText = pendingScenes.length === 1 ? 'scene ini' : `scene ${pendingScenes.slice(0, 3).map((scene) => scene.sceneNumber || '').filter(Boolean).join(', ') || 'yang belum selesai'}`;
      primaryActions.push(`Prioritaskan generate ${sceneText} sebelum lanjut ke scene berikutnya.`);
    }

    if (missingReferences.length) {
      primaryActions.push(`Map reference ${missingReferences.join(', ')} agar konsistensi visual lebih kuat.`);
    }

    const weakScenes = scenes.filter((scene) => !scene.visualDescription || !scene.imagePrompt).slice(0, 2);
    if (weakScenes.length) {
      primaryActions.push(`Perbaiki deskripsi visual pada scene ${weakScenes.map((scene) => scene.sceneNumber || '').filter(Boolean).join(', ')} agar prompt lebih jelas.`);
    }

    const consistencyGuard = buildStoryboardConsistencyGuard(project, references);
    if (consistencyGuard.issues.length) {
      primaryActions.push('Jalankan consistency guard dan perbaiki referensi produk/model/background sebelum batch render.');
    } else if (pendingScenes.length === 0) {
      primaryActions.push('Lanjutkan dengan batch render final, lalu preview karya di 1-sheet grid untuk final check.');
    }
  }

  const text = primaryActions.length
    ? `Langkah berikutnya:\n- ${primaryActions.join('\n- ')}`
    : 'Langkah berikutnya: review storyboard, verify output, lalu lanjutkan ke generate atau revisi yang paling dibutuhkan.';

  return {
    type: 'next_step_actions',
    text,
    actions: primaryActions,
  };
}

export function buildStoryboardReview(project, references = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const firstScene = scenes[0] || {};
  const lastScene = scenes[scenes.length - 1] || {};
  const review = [];
  const firstSceneText = [firstScene.title, firstScene.visualDescription, firstScene.onScreenText].filter(Boolean).join(' ').toLowerCase();
  const lastSceneText = [lastScene.title, lastScene.visualDescription, lastScene.onScreenText, lastScene.voiceover].filter(Boolean).join(' ').toLowerCase();

  if (/hook|opening|pattern|stop|tunggu|perhatian|masalah/.test(firstSceneText)) {
    review.push('✓ Hook scene pertama sudah terdeteksi.');
  } else {
    review.push('⚠ Hook scene pertama belum terlihat jelas; pertimbangkan visual pattern interrupt yang lebih kuat.');
  }

  const referenceLabels = [
    references.productImage ? 'produk' : null,
    references.modelImage ? 'model/talent' : null,
    references.backgroundImage ? 'background' : null,
  ].filter(Boolean);

  review.push(referenceLabels.length
    ? `✓ Reference tersedia: ${referenceLabels.join(', ')}.`
    : '⚠ Belum ada reference image utama; konsistensi visual akan lebih bergantung pada prompt teks.');

  if (/cta|checkout|beli|buy|keranjang|order|pesan|sekarang|promo/.test(lastSceneText)) {
    review.push('✓ CTA terdeteksi pada scene terakhir.');
  } else {
    review.push('⚠ CTA belum terdeteksi jelas pada scene terakhir.');
  }

  const consistencyGuard = buildStoryboardConsistencyGuard(project, references);
  if (consistencyGuard.issues.length) {
    review.push(`⚠ ${consistencyGuard.issues[0]}`);
  } else {
    review.push('✓ Konsistensi produk, model, dan background terlihat stabil di seluruh scene.');
  }

  const duplicatePairs = [];
  for (let index = 1; index < scenes.length; index += 1) {
    const previousText = [scenes[index - 1].visualDescription, scenes[index - 1].imagePrompt].filter(Boolean).join(' ').toLowerCase();
    const currentText = [scenes[index].visualDescription, scenes[index].imagePrompt].filter(Boolean).join(' ').toLowerCase();
    const previousWords = new Set(previousText.split(/\W+/).filter((word) => word.length > 4));
    const currentWords = new Set(currentText.split(/\W+/).filter((word) => word.length > 4));
    const sharedWords = [...currentWords].filter((word) => previousWords.has(word));
    const similarity = sharedWords.length / Math.max(1, Math.min(previousWords.size, currentWords.size));
    if (similarity > 0.72) duplicatePairs.push(`${index} dan ${index + 1}`);
  }

  if (duplicatePairs.length) {
    review.push(`⚠ Scene ${duplicatePairs.join(', ')} memiliki deskripsi sangat mirip; cek agar progres ceritanya tidak berulang.`);
  } else if (scenes.length > 1) {
    review.push('✓ Aksi antar-scene cukup bervariasi berdasarkan deskripsi yang tersedia.');
  }

  const averageDuration = scenes.length ? Number(project.duration || 0) / scenes.length : 0;
  review.push(`ℹ Rata-rata durasi sekitar ${averageDuration.toFixed(1)} detik per scene.`);
  return review.join('\n');
}

function buildSceneEditPatch({
  input,
  targetScene,
  fallbackScene,
  currentProject,
}) {
  const lowerInput = String(input || '').toLowerCase();
  const scene = targetScene || fallbackScene;
  if (!scene) return null;

  const patch = {
    id: scene.id,
    sceneNumber: Number(scene.sceneNumber || 1),
  };

  const narrative = [scene.title, scene.visualDescription, scene.onScreenText, scene.voiceover].filter(Boolean).join(' ');
  const fallbackTitle = scene.title || `Scene ${scene.sceneNumber || 1}`;

  if (/judul|title|nama scene|nama/.test(lowerInput)) {
    const titleValue = lowerInput.includes('judul') || lowerInput.includes('title')
      ? input.replace(/.*(?:judul|title)\s*[:\-]?\s*/i, '').trim()
      : fallbackTitle;
    if (titleValue && titleValue !== fallbackTitle) {
      patch.title = titleValue;
    }
  }

  if (/close[- ]?up|close up|low angle|high angle|wide|overhead|tracking|tilt|camera|angle/.test(lowerInput)) {
    const angleMap = {
      closeup: 'Close-up',
      'close-up': 'Close-up',
      'low angle': 'Low-angle shot',
      'high angle': 'High-angle shot',
      wide: 'Wide shot',
      overhead: 'Overhead shot',
      tracking: 'Tracking shot',
      tilt: 'Tilt shot',
    };
    const matchedAngle = Object.keys(angleMap).find((key) => lowerInput.includes(key));
    if (matchedAngle) {
      patch.cameraAngle = angleMap[matchedAngle];
    }
  }

  if (/dramatis|tegang|seru|lebih kuat|lebih menonjol|lebih fokus|lebih jelas|powerful|hero|penuh energi|suspense/.test(lowerInput)) {
    const nextVisual = `${scene.visualDescription || narrative || fallbackTitle} dibuat lebih dramatik, lebih tajam, dan lebih fokus pada momen utama produk/talent demi dampak visual yang lebih kuat.`;
    patch.visualDescription = nextVisual;
    patch.imagePrompt = `${scene.imagePrompt || nextVisual}. Visual cinematic, ad attention, high contrast, product focus, strong storytelling.`;
  }

  if (/cta|checkout|beli|buy|order|pesan|promo|keranjang|tombol|buy now/.test(lowerInput)) {
    patch.onScreenText = 'BUY NOW / ORDER NOW';
    patch.voiceover = 'Sekarang saatnya beli dan rasakan manfaatnya dengan cepat dan mudah.';
  }

  if (/hook|opening|awal|attention|stop|pattern|masalah|poin utama/.test(lowerInput)) {
    patch.title = `Hook: ${scene.title || fallbackTitle}`;
    patch.visualDescription = `${scene.visualDescription || narrative || fallbackTitle}. Fokus pada hook awal yang langsung menangkap perhatian dan menimbulkan rasa ingin tahu.`;
  }

  if (!Object.keys(patch).some((key) => !['id', 'sceneNumber'].includes(key))) {
    return null;
  }

  return patch;
}

export function buildSmartReferencesMapping(referenceImages = []) {
  const references = { product: [], model: [], background: [], custom: [] };
  if (!Array.isArray(referenceImages) || referenceImages.length === 0) return references;

  const assignedIndices = new Set();

  // 1. Assign explicit roles
  referenceImages.forEach((image, index) => {
    const role = (image.referenceRole || image.role || '').toLowerCase();
    const token = `@ref${index + 1}`;
    if (['product', 'produk', 'item', 'barang'].includes(role) && references.product.length === 0) {
      references.product.push(token);
      assignedIndices.add(index);
    } else if (['model', 'talent', 'person', 'orang', 'character', 'karakter'].includes(role) && references.model.length === 0) {
      references.model.push(token);
      assignedIndices.add(index);
    } else if (['background', 'bg', 'latar', 'setting', 'lokasi'].includes(role) && references.background.length === 0) {
      references.background.push(token);
      assignedIndices.add(index);
    }
  });

  // 2. Assign heuristic name matches
  referenceImages.forEach((image, index) => {
    if (assignedIndices.has(index)) return;
    const name = (image.name || '').toLowerCase();
    const token = `@ref${index + 1}`;
    if (references.product.length === 0 && /produk|product|barang|item|botol|baju|sepatu|kemasan|bibit|benih|sachet|pack|box|snack|buah/i.test(name)) {
      references.product.push(token);
      assignedIndices.add(index);
    } else if (references.model.length === 0 && /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|petani|man|woman/i.test(name)) {
      references.model.push(token);
      assignedIndices.add(index);
    } else if (references.background.length === 0 && /bg|background|latar|studio|ruangan|outdoor|indoor|setting|kebun|sawah|taman|ladang/i.test(name)) {
      references.background.push(token);
      assignedIndices.add(index);
    }
  });

  // 3. Fill unassigned slots by order
  referenceImages.forEach((image, index) => {
    if (assignedIndices.has(index)) return;
    const token = `@ref${index + 1}`;
    if (references.product.length === 0) {
      references.product.push(token);
      assignedIndices.add(index);
    } else if (references.model.length === 0) {
      references.model.push(token);
      assignedIndices.add(index);
    } else if (references.background.length === 0) {
      references.background.push(token);
      assignedIndices.add(index);
    } else {
      references.custom.push(token);
      assignedIndices.add(index);
    }
  });

  return references;
}

export function buildStoryboardCopilotIntentAction({
  text,
  currentSbProject,
  currentAspect,
  sbProjectName = null,
  sbProductName,
  sbProductDesc,
  sbModelTalent,
  sbBgSetting,
  sbBriefInput,
  sbTotalDuration,
  sbNumScenes,
  sbFormula,
  sbAiModelSelect,
  sbImageModelSelect,
  recommendStoryboardImageModel,
}, referenceImages = []) {
  const input = String(text || '').trim();
  if (!input) return null;

  const currentProject = currentSbProject || {};
  const scenes = Array.isArray(currentProject.scenes) ? currentProject.scenes : [];
  const fallbackScene = scenes[0] || null;

  const parseStoryboardTargetSceneNumber = (value, fallbackSceneNumber = fallbackScene?.sceneNumber || 1) => {
    if (!value) return fallbackSceneNumber;
    const directMatch = value.match(/scene\s*(?:ke|nomor|no|#)?\s*(\d+)/i);
    if (directMatch) return Number(directMatch[1]);
    const numberedMatch = value.match(/\b(\d{1,2})\b/);
    if (numberedMatch && Array.isArray(currentProject.scenes) && currentProject.scenes.some((scene) => Number(scene.sceneNumber) === Number(numberedMatch[1]))) {
      return Number(numberedMatch[1]);
    }
    return fallbackSceneNumber;
  };

  const targetSceneNumber = parseStoryboardTargetSceneNumber(input, fallbackScene?.sceneNumber || 1);
  const targetScene = scenes.find((scene) => Number(scene.sceneNumber) === Number(targetSceneNumber)) || fallbackScene;

  const isReviewRequest = /(review|cek|audit|evaluasi|check|ringkasan|masalah|issue|apakah.*storyboard|lihat.*storyboard)/i.test(input);
  if (isReviewRequest) {
    const reviewText = buildStoryboardReview(currentProject, {
      productImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'product') || null,
      modelImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'model') || null,
      backgroundImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'background') || null,
    });
    return {
      type: 'review',
      text: reviewText || 'Storyboard belum memiliki cukup detail untuk review otomatis.',
    };
  }

  const isBudgetRequest = /(berapa|estimasi|budget|biaya|koin|cost|harga|hemat|murah)/i.test(input) && /(scene|generate|render|storyboard|gambar|model)/i.test(input);
  if (isBudgetRequest) {
    const estimateResult = getStoryboardBudgetEstimate({
      scene: targetScene,
      project: currentProject,
      currentCredits: Number(currentProject?.accountCredits ?? 0),
      selectedModelId: null,
      recommendStoryboardImageModel,
    });
    return estimateResult;
  }

  const isRevisionHistoryRequest = /(riwayat|history|revisi|revision|undo|rollback|kembali.*versi|versi.*sebelumnya|history.*scene)/i.test(input);
  if (isRevisionHistoryRequest) {
    const history = Array.isArray(currentProject?.revisionHistory) ? currentProject.revisionHistory : [];
    if (!history.length) {
      return {
        type: 'revision_history',
        text: 'Belum ada revisi storyboard yang tercatat untuk proyek ini.',
      };
    }
    const summary = history.slice(0, 5).map((entry, index) => `${index + 1}. ${entry.label || 'Revisi'} · ${new Date(entry.savedAt || Date.now()).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`).join('\n');
    return {
      type: 'revision_history',
      text: `Riwayat revisi storyboard:\n${summary}`,
      history,
    };
  }

  const isNextStepRequest = /(langkah|selanjutnya|next|apa.*berikutnya|saran.*next|what.*next|lanjut|lanjutkan|yang.*dilakukan.*selanjutnya|rekomendasi.*selanjutnya|prioritas.*selanjutnya)/i.test(input);
  if (isNextStepRequest) {
    const nextActions = buildStoryboardNextStepActions(currentProject, {
      productImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'product') || null,
      modelImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'model') || null,
      backgroundImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'background') || null,
    });
    return nextActions;
  }

  const isConsistencyRequest = /(konsisten|consistency|guard|cek.*konsistensi|validasi.*visual|cek.*visual|produk.*model.*background|same.*product|same.*model|background.*konsisten)/i.test(input);
  if (isConsistencyRequest) {
    const guardResult = buildStoryboardConsistencyGuard(currentProject, {
      productImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'product') || null,
      modelImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'model') || null,
      backgroundImage: referenceImages.find((image) => (image.referenceRole || image.role || 'custom') === 'background') || null,
    });
    return guardResult;
  }

  const isEditSceneRequest = /(ubah|edit|ganti|perbaiki|revisi|sesuaikan|update|perbarui|ubah scene|edit scene|revisi scene|scene\s*(ke|nomor|#)?\s*\d+.*(lebih|jadi|menjadi)|scene\s*(ini|aktif))/i.test(input);
  if (isEditSceneRequest && targetScene) {
    const patch = buildSceneEditPatch({
      input,
      targetScene,
      fallbackScene,
      currentProject,
    });
    if (patch) {
      return {
        type: 'edit_scene',
        action: 'update_scenes',
        scenes: [patch],
        reason: `Copilot memperbarui scene ${patch.sceneNumber || 1} sesuai arahan edit natural language.`,
      };
    }
  }

  const isCreateProjectRequest = /(storyboard\s+baru|project\s+baru|buat\s+draft|buat\s+storyboard|mulai\s+storyboard|new\s+storyboard|buat\s+project|draft\s+storyboard|tambah(?:kan)?\s+(?:ke\s+|di\s+)?storyboard|masuk(?:kan)?\s+(?:ke\s+|di\s+)?storyboard|input\s+(?:ke\s+|di\s+)?storyboard|pindah(?:kan)?\s+(?:ke\s+|di\s+)?storyboard|jadikan\s+storyboard|gunakan\s+(?:di|ke)\s+storyboard|pakai\s+(?:di|ke)\s+storyboard|terapkan\s+(?:di|ke)\s+storyboard)/i.test(input);
  if (isCreateProjectRequest) {
    const projectTitle = currentProject.name || sbProjectName?.value || 'Storyboard Baru';
    const smartReferences = buildSmartReferencesMapping(referenceImages);
    const project = {
      title: projectTitle,
      productName: sbProductName?.value || 'Produk',
      productDesc: sbProductDesc?.value || '',
      modelTalent: sbModelTalent?.value || '',
      bgSetting: sbBgSetting?.value || '',
      brief: sbBriefInput?.value || 'Storyboard baru yang dibuat dari permintaan Copilot.',
      duration: Number(sbTotalDuration?.value || currentProject.duration || 15),
      numScenes: Number(sbNumScenes?.value || scenes.length || 4),
      formula: sbFormula?.value || 'hook_extreme',
      aspectRatio: currentAspect || '9:16',
      aiModel: sbAiModelSelect?.value || 'google/gemini-2.5-flash',
      imageModel: sbImageModelSelect?.value || 'GPT Image 2.5',
      references: smartReferences,
    };
    return {
      type: 'create_storyboard_project',
      action: 'create_storyboard_project',
      reason: 'Draft storyboard baru dibuat berdasarkan instruksi dan reference yang tersedia.',
      project,
      referenceImages,
    };
  }

  const isBatchGenerateRequest = /(generate\s+(semua|seluruh)|render\s+(semua|seluruh)|buat\s+(semua|seluruh)|batch|all\s+scene)/i.test(input);
  if (isBatchGenerateRequest && scenes.length) {
    return {
      type: 'generate_scenes',
      action: 'generate_scenes',
      scenes: scenes.map((scene) => ({
        id: scene.id,
        sceneNumber: scene.sceneNumber,
        modelId: recommendStoryboardImageModel(scene),
        reason: `Generate visual untuk scene ${scene.sceneNumber || ''} sesuai kebutuhan narasi storyboard.`,
      })),
      reason: 'Copilot meminta render semua scene di storyboard saat ini.',
    };
  }

  const isGenerateRequest = /(generate|render|buat\s+visual|gambar\s+scene|image\s+scene|buat\s+scene|render\s+scene)/i.test(input);
  if (isGenerateRequest && targetScene) {
    return {
      type: 'generate_scene',
      action: 'generate_scene',
      id: targetScene.id,
      sceneNumber: targetScene.sceneNumber,
      modelId: recommendStoryboardImageModel(targetScene),
      reason: `Copilot merekomendasikan render untuk scene ${targetScene.sceneNumber || ''} berdasarkan narasi dan visual yang aktif.`,
    };
  }

  return null;
}

export function extractStoryboardParamsFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return {};
  const text = String(rawText);
  const result = {};

  const cleanVal = (v) => {
    if (!v) return '';
    return String(v).trim().replace(/^[:\-\s]+/, '').replace(/[\r\n]+.*/g, '').replace(/[,\.;]+$/, '').trim();
  };

  // 1. Product Name
  const prodMatch = text.match(/(?:Nama\s*(?:produk|product|brand|barang)|Product\s*Name)\s*:\s*([^\n\r]+)/i) ||
    text.match(/(?:^|\n)\s*(?:Produk|Product)\s*:\s*([^\n\r]+)/i) ||
    text.match(/(?:storyboard\s+(?:jualan|iklan|promosi|produk|untuk)?|jualan\s+(?:produk\s+)?)\s*([a-z0-9\s]+?)(?:\s+(?:dengan|untuk|formula|durasi|sebanyak|pakai|menggunakan|di|pada|\.|\,|$))/i) ||
    text.match(/(?:benih\s+bibit\s+[a-z0-9\s]+|pepaya\s+merah\s+delima|pepaya\s+[a-z0-9\s]+)/i);
  if (prodMatch) result.productName = cleanVal(prodMatch[1] || prodMatch[0]);

  // 2. Product Description
  const descMatch = text.match(/(?:Deskripsi\s*(?:produk|product|barang)?|Product\s*Desc(?:ription)?|Detail\s*(?:fisik|produk)?)\s*:\s*([^\n\r]+)/i);
  if (descMatch) result.productDesc = cleanVal(descMatch[1]);

  // 3. Model / Talent
  const modelMatch = text.match(/(?:Talent|Model(?:\s*talent)?|Karakter|Pemeran|Tokoh|Ciri\s*model)\s*:\s*([^\n\r]+)/i) ||
    text.match(/(?:tunjukkan|tampilkan|pakai|jadikan)?\s*talent\s+(?:sebagai|dengan|petani)?\s*([^\n\r,\.]+)/i);
  if (modelMatch) result.modelTalent = cleanVal(modelMatch[1]);

  // 4. Background / Setting
  const bgMatch = text.match(/(?:Setting|Latar(?:\s*tempat)?|Background|Lokasi|Suasana(?:\s*tempat)?|Bg\s*setting)\s*:\s*([^\n\r]+)/i) ||
    text.match(/(?:di\s+)?(?:kebun\s+[a-z0-9\s/]+|area\s+panen[a-z0-9\s/]+)/i);
  if (bgMatch) result.bgSetting = cleanVal(bgMatch[1] || bgMatch[0]);

  // 5. Brief
  const briefMatch = text.match(/(?:Brief|Creative\s*Brief|Konsep|Ide(?:\s*(?:utama|cerita))?|Catatan|Notes)\s*:\s*([^\n\r]+)/i);
  if (briefMatch) result.brief = cleanVal(briefMatch[1]);

  // 6. Duration
  const durMatch = text.match(/(?:Durasi|Duration|Total\s*durasi)\s*:\s*(\d+)/i) ||
    text.match(/\b(\d+)\s*(?:detik|second|seconds|det)\b/i);
  if (durMatch) result.duration = Number(durMatch[1]);

  // 7. Num Scenes
  const sceneCountMatch = text.match(/(?:Jumlah\s*(?:scene|adegan)|Num\s*Scenes?|Total\s*scene)\s*:\s*(\d+)/i) ||
    text.match(/\b(\d+)\s*(?:scene|adegan)\b/i);
  if (sceneCountMatch) result.numScenes = Number(sceneCountMatch[1]);

  // 8. Aspect Ratio / Format
  const aspectMatch = text.match(/(?:Format|Aspek|Rasio|Aspect\s*Ratio)\s*:\s*(?:(?:Vertical|Horizontal|Square|Video\s*Short)\s*)?([19]:[196]|1:1|4:5|16:9|9:16)/i) ||
    text.match(/\b(9:16|16:9|1:1|4:5)\b/i) ||
    (/(?:vertical|short|reels|tiktok|story)/i.test(text) ? '9:16' : null);
  if (aspectMatch) result.aspectRatio = typeof aspectMatch === 'string' ? aspectMatch : aspectMatch[1];

  // 9. Formula
  const formulaMatch = text.match(/(?:Formula|Pola\s*formula|Struktur)\s*:\s*([^\n\r]+)/i) ||
    text.match(/formula\s+([a-z0-9\s_\-]+?)(?:\s*[,.]|\s+durasi|\s+\d+\s+scene|$)/i);
  if (formulaMatch) {
    const rawForm = cleanVal(formulaMatch[1]).toLowerCase();
    if (rawForm.includes('extreme') || rawForm.includes('ekstrem') || rawForm.includes('hook')) result.formula = 'hook_extreme';
    else if (rawForm.includes('ugc') || rawForm.includes('unboxing') || rawForm.includes('review')) result.formula = 'ugc_review';
    else if (rawForm.includes('cinema') || rawForm.includes('cinematic')) result.formula = 'cinematic_story';
    else if (rawForm.includes('problem') || rawForm.includes('solusi') || rawForm.includes('pas')) result.formula = 'pas_framework';
    else if (rawForm.includes('aida')) result.formula = 'aida_funnel';
  }

  return result;
}

export function extractStoryboardCopilotAction(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: String(rawText || ''), action: null };
  }

  let text = String(rawText);
  const foundActions = [];
  const segmentsToRemove = [];

  // Helper to safely parse and sanitize JSON
  const tryParseJson = (str) => {
    if (!str || typeof str !== 'string') return null;
    let trimmed = str.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      try {
        const sanitized = trimmed.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(sanitized);
      } catch (_) {
        // Try repair unclosed or broken JSON (e.g. truncated output)
        try {
          let repaired = trimmed;

          // Check and close unclosed string quotes
          let inString = false;
          let escape = false;
          for (let k = 0; k < repaired.length; k++) {
            const char = repaired[k];
            if (inString) {
              if (escape) escape = false;
              else if (char === '\\') escape = true;
              else if (char === '"') inString = false;
            } else {
              if (char === '"') inString = true;
            }
          }
          if (inString) repaired += '"';

          // Clean broken trailing keys, colons, commas
          repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*(?:\]\}\}|\}\}|\]|\}|```|$)/gi, '');
          repaired = repaired.replace(/:\s*(?:\]\}\}|\}\}|\]|\}|```|$)/gi, ':null');
          repaired = repaired.replace(/,\s*([\]}])/g, '$1');
          repaired = repaired.replace(/,\s*$/g, '');

          const openBraces = (repaired.match(/\{/g) || []).length;
          const closeBraces = (repaired.match(/\}/g) || []).length;
          const openBrackets = (repaired.match(/\[/g) || []).length;
          const closeBrackets = (repaired.match(/\]/g) || []).length;
          for (let b = 0; b < openBrackets - closeBrackets; b++) repaired += ']';
          for (let c = 0; c < openBraces - closeBraces; c++) repaired += '}';
          return JSON.parse(repaired);
        } catch (_) {
          // Fallback: regex extraction of action & reason from malformed JSON
          try {
            const actionMatch = trimmed.match(/"action"\s*:\s*"([^"]+)"/i) || trimmed.match(/"type"\s*:\s*"([^"]+)"/i);
            if (actionMatch) {
              const reasonMatch = trimmed.match(/"reason"\s*:\s*"([^"]+)"/i);
              return {
                action: actionMatch[1],
                type: actionMatch[1],
                reason: reasonMatch ? reasonMatch[1] : 'Draft storyboard dibuat oleh Copilot.',
              };
            }
          } catch (__) {}
          return null;
        }
      }
    }
  };

  // 1. First pass: extract all code blocks ```...```
  const codeBlockRegex = /```(?:json|storyboard_project|storyboard-project|storyboard_copilot|storyboard-copilot|storyboard_draft|storyboard|javascript|js)?\s*([\s\S]*?)\s*```/gi;
  let cbMatch;
  while ((cbMatch = codeBlockRegex.exec(text)) !== null) {
    const parsed = tryParseJson(cbMatch[1]);
    if (parsed) {
      const sbProject = extractStoryboardProjectFromData(parsed);
      if (sbProject) {
        foundActions.push({
          action: 'create_storyboard_project',
          type: 'create_storyboard_project',
          reason: parsed.reason || 'Draft storyboard dirancang oleh Copilot.',
          project: sbProject,
          scenes: sbProject.scenes,
        });
        segmentsToRemove.push({ start: cbMatch.index, end: cbMatch.index + cbMatch[0].length, fullMatch: cbMatch[0] });
      } else if (parsed.action || Array.isArray(parsed.scenes) || parsed.project) {
        foundActions.push(parsed);
        segmentsToRemove.push({ start: cbMatch.index, end: cbMatch.index + cbMatch[0].length, fullMatch: cbMatch[0] });
      }
    }
  }

  // 2. Second pass: scan for balanced curly braces in text to catch unquoted or plain text JSON (e.g. `json\n{...}`)
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 0;
      let inString = false;
      let escape = false;
      const start = i;
      let end = -1;

      for (let j = start; j < text.length; j += 1) {
        const char = text[j];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (char === '\\') {
            escape = true;
          } else if (char === '"') {
            inString = false;
          }
        } else {
          if (char === '"') {
            inString = true;
          } else if (char === '{') {
            depth += 1;
          } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
              end = j + 1;
              break;
            }
          }
        }
      }

      if (end !== -1) {
        const candidateStr = text.slice(start, end);
        const parsed = tryParseJson(candidateStr);
        if (parsed) {
          const sbProject = extractStoryboardProjectFromData(parsed);
          const alreadyCaptured = segmentsToRemove.some((seg) => start >= seg.start && end <= seg.end);
          if (!alreadyCaptured) {
            if (sbProject) {
              foundActions.push({
                action: 'create_storyboard_project',
                type: 'create_storyboard_project',
                reason: parsed.reason || 'Draft storyboard dirancang oleh Copilot.',
                project: sbProject,
                scenes: sbProject.scenes,
              });
              let cleanStart = start;
              const prefix = text.slice(Math.max(0, start - 20), start);
              const prefixMatch = prefix.match(/(?:```json|```|json)\s*$/i);
              if (prefixMatch) {
                cleanStart = start - prefixMatch[0].length;
              }
              segmentsToRemove.push({ start: cleanStart, end, fullMatch: text.slice(cleanStart, end) });
            } else if (parsed.action || Array.isArray(parsed.scenes) || parsed.project) {
              foundActions.push(parsed);
              let cleanStart = start;
              const prefix = text.slice(Math.max(0, start - 20), start);
              const prefixMatch = prefix.match(/(?:```json|```|json)\s*$/i);
              if (prefixMatch) {
                cleanStart = start - prefixMatch[0].length;
              }
              segmentsToRemove.push({ start: cleanStart, end, fullMatch: text.slice(cleanStart, end) });
            }
          }
        }
        i = end;
        continue;
      }
    }
    i += 1;
  }

  // Also strip broken/partial JSON remnants (e.g. {"action":"create_storyboard_project" ... "]}})
  const malformedJsonRegex = /\{"action"\s*:\s*"[^"]+"[\s\S]*?(?:\]\}\}|\}\}|```|$)/g;
  let mfMatch;
  while ((mfMatch = malformedJsonRegex.exec(text)) !== null) {
    const isAlreadyRemoved = segmentsToRemove.some((seg) => mfMatch.index >= seg.start && (mfMatch.index + mfMatch[0].length) <= seg.end);
    if (!isAlreadyRemoved) {
      let parsed = tryParseJson(mfMatch[0]);
      if (!parsed) {
        const actionMatch = mfMatch[0].match(/"action"\s*:\s*"([^"]+)"/i);
        if (actionMatch) {
          const reasonMatch = mfMatch[0].match(/"reason"\s*:\s*"([^"]+)"/i);
          parsed = {
            action: actionMatch[1],
            type: actionMatch[1],
            reason: reasonMatch ? reasonMatch[1] : 'Draft storyboard dibuat oleh Copilot.',
          };
        }
      }
      if (parsed && (parsed.action || parsed.project)) {
        foundActions.push(parsed);
      }
      segmentsToRemove.push({ start: mfMatch.index, end: mfMatch.index + mfMatch[0].length, fullMatch: mfMatch[0] });
    }
  }

  // Remove extracted JSON segments from text in reverse order
  segmentsToRemove.sort((a, b) => b.start - a.start);
  segmentsToRemove.forEach((seg) => {
    text = text.slice(0, seg.start) + '\n' + text.slice(seg.end);
  });

  // Clean system prompt header echoes (if Dola/AI echoed them)
  text = text
    .replace(/^\[(?:Instruksi\s+Sistem|Storyboard\s+Copilot\s+System)\][\s\S]*?(?=(?:Hai|Halo|Oke|Siap|Tentukan|[A-Z][a-z]+|\n\n[A-Z]))/i, '')
    .replace(/^\[(?:Instruksi\s+Sistem|Storyboard\s+Copilot\s+System)\][\s\S]*?PEMANFAATAN\s+SMART\s+ASSET\s+LIBRARY:[^\n]*\n*/gi, '')
    .replace(/\[Visual References\][\s\S]*?\[Konteks terbaru\][\s\S]*?\n*/gi, '')
    .replace(/^\s*```(?:json)?\s*$/gmi, '')
    .replace(/^\s*json\s*$/gmi, '')
    .replace(/\[Konteks Storyboard\][\s\S]*?\n/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Natural Language Parameter Extraction fallback:
  // If no action found OR action project lacks fields, extract from natural language text
  const extractedParams = extractStoryboardParamsFromText(rawText);

  if (foundActions.length === 0) {
    const hasStoryboardIntent = /(?:storyboard|scene|adegan|iklan|video|bikin|buat|rancang|draft|asumsikan|hook|talent|setting|panen)/i.test(rawText);
    const hasParams = Boolean(extractedParams.productName || extractedParams.modelTalent || extractedParams.bgSetting || extractedParams.productDesc || /(?:pepaya|benih|bibit|petani|kebun|panen)/i.test(rawText));

    if (hasStoryboardIntent && (hasParams || /(?:aku\s+akan\s+bikin\s+storyboard|draft\s+storyboard|\d+\s+scene|hook\s+yang\s+jelas)/i.test(rawText))) {
      const syntheticProject = {
        title: extractedParams.productName || 'Storyboard Iklan Produk',
        productName: extractedParams.productName || 'Storyboard Iklan Produk',
        productDesc: extractedParams.productDesc || '',
        modelTalent: extractedParams.modelTalent || '',
        bgSetting: extractedParams.bgSetting || '',
        brief: extractedParams.brief || `Storyboard ${extractedParams.productName || 'produk'} (${extractedParams.numScenes || 4} scene, ${extractedParams.duration || 10} detik)`,
        duration: extractedParams.duration || 10,
        numScenes: extractedParams.numScenes || 4,
        aspectRatio: extractedParams.aspectRatio || '9:16',
        formula: extractedParams.formula || 'hook_extreme',
        aiModel: 'google/gemini-2.5-flash',
        imageModel: 'GPT Image 2.5',
      };

      return {
        cleanText: text,
        action: {
          action: 'create_storyboard_project',
          type: 'create_storyboard_project',
          reason: 'Draft storyboard diekstrak dari detail konsep dan parameter Copilot.',
          project: syntheticProject,
        },
      };
    }

    return { cleanText: text, action: null };
  }

  // Intelligently merge multiple actions (e.g. create_storyboard_project + update_scenes)
  let mergedAction = foundActions[0];
  const createAction = foundActions.find((a) => a.action === 'create_storyboard_project' || a.type === 'create_storyboard_project' || a.project);
  const updateScenesAction = foundActions.find((a) => (a.action === 'update_scenes' || Array.isArray(a.scenes)) && a !== createAction);

  if (createAction && updateScenesAction) {
    const rawScenes = (updateScenesAction.scenes && updateScenesAction.scenes.length > 0)
      ? updateScenesAction.scenes
      : (createAction.scenes || createAction.project?.scenes || []);
    mergedAction = {
      ...createAction,
      action: 'create_storyboard_project',
      type: 'create_storyboard_project',
      project: {
        ...(createAction.project || {}),
        scenes: rawScenes,
      },
      scenes: rawScenes,
    };
  } else if (createAction) {
    mergedAction = createAction;
  } else if (updateScenesAction) {
    const asProject = extractStoryboardProjectFromData(updateScenesAction);
    if (asProject) {
      mergedAction = {
        action: 'create_storyboard_project',
        type: 'create_storyboard_project',
        reason: updateScenesAction.reason || 'Draft storyboard dirancang oleh Copilot.',
        project: asProject,
        scenes: asProject.scenes,
      };
    } else {
      mergedAction = updateScenesAction;
    }
  }

  // If merged action has a project object, enrich with extracted natural language params and normalize
  if (mergedAction && (mergedAction.project || mergedAction.action === 'create_storyboard_project')) {
    const normalized = extractStoryboardProjectFromData(mergedAction.project || mergedAction) || mergedAction.project || {};
    mergedAction.project = {
      ...normalized,
      productName: normalized.productName || extractedParams.productName || normalized.title || '',
      productDesc: normalized.productDesc || extractedParams.productDesc || '',
      modelTalent: normalized.modelTalent || extractedParams.modelTalent || '',
      bgSetting: normalized.bgSetting || extractedParams.bgSetting || '',
      brief: normalized.brief || extractedParams.brief || '',
      duration: Number(normalized.duration || extractedParams.duration || (normalized.scenes?.length ? normalized.scenes.length * 4 : 10)),
      numScenes: Number(normalized.numScenes || extractedParams.numScenes || (Array.isArray(normalized.scenes) ? normalized.scenes.length : 4)),
      aspectRatio: normalized.aspectRatio || extractedParams.aspectRatio || '9:16',
      formula: normalized.formula || extractedParams.formula || 'hook_extreme',
      scenes: Array.isArray(normalized.scenes) ? normalized.scenes : [],
    };
    mergedAction.scenes = mergedAction.project.scenes;
  }

  return {
    cleanText: text,
    action: mergedAction,
  };
}
