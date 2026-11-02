export function getTiktokStyleModifier(styleKey = 'ugc_handheld') {
  switch (styleKey) {
    case 'iphone_pov':
      return 'First-person POV shot on iPhone 15 Pro, creator hands holding product forward towards lens, shallow depth of field, authentic indoor home background, crisp natural lighting, sharp product label focus';
    case 'macro_texture':
      return 'Extreme macro close-up (ECU) 100mm lens, showing rich tactile product texture, sensory droplets and smooth application, tactile details, crisp focus, soft natural rim light';
    case 'split_screen':
      return 'TikTok split-screen vertical composition, side-by-side Before vs After visual proof, authentic real-life comparison, realistic smartphone camera texture, high contrast';
    case 'authentic_vlog':
      return 'Authentic casual TikTok room vlog, genuine relatable facial expression, natural eye-level selfie perspective, soft ring light reflection in eyes, real bedroom or vanity setting';
    case 'commercial_studio':
      return 'Clean minimalist modern e-commerce commercial shot, soft studio lighting, pristine aesthetic background, sharp product focus';
    case 'ugc_handheld':
    default:
      return 'Authentic UGC handheld smartphone camera video still, natural indoor ambient room lighting, realistic candid expression, unfiltered texture, subtle motion blur, high fidelity social media video frame';
  }
}

export function buildConsistencyAnchorTags({
  productName = '',
  productDesc = '',
  modelTalent = '',
  bgSetting = '',
  lockConsistency = true,
} = {}) {
  if (!lockConsistency) return '';
  const anchors = [];
  if (productName) {
    const pDesc = productDesc ? `, ${productDesc}` : '';
    anchors.push(`[PRODUCT ANCHOR: Maintain identical product design, packaging, and colors: ${productName}${pDesc}]`);
  }
  if (modelTalent) {
    anchors.push(`[CHARACTER LOCK: Maintain identical facial features, hair, and clothing: ${modelTalent}]`);
  }
  if (bgSetting) {
    anchors.push(`[ENVIRONMENT ANCHOR: Cohesive environment: ${bgSetting}]`);
  }
  return anchors.join(' ');
}

export function collectStoryboardRefImages(ctx = {}) {
  const refs = [];
  const seenKeys = new Set();

  const addRef = (ref, role = 'asset') => {
    if (!ref) return;
    let urlOrData = null;
    let weavyAsset = null;
    let id = null;

    if (typeof ref === 'string') {
      urlOrData = ref.trim();
    } else if (typeof ref === 'object') {
      weavyAsset = ref.weavyAsset || (ref.url && typeof ref.url === 'string' && ref.url.startsWith('http') ? ref : null);
      urlOrData = weavyAsset?.url || ref.url || ref.base64 || ref.src || ref.thumbnailUrl;
      id = ref.id || weavyAsset?.id;
    }

    if (!urlOrData && !weavyAsset) return;

    // Avoid duplicates
    const dedupeKey = weavyAsset?.id || weavyAsset?.url || (typeof urlOrData === 'string' ? urlOrData.slice(0, 120) : null) || id;
    if (dedupeKey && seenKeys.has(dedupeKey)) return;
    if (dedupeKey) seenKeys.add(dedupeKey);

    if (weavyAsset && weavyAsset.url) {
      refs.push(weavyAsset);
    } else if (typeof ref === 'object' && (ref.base64 || ref.url)) {
      refs.push(ref);
    } else if (typeof urlOrData === 'string' && urlOrData.length > 20) {
      refs.push(urlOrData);
    }
  };

  // 1. Direct context references
  if (ctx.sbProductWeavyAsset) addRef(ctx.sbProductWeavyAsset, 'product');
  else if (ctx.sbProductRefBase64) addRef(ctx.sbProductRefBase64, 'product');

  if (ctx.sbModelWeavyAsset) addRef(ctx.sbModelWeavyAsset, 'model');
  else if (ctx.sbModelRefBase64) addRef(ctx.sbModelRefBase64, 'model');

  if (ctx.sbBgWeavyAsset) addRef(ctx.sbBgWeavyAsset, 'background');
  else if (ctx.sbBgRefBase64) addRef(ctx.sbBgRefBase64, 'background');

  if (Array.isArray(ctx.sbCustomAssets)) {
    ctx.sbCustomAssets.forEach((ca) => {
      if (ca) addRef(ca.weavyAsset || ca.base64 || ca, 'custom');
    });
  }

  // 2. Project & inputState references
  const proj = ctx.currentSbProject;
  if (proj) {
    if (proj.inputState) {
      addRef(proj.inputState.productAsset?.weavyAsset || proj.inputState.productAsset?.base64 || proj.inputState.productAsset, 'product');
      addRef(proj.inputState.modelAsset?.weavyAsset || proj.inputState.modelAsset?.base64 || proj.inputState.modelAsset, 'model');
      addRef(proj.inputState.bgAsset?.weavyAsset || proj.inputState.bgAsset?.base64 || proj.inputState.bgAsset, 'background');
      if (Array.isArray(proj.inputState.customAssets)) {
        proj.inputState.customAssets.forEach((ca) => addRef(ca?.weavyAsset || ca?.base64 || ca, 'custom'));
      }
    }
    addRef(proj.productAsset?.weavyAsset || proj.productAsset?.base64 || proj.productAsset, 'product');
    addRef(proj.modelAsset?.weavyAsset || proj.modelAsset?.base64 || proj.modelAsset, 'model');
    addRef(proj.bgAsset?.weavyAsset || proj.bgAsset?.base64 || proj.bgAsset, 'background');
    if (proj.productImage) addRef(proj.productImage, 'product');
    if (Array.isArray(proj.customAssets)) {
      proj.customAssets.forEach((ca) => addRef(ca?.weavyAsset || ca?.base64 || ca, 'custom'));
    }
  }

  // 3. Fallback from DOM preview elements if running in browser
  if (typeof document !== 'undefined') {
    const prodImg = document.getElementById('sbProdImgPreview');
    const prodWrap = document.getElementById('sbProdPreviewBox');
    if (prodImg && prodImg.src && (!prodWrap || !prodWrap.classList.contains('hidden'))) {
      const src = prodImg.src;
      if (src && !src.endsWith('#') && src.length > 20) {
        addRef(src, 'product');
      }
    }

    const modelImg = document.getElementById('sbModelImgPreview');
    const modelWrap = document.getElementById('sbModelPreviewBox');
    if (modelImg && modelImg.src && (!modelWrap || !modelWrap.classList.contains('hidden'))) {
      const src = modelImg.src;
      if (src && !src.endsWith('#') && src.length > 20) {
        addRef(src, 'model');
      }
    }

    const bgImg = document.getElementById('sbBgImgPreview');
    const bgWrap = document.getElementById('sbBgPreviewBox');
    if (bgImg && bgImg.src && (!bgWrap || !bgWrap.classList.contains('hidden'))) {
      const src = bgImg.src;
      if (src && !src.endsWith('#') && src.length > 20) {
        addRef(src, 'background');
      }
    }
  }

  return refs;
}

export function updateSceneCardProgress(ctxOrSceneId = {}, sceneIdOrProgress, maybeProgress) {
  let sceneId = sceneIdOrProgress;
  let progress = maybeProgress;
  if (typeof ctxOrSceneId === 'string' || typeof ctxOrSceneId === 'number') {
    sceneId = ctxOrSceneId;
    progress = sceneIdOrProgress;
  }
  const cleanId = String(sceneId || '').replace(/^card_/, '');
  const card = document.getElementById(`card_${cleanId}`);
  if (!card) return;
  const bar = card.querySelector('.sb-progress-bar-fill');
  if (bar) bar.style.width = `${progress}%`;
  const txt = card.querySelector('.sb-generating-text');
  if (txt) txt.textContent = `Merender Visual Weavy AI (${progress}%)...`;
}

export function updateSceneCardDom(ctxOrScene = {}, maybeScene) {
  let ctx = ctxOrScene;
  let scene = maybeScene;
  if (!maybeScene && ctxOrScene && ctxOrScene.id) {
    scene = ctxOrScene;
    ctx = {};
  }
  if (!scene || !scene.id) return;
  const cleanId = String(scene.id).replace(/^card_/, '');
  const card = document.getElementById(`card_${cleanId}`);
  if (!card) return;
  const renderFn = typeof ctx.renderSceneCardHtml === 'function' ? ctx.renderSceneCardHtml : null;
  if (!renderFn) return;
  const newHtml = renderFn(scene, (scene.sceneNumber || 1) - 1);
  card.outerHTML = newHtml;
  ctx.bindSceneCardInteractions?.();
}

export function isSceneTextless(scene = {}, project = null) {
  const rawOst = scene?.onScreenText ?? scene?.on_screen_text ?? scene?.text ?? '';
  if (!rawOst || String(rawOst).trim() === '') return true;
  return /^(?:none|tidak\s+ada(?:\s+teks)?|tanpa\s+teks|kosong|-|n\/a|no\s+text)$/i.test(String(rawOst).trim());
}

export function sanitizeSceneImagePrompt(rawPrompt = '', scene = {}, project = null) {
  let prompt = (rawPrompt || '').trim();
  if (!prompt) return prompt;

  // 1. Clean broken or orphaned preposition artifacts (e.g. "with at ,", "with at", "at ,", "with ,")
  prompt = prompt
    .replace(/\bwith\s+at\s*,?/gi, '')
    .replace(/\bwith\s+at\b/gi, '')
    .replace(/\bat\s*,/gi, '')
    .replace(/\bwith\s*,/gi, '')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+,/g, ',')
    .trim();

  // 2. Sanitize "featuring <Title / Slogan>" so AI does not interpret slogans or headlines as 3D typography or banners
  prompt = prompt.replace(/featuring\s+([^,]+?)(?=(?:\s+with|\s+at|,|\.|$))/gi, (match, subject) => {
    let cleanSubject = subject.trim();
    cleanSubject = cleanSubject.replace(/["'“”]/g, '').replace(/[!?]+$/, '').trim();
    if (cleanSubject.includes('—')) {
      cleanSubject = cleanSubject.split('—')[0].trim();
    } else if (cleanSubject.includes(' - ')) {
      cleanSubject = cleanSubject.split(' - ')[0].trim();
    }
    cleanSubject = cleanSubject.replace(/^(?:Iklan\s+|Hasil\s+Panen\s+)/i, '');
    return `featuring ${cleanSubject}`;
  });

  // 3. If scene has NO on-screen text, enforce clean visual & negative text constraints
  const isTextless = isSceneTextless(scene, project);
  if (isTextless) {
    prompt = prompt.replace(/\bcommercial advertising photograph\b/gi, 'cinematic commercial photograph');
    const hasNegativeText = /no\s+(?:text|title|typography|words|banner|stickers|overlay)/i.test(prompt);
    if (!hasNegativeText) {
      prompt = prompt.replace(/\s*,\s*8k\.?$/i, '').replace(/\.*$/, '');
      prompt = `${prompt}, clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers, 8k.`;
    }
  }

  // 4. VO-Only Semantic Separation: Strip any accidental yellow shopping cart / keranjang kuning visual hallucinations
  prompt = prompt
    .replace(/\b(?:with\s+a\s+|with\s+|holding\s+a\s+|pointing\s+at\s+)?(?:yellow\s+shopping\s+cart|yellow\s+cart|yellow\s+basket|keranjang\s+kuning|shopping\s+cart\s+icon|yellow\s+cta\s+button)\b/gi, '')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*\./g, '.')
    .trim();

  return prompt;
}

export async function initiateSceneTask(ctx = {}, scene, acc, idToken, modelOverride = null) {
  const refImages = collectStoryboardRefImages(ctx);
  if (scene?.referenceImage) refImages.push(scene.referenceImage);
  if (Array.isArray(scene?.referenceImages)) refImages.push(...scene.referenceImages);

  const modelName = modelOverride ||
    (typeof document !== 'undefined' && document.getElementById('sbImageModel')?.value) ||
    scene.imageModel ||
    ctx.currentSbProject?.imageModel ||
    'GPT Image 2.5';
  const aspectRatio = scene.aspectRatio || ctx.currentSbProject?.aspectRatio || '9:16';
  
  // Intelligently resolve prompt: prioritize active textarea edit if user is typing, then fallback to scene prompt
  const activeEditTextarea = typeof document !== 'undefined' ? document.getElementById(`prompt_edit_${scene.id}`) : null;
  let prompt = (activeEditTextarea && activeEditTextarea.value ? activeEditTextarea.value : (scene.imagePrompt || '')).trim();
  const visualDesc = (scene.visualDescription || '').trim();
  const cameraAngle = (scene.cameraAngle || '').trim();
  const isGenericTemplate = !prompt || /photograph of\s+showcasing|showcasing.*at\s*,/i.test(prompt) || /^(vertical|horizontal)?\s*(\d+:\d+)?\s*commercial photograph of\s*showcasing/i.test(prompt) || /commercial advertising photograph of.*showcasing/i.test(prompt);

  if (isGenericTemplate && (visualDesc || cameraAngle)) {
    const parts = [];
    if (cameraAngle) parts.push(cameraAngle);
    if (visualDesc) parts.push(visualDesc);
    prompt = `Vertical ${aspectRatio} commercial cinematic shot, ${parts.join(', ')}`;
  } else if (!prompt && visualDesc) {
    prompt = `Vertical ${aspectRatio} commercial cinematic shot, ${cameraAngle ? cameraAngle + ', ' : ''}${visualDesc}`;
  } else if (prompt && visualDesc && !prompt.toLowerCase().includes(visualDesc.toLowerCase().slice(0, Math.min(25, visualDesc.length))) && !prompt.includes('Scene Action & Framing:')) {
    // If prompt doesn't mention the scene action/visual description, append the specific scene action so it reflects the storyboard
    prompt = `${prompt}. Scene Action & Framing: ${cameraAngle ? cameraAngle + ', ' : ''}${visualDesc}`;
  }

  // Intelligently sanitize prompt: clean orphaned grammar, remove slogan typography triggers, and inject strict negative text constraints if no on-screen text
  prompt = sanitizeSceneImagePrompt(prompt, scene, ctx.currentSbProject);

  // Sync sanitized prompt back to scene object and card UI so user sees the clean prompt!
  if (prompt && prompt !== scene.imagePrompt) {
    scene.imagePrompt = prompt;
    if (typeof document !== 'undefined') {
      const card = document.getElementById(`card_${scene.id}`);
      const promptBox = card?.querySelector('.sb-prompt-box');
      if (promptBox) promptBox.textContent = prompt;
      const copyBtn = card?.querySelector('.btn-copy-prompt');
      if (copyBtn) copyBtn.setAttribute('data-text', prompt);
    }
  }

  if (!prompt) throw new Error('Prompt gambar pada scene ini masih kosong.');

  let recipeId = await ctx.getOrCreateWeavyRecipeId(idToken, acc?.userId || acc?.id, 'image');
  if (!recipeId) throw new Error('Recipe Canvas tidak dapat dibuat atau ditemukan di akun Weavy.');

  const readyAssets = [];
  for (const ref of refImages) {
    try {
      if (ref && typeof ref === 'object' && ref.url && typeof ref.url === 'string' && ref.url.startsWith('http')) {
        readyAssets.push({
          type: 'image',
          url: ref.url,
          width: ref.width || 1024,
          height: ref.height || 1024,
          thumbnailUrl: ref.thumbnailUrl || ref.url,
          id: ref.id || `weavy_asset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: ref.name || `ref_${Date.now()}.png`,
        });
        continue;
      }
      if (ref && typeof ref === 'object' && ref.weavyAsset && ref.weavyAsset.url) {
        readyAssets.push(ref.weavyAsset);
        continue;
      }
      const asset = await ctx.uploadAssetToWeavy(ref, idToken);
      if (asset && asset.url) readyAssets.push(asset);
    } catch (e) {
      console.warn('Upload ref asset warning:', e);
    }
  }

  // If reference assets exist, enrich prompt context with product, talent, and background details
  if (readyAssets.length > 0) {
    const prodVal = (document.getElementById('sbProductName')?.value || ctx.currentSbProject?.inputState?.productName || '').trim();
    const modelVal = (document.getElementById('sbModelTalent')?.value || ctx.currentSbProject?.inputState?.modelTalent || '').trim();
    const bgVal = (document.getElementById('sbBgSetting')?.value || ctx.currentSbProject?.inputState?.bgSetting || '').trim();

    const tags = [];
    if (prodVal) tags.push(`Product: "${prodVal}"`);
    if (modelVal) tags.push(`Talent: "${modelVal}"`);
    if (bgVal) tags.push(`Setting: "${bgVal}"`);

    const refContext = tags.length ? ` [Visual References: ${tags.join(' | ')}]` : ' [Visual References attached]';
    if (!prompt.includes('[Visual References:')) {
      prompt += refContext;
    }
  }

  // 1. Opsi 4: Inject Character Lock & Product Anchor for continuous visual consistency
  const hasDoc = typeof document !== 'undefined';
  const lockEl = hasDoc ? document.getElementById('sbLockConsistency') : null;
  const lockConsistency = lockEl ? lockEl.checked : (ctx.currentSbProject?.inputState?.lockConsistency !== false);
  if (lockConsistency) {
    const prodVal = ((hasDoc && document.getElementById('sbProductName')?.value) || ctx.currentSbProject?.inputState?.productName || '').trim();
    const prodDesc = ((hasDoc && document.getElementById('sbProductDesc')?.value) || ctx.currentSbProject?.inputState?.productDesc || '').trim();
    const modelVal = ((hasDoc && document.getElementById('sbModelTalent')?.value) || ctx.currentSbProject?.inputState?.modelTalent || '').trim();
    const bgVal = ((hasDoc && document.getElementById('sbBgSetting')?.value) || ctx.currentSbProject?.inputState?.bgSetting || '').trim();

    const anchorTag = buildConsistencyAnchorTags({
      productName: prodVal,
      productDesc: prodDesc,
      modelTalent: modelVal,
      bgSetting: bgVal,
      lockConsistency: true,
    });
    if (anchorTag && !prompt.includes('[PRODUCT ANCHOR:')) {
      prompt = `${anchorTag} ${prompt}`;
    }
  }

  // 2. Opsi 2: Inject TikTok Native Look style modifier
  const tiktokStyle = ((hasDoc && document.getElementById('sbTiktokStyle')?.value) || ctx.currentSbProject?.inputState?.tiktokStyle || 'ugc_handheld');
  const styleModifier = getTiktokStyleModifier(tiktokStyle);
  if (styleModifier && !prompt.includes('[TikTok Aesthetic:') && !prompt.toLowerCase().includes(tiktokStyle.toLowerCase().replace(/_/g, ' '))) {
    prompt += ` [TikTok Aesthetic: ${styleModifier}]`;
  }

  const lowerModel = String(modelName || '').toLowerCase().trim();
  const isSeedream = lowerModel.includes('seedream') || lowerModel.includes('v5');
  const isNanoBanana = lowerModel.includes('banana') || lowerModel.includes('nano');
  const isGrok = lowerModel.includes('grok') || lowerModel.includes('imagine');
  const isGptEdit = lowerModel.includes('edit') && lowerModel.includes('gpt');
  // Evaluate 2.5 BEFORE 2.0 to avoid 'gpt 2.5'.includes('gpt 2') bug!
  const isGpt25 = !isSeedream && !isNanoBanana && !isGrok && !isGptEdit && (
    lowerModel.includes('2.5') || lowerModel.includes('2_5') || lowerModel.includes('flare') || lowerModel.includes('gpt-image-2.5') || lowerModel.includes('gpt image 2.5')
  );
  const isGpt2 = !isSeedream && !isNanoBanana && !isGrok && !isGptEdit && !isGpt25 && (
    lowerModel.includes('gpt 2') || lowerModel.includes('gpt_image_2') || lowerModel.includes('chatgpt images 2.0')
  );

  const imageSizeMap = {
    '9:16': 'portrait_16_9',
    '16:9': 'landscape_16_9',
    '1:1': 'square_hd',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
  };

  const imageSize = imageSizeMap[aspectRatio] || 'portrait_16_9';
  const randomSeed = Math.floor(Math.random() * 2147483647);
  const promptNodeId = `prompt_${Date.now()}`;
  const modelNodeId = `node_model_${Date.now()}`;

  const promptNode = {
    id: promptNodeId,
    type: 'promptV3',
    position: { x: 200, y: 200 },
    data: {
      name: 'Prompt',
      color: 'Yambo_Green',
      prompt,
      output: { type: 'text', prompt },
      result: { prompt },
      handles: { output: { prompt: { type: 'text', order: 0 } } },
      version: 3,
    },
  };

  let targetModelName = 'gpt-image-2.5';
  let targetDisplayName = 'GPT Image 2.5';
  let targetDescription = 'Generates images with GPT Image 2.5';
  let targetMenuDisplayName = 'GPT Image 2.5';
  let modelCredits = 4;
  let inputsList = [];
  let parametersList = [];
  let paramsObj = {};
  let inputObj = { prompt };
  let nodeHandles = {
    input: { prompt: { type: 'text', order: 0, required: true } },
    output: { result: { type: 'image', order: 0 } },
  };
  let outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
  let nodeSchema = {};

  inputsList.push([
    { id: 'prompt', title: 'Prompt', description: 'Text description', validTypes: ['text'], required: true },
    { nodeId: promptNodeId, outputId: 'prompt', string: prompt },
  ]);

  const refNodes = [];
  const refEdges = [];
  readyAssets.forEach((asset, idx) => {
    const fNodeId = `file_ref_${Date.now()}_${idx}`;
    const handleName = isGptEdit && idx === 0 ? 'image' : isGrok && readyAssets.length === 1 ? 'image' : `image_${idx + 1}`;
    refNodes.push({
      id: fNodeId,
      isModel: false,
      type: 'import',
      dragHandle: '.node-header',
      position: { x: 200, y: 380 + idx * 180 },
      data: {
        name: `File ${idx + 1}`,
        color: 'Yambo_Blue',
        files: [asset],
        output: { file: asset },
        result: asset,
        handles: {
          output: {
            file: {
              type: 'any',
              label: 'File',
              order: 0,
              format: 'uri',
              description: 'The uploaded file',
            },
          },
        },
        version: 3,
        dark_color: 'Yambo_Blue_Dark',
        border_color: 'Yambo_Blue_Stroke',
      },
    });

    nodeHandles.input[handleName] = { type: 'image', order: idx + 1, required: isGptEdit && idx === 0 };
    inputObj[handleName] = asset;
    paramsObj[handleName] = asset;

    refEdges.push({
      id: `edge_ref_${idx + 1}_${Date.now()}`,
      type: 'custom',
      source: fNodeId,
      target: modelNodeId,
      sourceHandle: `${fNodeId}-output-file`,
      targetHandle: `${modelNodeId}-input-${handleName}`,
      data: {
        sourceColor: 'Yambo_Blue',
        targetColor: 'Yambo_Purple',
        sourceHandleType: 'any',
        targetHandleType: 'image',
      },
    });
    inputsList.push([
      { id: handleName, title: handleName, description: `Reference image ${idx + 1}`, validTypes: ['image'], required: isGptEdit && idx === 0 },
      { nodeId: fNodeId, outputId: 'file', file: asset },
    ]);
  });

  if (isGpt25) {
    targetModelName = 'gpt-image-2.5';
    targetDisplayName = 'GPT Image 2.5';
    targetDescription = 'Generates images with GPT Image 2.5';
    targetMenuDisplayName = 'GPT Image 2.5';
    modelCredits = 10;
    outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
    parametersList = [
      [{ id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } }, { type: 'value', data: { type: 'string', value: 'Flare' } }],
      [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }],
      [{ id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: 'auto' } }],
      [{ id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
      [{ id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } }, { type: 'value', data: { type: 'string', value: 'png' } }],
    ];
    paramsObj = { ...paramsObj, model: 'Flare', prompt: prompt.trim(), quality: 'high', background: 'auto', image_size: imageSize, output_format: 'png' };
  } else if (isSeedream) {
    targetModelName = 'fal-ai/bytedance/seedream/v5/lite/edit';
    targetDisplayName = 'Seedream V5.0 Pro Edit';
    targetDescription = 'Edit images with Seedream V5.0 Pro';
    targetMenuDisplayName = 'Seedream V5.0 Pro Edit';
    modelCredits = 12;
    outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
    parametersList = [
      [{ id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, defaultValue: { type: 'string', value: 'V5.0 Pro' } }, { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } }],
      [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
      [{ id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
      [{ id: 'enhance_prompt_mode', title: 'Enhance Prompt Mode', constraint: { type: 'enum', options: ['standard', 'fast'] }, defaultValue: { type: 'string', value: 'standard' } }, { type: 'value', data: { type: 'string', value: 'standard' } }],
    ];
    paramsObj = { ...paramsObj, model: 'V5.0 Pro', prompt: prompt.trim(), seed: randomSeed, image_size: imageSize, enhance_prompt_mode: 'standard' };
  } else if (isNanoBanana) {
    targetModelName = 'fal-ai/nano-banana-pro/edit';
    targetDisplayName = 'Nano Banana Pro';
    targetDescription = 'Edit images with Nano Banana Pro';
    targetMenuDisplayName = 'Nano Banana Pro';
    modelCredits = 11;
    const cleanRes = aspectRatio === '16:9' || aspectRatio === '1:1' ? '2K' : '1K';
    outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
    parametersList = [
      [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
      [{ id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, defaultValue: { type: 'string', value: '1K' } }, { type: 'value', data: { type: 'string', value: cleanRes } }],
      [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: aspectRatio || '9:16' } }],
      [{ id: 'enable_web_search', title: 'Enable Web Search', constraint: { type: 'boolean' }, defaultValue: { type: 'boolean', value: false } }, { type: 'value', data: { type: 'boolean', value: false } }],
    ];
    paramsObj = { ...paramsObj, prompt: prompt.trim(), seed: randomSeed, num_images: 1, resolution: cleanRes, aspect_ratio: aspectRatio || '9:16', output_format: 'png', enable_web_search: false };
  } else if (isGptEdit) {
    if (readyAssets.length === 0) {
      console.warn('[Storyboard] ChatGPT Images 2.0 Edit dipilih tetapi tidak ada gambar referensi. Otomatis beralih ke model text-to-image GPT Image 2.5.');
      targetModelName = 'gpt-image-2.5';
      targetDisplayName = 'GPT Image 2.5';
      targetDescription = 'Generates images with GPT Image 2.5';
      targetMenuDisplayName = 'GPT Image 2.5';
      modelCredits = 10;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [{ id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } }, { type: 'value', data: { type: 'string', value: 'Flare' } }],
        [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }],
        [{ id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: 'auto' } }],
        [{ id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
        [{ id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } }, { type: 'value', data: { type: 'string', value: 'png' } }],
      ];
      paramsObj = { ...paramsObj, model: 'Flare', prompt: prompt.trim(), quality: 'high', background: 'auto', image_size: imageSize, output_format: 'png' };
    } else {
      targetModelName = 'gpt_image_1_edit';
      targetDisplayName = 'ChatGPT Images 2.0 Edit';
      targetDescription = "Edit images with OpenAI's GPT Image 2";
      targetMenuDisplayName = 'GPT Image 1';
      modelCredits = 9;
      nodeHandles = { input: { prompt: { id: `470e45b3-3c3a-46f1-822e-715abc4610ab`, type: 'text', label: 'prompt', order: 0, format: 'text', required: true, description: 'Prompt for image edit' }, ...nodeHandles.input }, output: { image: { id: `470e45b3-3c3a-46f1-822e-715abc4610at`, type: 'image', label: 'image', order: 0, format: 'uri', description: 'Result image' } } };
      outputSchema = [{ id: 'image', title: 'image', description: 'Result image', dataType: 'image' }];
      nodeSchema = {
        size: { type: 'fal_image_size', order: 9, title: 'Resolution', default: 'auto', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'], description: "The size of the generated images. Edges must be multiples of 16px, max 3840px per side, aspect ratio up to 3:1, and total pixels between 655,360–8,294,400." },
        model: { type: 'enum', order: 0, title: 'Model', default: 'GPT Image 2', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'], description: 'GPT model type' },
        quality: { type: 'enum', order: 7, title: 'Quality', default: 'medium', options: ['auto', 'high', 'medium', 'low'], description: "The quality of the image that will be generated. 'auto' will automatically select the best quality for the given model." },
      };
      parametersList = [
        [{ id: 'model', title: 'Model', description: 'GPT model type', constraint: { type: 'enum', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'] }, defaultValue: { type: 'string', value: 'GPT Image 2' } }, { type: 'value', data: { type: 'string', value: 'GPT Image 2' } }],
        [{ id: 'quality', title: 'Quality', description: "The quality of the image that will be generated. 'auto' will automatically select the best quality for the given model.", constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'medium' } }, { type: 'value', data: { type: 'string', value: 'medium' } }],
        [{ id: 'size', title: 'Resolution', description: "The size of the generated images. Edges must be multiples of 16px, max 3840px per side, aspect ratio up to 3:1, and total pixels between 655,360–8,294,400.", constraint: { type: 'image_size', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }],
      ];
      paramsObj = { ...paramsObj, size: 'auto', model: 'GPT Image 2', quality: 'medium', number_of_images: 1, prompt: prompt.trim() };
    }
  } else if (isGpt2) {
    targetModelName = 'gpt_image_2';
    targetDisplayName = 'ChatGPT Images 2.0';
    targetDescription = "Generate images with OpenAI's GPT Image 2";
    targetMenuDisplayName = 'GPT Image 2';
    modelCredits = 8;
    nodeHandles = { input: { prompt: { type: 'text', order: 0, required: true }, ...nodeHandles.input }, output: { image: { type: 'image', order: 0 } } };
    outputSchema = [{ id: 'image', title: 'Image', description: 'The generated image.', dataType: 'image' }];
    parametersList = [
      [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }],
      [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: aspectRatio || '9:16' } }, { type: 'value', data: { type: 'string', value: aspectRatio || '9:16' } }],
    ];
    paramsObj = { ...paramsObj, prompt: prompt.trim(), quality: 'high', aspect_ratio: aspectRatio || '9:16' };
  } else if (isGrok) {
    targetModelName = 'xai/grok-imagine-image';
    targetDisplayName = 'Grok Imagine Image';
    targetDescription = 'Generates images with Grok Imagine Image';
    targetMenuDisplayName = 'Grok Imagine Image';
    modelCredits = 8;
    outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
    parametersList = [
      [{ id: 'seed', title: 'Seed', constraint: { type: 'integer' }, defaultValue: { type: 'integer', value: 0 } }, { type: 'value', data: { type: 'integer', value: randomSeed } }],
      [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: aspectRatio || '9:16' } }, { type: 'value', data: { type: 'string', value: aspectRatio || '9:16' } }],
    ];
    paramsObj = { ...paramsObj, prompt: prompt.trim(), seed: randomSeed, aspect_ratio: aspectRatio || '9:16' };
  }

  const isFalImported = isSeedream || isNanoBanana || isGrok;

  const modelNode = {
    id: modelNodeId,
    isModel: true,
    type: 'custommodelV2',
    dragHandle: '.node-header',
    position: { x: 650, y: 200 },
    data: {
      name: targetDisplayName,
      description: targetDescription,
      color: 'Yambo_Purple',
      ...(isGptEdit ? { color: 'Red' } : {}),
      menu: { icon: 'EmojiObjectsIcon', isModel: true, displayName: targetMenuDisplayName },
      model: { name: targetModelName, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) },
      ...(Object.keys(nodeSchema).length > 0 ? { schema: nodeSchema } : {}),
      kind: { type: 'wildcard', model: { type: 'predefined', name: targetModelName, description: targetDescription, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) }, inputs: inputsList, parameters: parametersList, outputs: outputSchema },
      params: paramsObj,
      input: inputObj,
      handles: nodeHandles,
      version: 3,
    },
  };

  const nodes = [promptNode, modelNode, ...refNodes];
  const edges = [{ id: `edge_prompt_${Date.now()}`, type: 'custom', source: promptNodeId, target: modelNodeId, sourceHandle: `${promptNodeId}-output-prompt`, targetHandle: `${modelNodeId}-input-prompt`, data: { sourceColor: 'Yambo_Green', targetColor: 'Yambo_Purple', sourceHandleType: 'text', targetHandleType: 'text' } }, ...refEdges];

  let execHeaders = ctx.getWeavyClientHeaders(idToken, acc?.userId || acc?.id, recipeId);
  await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }) }).catch(() => {});

  const executePayload = { numberOfRuns: 1, nodes, edges, displayedCost: { credits: modelCredits, perSecondRate: 0, surface: 'drawer' } };

  let execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });

  if (execRes.status === 403) {
    try {
      await ctx.approveWeavyModel(targetModelName, idToken, acc?.userId || acc?.id, recipeId);
      execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
    } catch (approvalError) {
      console.warn('[Storyboard Model Approval Warning]:', approvalError);
    }
  }

  if (execRes.status === 401 || execRes.status === 403) {
    if (typeof ctx.recoverWeavySessionOn403 === 'function') {
      try {
        const renewedToken = await ctx.recoverWeavySessionOn403(acc);
        if (renewedToken) idToken = renewedToken;
      } catch (e) {
        console.warn('[Storyboard 403 recovery warning]:', e);
      }
    }

    const storageKey = `weavy_canvas_image_${acc?.userId || 'default'}`;
    await ctx.storage.set(storageKey, null);
    const freshToken = await ctx.getValidIdToken(acc);
    const activeToken = freshToken || idToken;
    if (activeToken) {
      recipeId = await ctx.getOrCreateWeavyRecipeId(activeToken, acc?.userId || acc?.id, 'image');
      execHeaders = ctx.getWeavyClientHeaders(activeToken, acc?.userId || acc?.id, recipeId);
      await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true }) }).catch(() => {});
      execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
    }
  }

  if (!execRes.ok) {
    const errText = await execRes.text().catch(() => '');
    throw new Error(`Gagal mengirim batch render ke Weavy AI (HTTP ${execRes.status}): ${errText.slice(0, 100)}`);
  }

  const execData = await execRes.json();
  const batchId = execData.batchId || execData.id;

  return { mode: 'direct', recipeId, batchId, modelNodeId, refNodes, readyAssets, execHeaders, scene };
}

export async function pollSceneTask(ctx = {}, taskContext, onProgress) {
  const maxAttempts = 240; // Up to 8 minutes polling
  const inputUrls = (taskContext.readyAssets || []).flatMap((a) => [a.url, a.downloadUrl, a.thumbnailUrl].filter(Boolean));
  const refNodeIds = new Set((taskContext.refNodes || []).map((n) => n.id));
  const completedStatuses = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'FINISHED', 'DONE']);
  const failedStatuses = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'FAIL']);

  let completedRetriesWithoutUrl = 0;

  for (let poll = 0; poll < maxAttempts; poll++) {
    await new Promise((r) => setTimeout(r, 2000));
    
    let progressPct = 25;
    if (poll < 15) {
      progressPct = 25 + Math.round(poll * 2.5); // 25% -> 62%
    } else if (poll < 45) {
      progressPct = 62 + Math.round((poll - 15) * 0.8); // 62% -> 86%
    } else if (poll < 90) {
      progressPct = 86 + Math.round((poll - 45) * 0.2); // 86% -> 95%
    } else {
      progressPct = Math.min(98, 95 + Math.round((poll - 90) * 0.03));
    }
    onProgress?.(progressPct);

    try {
      const stRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${taskContext.recipeId}/batches/${taskContext.batchId}/status`, { headers: taskContext.execHeaders });
      if (stRes.ok) {
        const stData = await stRes.json();
        const run = stData.recipeRuns?.[0] || stData.recipeRun;
        const currentStatus = (run?.status || stData.status || '').toUpperCase();

        if (completedStatuses.has(currentStatus)) {
          const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];
          let resultUrl = null;

          // 1. Top-level candidates
          const topLevelCandidates = [
            run?.result, run?.output, run?.resultUrl, run?.outputUrl, run?.url,
            stData.result, stData.output, stData.resultUrl, stData.outputUrl, stData.url,
            ...(Array.isArray(run?.outputs) ? run.outputs : []),
            ...(Array.isArray(stData.outputs) ? stData.outputs : []),
          ];

          for (const candidate of topLevelCandidates) {
            const url = ctx.extractMediaUrlFromObject(candidate, inputUrls);
            if (url) {
              resultUrl = url;
              break;
            }
          }

          // 2. Model run
          if (!resultUrl) {
            const modelRun = nodeRuns.find((nr) => nr.nodeId === taskContext.modelNodeId) ||
              nodeRuns.find((nr) => nr.nodeType === 'custommodelV2' || (nr.isModel && nr.nodeType !== 'import')) ||
              nodeRuns.find((nr) => !refNodeIds.has(nr.nodeId) && nr.nodeType !== 'import' && nr.nodeType !== 'promptV3');

            if (modelRun) {
              const resObj = modelRun.result || modelRun.output;
              if (resObj) {
                const url = ctx.extractMediaUrlFromObject(resObj, inputUrls);
                if (url) resultUrl = url;
              }
            }
          }

          // 3. Other node runs
          if (!resultUrl) {
            for (const nr of nodeRuns) {
              if (refNodeIds.has(nr.nodeId) || nr.nodeType === 'import' || nr.nodeType === 'promptV3' || nr.name?.includes('Reference Image') || nr.name?.startsWith('File')) continue;
              const resObj = nr.result || nr.output;
              if (resObj) {
                const url = ctx.extractMediaUrlFromObject(resObj, inputUrls);
                if (url) {
                  resultUrl = url;
                  break;
                }
              }
            }
          }

          // 4. Recursive whole object fallback
          if (!resultUrl) {
            const topUrl = ctx.extractMediaUrlFromObject(run || stData, inputUrls);
            if (topUrl) resultUrl = topUrl;
          }

          if (resultUrl) {
            onProgress?.(100);
            return resultUrl;
          } else {
            // Status completed but result URL not populated yet, wait up to 30 additional poll cycles
            completedRetriesWithoutUrl += 1;
            if (completedRetriesWithoutUrl > 30) {
              break;
            }
          }
        } else if (failedStatuses.has(currentStatus)) {
          const errMsg = run?.error?.message || run?.error || stData.error || run?.errorMessage || 'Generasi gambar gagal pada Weavy AI.';
          throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
        }
      }
    } catch (err) {
      if (err.message && (err.message.includes('Generasi gambar gagal') || err.message.includes('Akses ditolak'))) throw err;
      console.warn('[Scene Polling Status Warning]:', err);
    }
  }

  throw new Error('Gambar tidak berhasil didapatkan setelah batas waktu tunggu. Silakan periksa koneksi atau coba generate ulang.');
}

const activeGeneratingSceneIds = new Set();
let isBatchGeneratingActive = false;

export async function generateSingleSceneVisual(ctx = {}, sceneId, options = {}) {
  const proj = ctx.currentSbProject || (typeof currentSbProject !== 'undefined' ? currentSbProject : null);
  if (!proj || !Array.isArray(proj.scenes)) {
    console.warn('[Storyboard] Project atau scene list tidak ditemukan.');
    return;
  }
  const cleanId = String(sceneId || '').replace(/^card_/, '');
  const scene = proj.scenes.find((s) => String(s.id) === cleanId || String(s.id) === String(sceneId) || String(s.sceneNumber) === cleanId);
  if (!scene) {
    console.warn('[Storyboard] Scene tidak ditemukan dengan ID:', sceneId);
    return;
  }

  // Strict concurrency lock: prevent double-clicks and duplicate parallel requests
  if (activeGeneratingSceneIds.has(scene.id) || scene.status === 'generating') {
    ctx.showAuthAlert?.(`Scene ${scene.sceneNumber} sedang dalam proses render, mohon tunggu...`, 'info');
    return;
  }

  const acc = ctx.getActiveAccount();
  if (!acc) {
    alert('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.');
    ctx.switchTab('settings');
    return;
  }

  activeGeneratingSceneIds.add(scene.id);
  scene.status = 'generating';
  scene.progress = 15;
  scene.errorMessage = null;
  const resolvedModelName = options.model || (typeof document !== 'undefined' && document.getElementById('sbImageModel')?.value) || scene.imageModel || ctx.currentSbProject?.imageModel || 'GPT Image 2.5';
  scene.imageModel = resolvedModelName;
  if (ctx.currentSbProject) ctx.currentSbProject.imageModel = resolvedModelName;
  ctx.updateSceneCardDom(scene);

  try {
    const idToken = await ctx.getValidIdToken(acc);
    const taskContext = await initiateSceneTask(ctx, scene, acc, idToken, options.model);
    scene.progress = 25;
    ctx.updateSceneCardProgress(scene.id, 25);

    const resultUrl = await pollSceneTask(ctx, taskContext, (prog) => {
      scene.progress = prog;
      ctx.updateSceneCardProgress(scene.id, prog);
    });

    if (resultUrl) {
      scene.status = 'completed';
      scene.imageUrl = resultUrl;
      scene.progress = 100;
      scene.errorMessage = null;
      ctx.updateSceneCardDom(scene);
      ctx.updateCompletedBadge?.();
      ctx.refreshCredits?.();
      await ctx.handleSaveSbProject?.(false);
      ctx.showAuthAlert?.(`Scene ${scene.sceneNumber} visual berhasil digenerate!`, 'success');
    } else {
      throw new Error('URL gambar tidak ditemukan dalam respon Weavy.');
    }
  } catch (err) {
    scene.status = 'error';
    scene.errorMessage = err.message || 'Gagal generate gambar';
    scene.progress = 0;
    ctx.updateSceneCardDom(scene);
    console.warn('[Studio Scene Render Error]:', err);
    ctx.showAuthAlert?.(`Gagal merender Scene ${scene.sceneNumber}: ${err.message}`, 'error');
  } finally {
    activeGeneratingSceneIds.delete(scene.id);
  }
}

export async function handleBatchGenerateScenes(ctx = {}, options = {}) {
  const safeOptions = (options && typeof options === 'object' && !options.preventDefault && !options.target) ? options : {};
  const requestedScenes = Array.isArray(safeOptions.scenes) && safeOptions.scenes.length ? safeOptions.scenes : ctx.currentSbProject?.scenes || [];
  const modelId = safeOptions.modelId || null;

  if (!ctx.currentSbProject || !requestedScenes.length) return;
  if (isBatchGeneratingActive || ctx.isBatchGenerating) {
    ctx.showAuthAlert?.('Proses render batch sedang berjalan, mohon tunggu...', 'info');
    return;
  }

  const acc = ctx.getActiveAccount();
  if (!acc) {
    alert('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.');
    ctx.switchTab('settings');
    return;
  }

  isBatchGeneratingActive = true;
  ctx.isBatchGenerating = true;
  if (ctx.btnBatchGenerateScenes) ctx.btnBatchGenerateScenes.disabled = true;
  if (ctx.sbBatchGenLabel) ctx.sbBatchGenLabel.textContent = '⏳ Rendering...';

  const pendingScenes = requestedScenes
    .map((scene) => ctx.currentSbProject.scenes.find((item) => ((scene?.id && item.id === scene.id) || (scene?.sceneNumber && item.sceneNumber === Number(scene.sceneNumber)))) || scene)
    .filter(Boolean);
  const scenesToProcess = pendingScenes.filter((s) => s.status !== 'completed' || !s.imageUrl).length > 0
    ? pendingScenes.filter((s) => s.status !== 'completed' || !s.imageUrl)
    : pendingScenes;

  ctx.showAuthAlert(`Memulai pengiriman batch ${scenesToProcess.length} scene ke Weavy AI...`, 'info');

  const pollPromises = [];

  try {
    for (let i = 0; i < scenesToProcess.length; i++) {
      const scene = scenesToProcess[i];
      if (activeGeneratingSceneIds.has(scene.id) || scene.status === 'generating') {
        continue;
      }

      activeGeneratingSceneIds.add(scene.id);
      scene.status = 'generating';
      scene.progress = 15;
      scene.errorMessage = null;
      ctx.updateSceneCardDom(scene);

      try {
        const idToken = await ctx.getValidIdToken(acc);
        const taskContext = await initiateSceneTask(ctx, scene, acc, idToken, modelId || undefined);
        scene.progress = 25;
        ctx.updateSceneCardProgress(scene.id, 25);

        const pollPromise = pollSceneTask(ctx, taskContext, (prog) => {
          scene.progress = prog;
          ctx.updateSceneCardProgress(scene.id, prog);
        }).then(async (imageUrl) => {
          scene.status = 'completed';
          scene.imageUrl = imageUrl;
          scene.progress = 100;
          scene.errorMessage = null;
          ctx.updateSceneCardDom(scene);
          ctx.updateCompletedBadge();
          ctx.refreshCredits();
          await ctx.handleSaveSbProject(false);
          return imageUrl;
        }).catch((pollErr) => {
          console.error(`[Scene ${scene.sceneNumber} Background Poll Error]:`, pollErr);
          scene.status = 'error';
          scene.errorMessage = pollErr.message || 'Gagal generate gambar';
          scene.progress = 0;
          ctx.updateSceneCardDom(scene);
          return null;
        }).finally(() => {
          activeGeneratingSceneIds.delete(scene.id);
        });

        pollPromises.push(pollPromise);

        // Add 1.2s throttle so Weavy canvas does not collide on simultaneous recipe save/execute
        if (i < scenesToProcess.length - 1) await new Promise((r) => setTimeout(r, 1200));
      } catch (dispatchErr) {
        activeGeneratingSceneIds.delete(scene.id);
        console.error(`[Scene ${scene.sceneNumber} Dispatch Error]:`, dispatchErr);
        scene.status = 'error';
        scene.errorMessage = dispatchErr.message || 'Gagal dispatch scene';
        scene.progress = 0;
        ctx.updateSceneCardDom(scene);
      }
    }

    if (pollPromises.length > 0) {
      await Promise.allSettled(pollPromises);
    }
  } finally {
    if (ctx.btnBatchGenerateScenes) ctx.btnBatchGenerateScenes.disabled = false;
    if (ctx.sbBatchGenLabel) ctx.sbBatchGenLabel.textContent = 'Generate Semua';
    ctx.isBatchGenerating = false;
    isBatchGeneratingActive = false;
    ctx.updateCompletedBadge?.();
    ctx.refreshCredits?.();
  }
}

export function collectAll1SheetAssets(ctx = {}) {
  const assets = [];
  const seenUrls = new Set();

  const addAsset = (item) => {
    if (!item || !item.url) return;
    const key = (typeof item.url === 'string' ? item.url.slice(0, 120) : '') || item.name;
    if (key && seenUrls.has(key)) return;
    if (key) seenUrls.add(key);
    assets.push(item);
  };

  const prodUrl = ctx.sbProductWeavyAsset?.url || ctx.sbProductRefBase64 || ctx.currentSbProject?.inputState?.productAsset?.base64 || ctx.currentSbProject?.productAsset?.base64 || (typeof document !== 'undefined' ? document.getElementById('sbProdImgPreview')?.src : null);
  if (prodUrl && !prodUrl.endsWith('#') && prodUrl.length > 20) {
    addAsset({ type: 'input', category: 'product', tag: 'PRODUK', name: 'Foto Produk', url: prodUrl, weavyAsset: ctx.sbProductWeavyAsset || ctx.currentSbProject?.productAsset?.weavyAsset });
  }

  const modelUrl = ctx.sbModelWeavyAsset?.url || ctx.sbModelRefBase64 || ctx.currentSbProject?.inputState?.modelAsset?.base64 || ctx.currentSbProject?.modelAsset?.base64 || (typeof document !== 'undefined' ? document.getElementById('sbModelImgPreview')?.src : null);
  if (modelUrl && !modelUrl.endsWith('#') && modelUrl.length > 20) {
    addAsset({ type: 'input', category: 'talent', tag: 'MODEL', name: 'Foto Model/Talent', url: modelUrl, weavyAsset: ctx.sbModelWeavyAsset || ctx.currentSbProject?.modelAsset?.weavyAsset });
  }

  const bgUrl = ctx.sbBgWeavyAsset?.url || ctx.sbBgRefBase64 || ctx.currentSbProject?.inputState?.bgAsset?.base64 || ctx.currentSbProject?.bgAsset?.base64 || (typeof document !== 'undefined' ? document.getElementById('sbBgImgPreview')?.src : null);
  if (bgUrl && !bgUrl.endsWith('#') && bgUrl.length > 20) {
    addAsset({ type: 'input', category: 'bg', tag: 'LATAR', name: 'Foto Latar/Environment', url: bgUrl, weavyAsset: ctx.sbBgWeavyAsset || ctx.currentSbProject?.bgAsset?.weavyAsset });
  }

  const customList = Array.isArray(ctx.sbCustomAssets) ? ctx.sbCustomAssets : (ctx.currentSbProject?.inputState?.customAssets || ctx.currentSbProject?.customAssets || []);
  if (Array.isArray(customList)) {
    customList.forEach((ca, idx) => {
      const cUrl = ca?.weavyAsset?.url || ca?.base64 || ca?.url;
      if (cUrl && cUrl.length > 20) {
        addAsset({ type: 'input', category: 'custom', tag: (ca.name || `ASET ${idx + 1}`).slice(0, 8).toUpperCase(), name: ca.name || `Aset Tambahan ${idx + 1}`, url: cUrl, weavyAsset: ca.weavyAsset });
      }
    });
  }

  if (ctx.currentSbProject?.scenes && Array.isArray(ctx.currentSbProject.scenes)) {
    ctx.currentSbProject.scenes.forEach((sc, idx) => {
      if (sc && sc.imageUrl) {
        addAsset({ type: 'scene', category: 'scene', tag: `SCN ${sc.sceneNumber || idx + 1}`, name: `Hasil Scene ${sc.sceneNumber || idx + 1}`, url: sc.imageUrl, weavyAsset: { type: 'image', url: sc.imageUrl, width: 1024, height: 1024, thumbnailUrl: sc.imageUrl, id: `scene_img_${sc.sceneNumber || idx + 1}`, name: `scene_${sc.sceneNumber || idx + 1}.png` } });
      }
    });
  }

  return assets;
}

let currentActive1SheetAssets = null;

export function render1SheetAssetsPreview(ctx = {}, assets) {
  if (!ctx.sbCompositeAssetsGrid) return;
  ctx.sbCompositeAssetsGrid.innerHTML = '';

  const activeList = Array.isArray(assets) ? assets : (Array.isArray(currentActive1SheetAssets) ? currentActive1SheetAssets : []);
  currentActive1SheetAssets = activeList;

  if (!activeList || activeList.length === 0) {
    ctx.sbCompositeAssetsGrid.innerHTML = `<div class="sb-onesheet-empty-assets">Belum ada foto referensi (Input Asset atau Hasil Render Scene). Anda tetap dapat generate 1-sheet berdasarkan alur prompt scene!</div>`;
    if (ctx.sbCompositeAssetCount) ctx.sbCompositeAssetCount.textContent = '0 Referensi';
    return;
  }

  if (ctx.sbCompositeAssetCount) ctx.sbCompositeAssetCount.textContent = `${activeList.length} Referensi Siap Dipakai`;

  const escapeFn = ctx.escapeHtml || ((str) => String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]));

  activeList.forEach((item, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'sb-onesheet-thumb-item';
    thumb.title = `${item.name} (${item.tag})`;
    thumb.innerHTML = `
      <img src="${escapeFn(item.url)}" alt="${escapeFn(item.name)}" onerror="this.onerror=null; const parent=this.closest('.sb-onesheet-thumb-item'); if(parent) parent.remove(); else this.style.display='none';" />
      <span class="sb-onesheet-thumb-tag">${escapeFn(item.tag)}</span>
      <button type="button" class="sb-onesheet-thumb-remove" data-index="${index}" title="Hapus referensi ${escapeFn(item.name)}" aria-label="Hapus referensi">&times;</button>
    `;

    const removeBtn = thumb.querySelector('.sb-onesheet-thumb-remove');
    if (removeBtn) {
      removeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeList.splice(index, 1);
        currentActive1SheetAssets = activeList;
        render1SheetAssetsPreview(ctx, activeList);
      };
    }

    ctx.sbCompositeAssetsGrid.appendChild(thumb);
  });
}

export function generateMaster1SheetPrompt(ctx = {}, forceRebuild = false) {
  if (!ctx.currentSbProject || !ctx.currentSbProject.scenes || ctx.currentSbProject.scenes.length === 0) return '';
  if (!forceRebuild && ctx.sbCompositePromptText && ctx.sbCompositePromptText.value && ctx.sbCompositePromptText.value.trim().length > 0) return ctx.sbCompositePromptText.value;

  const numScenes = ctx.currentSbProject.scenes.length;
  const chosenRatio = ctx.sbCompositeRatioSelect?.value || '16:9';
  const projectAspect = ctx.currentSbProject?.aspectRatio || ctx.currentAspect || '9:16';
  const isProjectPortrait = projectAspect === '9:16';

  let masterPrompt = '';
  if (chosenRatio === '9:16') {
    masterPrompt = `A high-end cinematic vertical storyboard 1-sheet presentation, formatted into clean sequential multi-panel layout (${numScenes} sequential frames in 1 vertical 9:16 mobile canvas image). Aspect ratio 9:16 vertical presentation. Each panel features a vertical portrait framing composition.\n\n`;
  } else if (chosenRatio === '16:9') {
    if (isProjectPortrait) {
      masterPrompt = `A high-end cinematic storyboard 1-sheet contact sheet presentation, formatted into clean sequential multi-panel grid layout (${numScenes} vertical 9:16 portrait panels arranged side-by-side from left to right in 1 horizontal image). Aspect ratio 16:9 presentation canvas. Each panel has a tall vertical 9:16 portrait framing showing sequential mobile video scenes.\n\n`;
    } else {
      masterPrompt = `A high-end cinematic storyboard 1-sheet contact sheet presentation, formatted into clean sequential multi-panel grid layout (${numScenes} sequential frames in 1 image). Aspect ratio 16:9 widescreen commercial presentation.\n\n`;
    }
  } else if (chosenRatio === '1:1') {
    masterPrompt = `A high-end cinematic storyboard 1-sheet presentation, formatted into clean sequential multi-panel grid collage (${numScenes} sequential frames in 1 square image). Aspect ratio 1:1 square presentation.\n\n`;
  } else {
    masterPrompt = `A high-end cinematic storyboard 1-sheet presentation, formatted into clean sequential multi-panel layout (${numScenes} sequential frames in 1 image). Aspect ratio ${chosenRatio} commercial presentation.\n\n`;
  }

  if (ctx.currentSbProject.name) masterPrompt += `[PROJECT TITLE]\n${ctx.currentSbProject.name}\n\n`;

  const prodVal = (document.getElementById('sbProductName')?.value || ctx.currentSbProject?.inputState?.productName || ctx.currentSbProject?.productName || '').trim();
  const prodDesc = (document.getElementById('sbProductDesc')?.value || ctx.currentSbProject?.inputState?.productDesc || ctx.currentSbProject?.productDesc || '').trim();
  const modelDesc = (document.getElementById('sbModelTalent')?.value || document.getElementById('sbModelDesc')?.value || ctx.currentSbProject?.inputState?.modelTalent || ctx.currentSbProject?.modelTalent || '').trim();
  const bgDesc = (document.getElementById('sbBgSetting')?.value || document.getElementById('sbBgDesc')?.value || ctx.currentSbProject?.inputState?.bgSetting || ctx.currentSbProject?.bgSetting || '').trim();

  // Detect talent characteristics across all scenes
  const allVisualText = ctx.currentSbProject.scenes.map((s) => `${s.visualDescription || ''} ${s.cameraAngle || ''}`).join(' ').toLowerCase();
  const isHandsOnly = /hanya\s+tampilkan\s+tangan|tangan\s+saja|tidak\s+ada\s+wajah|hands\s*only|no\s+face|pov\s+hand/i.test(allVisualText) || /hands\s*only|no\s+face|tangan/i.test(modelDesc.toLowerCase());
  const isNoModel = (!modelDesc && !allVisualText.includes('model') && !allVisualText.includes('talent')) || isHandsOnly || /tanpa\s+model|no\s+model|produk\s+saja|product\s+only/i.test(modelDesc.toLowerCase());

  masterPrompt += `[VISUAL CONSISTENCY & IDENTITY]\n`;
  if (prodVal || prodDesc) masterPrompt += `- Main Product: ${prodVal ? prodVal + ' - ' : ''}${prodDesc || 'Consistent hero product'}\n`;
  if (modelDesc) masterPrompt += `- Lead Talent/Model: ${modelDesc}\n`;
  if (bgDesc) masterPrompt += `- Environment Setting: ${bgDesc}\n`;

  if (isHandsOnly) {
    masterPrompt += `- Talent Directive: POV hands-only presentation. Clean, manicured hands only, strictly NO visible human face or head in any frame.\n`;
    masterPrompt += `- Strict consistency directive: Consistent product scale, same hand appearance, uniform lighting, and consistent branding across all sequential grid panels.\n\n`;
  } else if (isNoModel) {
    masterPrompt += `- Strict consistency directive: Consistent product scale & appearance, uniform lighting, realistic material textures, and consistent branding across all sequential grid panels.\n\n`;
  } else {
    masterPrompt += `- Strict consistency directive: Same talent face, same exact hairstyle, same outfit, and consistent product scale & branding across all sequential grid panels.\n\n`;
  }

  masterPrompt += `[SEQUENTIAL STORYBOARD PANELS]\n`;
  ctx.currentSbProject.scenes.forEach((s) => {
    const timecode = s.timecode ? ` (${s.timecode})` : '';
    let content = (s.imagePrompt || '').trim();

    // Check if s.imagePrompt is an unpopulated generic template (e.g. "photograph of  showcasing")
    const isGenericTemplate = !content || /photograph of\s+showcasing|showcasing.*at\s*,/i.test(content) || /^(vertical|horizontal)?\s*(\d+:\d+)?\s*commercial photograph of\s*showcasing/i.test(content);

    if (isGenericTemplate && (s.visualDescription || s.cameraAngle)) {
      // Intelligently fallback to rich visual description + camera framing
      const parts = [];
      if (s.cameraAngle) parts.push(s.cameraAngle);
      if (s.visualDescription) parts.push(s.visualDescription);
      content = parts.join(', ');
    } else if (content) {
      content = sanitizeSceneImagePrompt(content, s, ctx.currentSbProject);
      if (isProjectPortrait) {
        content = content.replace(/^(vertical|horizontal)\s+\d+:\d+\s+/i, '');
        if (!/portrait|vertical/i.test(content)) {
          content = `vertical portrait framing, ${content}`;
        }
      } else {
        content = content.replace(/^(vertical|horizontal)\s+\d+:\d+\s+/i, '');
      }
    } else {
      content = (s.visualDescription || `${s.cameraAngle || ''}: ${s.action || ''}`).trim();
      if (isProjectPortrait && !/portrait|vertical/i.test(content)) {
        content = `vertical portrait framing, ${content}`;
      }
    }

    masterPrompt += `Panel ${s.sceneNumber}${timecode}: ${content}\n`;
  });

  const allTextless = ctx.currentSbProject.scenes.every((s) => isSceneTextless(s, ctx.currentSbProject));
  const styleTextConstraint = allTextless ? ', clean photography, pure visual without text, no title, no typography, no banner overlays' : '';
  masterPrompt += `\n[STYLE & CINEMATOGRAPHY]\nCrisp minimalist divider borders separating the sequential panels, photorealistic commercial cinema studio lighting${styleTextConstraint}, 8k resolution, award-winning cinematography, ultra-detailed textures, neutral color balance.`;

  if (ctx.sbCompositePromptText) ctx.sbCompositePromptText.value = masterPrompt;
  return masterPrompt;
}

export function update1SheetGridButtonState(ctx = {}, isOpen = false) {
  const btn = ctx.btnCompositeGrid || (typeof document !== 'undefined' ? document.getElementById('btnCompositeGrid') : null);
  if (!btn) return;
  const chevron = btn.querySelector('.sb-toggle-chevron') || (typeof document !== 'undefined' ? document.getElementById('sbCompositeChevronIcon') : null);

  if (isOpen) {
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    btn.title = 'Tutup 1-Sheet Grid 16:9 Master Visual';
    if (chevron) chevron.classList.add('sb-chevron-open');
  } else {
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = 'Buka 1-Sheet Grid 16:9 Master Visual';
    if (chevron) chevron.classList.remove('sb-chevron-open');
  }
}

export function close1SheetGridModal(ctx = {}) {
  const modal = ctx.sbCompositeModal || (typeof document !== 'undefined' ? document.getElementById('sbCompositeModal') : null);
  if (modal) {
    modal.classList.add('hidden');
  }
  update1SheetGridButtonState(ctx, false);
}

export function open1SheetGridModal(ctx = {}) {
  if (!ctx.currentSbProject || !ctx.currentSbProject.scenes || ctx.currentSbProject.scenes.length === 0) {
    alert('Silakan buat rancangan storyboard terlebih dahulu untuk melihat 1-Sheet Grid Master.');
    return;
  }

  const modal = ctx.sbCompositeModal || (typeof document !== 'undefined' ? document.getElementById('sbCompositeModal') : null);
  currentActive1SheetAssets = collectAll1SheetAssets(ctx);
  render1SheetAssetsPreview(ctx, currentActive1SheetAssets);
  if (ctx.sbCompositeRatioSelect && !ctx.sbCompositeRatioSelect.value) {
    ctx.sbCompositeRatioSelect.value = '16:9';
  }
  generateMaster1SheetPrompt(ctx, false);
  ctx.sbCompositeLoadingBox?.classList.add('hidden');
  ctx.sbCompositeErrorAlert?.classList.add('hidden');

  // If a generated 1-sheet composite result already exists on this project, show it
  const existingResult = ctx.sbCompositeResultUrl || ctx.currentSbProject?.compositeGridUrl;
  if (existingResult && ctx.sbCompositeResultImg && ctx.sbCompositeResultArea) {
    ctx.sbCompositeResultImg.src = existingResult;
    if (ctx.btnDownloadCompositeResult) ctx.btnDownloadCompositeResult.href = existingResult;
    if (ctx.btnOpenCompositeResult) ctx.btnOpenCompositeResult.href = existingResult;
    ctx.sbCompositeResultArea.classList.remove('hidden');
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
  update1SheetGridButtonState(ctx, true);

  // Smooth scroll into view so the user immediately sees it in the same layout
  try {
    modal?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (_) {}
}

export function toggle1SheetGridModal(ctx = {}) {
  const modal = ctx.sbCompositeModal || (typeof document !== 'undefined' ? document.getElementById('sbCompositeModal') : null);
  if (!modal) return;
  const isHidden = modal.classList.contains('hidden');
  if (isHidden) {
    open1SheetGridModal(ctx);
  } else {
    close1SheetGridModal(ctx);
  }
}

export async function execute1SheetGeneration(ctx = {}) {
  const acc = ctx.getActiveAccount();
  if (!acc) {
    alert('Silakan hubungkan atau pilih akun Weavy AI yang aktif terlebih dahulu di tab Akun & Token.');
    ctx.switchTab('settings');
    return;
  }

  const prompt = (ctx.sbCompositePromptText?.value || '').trim();
  if (!prompt) {
    alert('Prompt 1-Sheet Grid tidak boleh kosong.');
    ctx.sbCompositePromptText?.focus();
    return;
  }

  const model = ctx.sbCompositeModelSelect?.value || 'gpt-image-2.5';
  const modelLabel = ctx.sbCompositeModelSelect?.options[ctx.sbCompositeModelSelect.selectedIndex]?.text || model;
  const aspectRatio = ctx.sbCompositeRatioSelect?.value || '16:9';

  if (ctx.btnGenerateCompositeGrid) ctx.btnGenerateCompositeGrid.disabled = true;
  if (ctx.btnGenerateCompositeLabel) ctx.btnGenerateCompositeLabel.textContent = '⏳ Mengirim ke Weavy AI...';
  ctx.sbCompositeLoadingBox?.classList.remove('hidden');
  ctx.sbCompositeResultArea?.classList.add('hidden');
  ctx.sbCompositeErrorAlert?.classList.add('hidden');
  if (ctx.sbCompositeProgressBar) ctx.sbCompositeProgressBar.style.width = '10%';
  if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = 'Menyiapkan foto referensi input & scene...';

  try {
    let idToken = await ctx.getValidIdToken(acc);
    if (!idToken) throw new Error('Sesi token Weavy tidak valid atau telah kedaluwarsa. Silakan klik tombol Refresh Saldo di atas.');

    const allAssets = Array.isArray(currentActive1SheetAssets) ? currentActive1SheetAssets : collectAll1SheetAssets(ctx);
    const readyAssets = [];
    if (allAssets.length > 0) {
      if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = `Menyiapkan ${allAssets.length} foto referensi (Cloud Weavy)...`;
      for (let i = 0; i < allAssets.length; i++) {
        const item = allAssets[i];
        if (ctx.sbCompositeProgressBar) ctx.sbCompositeProgressBar.style.width = `${10 + Math.round(((i + 1) / allAssets.length) * 30)}%`;
        if (item.weavyAsset && item.weavyAsset.url) readyAssets.push(item.weavyAsset);
        else if (typeof item.url === 'string' && item.url.startsWith('http')) readyAssets.push({ type: 'image', url: item.url, width: 1024, height: 1024, thumbnailUrl: item.url, id: `weavy_asset_${i + 1}_${Date.now()}`, name: `${item.tag || 'ref'}_${i + 1}.png` });
        else if (item.url) {
          try {
            const assetObj = await ctx.uploadAssetToWeavy({ url: item.url, name: `${item.tag || 'ref'}_${i + 1}.png` }, idToken);
            if (assetObj && (assetObj.id || assetObj.url)) readyAssets.push(assetObj);
          } catch (e) {
            console.warn('[1-Sheet Asset Upload Warning]:', e);
          }
        }
      }
    }

    const isStrictEditModel = model === 'gpt_image_1_edit';
    if (isStrictEditModel && readyAssets.length === 0) {
      throw new Error(`Model "${modelLabel}" adalah model Image Edit yang membutuhkan setidaknya 1 Foto Referensi. Pastikan ada foto input produk/model atau scene yang selesai.`);
    }

    if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = `Menghubungkan Canvas Recipe Weavy AI (${modelLabel})...`;
    if (ctx.sbCompositeProgressBar) ctx.sbCompositeProgressBar.style.width = '45%';

    let resultUrl = null;
    let recipeId = await ctx.getOrCreateWeavyRecipeId(idToken, acc?.userId || acc?.id, 'image');
    if (!recipeId) throw new Error('Tidak dapat menemukan atau membuat Recipe Canvas di akun Weavy Anda. Silakan coba klik tombol refresh saldo akun.');

    const promptNodeId = `prompt_${Date.now()}`;
    const modelNodeId = `node_model_${Date.now()}`;
    const promptNode = { id: promptNodeId, type: 'promptV3', position: { x: 200, y: 200 }, data: { name: 'Prompt', color: 'Yambo_Green', prompt, output: { type: 'text', prompt }, result: { prompt }, handles: { output: { prompt: { type: 'text', order: 0 } } }, version: 3 } };
    const isSeedream = model.includes('seedream') || model.includes('v5');
    const isNanoBanana = model.includes('banana') || model.includes('nano');
    const isGrok = model.includes('grok') || model.includes('imagine');
    const isGptEdit = model === 'gpt_image_1_edit' || model.includes('gpt_image_1');
    const isGpt2 = model === 'gpt_image_2';
    const isGpt25 = !isSeedream && !isNanoBanana && !isGrok && !isGptEdit && !isGpt2;
    const randomSeed = Math.floor(Math.random() * 2147483647);
    const imageSizeMap = { '9:16': 'portrait_16_9', '16:9': 'landscape_16_9', '1:1': 'square_hd', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3' };
    const imageSize = imageSizeMap[aspectRatio] || 'landscape_16_9';

    let targetModelName = 'gpt-image-2.5';
    let targetDisplayName = 'GPT Image 2.5';
    let targetDescription = 'Generates images with GPT Image 2.5';
    let targetMenuDisplayName = 'GPT Image 2.5';
    let modelCredits = 4;
    let inputsList = [];
    let parametersList = [];
    let paramsObj = {};
    let inputObj = { prompt: prompt.trim() };
    let nodeHandles = { input: { prompt: { type: 'text', order: 0, required: true } }, output: { result: { type: 'image', order: 0 } } };
    let outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
    let nodeSchema = {};

    inputsList.push([{ id: 'prompt', title: 'Prompt', description: 'Text description', validTypes: ['text'], required: true }, { nodeId: promptNodeId, outputId: 'prompt', string: prompt.trim() }]);

    const refNodes = [];
    const refEdges = [];
    readyAssets.forEach((asset, idx) => {
      const fNodeId = `file_ref_${Date.now()}_${idx}`;
      const handleName = isGptEdit && idx === 0 ? 'image' : isGrok && readyAssets.length === 1 ? 'image' : `image_${idx + 1}`;
      refNodes.push({ id: fNodeId, isModel: false, type: 'import', dragHandle: '.node-header', position: { x: 200, y: 380 + idx * 180 }, data: { name: `File ${idx + 1}`, color: 'Yambo_Blue', files: [asset], output: { file: asset }, result: asset, handles: { output: { file: { type: 'any', label: 'File', order: 0, format: 'uri', description: 'The uploaded file' } } }, version: 3, dark_color: 'Yambo_Blue_Dark', border_color: 'Yambo_Blue_Stroke' } });
      refEdges.push({ id: `edge_ref_${idx + 1}_${Date.now()}`, type: 'custom', source: fNodeId, target: modelNodeId, sourceHandle: `${fNodeId}-output-file`, targetHandle: `${modelNodeId}-input-${handleName}`, data: { sourceColor: 'Yambo_Blue', targetColor: 'Yambo_Purple', sourceHandleType: 'any', targetHandleType: 'image' } });
      nodeHandles.input[handleName] = { type: 'image', order: idx + 1, required: isGptEdit && idx === 0 };
      inputsList.push([{ id: handleName, title: handleName, description: `Reference image ${idx + 1}`, validTypes: ['image'], required: isGptEdit && idx === 0 }, { nodeId: fNodeId, outputId: 'file', file: asset }]);
      paramsObj[handleName] = asset;
      inputObj[handleName] = asset;
    });

    if (isGpt25) {
      targetModelName = 'gpt-image-2.5';
      targetDisplayName = 'GPT Image 2.5';
      targetDescription = 'Generates images with GPT Image 2.5';
      targetMenuDisplayName = 'GPT Image 2.5';
      modelCredits = 4;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [[{ id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } }, { type: 'value', data: { type: 'string', value: 'Flare' } }], [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }], [{ id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: 'auto' } }], [{ id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }], [{ id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } }, { type: 'value', data: { type: 'string', value: 'png' } }]];
      paramsObj = { ...paramsObj, model: 'Flare', prompt: prompt.trim(), quality: 'high', background: 'auto', image_size: imageSize, output_format: 'png' };
    } else if (isSeedream) {
      targetModelName = 'fal-ai/bytedance/seedream/v5/lite/edit';
      targetDisplayName = 'Seedream V5.0 Pro Edit';
      targetDescription = 'Edit images with Seedream V5.0 Pro';
      targetMenuDisplayName = 'Seedream V5.0 Pro Edit';
      modelCredits = 12;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [[{ id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, defaultValue: { type: 'string', value: 'V5.0 Pro' } }, { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } }], [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }], [{ id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }], [{ id: 'enhance_prompt_mode', title: 'Enhance Prompt Mode', constraint: { type: 'enum', options: ['standard', 'fast'] }, defaultValue: { type: 'string', value: 'standard' } }, { type: 'value', data: { type: 'string', value: 'standard' } }]];
      paramsObj = { ...paramsObj, model: 'V5.0 Pro', prompt: prompt.trim(), seed: randomSeed, image_size: imageSize, enhance_prompt_mode: 'standard' };
    } else if (isNanoBanana) {
      targetModelName = 'fal-ai/nano-banana-pro/edit';
      targetDisplayName = 'Nano Banana Pro';
      targetDescription = 'Edit images with Nano Banana Pro';
      targetMenuDisplayName = 'Nano Banana Pro';
      modelCredits = 11;
      const cleanRes = aspectRatio === '16:9' || aspectRatio === '1:1' ? '2K' : '1K';
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [[{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }], [{ id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, defaultValue: { type: 'string', value: '1K' } }, { type: 'value', data: { type: 'string', value: cleanRes } }], [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: aspectRatio || '16:9' } }], [{ id: 'enable_web_search', title: 'Enable Web Search', constraint: { type: 'boolean' }, defaultValue: { type: 'boolean', value: false } }, { type: 'value', data: { type: 'boolean', value: false } }]];
      paramsObj = { ...paramsObj, prompt: prompt.trim(), seed: randomSeed, num_images: 1, resolution: cleanRes, aspect_ratio: aspectRatio || '16:9', output_format: 'png', enable_web_search: false };
    } else if (isGptEdit) {
      targetModelName = 'gpt_image_1_edit';
      targetDisplayName = 'ChatGPT Images 2.0 Edit';
      targetDescription = "Edit images with OpenAI's GPT Image 2";
      targetMenuDisplayName = 'GPT Image 1';
      modelCredits = 9;
      nodeHandles = { input: { prompt: { id: `470e45b3-3c3a-46f1-822e-715abc4610ab`, type: 'text', label: 'prompt', order: 0, format: 'text', required: true, description: 'Prompt for image edit' }, ...nodeHandles.input }, output: { image: { id: `470e45b3-3c3a-46f1-822e-715abc4610at`, type: 'image', label: 'image', order: 0, format: 'uri', description: 'Result image' } } };
      outputSchema = [{ id: 'image', title: 'image', description: 'Result image', dataType: 'image' }];
      nodeSchema = { size: { type: 'fal_image_size', order: 9, title: 'Resolution', default: 'auto', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'], description: "The size of the generated images. Edges must be multiples of 16px, max 3840px per side, aspect ratio up to 3:1, and total pixels between 655,360–8,294,400." }, model: { type: 'enum', order: 0, title: 'Model', default: 'GPT Image 2', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'], description: 'GPT model type' }, quality: { type: 'enum', order: 7, title: 'Quality', default: 'medium', options: ['auto', 'high', 'medium', 'low'], description: "The quality of the image that will be generated. 'auto' will automatically select the best quality for the given model." } };
      parametersList = [[{ id: 'model', title: 'Model', description: 'GPT model type', constraint: { type: 'enum', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'] }, defaultValue: { type: 'string', value: 'GPT Image 2' } }, { type: 'value', data: { type: 'string', value: 'GPT Image 2' } }], [{ id: 'quality', title: 'Quality', description: "The quality of the image that will be generated. 'auto' will automatically select the best quality for the given model.", constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'medium' } }, { type: 'value', data: { type: 'string', value: 'medium' } }], [{ id: 'size', title: 'Resolution', description: "The size of the generated images. Edges must be multiples of 16px, max 3840px per side, aspect ratio up to 3:1, and total pixels between 655,360–8,294,400.", constraint: { type: 'image_size', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }]];
      paramsObj = { ...paramsObj, size: 'auto', model: 'GPT Image 2', quality: 'medium', number_of_images: 1, prompt: prompt.trim() };
    } else if (isGpt2) {
      targetModelName = 'gpt_image_2';
      targetDisplayName = 'ChatGPT Images 2.0';
      targetDescription = "Generate images with OpenAI's GPT Image 2";
      targetMenuDisplayName = 'GPT Image 2';
      modelCredits = 8;
      nodeHandles = { input: { prompt: { type: 'text', order: 0, required: true }, ...nodeHandles.input }, output: { image: { type: 'image', order: 0 } } };
      outputSchema = [{ id: 'image', title: 'Image', description: 'The generated image.', dataType: 'image' }];
      parametersList = [[{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }], [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: aspectRatio || '16:9' } }, { type: 'value', data: { type: 'string', value: aspectRatio || '16:9' } }]];
      paramsObj = { ...paramsObj, prompt: prompt.trim(), quality: 'high', aspect_ratio: aspectRatio || '16:9' };
    } else if (isGrok) {
      targetModelName = 'xai/grok-imagine-image';
      targetDisplayName = 'Grok Imagine Image';
      targetDescription = 'Generates images with Grok Imagine Image';
      targetMenuDisplayName = 'Grok Imagine Image';
      modelCredits = 4;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [[{ id: 'seed', title: 'Seed', constraint: { type: 'integer' }, defaultValue: { type: 'integer', value: 0 } }, { type: 'value', data: { type: 'integer', value: randomSeed } }], [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: aspectRatio || '16:9' } }, { type: 'value', data: { type: 'string', value: aspectRatio || '16:9' } }]];
      paramsObj = { ...paramsObj, prompt: prompt.trim(), seed: randomSeed, aspect_ratio: aspectRatio || '16:9' };
    }

    const isFalImported = isSeedream || isNanoBanana || isGrok;
    const modelNode = { id: modelNodeId, type: 'custommodelV2', isModel: true, dragHandle: '.node-header', position: { x: 650, y: 200 }, data: { name: targetDisplayName, description: targetDescription, ...(isGptEdit ? { color: 'Red' } : {}), menu: { icon: 'EmojiObjectsIcon', isModel: true, displayName: targetMenuDisplayName }, model: { name: targetModelName, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) }, ...(Object.keys(nodeSchema).length > 0 ? { schema: nodeSchema } : {}), kind: { type: 'wildcard', model: { type: 'predefined', name: targetModelName, description: targetDescription, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) }, inputs: inputsList, parameters: parametersList, outputs: outputSchema }, params: paramsObj, input: inputObj, handles: nodeHandles, version: 3 } };

    const nodes = [promptNode, modelNode, ...refNodes];
    const edges = [{ id: `edge_p_${Date.now()}`, type: 'custom', source: promptNodeId, target: modelNodeId, sourceHandle: `${promptNodeId}-output-prompt`, targetHandle: `${modelNodeId}-input-prompt`, data: { sourceColor: 'Yambo_Green', targetColor: 'Yambo_Purple', sourceHandleType: 'text', targetHandleType: 'text' } }, ...refEdges];
    const executePayload = { numberOfRuns: 1, nodes, edges, displayedCost: { credits: modelCredits, perSecondRate: 0, surface: 'drawer' } };
    let execHeaders = ctx.getWeavyClientHeaders(idToken, acc?.userId || acc?.id, recipeId);

    await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }) }).catch(() => {});

    if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = `Memproses rendering 1-sheet (${targetDisplayName}) di Weavy AI...`;
    if (ctx.sbCompositeProgressBar) ctx.sbCompositeProgressBar.style.width = '60%';

    let execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
    if (execRes.status === 403) {
      try {
        await ctx.approveWeavyModel(targetModelName, idToken, acc?.userId || acc?.id, recipeId);
        execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
      } catch (approvalError) {
        console.warn('[Composite Model Approval Warning]:', approvalError);
      }
    }

    if (execRes.status === 403 || execRes.status === 401) {
      if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = 'Terjadi error 403. Mereload tab Weavy & menyinkronkan token...';
      if (typeof ctx.recoverWeavySessionOn403 === 'function') {
        try {
          const renewedToken = await ctx.recoverWeavySessionOn403(acc);
          if (renewedToken) idToken = renewedToken;
        } catch (e) {
          console.warn('[1-Sheet 403 recovery warning]:', e);
        }
      }

      const storageKey = `weavy_canvas_image_${acc?.userId || 'default'}`;
      await ctx.storage.set(storageKey, null);
      const freshToken = await ctx.getValidIdToken(acc);
      const activeToken = freshToken || idToken;
      if (activeToken) {
        const freshRecipeId = await ctx.getOrCreateWeavyRecipeId(activeToken, acc?.userId || acc?.id, 'image');
        if (freshRecipeId) {
          recipeId = freshRecipeId;
        }
        execHeaders = ctx.getWeavyClientHeaders(activeToken, acc?.userId || acc?.id, recipeId);
        await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }) }).catch(() => {});
        execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
      }
    }

    if (!execRes.ok) {
      const errText = await execRes.text().catch(() => '');
      if (execRes.status === 403) throw new Error(`Akses ditolak (HTTP 403). Sesi atau izin canvas akun Weavy perlu disegarkan. Saldo koin: ${acc.credits ?? 0} Koin. Silakan klik tombol Refresh Saldo di atas.`);
      throw new Error(`Gagal mengirim permintaan generasi 1-sheet (HTTP ${execRes.status}): ${errText.slice(0, 120)}`);
    }

    const execData = await execRes.json();
    const batchId = execData.batchId || execData.id;
    if (!batchId) throw new Error('Batch ID tidak diterima dari Weavy AI.');

    const inputUrls = readyAssets.flatMap((a) => [a.url, a.downloadUrl, a.thumbnailUrl].filter(Boolean));
    const refNodeIds = new Set(refNodes.map((n) => n.id));
    const completedStatuses = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'FINISHED', 'DONE']);
    const failedStatuses = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'FAIL']);

    const maxPollCycles = 240; // Up to 8 minutes polling
    let completedRetriesWithoutUrl = 0;

    for (let poll = 0; poll < maxPollCycles; poll++) {
      await new Promise((r) => setTimeout(r, 2000));
      
      // Smooth progress calculation (10% -> 98%)
      let progress = 20;
      if (poll < 15) {
        progress = 20 + Math.round(poll * 2.5); // 20% -> ~57% in 30s
      } else if (poll < 45) {
        progress = 58 + Math.round((poll - 15) * 0.8); // 58% -> ~82% in 90s
      } else if (poll < 90) {
        progress = 82 + Math.round((poll - 45) * 0.2); // 82% -> ~91% in 3 min
      } else {
        progress = Math.min(98, 91 + Math.round((poll - 90) * 0.05)); // 91% -> 98%
      }

      if (ctx.sbCompositeProgressBar) ctx.sbCompositeProgressBar.style.width = `${progress}%`;

      try {
        const stRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`, { headers: execHeaders });
        if (stRes.ok) {
          const stData = await stRes.json();
          const run = stData.recipeRuns?.[0] || stData.recipeRun;
          const currentStatus = (run?.status || stData.status || '').toUpperCase();

          if (currentStatus === 'QUEUED' || currentStatus === 'PENDING') {
            if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = `Menunggu antrean Weavy AI (${progress}%)...`;
          } else {
            if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = `Merender visual 1-sheet grid (${targetDisplayName}) di Weavy AI (${progress}%)...`;
          }

          if (completedStatuses.has(currentStatus)) {
            const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];

            // 1. Top-level candidates
            const topLevelCandidates = [
              run?.result, run?.output, run?.resultUrl, run?.outputUrl, run?.url,
              stData.result, stData.output, stData.resultUrl, stData.outputUrl, stData.url,
              ...(Array.isArray(run?.outputs) ? run.outputs : []),
              ...(Array.isArray(stData.outputs) ? stData.outputs : []),
            ];

            for (const candidate of topLevelCandidates) {
              const url = ctx.extractMediaUrlFromObject(candidate, inputUrls);
              if (url) {
                resultUrl = url;
                break;
              }
            }

            // 2. Model node run
            if (!resultUrl) {
              const modelRun = nodeRuns.find((nr) => nr.nodeId === modelNodeId) ||
                nodeRuns.find((nr) => nr.nodeType === 'custommodelV2' || (nr.isModel && nr.nodeType !== 'import')) ||
                nodeRuns.find((nr) => !refNodeIds.has(nr.nodeId) && nr.nodeType !== 'import' && nr.nodeType !== 'promptV3');

              if (modelRun) {
                const resObj = modelRun.result || modelRun.output;
                if (resObj) {
                  const url = ctx.extractMediaUrlFromObject(resObj, inputUrls);
                  if (url) resultUrl = url;
                }
              }
            }

            // 3. Other node runs
            if (!resultUrl) {
              for (const nr of nodeRuns) {
                if (refNodeIds.has(nr.nodeId) || nr.nodeType === 'import' || nr.nodeType === 'promptV3' || nr.name?.includes('Reference Image') || nr.name?.startsWith('File')) continue;
                const resObj = nr.result || nr.output;
                if (resObj) {
                  const url = ctx.extractMediaUrlFromObject(resObj, inputUrls);
                  if (url) {
                    resultUrl = url;
                    break;
                  }
                }
              }
            }

            // 4. Recursive whole object fallback
            if (!resultUrl) {
              const topUrl = ctx.extractMediaUrlFromObject(run || stData, inputUrls);
              if (topUrl) resultUrl = topUrl;
            }

            if (resultUrl) {
              break;
            } else {
              // Status completed but result URL not populated yet, wait up to 30 additional poll cycles
              completedRetriesWithoutUrl += 1;
              if (completedRetriesWithoutUrl > 30) {
                break;
              }
            }
          }

          if (failedStatuses.has(currentStatus)) {
            const errMsg = run?.error?.message || run?.error || stData.error || run?.errorMessage || 'Rendering visual 1-sheet gagal di Weavy AI.';
            throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
          }
        }
      } catch (pollErr) {
        if (pollErr.message && (pollErr.message.includes('Rendering visual 1-sheet gagal') || pollErr.message.includes('Akses ditolak'))) {
          throw pollErr;
        }
        console.warn('[1-Sheet Polling Status Warning]:', pollErr);
      }
    }

    if (!resultUrl) throw new Error('Gambar tidak berhasil didapatkan setelah batas waktu tunggu. Silakan periksa kanvas Weavy atau coba generate ulang.');

    if (ctx.sbCompositeProgressBar) ctx.sbCompositeProgressBar.style.width = '100%';
    if (ctx.sbCompositeLoadingText) ctx.sbCompositeLoadingText.textContent = 'Gambar 1-Sheet Grid Berhasil Dibuat!';
    ctx.sbCompositeLoadingBox?.classList.add('hidden');
    if (ctx.sbCompositeResultImg) ctx.sbCompositeResultImg.src = resultUrl;
    ctx.sbCompositeResultUrl = resultUrl;
    if (ctx.currentSbProject) {
      ctx.currentSbProject.compositeGridUrl = resultUrl;
      await ctx.handleSaveSbProject(false);
    }
    if (ctx.btnDownloadCompositeResult) ctx.btnDownloadCompositeResult.href = resultUrl;
    if (ctx.btnOpenCompositeResult) ctx.btnOpenCompositeResult.href = resultUrl;
    ctx.sbCompositeResultArea?.classList.remove('hidden');
    ctx.showAuthAlert('🎉 Gambar 1-Sheet Grid Master berhasil dibuat!', 'success');
    if (acc) ctx.fetchUserCreditsFromWeavy(acc).catch(() => {});
  } catch (err) {
    console.error('[1-Sheet Generation Error]:', err);
    if (ctx.sbCompositeLoadingBox) ctx.sbCompositeLoadingBox.classList.add('hidden');
    if (ctx.sbCompositeErrorAlert) {
      ctx.sbCompositeErrorAlert.textContent = `❌ ${err.message || 'Gagal generate 1-sheet grid'}`;
      ctx.sbCompositeErrorAlert.classList.remove('hidden');
    }
    ctx.showAuthAlert(`Gagal: ${err.message || 'Gagal membuat 1-sheet grid.'}`, 'error');
  } finally {
    if (ctx.btnGenerateCompositeGrid) ctx.btnGenerateCompositeGrid.disabled = false;
    if (ctx.btnGenerateCompositeLabel) ctx.btnGenerateCompositeLabel.textContent = 'Generate 1-Sheet Grid Image';
  }
}

// ==========================================================================
// CHARACTER SHEET GENERATOR ENGINE (Multi-Angle Front/Side/Back Reference)
// ==========================================================================
export const DEFAULT_CHARACTER_SHEET_PROMPT = 'photorealistic character reference sheet of this exact person, showing front view, side view, and back view side by side. Preserve real facial features, authentic skin tone, actual clothing and appearance. Ultra-realistic, hyperdetailed, photography style, no cartoon, no illustration, no 3D render, no stylization, no anime. Clean white background, neutral standing pose, full body visible, soft studio lighting.';

export function openCharacterSheetModal(ctx = {}) {
  const modal = ctx.sbCharSheetModal || document.getElementById('sbCharSheetModal');
  if (!modal) return;

  const promptTextarea = ctx.sbCharSheetPromptText || document.getElementById('sbCharSheetPromptText');
  if (promptTextarea && (!promptTextarea.value || !promptTextarea.value.trim())) {
    promptTextarea.value = DEFAULT_CHARACTER_SHEET_PROMPT;
  }

  // Sync current talent preview if available
  const talentPreviewImg = ctx.sbCharSheetTalentImgPreview || document.getElementById('sbCharSheetTalentImgPreview');
  const talentEmptyIcon = ctx.sbCharSheetEmptyIcon || document.getElementById('sbCharSheetEmptyIcon');
  const talentStatusBadge = ctx.sbCharSheetTalentStatus || document.getElementById('sbCharSheetTalentStatus');
  const talentDescText = ctx.sbCharSheetTalentDescText || document.getElementById('sbCharSheetTalentDescText');

  const currentTalentRef = ctx.sbModelWeavyAsset?.url || ctx.sbModelRefBase64 || ctx.currentSbProject?.inputState?.modelAsset?.weavyAsset?.url || ctx.currentSbProject?.inputState?.modelAsset?.base64;
  const currentTalentDesc = (ctx.sbModelTalent?.value || ctx.currentSbProject?.inputState?.modelTalent || '').trim();

  if (currentTalentRef) {
    if (talentPreviewImg) {
      talentPreviewImg.src = currentTalentRef;
      talentPreviewImg.classList.remove('hidden');
    }
    if (talentEmptyIcon) talentEmptyIcon.classList.add('hidden');
    if (talentStatusBadge) {
      talentStatusBadge.textContent = 'Foto Talent Siap';
      talentStatusBadge.className = 'sb-asset-badge';
    }
    if (talentDescText) {
      talentDescText.textContent = currentTalentDesc ? `Talent: ${currentTalentDesc}` : 'Foto talent aktif dari form Storyboard.';
    }
  } else {
    if (talentPreviewImg) {
      talentPreviewImg.src = '';
      talentPreviewImg.classList.add('hidden');
    }
    if (talentEmptyIcon) talentEmptyIcon.classList.remove('hidden');
    if (talentStatusBadge) {
      talentStatusBadge.textContent = 'Belum Ada Foto';
      talentStatusBadge.className = 'sb-asset-badge text-muted';
    }
    if (talentDescText) {
      talentDescText.textContent = 'Silakan upload atau pilih foto talent/orang asli untuk dibuatkan Karakter Sheet 3 sudut.';
    }
  }

  modal.classList.remove('hidden');
  modal.style.setProperty('display', 'flex', 'important');
}

export function closeCharacterSheetModal(ctx = {}) {
  const modal = ctx.sbCharSheetModal || document.getElementById('sbCharSheetModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.removeProperty('display');
}

export async function executeCharacterSheetGeneration(ctx = {}) {
  const acc = ctx.getActiveAccount?.();
  if (!acc) {
    ctx.showAuthAlert?.('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.', 'error');
    ctx.switchTab?.('settings');
    return;
  }

  const promptInput = ctx.sbCharSheetPromptText || document.getElementById('sbCharSheetPromptText');
  const prompt = (promptInput?.value || '').trim() || DEFAULT_CHARACTER_SHEET_PROMPT;

  const modelSelect = ctx.sbCharSheetModelSelect || document.getElementById('sbCharSheetModelSelect');
  const selectedModelVal = modelSelect?.value || 'gpt-image-2.5';

  const ratioSelect = ctx.sbCharSheetRatioSelect || document.getElementById('sbCharSheetRatioSelect');
  const selectedRatio = ratioSelect?.value || '16:9';

  // Find talent reference image
  let talentImage = ctx.sbCharSheetUploadedAsset || ctx.sbModelWeavyAsset || ctx.sbModelRefBase64 || ctx.currentSbProject?.inputState?.modelAsset?.weavyAsset || ctx.currentSbProject?.inputState?.modelAsset?.base64 || null;

  if (!talentImage) {
    const modelImgDom = document.getElementById('sbModelImgPreview');
    const modelWrapDom = document.getElementById('sbModelPreviewBox');
    if (modelImgDom && modelImgDom.src && (!modelWrapDom || !modelWrapDom.classList.contains('hidden'))) {
      const src = modelImgDom.src;
      if (src && !src.endsWith('#') && src.length > 20) {
        talentImage = src;
      }
    }
  }

  if (!talentImage) {
    ctx.showAuthAlert?.('Silakan upload foto talent / model terlebih dahulu agar AI mengenali wajah & ciri fisiknya.', 'error');
    const fileInput = document.getElementById('sbCharSheetFileInput');
    if (fileInput) fileInput.click();
    return;
  }

  const btnGen = ctx.btnGenerateCharSheet || document.getElementById('btnGenerateCharSheet');
  const btnLabel = ctx.btnGenerateCharSheetLabel || document.getElementById('btnGenerateCharSheetLabel');
  const loadingBox = ctx.sbCharSheetLoadingBox || document.getElementById('sbCharSheetLoadingBox');
  const progressBar = ctx.sbCharSheetProgressBar || document.getElementById('sbCharSheetProgressBar');
  const loadingText = ctx.sbCharSheetLoadingText || document.getElementById('sbCharSheetLoadingText');
  const errorAlert = ctx.sbCharSheetErrorAlert || document.getElementById('sbCharSheetErrorAlert');
  const resultArea = ctx.sbCharSheetResultArea || document.getElementById('sbCharSheetResultArea');
  const resultImg = ctx.sbCharSheetResultImg || document.getElementById('sbCharSheetResultImg');
  const btnDownload = ctx.btnDownloadCharSheetResult || document.getElementById('btnDownloadCharSheetResult');
  const btnOpen = ctx.btnOpenCharSheetResult || document.getElementById('btnOpenCharSheetResult');

  if (btnGen) btnGen.disabled = true;
  if (btnLabel) btnLabel.textContent = 'Menyiapkan Karakter Sheet...';
  if (loadingBox) loadingBox.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '15%';
  if (loadingText) loadingText.textContent = 'Menyiapkan gambar referensi talent...';
  if (errorAlert) errorAlert.classList.add('hidden');
  if (resultArea) resultArea.classList.add('hidden');

  let resultUrl = null;

  try {
    let idToken = await ctx.getValidIdToken(acc);
    if (!idToken) throw new Error('Sesi akun Weavy tidak valid. Silakan refresh akun.');

    // Upload talent image to Weavy if needed
    const readyAssets = [];
    let assetObj = null;

    if (typeof talentImage === 'object' && talentImage?.weavyAsset?.url) {
      assetObj = talentImage.weavyAsset;
    } else if (typeof talentImage === 'object' && talentImage?.url && String(talentImage.url).startsWith('http')) {
      assetObj = talentImage;
    } else {
      const rawData = typeof talentImage === 'object' ? (talentImage.base64 || talentImage.url) : talentImage;
      if (typeof rawData === 'string' && rawData.startsWith('data:')) {
        if (loadingText) loadingText.textContent = 'Mengunggah foto talent ke Weavy AI...';
        const upRes = await ctx.uploadAssetToWeavy({ base64: rawData, name: 'talent_reference.png' }, idToken);
        if (upRes && upRes.url) {
          assetObj = upRes;
        } else {
          throw new Error('Gagal mengunggah foto referensi talent ke server Weavy.');
        }
      } else if (typeof rawData === 'string' && rawData.startsWith('http')) {
        assetObj = { url: rawData, type: 'image', name: 'talent_reference.png' };
      }
    }

    if (assetObj) {
      readyAssets.push(assetObj);
    }

    if (loadingText) loadingText.textContent = 'Membuka canvas dan menyiapkan resep AI...';
    if (progressBar) progressBar.style.width = '35%';

    let recipeId = await ctx.getOrCreateWeavyRecipeId(idToken, acc?.userId || acc?.id, 'image');
    if (!recipeId) throw new Error('Gagal mengakses resep canvas Weavy AI.');

    const promptNodeId = `node_prompt_${Date.now()}`;
    const modelNodeId = `node_model_${Date.now()}`;
    const promptNode = {
      id: promptNodeId,
      type: 'promptV3',
      isModel: false,
      dragHandle: '.node-header',
      position: { x: 200, y: 200 },
      data: {
        name: 'Prompt',
        color: 'Yambo_Green',
        params: { prompt: prompt.trim() },
        output: { prompt: prompt.trim() },
        result: { prompt: prompt.trim() },
        handles: { output: { prompt: { type: 'text', label: 'Prompt', order: 0, format: 'text', description: 'The prompt text' } } },
        version: 3,
        dark_color: 'Yambo_Green_Dark',
        border_color: 'Yambo_Green_Stroke',
      },
    };

    let targetModelName = 'gpt-image-2.5';
    let targetDisplayName = 'GPT Image 2.5';
    let targetDescription = 'Generates images with GPT Image 2.5';
    let targetMenuDisplayName = 'GPT Image 2.5';
    let modelCredits = 4;
    let parametersList = [];
    let outputSchema = [];
    let nodeSchema = {};
    let paramsObj = {};
    let inputObj = {};
    let inputsList = [];
    let nodeHandles = { input: { prompt: { type: 'text', label: 'Prompt', order: 0, required: true } }, output: {} };

    const isGpt25 = selectedModelVal === 'gpt-image-2.5' || selectedModelVal.includes('flare');
    const isSeedream = selectedModelVal === 'seedream' || selectedModelVal.includes('seedream');
    const isNanoBanana = selectedModelVal === 'nano-banana' || selectedModelVal.includes('nano-banana');
    const isGptEdit = selectedModelVal === 'gpt_image_1_edit' || selectedModelVal.includes('edit');
    const isGrok = selectedModelVal === 'grok' || selectedModelVal.includes('grok');

    let imageSize = 'landscape_16_9';
    if (selectedRatio === '9:16') imageSize = 'portrait_16_9';
    else if (selectedRatio === '1:1') imageSize = 'square_hd';
    else if (selectedRatio === '4:3') imageSize = 'landscape_4_3';

    const randomSeed = Math.floor(Math.random() * 9999999) + 1;
    const refNodes = [];
    const refEdges = [];

    readyAssets.forEach((asset, idx) => {
      const fNodeId = `node_file_talent_${Date.now()}_${idx}`;
      const handleName = isGptEdit && idx === 0 ? 'image' : isGrok && readyAssets.length === 1 ? 'image' : `image_${idx + 1}`;
      refNodes.push({
        id: fNodeId,
        isModel: false,
        type: 'import',
        dragHandle: '.node-header',
        position: { x: 200, y: 380 + idx * 180 },
        data: {
          name: `Talent Reference ${idx + 1}`,
          color: 'Yambo_Blue',
          files: [asset],
          output: { file: asset },
          result: asset,
          handles: { output: { file: { type: 'any', label: 'File', order: 0, format: 'uri', description: 'The uploaded file' } } },
          version: 3,
          dark_color: 'Yambo_Blue_Dark',
          border_color: 'Yambo_Blue_Stroke',
        },
      });
      refEdges.push({
        id: `edge_ref_talent_${idx + 1}_${Date.now()}`,
        type: 'custom',
        source: fNodeId,
        target: modelNodeId,
        sourceHandle: `${fNodeId}-output-file`,
        targetHandle: `${modelNodeId}-input-${handleName}`,
        data: { sourceColor: 'Yambo_Blue', targetColor: 'Yambo_Purple', sourceHandleType: 'any', targetHandleType: 'image' },
      });
      nodeHandles.input[handleName] = { type: 'image', order: idx + 1, required: isGptEdit && idx === 0 };
      inputsList.push([{ id: handleName, title: handleName, description: `Talent Reference ${idx + 1}`, validTypes: ['image'], required: isGptEdit && idx === 0 }, { nodeId: fNodeId, outputId: 'file', file: asset }]);
      paramsObj[handleName] = asset;
      inputObj[handleName] = asset;
    });

    if (isGpt25) {
      targetModelName = 'gpt-image-2.5';
      targetDisplayName = 'GPT Image 2.5';
      targetDescription = 'Generates images with GPT Image 2.5';
      targetMenuDisplayName = 'GPT Image 2.5';
      modelCredits = 4;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [{ id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } }, { type: 'value', data: { type: 'string', value: 'Flare' } }],
        [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }],
        [{ id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: 'auto' } }],
        [{ id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
        [{ id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } }, { type: 'value', data: { type: 'string', value: 'png' } }],
      ];
      paramsObj = { ...paramsObj, model: 'Flare', prompt: prompt.trim(), quality: 'high', background: 'auto', image_size: imageSize, output_format: 'png' };
    } else if (isSeedream) {
      targetModelName = 'fal-ai/bytedance/seedream/v5/lite/edit';
      targetDisplayName = 'Seedream V5.0 Pro Edit';
      targetDescription = 'Edit images with Seedream V5.0 Pro';
      targetMenuDisplayName = 'Seedream V5.0 Pro Edit';
      modelCredits = 12;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [{ id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, defaultValue: { type: 'string', value: 'V5.0 Pro' } }, { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } }],
        [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
        [{ id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
        [{ id: 'enhance_prompt_mode', title: 'Enhance Prompt Mode', constraint: { type: 'enum', options: ['standard', 'fast'] }, defaultValue: { type: 'string', value: 'standard' } }, { type: 'value', data: { type: 'string', value: 'standard' } }],
      ];
      paramsObj = { ...paramsObj, model: 'V5.0 Pro', prompt: prompt.trim(), seed: randomSeed, image_size: imageSize, enhance_prompt_mode: 'standard' };
    } else if (isNanoBanana) {
      targetModelName = 'fal-ai/nano-banana-pro/edit';
      targetDisplayName = 'Nano Banana Pro';
      targetDescription = 'Edit images with Nano Banana Pro';
      targetMenuDisplayName = 'Nano Banana Pro';
      modelCredits = 11;
      const cleanRes = selectedRatio === '16:9' || selectedRatio === '1:1' ? '2K' : '1K';
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
        [{ id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, defaultValue: { type: 'string', value: '1K' } }, { type: 'value', data: { type: 'string', value: cleanRes } }],
        [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: selectedRatio || '16:9' } }],
        [{ id: 'enable_web_search', title: 'Enable Web Search', constraint: { type: 'boolean' }, defaultValue: { type: 'boolean', value: false } }, { type: 'value', data: { type: 'boolean', value: false } }],
      ];
      paramsObj = { ...paramsObj, prompt: prompt.trim(), seed: randomSeed, num_images: 1, resolution: cleanRes, aspect_ratio: selectedRatio || '16:9', output_format: 'png', enable_web_search: false };
    } else if (isGptEdit) {
      targetModelName = 'gpt_image_1_edit';
      targetDisplayName = 'ChatGPT Images 2.0 Edit';
      targetDescription = "Edit images with OpenAI's GPT Image 2";
      targetMenuDisplayName = 'GPT Image 1';
      modelCredits = 9;
      nodeHandles = { input: { prompt: { id: `470e45b3-3c3a-46f1-822e-715abc4610ab`, type: 'text', label: 'prompt', order: 0, format: 'text', required: true, description: 'Prompt for image edit' }, ...nodeHandles.input }, output: { image: { id: `470e45b3-3c3a-46f1-822e-715abc4610at`, type: 'image', label: 'image', order: 0, format: 'uri', description: 'Result image' } } };
      outputSchema = [{ id: 'image', title: 'image', description: 'Result image', dataType: 'image' }];
      nodeSchema = { size: { type: 'fal_image_size', order: 9, title: 'Resolution', default: 'auto', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'], description: 'Size of image' }, model: { type: 'enum', order: 0, title: 'Model', default: 'GPT Image 2', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'] }, quality: { type: 'enum', order: 7, title: 'Quality', default: 'medium', options: ['auto', 'high', 'medium', 'low'] } };
      parametersList = [
        [{ id: 'model', title: 'Model', description: 'GPT model type', constraint: { type: 'enum', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'] }, defaultValue: { type: 'string', value: 'GPT Image 2' } }, { type: 'value', data: { type: 'string', value: 'GPT Image 2' } }],
        [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'medium' } }, { type: 'value', data: { type: 'string', value: 'medium' } }],
        [{ id: 'size', title: 'Resolution', constraint: { type: 'image_size', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }],
      ];
      paramsObj = { ...paramsObj, size: 'auto', model: 'GPT Image 2', quality: 'medium', number_of_images: 1, prompt: prompt.trim() };
    } else if (isGrok) {
      targetModelName = 'xai/grok-imagine-image';
      targetDisplayName = 'Grok Imagine Image';
      targetDescription = 'Generates images with Grok Imagine Image';
      targetMenuDisplayName = 'Grok Imagine Image';
      modelCredits = 4;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [{ id: 'seed', title: 'Seed', constraint: { type: 'integer' }, defaultValue: { type: 'integer', value: 0 } }, { type: 'value', data: { type: 'integer', value: randomSeed } }],
        [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: selectedRatio || '16:9' } }, { type: 'value', data: { type: 'string', value: selectedRatio || '16:9' } }],
      ];
      paramsObj = { ...paramsObj, prompt: prompt.trim(), seed: randomSeed, aspect_ratio: selectedRatio || '16:9' };
    }

    const isFalImported = isSeedream || isNanoBanana || isGrok;
    const modelNode = {
      id: modelNodeId,
      type: 'custommodelV2',
      isModel: true,
      dragHandle: '.node-header',
      position: { x: 650, y: 200 },
      data: {
        name: targetDisplayName,
        description: targetDescription,
        ...(isGptEdit ? { color: 'Red' } : {}),
        menu: { icon: 'EmojiObjectsIcon', isModel: true, displayName: targetMenuDisplayName },
        model: { name: targetModelName, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) },
        ...(Object.keys(nodeSchema).length > 0 ? { schema: nodeSchema } : {}),
        kind: { type: 'wildcard', model: { type: 'predefined', name: targetModelName, description: targetDescription, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) }, inputs: inputsList, parameters: parametersList, outputs: outputSchema },
        params: paramsObj,
        input: inputObj,
        handles: nodeHandles,
        version: 3,
      },
    };

    const nodes = [promptNode, modelNode, ...refNodes];
    const edges = [
      { id: `edge_p_${Date.now()}`, type: 'custom', source: promptNodeId, target: modelNodeId, sourceHandle: `${promptNodeId}-output-prompt`, targetHandle: `${modelNodeId}-input-prompt`, data: { sourceColor: 'Yambo_Green', targetColor: 'Yambo_Purple', sourceHandleType: 'text', targetHandleType: 'text' } },
      ...refEdges,
    ];
    const executePayload = { numberOfRuns: 1, nodes, edges, displayedCost: { credits: modelCredits, perSecondRate: 0, surface: 'drawer' } };
    let execHeaders = ctx.getWeavyClientHeaders(idToken, acc?.userId || acc?.id, recipeId);

    await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }) }).catch(() => {});

    if (loadingText) loadingText.textContent = `Memproses rendering Karakter Sheet (${targetDisplayName}) di Weavy AI...`;
    if (progressBar) progressBar.style.width = '60%';

    let execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
    if (execRes.status === 403) {
      try {
        await ctx.approveWeavyModel(targetModelName, idToken, acc?.userId || acc?.id, recipeId);
        execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
      } catch (approvalError) {
        console.warn('[CharSheet Model Approval Warning]:', approvalError);
      }
    }

    if (execRes.status === 403 || execRes.status === 401) {
      if (loadingText) loadingText.textContent = 'Menyinkronkan sesi Weavy...';
      if (typeof ctx.recoverWeavySessionOn403 === 'function') {
        try {
          const renewedToken = await ctx.recoverWeavySessionOn403(acc);
          if (renewedToken) idToken = renewedToken;
        } catch (e) {
          console.warn('[CharSheet 403 recovery warning]:', e);
        }
      }

      const storageKey = `weavy_canvas_image_${acc?.userId || 'default'}`;
      await ctx.storage.set(storageKey, null);
      const freshToken = await ctx.getValidIdToken(acc);
      const activeToken = freshToken || idToken;
      if (activeToken) {
        const freshRecipeId = await ctx.getOrCreateWeavyRecipeId(activeToken, acc?.userId || acc?.id, 'image');
        if (freshRecipeId) recipeId = freshRecipeId;
        execHeaders = ctx.getWeavyClientHeaders(activeToken, acc?.userId || acc?.id, recipeId);
        await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }) }).catch(() => {});
        execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
      }
    }

    if (!execRes.ok) {
      const errText = await execRes.text().catch(() => '');
      if (execRes.status === 403) throw new Error(`Akses ditolak (HTTP 403). Saldo: ${acc.credits ?? 0} Koin. Silakan klik Refresh Saldo.`);
      throw new Error(`Gagal mengirim permintaan generasi Karakter Sheet (HTTP ${execRes.status}): ${errText.slice(0, 120)}`);
    }

    const execData = await execRes.json();
    const batchId = execData.batchId || execData.id;
    if (!batchId) throw new Error('Batch ID tidak diterima dari Weavy AI.');

    const inputUrls = readyAssets.flatMap((a) => [a.url, a.downloadUrl, a.thumbnailUrl].filter(Boolean));
    const refNodeIds = new Set(refNodes.map((n) => n.id));
    const completedStatuses = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'FINISHED', 'DONE']);
    const failedStatuses = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'FAIL']);

    const maxPollCycles = 240;
    let completedRetriesWithoutUrl = 0;

    for (let poll = 0; poll < maxPollCycles; poll++) {
      await new Promise((r) => setTimeout(r, 2000));

      let progress = 20;
      if (poll < 15) {
        progress = 20 + Math.round(poll * 2.5);
      } else if (poll < 45) {
        progress = 58 + Math.round((poll - 15) * 0.8);
      } else if (poll < 90) {
        progress = 82 + Math.round((poll - 45) * 0.2);
      } else {
        progress = Math.min(98, 91 + Math.round((poll - 90) * 0.05));
      }

      if (progressBar) progressBar.style.width = `${progress}%`;

      try {
        const stRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`, { headers: execHeaders });
        if (stRes.ok) {
          const stData = await stRes.json();
          const run = stData.recipeRuns?.[0] || stData.recipeRun;
          const currentStatus = (run?.status || stData.status || '').toUpperCase();

          if (currentStatus === 'QUEUED' || currentStatus === 'PENDING') {
            if (loadingText) loadingText.textContent = `Menunggu antrean Weavy AI (${progress}%)...`;
          } else {
            if (loadingText) loadingText.textContent = `Merender Karakter Sheet 3-View (${targetDisplayName}) di Weavy AI (${progress}%)...`;
          }

          if (completedStatuses.has(currentStatus)) {
            const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];

            const topLevelCandidates = [
              run?.result, run?.output, run?.resultUrl, run?.outputUrl, run?.url,
              stData.result, stData.output, stData.resultUrl, stData.outputUrl, stData.url,
              ...(Array.isArray(run?.outputs) ? run.outputs : []),
              ...(Array.isArray(stData.outputs) ? stData.outputs : []),
            ];

            for (const candidate of topLevelCandidates) {
              const url = ctx.extractMediaUrlFromObject(candidate, inputUrls);
              if (url) {
                resultUrl = url;
                break;
              }
            }

            if (!resultUrl) {
              const modelRun = nodeRuns.find((nr) => nr.nodeId === modelNodeId) ||
                nodeRuns.find((nr) => nr.nodeType === 'custommodelV2' || (nr.isModel && nr.nodeType !== 'import')) ||
                nodeRuns.find((nr) => !refNodeIds.has(nr.nodeId) && nr.nodeType !== 'import' && nr.nodeType !== 'promptV3');

              if (modelRun) {
                const resObj = modelRun.result || modelRun.output;
                if (resObj) {
                  const url = ctx.extractMediaUrlFromObject(resObj, inputUrls);
                  if (url) resultUrl = url;
                }
              }
            }

            if (!resultUrl) {
              for (const nr of nodeRuns) {
                if (refNodeIds.has(nr.nodeId) || nr.nodeType === 'import' || nr.nodeType === 'promptV3' || nr.name?.includes('Reference Image') || nr.name?.startsWith('File')) continue;
                const resObj = nr.result || nr.output;
                if (resObj) {
                  const url = ctx.extractMediaUrlFromObject(resObj, inputUrls);
                  if (url) {
                    resultUrl = url;
                    break;
                  }
                }
              }
            }

            if (!resultUrl) {
              const topUrl = ctx.extractMediaUrlFromObject(run || stData, inputUrls);
              if (topUrl) resultUrl = topUrl;
            }

            if (resultUrl) {
              break;
            } else {
              completedRetriesWithoutUrl += 1;
              if (completedRetriesWithoutUrl > 30) break;
            }
          }

          if (failedStatuses.has(currentStatus)) {
            const errMsg = run?.error?.message || run?.error || stData.error || run?.errorMessage || 'Rendering Karakter Sheet gagal di Weavy AI.';
            throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
          }
        }
      } catch (pollErr) {
        if (pollErr.message && (pollErr.message.includes('Rendering Karakter Sheet gagal') || pollErr.message.includes('Akses ditolak'))) {
          throw pollErr;
        }
        console.warn('[CharSheet Polling Warning]:', pollErr);
      }
    }

    if (!resultUrl) throw new Error('Gambar Karakter Sheet tidak berhasil didapatkan setelah batas waktu tunggu. Silakan coba lagi.');

    if (progressBar) progressBar.style.width = '100%';
    if (loadingText) loadingText.textContent = 'Karakter Sheet Berhasil Dibuat!';
    if (loadingBox) loadingBox.classList.add('hidden');
    if (resultImg) resultImg.src = resultUrl;
    ctx.sbCharSheetResultUrl = resultUrl;

    if (btnDownload) btnDownload.href = resultUrl;
    if (btnOpen) btnOpen.href = resultUrl;
    if (resultArea) resultArea.classList.remove('hidden');

    ctx.showAuthAlert?.('🎉 Karakter Sheet 3-View berhasil dibuat!', 'success');
    if (acc) ctx.fetchUserCreditsFromWeavy?.(acc).catch(() => {});
    return resultUrl;
  } catch (err) {
    console.error('[Character Sheet Error]:', err);
    if (loadingBox) loadingBox.classList.add('hidden');
    if (errorAlert) {
      errorAlert.textContent = `❌ ${err.message || 'Gagal generate karakter sheet'}`;
      errorAlert.classList.remove('hidden');
    }
    ctx.showAuthAlert?.(`Gagal: ${err.message || 'Gagal membuat karakter sheet.'}`, 'error');
  } finally {
    if (btnGen) btnGen.disabled = false;
    if (btnLabel) btnLabel.textContent = 'Generate Karakter Sheet';
  }
}

// ==========================================================================
// PRODUCT STAGING & MULTI-ANGLE VARIATIONS GENERATOR ENGINE
// ==========================================================================
export function buildProductVariationPrompts({
  productName = 'Produk',
  productDesc = '',
  settingBrief = '',
  count = 4,
  strategy = 'multi_setting',
  aspectRatio = '9:16',
} = {}) {
  const pName = (productName || 'Produk').trim();
  const pDesc = (productDesc || '').trim();
  const sBrief = (settingBrief || 'studio commercial setting with aesthetic lighting').trim();
  const productAnchor = `[PRODUCT ANCHOR: Maintain exact original packaging, label, design, shape, and colors of ${pName}${pDesc ? `, ${pDesc}` : ''}]`;
  const ratioPrefix = aspectRatio === '16:9' ? 'Horizontal 16:9 landscape' : aspectRatio === '1:1' ? 'Square 1:1 format' : `Vertical ${aspectRatio}`;

  const prompts = [];

  if (strategy === 'packshot_angles') {
    prompts.push({
      index: 1,
      title: 'Sudut 1: Extreme Close-Up Macro Hero',
      desc: 'Fokus tajam pada tekstur detail dan label kemasan produk dengan rim light sinematik.',
      prompt: `${ratioPrefix} commercial advertising photograph, extreme close-up macro 100mm lens shot, ${productAnchor}, positioned prominently in ${sBrief}, crisp sharp focus on product details, premium studio softbox lighting, high-end commercial grade, 8k, clean photography, no watermark.`,
    });
    prompts.push({
      index: 2,
      title: 'Sudut 2: Eye-Level 45° Angle Hero Packshot',
      desc: 'Tampak depan 45 derajat proporsional memperlihatkan bentuk utuh produk.',
      prompt: `${ratioPrefix} commercial product photography, 45-degree angle eye-level shot, ${productAnchor}, resting stably on modern surface in ${sBrief}, elegant soft shadow casting, balanced studio lighting, pristine commercial advertisement frame, 8k.`,
    });
    prompts.push({
      index: 3,
      title: 'Sudut 3: Dynamic Flat Lay / Top-Down View',
      desc: 'Sudut atas flat-lay estetik dengan komposisi properti pendukung yang rapi.',
      prompt: `${ratioPrefix} aesthetic flat lay top-down overhead shot (90 degree view), ${productAnchor}, arranged beautifully with subtle props in ${sBrief}, clean balanced composition, diffused natural light, editorial magazine aesthetic, 8k.`,
    });
    prompts.push({
      index: 4,
      title: 'Sudut 4: Hands Interaction / First-Person POV',
      desc: 'Tangan memegang atau mendemonstrasikan produk secara natural.',
      prompt: `${ratioPrefix} first-person POV shot, authentic creator hand gently holding and presenting ${productAnchor} forward towards the camera in ${sBrief}, natural skin texture, soft ambient room illumination, crisp product focus, 8k.`,
    });
    if (count >= 5) {
      prompts.push({
        index: 5,
        title: 'Sudut 5: Low-Angle Dramatic Hero Shot',
        desc: 'Sudut rendah dinamis memberikan kesan produk mewah dan premium.',
        prompt: `${ratioPrefix} dramatic low-angle heroic shot, ${productAnchor}, looking slightly upward against ${sBrief}, striking rim lighting, high-contrast premium luxury aesthetic, 8k.`,
      });
    }
    if (count >= 6) {
      prompts.push({
        index: 6,
        title: 'Sudut 6: Floating Splash & Dynamic Action',
        desc: 'Produk melayang estetik dengan efek cipratan partikel atau elemen natural.',
        prompt: `${ratioPrefix} dynamic floating zero-gravity packshot, ${productAnchor}, suspended in mid-air in ${sBrief}, subtle floating organic particles and light droplets, high-speed shutter photography, crisp focus, 8k.`,
      });
    }
  } else if (strategy === 'tiktok_lifestyle') {
    prompts.push({
      index: 1,
      title: 'Variasi 1: UGC Handheld Room Vlog',
      desc: 'Gaya candid smartphone alami di kamar dengan pencahayaan ambient santai.',
      prompt: `${ratioPrefix} authentic UGC handheld smartphone camera video still, natural room lighting, ${productAnchor}, shown casually in ${sBrief}, unfiltered realistic texture, relatable social media video still, 8k.`,
    });
    prompts.push({
      index: 2,
      title: 'Variasi 2: First-Person Hands-On POV',
      desc: 'Tangan creator menunjukkan produk dari dekat seakan sedang unboxing/review.',
      prompt: `${ratioPrefix} first-person POV hands-on TikTok frame, creator fingers holding ${productAnchor}, testing and displaying in ${sBrief}, crisp product focus, shallow depth of field, aesthetic bedroom ambience.`,
    });
    prompts.push({
      index: 3,
      title: 'Variasi 3: Golden Hour Window Sunlight',
      desc: 'Cahaya matahari sore hangat (golden hour) memberikan kesan natural & glowing.',
      prompt: `${ratioPrefix} aesthetic lifestyle photograph, golden hour sunlight streaming through window onto ${productAnchor}, placed warmly in ${sBrief}, soft warm sunbeam flares, authentic cozy aesthetic, 8k.`,
    });
    prompts.push({
      index: 4,
      title: 'Variasi 4: Aesthetic Vanity / Desk Staging',
      desc: 'Penataan estetik di atas meja rias atau workspace ala video review viral.',
      prompt: `${ratioPrefix} aesthetic viral TikTok setup still, ${productAnchor}, placed neatly on a modern vanity table in ${sBrief}, soft ambient lighting, clean millennial interior background, 8k.`,
    });
    if (count >= 5) {
      prompts.push({
        index: 5,
        title: 'Variasi 5: Outdoor Natural Ambient Walk',
        desc: 'Produk dibawa di luar ruangan dengan suasana outdoor segar.',
        prompt: `${ratioPrefix} candid outdoor handheld shot, ${productAnchor}, held against natural sunny background in ${sBrief}, crisp daylight, realistic bokeh background, 8k.`,
      });
    }
    if (count >= 6) {
      prompts.push({
        index: 6,
        title: 'Variasi 6: Before-After Split Comparison',
        desc: 'Komposisi perbandingan visual yang memperlihatkan keunggulan produk.',
        prompt: `${ratioPrefix} authentic social media product demonstration, ${productAnchor}, highlighting real-life usage in ${sBrief}, bright natural lighting, crisp sharp focus, 8k.`,
      });
    }
  } else if (strategy === 'minimalist_podium') {
    prompts.push({
      index: 1,
      title: 'Variasi 1: Luxury Stone Pedestal Podium',
      desc: 'Produk berdiri di atas podium marmer/batu mewah dengan lighting minimalis.',
      prompt: `${ratioPrefix} high-end commercial advertising photography, ${productAnchor}, standing on a minimalist circular stone podium in ${sBrief}, clean architectural shadows, soft diffused studio light, luxury brand aesthetic, 8k.`,
    });
    prompts.push({
      index: 2,
      title: 'Variasi 2: Modern Pastel Geometric Blocks',
      desc: 'Komposisi balok geometris modern dengan palet warna elegan yang senada.',
      prompt: `${ratioPrefix} minimalist product staging, ${productAnchor}, elevated on geometric pastel blocks in ${sBrief}, soft monochrome color grading, pristine clean studio setup, 8k.`,
    });
    prompts.push({
      index: 3,
      title: 'Variasi 3: Organic Floral & Shadow Play',
      desc: 'Siluet bayangan daun tanaman tropis dan pantulan cahaya alami yang artistik.',
      prompt: `${ratioPrefix} aesthetic studio photograph, ${productAnchor}, placed on matte surface in ${sBrief}, elegant organic leaf shadows casting across the background, soft warm lighting, 8k.`,
    });
    prompts.push({
      index: 4,
      title: 'Variasi 4: Mirror & Water Surface Reflection',
      desc: 'Pantulan air jernih atau kaca cermin yang memberikan efek kemewahan ganda.',
      prompt: `${ratioPrefix} premium commercial photography, ${productAnchor}, standing on calm reflective water mirror surface in ${sBrief}, crystal clear reflection, soft rim illumination, pristine 8k.`,
    });
    if (count >= 5) {
      prompts.push({
        index: 5,
        title: 'Variasi 5: Neon Rim Cyber Aesthetic',
        desc: 'Aksen garis cahaya neon kontras tinggi di sekitar produk.',
        prompt: `${ratioPrefix} sleek modern commercial packshot, ${productAnchor}, surrounded by subtle glowing neon rim light in ${sBrief}, dark atmospheric background, high contrast, 8k.`,
      });
    }
    if (count >= 6) {
      prompts.push({
        index: 6,
        title: 'Variasi 6: Floating Silk & Fluid Fabric',
        desc: 'Kain sutra melayang lembut mengelilingi produk.',
        prompt: `${ratioPrefix} luxury editorial packshot, ${productAnchor}, surrounded by flowing ethereal soft silk fabric in ${sBrief}, gentle fluid motion, soft studio lighting, 8k.`,
      });
    }
  } else {
    // Default: Multi-Setting (Latar Beragam Sesuai Brief)
    prompts.push({
      index: 1,
      title: 'Latar 1: Clean Ambient Interior',
      desc: 'Latar ruangan utama sesuai brief dengan pencahayaan estetik yang hangat.',
      prompt: `${ratioPrefix} commercial advertising photograph, ${productAnchor}, placed gracefully in ${sBrief}, soft ambient interior lighting, authentic atmosphere, high fidelity, 8k.`,
    });
    prompts.push({
      index: 2,
      title: 'Latar 2: Close-Up Sensory Context',
      desc: 'Pengambilan gambar lebih dekat dengan fokus pada interaksi produk di setting tersebut.',
      prompt: `${ratioPrefix} close-up lifestyle shot, ${productAnchor}, featured centrally in ${sBrief}, soft depth of field, crisp product texture, natural bright lighting, 8k.`,
    });
    prompts.push({
      index: 3,
      title: 'Latar 3: Creative Angle & Daylight Sunbeam',
      desc: 'Sudut pandang berbeda dengan pantulan sinar matahari alami yang dramatis.',
      prompt: `${ratioPrefix} artistic commercial photograph, dynamic angle showing ${productAnchor}, standing in ${sBrief}, natural sunbeam casting soft shadows, crisp sharp product label, 8k.`,
    });
    prompts.push({
      index: 4,
      title: 'Latar 4: In-Action / Lifestyle Demonstration',
      desc: 'Produk dalam konteks pemakaian nyata sehari-hari di latar brief.',
      prompt: `${ratioPrefix} authentic commercial lifestyle still, ${productAnchor}, showcased in active use in ${sBrief}, relatable candid setting, beautiful atmospheric lighting, 8k.`,
    });
    if (count >= 5) {
      prompts.push({
        index: 5,
        title: 'Latar 5: Minimalist Tabletop Flatlay',
        desc: 'Komposisi rapi di atas meja datar dengan elemen pendukung minimalis.',
        prompt: `${ratioPrefix} clean flat lay commercial still, ${productAnchor}, arranged tastefully in ${sBrief}, balanced composition, soft diffused daylight, 8k.`,
      });
    }
    if (count >= 6) {
      prompts.push({
        index: 6,
        title: 'Latar 6: Dramatic Golden Hour / Evening Lighting',
        desc: 'Suasana pencahayaan sore/malam hari yang sinematik.',
        prompt: `${ratioPrefix} cinematic advertising photograph, ${productAnchor}, beautifully lit in ${sBrief}, rich warm contrast, high-end commercial visual, 8k.`,
      });
    }
  }

  return prompts.slice(0, count);
}

export function openProductVariationsModal(ctx = {}) {
  const modal = ctx.sbProductVariationsModal || document.getElementById('sbProductVariationsModal');
  if (!modal) return;

  // Sync current product info & preview if available
  const previewImg = ctx.sbProdVarsImgPreview || document.getElementById('sbProdVarsImgPreview');
  const emptyIcon = ctx.sbProdVarsEmptyIcon || document.getElementById('sbProdVarsEmptyIcon');
  const statusBadge = ctx.sbProdVarsStatus || document.getElementById('sbProdVarsStatus');
  const nameInput = ctx.sbProdVarsNameInput || document.getElementById('sbProdVarsNameInput');
  const descInput = ctx.sbProdVarsDescInput || document.getElementById('sbProdVarsDescInput');
  const briefTextarea = ctx.sbProdVarsBriefText || document.getElementById('sbProdVarsBriefText');

  const currentProdRef = ctx.sbProductWeavyAsset?.url || ctx.sbProductRefBase64 || ctx.currentSbProject?.inputState?.productAsset?.weavyAsset?.url || ctx.currentSbProject?.inputState?.productAsset?.base64;
  const currentProdName = (ctx.sbProductName?.value || ctx.currentSbProject?.inputState?.productName || '').trim();
  const currentProdDesc = (ctx.sbProductDesc?.value || ctx.currentSbProject?.inputState?.productDesc || '').trim();
  const currentBrief = (ctx.sbMainBrief?.value || ctx.sbBriefInput?.value || ctx.currentSbProject?.inputState?.brief || '').trim();

  if (nameInput && currentProdName && !nameInput.value) {
    nameInput.value = currentProdName;
  }
  if (descInput && currentProdDesc && !descInput.value) {
    descInput.value = currentProdDesc;
  }
  if (briefTextarea && !briefTextarea.value && currentBrief) {
    briefTextarea.value = currentBrief;
  }

  // Sync selected Text AI model from main storyboard config if not set
  const textModelSelect = ctx.sbProdVarsTextModelSelect || document.getElementById('sbProdVarsTextModelSelect');
  const mainAiModelSelect = ctx.sbAiModel || document.getElementById('sbAiModel');
  if (textModelSelect && mainAiModelSelect && mainAiModelSelect.value) {
    textModelSelect.value = mainAiModelSelect.value;
  }

  if (currentProdRef) {
    if (previewImg) {
      previewImg.src = currentProdRef;
      previewImg.classList.remove('hidden');
    }
    if (emptyIcon) emptyIcon.classList.add('hidden');
    if (statusBadge) {
      statusBadge.textContent = 'Foto Produk Siap';
      statusBadge.className = 'sb-asset-badge';
    }
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
    }
    if (emptyIcon) emptyIcon.classList.remove('hidden');
    if (statusBadge) {
      statusBadge.textContent = 'Belum Ada Foto';
      statusBadge.className = 'sb-asset-badge text-muted';
    }
  }

  modal.classList.remove('hidden');
  modal.style.setProperty('display', 'flex', 'important');
}

export function closeProductVariationsModal(ctx = {}) {
  const modal = ctx.sbProductVariationsModal || document.getElementById('sbProductVariationsModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.removeProperty('display');
}

export async function executeProductVariationsGeneration(ctx = {}) {
  const acc = ctx.getActiveAccount?.();
  if (!acc) {
    ctx.showAuthAlert?.('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.', 'error');
    ctx.switchTab?.('settings');
    return;
  }

  const nameInput = ctx.sbProdVarsNameInput || document.getElementById('sbProdVarsNameInput');
  const descInput = ctx.sbProdVarsDescInput || document.getElementById('sbProdVarsDescInput');
  const briefInput = ctx.sbProdVarsBriefText || document.getElementById('sbProdVarsBriefText');
  const countSelect = ctx.sbProdVarsCountSelect || document.getElementById('sbProdVarsCountSelect');
  const strategySelect = ctx.sbProdVarsStrategySelect || document.getElementById('sbProdVarsStrategySelect');
  const modelSelect = ctx.sbProdVarsModelSelect || document.getElementById('sbProdVarsModelSelect');
  const ratioSelect = ctx.sbProdVarsRatioSelect || document.getElementById('sbProdVarsRatioSelect');

  const productName = (nameInput?.value || ctx.sbProductName?.value || 'Produk').trim();
  const productDesc = (descInput?.value || ctx.sbProductDesc?.value || '').trim();
  const settingBrief = (briefInput?.value || ctx.sbMainBrief?.value || 'Kamar mandi marmer mewah pencahayaan estetik pagi hari').trim();
  const count = parseInt(countSelect?.value || '4', 10);
  const strategy = strategySelect?.value || 'multi_setting';
  const selectedModelVal = modelSelect?.value || 'gpt-image-2.5';
  const selectedRatio = ratioSelect?.value || '9:16';

  // Product reference image
  let productImage = ctx.sbProdVarsUploadedAsset || ctx.sbProductWeavyAsset || ctx.sbProductRefBase64 || ctx.currentSbProject?.inputState?.productAsset?.weavyAsset || ctx.currentSbProject?.inputState?.productAsset?.base64 || null;

  if (!productImage) {
    const prodImgDom = document.getElementById('sbProdImgPreview');
    const prodWrapDom = document.getElementById('sbProdPreviewBox');
    if (prodImgDom && prodImgDom.src && (!prodWrapDom || !prodWrapDom.classList.contains('hidden'))) {
      const src = prodImgDom.src;
      if (src && !src.endsWith('#') && src.length > 20) {
        productImage = src;
      }
    }
  }

  if (!productImage) {
    ctx.showAuthAlert?.('Silakan upload foto produk terlebih dahulu agar AI mengenali kemasan & detail produk.', 'error');
    const fileInput = document.getElementById('sbProdVarsFileInput');
    if (fileInput) fileInput.click();
    return;
  }

  const btnGen = ctx.btnGenerateProductVariations || document.getElementById('btnGenerateProductVariations');
  const btnLabel = ctx.btnGenerateProductVariationsLabel || document.getElementById('btnGenerateProductVariationsLabel');
  const loadingBox = ctx.sbProdVarsLoadingBox || document.getElementById('sbProdVarsLoadingBox');
  const progressBar = ctx.sbProdVarsProgressBar || document.getElementById('sbProdVarsProgressBar');
  const loadingText = ctx.sbProdVarsLoadingText || document.getElementById('sbProdVarsLoadingText');
  const errorAlert = ctx.sbProdVarsErrorAlert || document.getElementById('sbProdVarsErrorAlert');
  const resultsGrid = ctx.sbProdVarsResultsGrid || document.getElementById('sbProdVarsResultsGrid');
  const resultsArea = ctx.sbProdVarsResultsArea || document.getElementById('sbProdVarsResultsArea');

  if (btnGen) btnGen.disabled = true;
  if (btnLabel) btnLabel.textContent = `Merancang ${count} Variasi Produk...`;
  if (loadingBox) loadingBox.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '10%';
  if (loadingText) loadingText.textContent = `Menyusun ${count} skenario visual & prompt khusus...`;
  if (errorAlert) errorAlert.classList.add('hidden');
  if (resultsArea) resultsArea.classList.remove('hidden');

  // Build or retrieve customized prompt variations
  let variations = getCustomizedProductVariationPrompts('sbProdVarsPromptsList');
  if (!variations || variations.length < count) {
    variations = buildProductVariationPrompts({
      productName,
      productDesc,
      settingBrief,
      count,
      strategy,
      aspectRatio: selectedRatio,
    });
  } else {
    variations = variations.slice(0, count);
  }

  // Render variation placeholder cards in results grid
  if (resultsGrid) {
    resultsGrid.innerHTML = variations.map((v, i) => `
      <div class="sb-prodvar-card" id="prodvar_card_${i + 1}" data-index="${i + 1}">
        <div class="sb-prodvar-thumb-wrap">
          <div class="sb-prodvar-placeholder" id="prodvar_ph_${i + 1}">
            <div class="sb-spinner"></div>
            <span class="text-xs text-muted" id="prodvar_status_${i + 1}">Menunggu antrean...</span>
          </div>
          <img id="prodvar_img_${i + 1}" src="" alt="${v.title}" class="sb-prodvar-img hidden" />
          <span class="sb-prodvar-tag">${v.title}</span>
        </div>
        <div class="sb-prodvar-content">
          <div class="sb-prodvar-desc-text">${v.desc}</div>
          <div class="sb-prodvar-prompt-preview">${v.prompt}</div>
          <div class="sb-prodvar-actions" id="prodvar_actions_${i + 1}" style="display: none;">
            <button type="button" class="btn-xs btn-primary btn-select-prodvar" data-index="${i + 1}" title="Pasang gambar ini sebagai Foto Produk Storyboard">
              ⭐ PILIH PRODUK
            </button>
            <button type="button" class="btn-xs btn-outline btn-set-bg-prodvar" data-index="${i + 1}" title="Jadikan gambar ini sebagai Latar Storyboard">
              🖼️ JADIKAN LATAR
            </button>
            <a id="prodvar_dl_${i + 1}" href="#" target="_blank" download="produk_variasi_${i + 1}.png" class="btn-xs btn-outline" title="Unduh">
              ⬇️
            </a>
            <a id="prodvar_open_${i + 1}" href="#" target="_blank" class="btn-xs btn-outline" title="Buka Fullscreen HD">
              🔍
            </a>
          </div>
        </div>
      </div>
    `).join('');
  }

  let completedCount = 0;
  const results = [];
  const pollTasks = [];

  try {
    let idToken = await ctx.getValidIdToken(acc);
    if (!idToken) throw new Error('Sesi akun Weavy tidak valid. Silakan refresh akun.');

    // Upload product asset if needed once
    let assetObj = null;
    if (typeof productImage === 'object' && productImage?.weavyAsset?.url) {
      assetObj = productImage.weavyAsset;
    } else if (typeof productImage === 'object' && productImage?.url && String(productImage.url).startsWith('http')) {
      assetObj = productImage;
    } else {
      const rawData = typeof productImage === 'object' ? (productImage.base64 || productImage.url) : productImage;
      if (typeof rawData === 'string' && rawData.startsWith('data:')) {
        if (loadingText) loadingText.textContent = 'Mengunggah foto produk ke Weavy AI...';
        const upRes = await ctx.uploadAssetToWeavy({ base64: rawData, name: `${productName || 'product'}.png` }, idToken);
        if (upRes && upRes.url) {
          assetObj = upRes;
        } else {
          throw new Error('Gagal mengunggah foto produk ke server Weavy.');
        }
      } else if (typeof rawData === 'string' && rawData.startsWith('http')) {
        assetObj = { url: rawData, type: 'image', name: `${productName || 'product'}.png` };
      }
    }

    if (loadingText) loadingText.textContent = `Mengirim ${variations.length} tugas render ke Weavy AI secara paralel...`;
    if (progressBar) progressBar.style.width = '20%';

    // Helper to poll individual variation task concurrently
    const pollSingleVariation = async (batchId, recipeId, execHeaders, cardNum, v, inputUrls) => {
      const cardStatus = document.getElementById(`prodvar_status_${cardNum}`);
      const cardImg = document.getElementById(`prodvar_img_${cardNum}`);
      const cardPh = document.getElementById(`prodvar_ph_${cardNum}`);
      const cardActions = document.getElementById(`prodvar_actions_${cardNum}`);
      const cardDl = document.getElementById(`prodvar_dl_${cardNum}`);
      const cardOpen = document.getElementById(`prodvar_open_${cardNum}`);

      if (cardStatus) cardStatus.textContent = 'Proses render di Weavy AI...';

      const completedStatuses = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'FINISHED', 'DONE']);
      const failedStatuses = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'FAIL']);

      for (let poll = 0; poll < 150; poll++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const stRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`, { headers: execHeaders });
          if (stRes.ok) {
            const stData = await stRes.json();
            const run = stData.recipeRuns?.[0] || stData.recipeRun;
            const currentStatus = (run?.status || stData.status || '').toUpperCase();

            if (currentStatus === 'QUEUED' || currentStatus === 'PENDING') {
              if (cardStatus) cardStatus.textContent = 'Menunggu antrean GPU...';
            } else if (currentStatus) {
              if (cardStatus) cardStatus.textContent = `Merender visual (${Math.min(95, 20 + poll * 3)}%)...`;
            }

            if (completedStatuses.has(currentStatus)) {
              let topUrl = null;
              const topCandidates = [
                run?.result, run?.output, run?.resultUrl, run?.outputUrl, run?.url,
                stData.result, stData.output, stData.resultUrl, stData.outputUrl, stData.url,
                ...(Array.isArray(run?.outputs) ? run.outputs : []),
                ...(Array.isArray(stData.outputs) ? stData.outputs : []),
              ];

              for (const c of topCandidates) {
                const u = ctx.extractMediaUrlFromObject(c, inputUrls);
                if (u) { topUrl = u; break; }
              }

              if (!topUrl && Array.isArray(run?.nodeRuns)) {
                for (const nr of run.nodeRuns) {
                  const u = ctx.extractMediaUrlFromObject(nr.result || nr.output, inputUrls);
                  if (u) { topUrl = u; break; }
                }
              }

              if (!topUrl) {
                topUrl = ctx.extractMediaUrlFromObject(run || stData, inputUrls);
              }

              if (topUrl) {
                results.push({ index: cardNum, url: topUrl, prompt: v.prompt, title: v.title });
                completedCount += 1;

                if (cardImg) {
                  cardImg.src = topUrl;
                  cardImg.classList.remove('hidden');
                }
                if (cardPh) cardPh.classList.add('hidden');
                if (cardActions) cardActions.style.display = 'flex';
                if (cardDl) cardDl.href = topUrl;
                if (cardOpen) cardOpen.href = topUrl;

                const overallProgress = Math.round(20 + (completedCount / variations.length) * 80);
                if (progressBar) progressBar.style.width = `${overallProgress}%`;
                if (loadingText) loadingText.textContent = `Selesai ${completedCount} dari ${variations.length} gambar (${v.title})...`;

                return { index: cardNum, url: topUrl };
              }
            }

            if (failedStatuses.has(currentStatus)) {
              const errMsg = run?.error?.message || run?.error || stData.error || 'Gagal merender variasi ini';
              if (cardStatus) cardStatus.textContent = `❌ ${typeof errMsg === 'string' ? errMsg.slice(0, 40) : 'Error'}`;
              return null;
            }
          }
        } catch (pollErr) {
          console.warn(`[Poll Warn Var #${cardNum}]:`, pollErr);
        }
      }

      if (cardStatus) cardStatus.textContent = '⚠️ Waktu tunggu habis';
      return null;
    };

    // Fast sequential dispatch loop: fire task -> get batchId -> launch polling async -> immediately next
    for (let idx = 0; idx < variations.length; idx++) {
      const v = variations[idx];
      const cardNum = idx + 1;
      const statusText = document.getElementById(`prodvar_status_${cardNum}`);
      if (statusText) statusText.textContent = `Membuat resep & mengirim task (${idx + 1}/${variations.length})...`;

      try {
        let recipeId = await ctx.getOrCreateWeavyRecipeId(idToken, acc?.userId || acc?.id, 'image');
        if (!recipeId) throw new Error('Gagal mengakses resep canvas Weavy AI.');

        const promptNodeId = `node_prompt_pv_${Date.now()}_${idx}`;
        const modelNodeId = `node_model_pv_${Date.now()}_${idx}`;
        const promptNode = {
          id: promptNodeId,
          type: 'promptV3',
          isModel: false,
          dragHandle: '.node-header',
          position: { x: 200, y: 200 },
          data: {
            name: 'Prompt',
            color: 'Yambo_Green',
            params: { prompt: v.prompt },
            output: { prompt: v.prompt },
            result: { prompt: v.prompt },
            handles: { output: { prompt: { type: 'text', label: 'Prompt', order: 0, format: 'text', description: 'The prompt text' } } },
            version: 3,
            dark_color: 'Yambo_Green_Dark',
            border_color: 'Yambo_Green_Stroke',
          },
        };

        let targetModelName = 'gpt-image-2.5';
        let targetDisplayName = 'GPT Image 2.5';
        let targetDescription = 'Generates images with GPT Image 2.5';
        let targetMenuDisplayName = 'GPT Image 2.5';
        let modelCredits = 4;
        let parametersList = [];
        let outputSchema = [];
        let nodeSchema = {};
        let paramsObj = {};
        let inputObj = {};
        let inputsList = [];
        let nodeHandles = { input: { prompt: { type: 'text', label: 'Prompt', order: 0, required: true } }, output: {} };

        const isGpt25 = selectedModelVal === 'gpt-image-2.5' || selectedModelVal.includes('flare');
        const isSeedream = selectedModelVal === 'seedream' || selectedModelVal.includes('seedream');
        const isNanoBanana = selectedModelVal === 'nano-banana' || selectedModelVal.includes('nano-banana');
        const isGptEdit = selectedModelVal === 'gpt_image_1_edit' || selectedModelVal.includes('edit');
        const isGrok = selectedModelVal === 'grok' || selectedModelVal.includes('grok');

        let imageSize = 'portrait_16_9';
        if (selectedRatio === '16:9') imageSize = 'landscape_16_9';
        else if (selectedRatio === '1:1') imageSize = 'square_hd';
        else if (selectedRatio === '4:3') imageSize = 'landscape_4_3';

        const randomSeed = Math.floor(Math.random() * 9999999) + 1;
        const refNodes = [];
        const refEdges = [];

        if (assetObj) {
          const fNodeId = `node_file_prod_${Date.now()}_${idx}`;
          const handleName = isGptEdit ? 'image' : isGrok ? 'image' : 'image_1';
          refNodes.push({
            id: fNodeId,
            isModel: false,
            type: 'import',
            dragHandle: '.node-header',
            position: { x: 200, y: 380 },
            data: {
              name: 'Product Reference',
              color: 'Yambo_Blue',
              files: [assetObj],
              output: { file: assetObj },
              result: assetObj,
              handles: { output: { file: { type: 'any', label: 'File', order: 0, format: 'uri', description: 'The uploaded file' } } },
              version: 3,
              dark_color: 'Yambo_Blue_Dark',
              border_color: 'Yambo_Blue_Stroke',
            },
          });
          refEdges.push({
            id: `edge_ref_prod_${idx}_${Date.now()}`,
            type: 'custom',
            source: fNodeId,
            target: modelNodeId,
            sourceHandle: `${fNodeId}-output-file`,
            targetHandle: `${modelNodeId}-input-${handleName}`,
            data: { sourceColor: 'Yambo_Blue', targetColor: 'Yambo_Purple', sourceHandleType: 'any', targetHandleType: 'image' },
          });
          nodeHandles.input[handleName] = { type: 'image', order: 1, required: isGptEdit };
          inputsList.push([{ id: handleName, title: handleName, description: 'Product Reference', validTypes: ['image'], required: isGptEdit }, { nodeId: fNodeId, outputId: 'file', file: assetObj }]);
          paramsObj[handleName] = assetObj;
          inputObj[handleName] = assetObj;
        }

        if (isGpt25) {
          targetModelName = 'gpt-image-2.5';
          targetDisplayName = 'GPT Image 2.5';
          targetDescription = 'Generates images with GPT Image 2.5';
          targetMenuDisplayName = 'GPT Image 2.5';
          modelCredits = 4;
          outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
          parametersList = [
            [{ id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } }, { type: 'value', data: { type: 'string', value: 'Flare' } }],
            [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }],
            [{ id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: 'auto' } }],
            [{ id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
            [{ id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } }, { type: 'value', data: { type: 'string', value: 'png' } }],
          ];
          paramsObj = { ...paramsObj, model: 'Flare', prompt: v.prompt, quality: 'high', background: 'auto', image_size: imageSize, output_format: 'png' };
        } else if (isSeedream) {
          targetModelName = 'fal-ai/bytedance/seedream/v5/lite/edit';
          targetDisplayName = 'Seedream V5.0 Pro Edit';
          targetDescription = 'Edit images with Seedream V5.0 Pro';
          targetMenuDisplayName = 'Seedream V5.0 Pro Edit';
          modelCredits = 12;
          outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
          parametersList = [
            [{ id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, defaultValue: { type: 'string', value: 'V5.0 Pro' } }, { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } }],
            [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
            [{ id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
            [{ id: 'enhance_prompt_mode', title: 'Enhance Prompt Mode', constraint: { type: 'enum', options: ['standard', 'fast'] }, defaultValue: { type: 'string', value: 'standard' } }, { type: 'value', data: { type: 'string', value: 'standard' } }],
          ];
          paramsObj = { ...paramsObj, model: 'V5.0 Pro', prompt: v.prompt, seed: randomSeed, image_size: imageSize, enhance_prompt_mode: 'standard' };
        } else if (isNanoBanana) {
          targetModelName = 'fal-ai/nano-banana-pro/edit';
          targetDisplayName = 'Nano Banana Pro';
          targetDescription = 'Edit images with Nano Banana Pro';
          targetMenuDisplayName = 'Nano Banana Pro';
          modelCredits = 11;
          const cleanRes = selectedRatio === '16:9' || selectedRatio === '1:1' ? '2K' : '1K';
          outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
          parametersList = [
            [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
            [{ id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, defaultValue: { type: 'string', value: '1K' } }, { type: 'value', data: { type: 'string', value: cleanRes } }],
            [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'] }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: selectedRatio || '9:16' } }],
            [{ id: 'enable_web_search', title: 'Enable Web Search', constraint: { type: 'boolean' }, defaultValue: { type: 'boolean', value: false } }, { type: 'value', data: { type: 'boolean', value: false } }],
          ];
          paramsObj = { ...paramsObj, prompt: v.prompt, seed: randomSeed, num_images: 1, resolution: cleanRes, aspect_ratio: selectedRatio || '9:16', output_format: 'png', enable_web_search: false };
        }

        const isFalImported = isSeedream || isNanoBanana || isGrok;
        const modelNode = {
          id: modelNodeId,
          type: 'custommodelV2',
          isModel: true,
          dragHandle: '.node-header',
          position: { x: 650, y: 200 },
          data: {
            name: targetDisplayName,
            description: targetDescription,
            ...(isGptEdit ? { color: 'Red' } : {}),
            menu: { icon: 'EmojiObjectsIcon', isModel: true, displayName: targetMenuDisplayName },
            model: { name: targetModelName, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) },
            ...(Object.keys(nodeSchema).length > 0 ? { schema: nodeSchema } : {}),
            kind: { type: 'wildcard', model: { type: 'predefined', name: targetModelName, description: targetDescription, ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}) }, inputs: inputsList, parameters: parametersList, outputs: outputSchema },
            params: paramsObj,
            input: inputObj,
            handles: nodeHandles,
            version: 3,
          },
        };

        const nodes = [promptNode, modelNode, ...refNodes];
        const edges = [
          { id: `edge_p_${Date.now()}_${idx}`, type: 'custom', source: promptNodeId, target: modelNodeId, sourceHandle: `${promptNodeId}-output-prompt`, targetHandle: `${modelNodeId}-input-prompt`, data: { sourceColor: 'Yambo_Green', targetColor: 'Yambo_Purple', sourceHandleType: 'text', targetHandleType: 'text' } },
          ...refEdges,
        ];
        const executePayload = { numberOfRuns: 1, nodes, edges, displayedCost: { credits: modelCredits, perSecondRate: 0, surface: 'drawer' } };
        let execHeaders = ctx.getWeavyClientHeaders(idToken, acc?.userId || acc?.id, recipeId);

        await ctx.callWeavyApi(`/api/v1/recipes/${recipeId}/save`, { method: 'POST', headers: execHeaders, body: JSON.stringify({ nodes, edges, files: assetObj ? [assetObj] : [], v3: true, lastUpdatedAt: new Date().toISOString() }) }).catch(() => {});

        let execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
        if (execRes.status === 403) {
          try {
            await ctx.approveWeavyModel(targetModelName, idToken, acc?.userId || acc?.id, recipeId);
            execRes = await ctx.callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, { method: 'POST', headers: execHeaders, body: JSON.stringify(executePayload) });
          } catch (_) {}
        }

        if (execRes.ok) {
          const execData = await execRes.json();
          const batchId = execData.batchId || execData.id;
          if (batchId) {
            const inputUrls = assetObj ? [assetObj.url, assetObj.downloadUrl, assetObj.thumbnailUrl].filter(Boolean) : [];
            // Launch polling concurrently in background and immediately move to the next variation!
            const pollPromise = pollSingleVariation(batchId, recipeId, execHeaders, cardNum, v, inputUrls);
            pollTasks.push(pollPromise);
          } else {
            if (statusText) statusText.textContent = '❌ Batch ID tidak ditemukan';
          }
        } else {
          if (statusText) statusText.textContent = `❌ Gagal kirim (HTTP ${execRes.status})`;
        }
      } catch (subErr) {
        console.warn(`[Product Variation ${idx + 1} Launch Warn]:`, subErr);
        if (statusText) statusText.textContent = `❌ Error: ${subErr.message?.slice(0, 30) || 'Gagal'}`;
      }
    }

    // Await all parallel polling promises to complete simultaneously
    if (pollTasks.length > 0) {
      await Promise.allSettled(pollTasks);
    }

    if (progressBar) progressBar.style.width = '100%';
    if (loadingText) loadingText.textContent = `${completedCount} Variasi Foto Produk Selesai Digenerate!`;
    if (loadingBox) loadingBox.classList.add('hidden');

    ctx.showAuthAlert?.(`🎉 ${completedCount} variasi foto produk selesai diproses! Silakan pilih foto terbaik.`, 'success');
    if (acc) ctx.fetchUserCreditsFromWeavy?.(acc).catch(() => {});
    return results;
  } catch (err) {
    console.error('[Product Variations Error]:', err);
    if (loadingBox) loadingBox.classList.add('hidden');
    if (errorAlert) {
      errorAlert.textContent = `❌ ${err.message || 'Gagal generate variasi produk'}`;
      errorAlert.classList.remove('hidden');
    }
    ctx.showAuthAlert?.(`Gagal: ${err.message || 'Gagal membuat variasi produk.'}`, 'error');
  } finally {
    if (btnGen) btnGen.disabled = false;
    if (btnLabel) btnLabel.textContent = `⚡ Generate ${count} Variasi Produk`;
  }
}

export function getCustomizedProductVariationPrompts(containerId = 'sbProdVarsPromptsList') {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const cards = container.querySelectorAll('.sb-prompt-card-item');
  if (!cards || cards.length === 0) return null;

  const results = [];
  cards.forEach((card, idx) => {
    const titleEl = card.querySelector('.sb-prompt-card-title');
    const descEl = card.querySelector('.text-muted');
    const textarea = card.querySelector('textarea');
    const title = titleEl ? titleEl.textContent.replace(/^✨\s*/, '').trim() : `Variasi ${idx + 1}`;
    const desc = descEl ? descEl.textContent.trim() : '';
    const prompt = textarea ? textarea.value.trim() : '';
    if (prompt) {
      results.push({
        index: idx + 1,
        title,
        desc,
        prompt,
      });
    }
  });

  return results.length > 0 ? results : null;
}

export function renderProductVariationPromptCards(prompts = [], containerId = 'sbProdVarsPromptsList') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!prompts || prompts.length === 0) {
    container.innerHTML = '<div class="text-xs text-muted">Belum ada prompt variasi yang disusun.</div>';
    return;
  }

  container.innerHTML = prompts.map((p, idx) => `
    <div class="sb-prompt-card-item">
      <div class="sb-prompt-card-header">
        <span class="sb-prompt-card-title">
          <span>✨ ${p.title}</span>
        </span>
        <button type="button" class="btn-xs btn-outline btn-copy-var-prompt" data-index="${idx + 1}" title="Salin Prompt Ini">
          📋 Salin
        </button>
      </div>
      <div class="text-xs text-muted mb-1">${p.desc}</div>
      <textarea id="sbProdVarPromptInput_${idx + 1}" rows="3" class="form-textarea text-xs font-mono w-full">${p.prompt}</textarea>
    </div>
  `).join('');
}

export function selectWinnerProductVariation(cardIndex, ctx = {}) {
  const card = document.getElementById(`prodvar_card_${cardIndex}`);
  if (!card) return;

  // Remove winner class from all cards
  const allCards = document.querySelectorAll('.sb-prodvar-card');
  allCards.forEach(c => {
    c.classList.remove('is-winner');
    const badge = c.querySelector('.sb-prodvar-winner-badge');
    if (badge) badge.remove();
  });

  // Add winner to selected card
  card.classList.add('is-winner');
  const badge = document.createElement('span');
  badge.className = 'sb-prodvar-winner-badge';
  badge.innerHTML = '👑 Pilihan Juara';
  card.appendChild(badge);

  ctx.showAuthAlert?.(`⭐ Variasi #${cardIndex} terpilih sebagai foto produk juara!`, 'info');
}

export function applyProductVariationToProduct(cardIndex, ctx = {}) {
  const img = document.getElementById(`prodvar_img_${cardIndex}`);
  if (!img || !img.src) {
    ctx.showAuthAlert?.('Gambar belum selesai digenerate.', 'warning');
    return;
  }

  const url = img.src;
  ctx.sbProductRefBase64 = url;
  ctx.sbProductWeavyAsset = { url, type: 'image', name: `product_variation_${cardIndex}.png` };

  const prodPreview = document.getElementById('sbProdImgPreview');
  const prodWrap = document.getElementById('sbProdPreviewBox');
  const prodEmpty = document.getElementById('sbProdEmpty');

  if (prodPreview) prodPreview.src = url;
  if (prodWrap) prodWrap.classList.remove('hidden');
  if (prodEmpty) prodEmpty.classList.add('hidden');

  ctx.showAuthAlert?.(`✅ Foto produk aktif berhasil diperbarui dengan Variasi #${cardIndex}!`, 'success');
}

export function applyProductVariationToBackground(cardIndex, ctx = {}) {
  const img = document.getElementById(`prodvar_img_${cardIndex}`);
  if (!img || !img.src) {
    ctx.showAuthAlert?.('Gambar belum selesai digenerate.', 'warning');
    return;
  }

  const url = img.src;
  ctx.sbBgRefBase64 = url;
  ctx.sbBgWeavyAsset = { url, type: 'image', name: `bg_variation_${cardIndex}.png` };

  const bgPreview = document.getElementById('sbBgImgPreview');
  const bgWrap = document.getElementById('sbBgPreviewBox');
  const bgEmpty = document.getElementById('sbBgEmpty');

  if (bgPreview) bgPreview.src = url;
  if (bgWrap) bgWrap.classList.remove('hidden');
  if (bgEmpty) bgEmpty.classList.add('hidden');

  ctx.showAuthAlert?.(`✅ Foto latar aktif berhasil diperbarui dengan Variasi #${cardIndex}!`, 'success');
}



