export function snapshotStoryboardAsset(base64Value, weavyAssetValue, role = 'custom') {
  if (weavyAssetValue && (weavyAssetValue.url || weavyAssetValue.id)) {
    return {
      base64: null,
      weavyAsset: weavyAssetValue,
      role: weavyAssetValue.role || role,
    };
  }

  if (base64Value) {
    return {
      base64: base64Value,
      weavyAsset: null,
      role,
    };
  }

  return {
    base64: null,
    weavyAsset: null,
    role,
  };
}

export function getStoryboardFormSnapshot({
  sbProductName = null,
  sbProductDesc = null,
  sbModelTalent = null,
  sbBgSetting = null,
  sbBriefInput = null,
  sbVideoUrlInput = null,
  sbTotalDuration = null,
  sbNumScenes = null,
  sbFormula = null,
  sbTiktokStyle = null,
  sbHookPattern = null,
  sbLockConsistency = null,
  sbImageModelSelect = null,
  sbAiModelSelect = null,
  currentAspect = '9:16',
  sbProductRefBase64 = null,
  sbProductWeavyAsset = null,
  sbModelRefBase64 = null,
  sbModelWeavyAsset = null,
  sbBgRefBase64 = null,
  sbBgWeavyAsset = null,
  sbCustomAssets = [],
} = {}) {
  return {
    productName: (sbProductName?.value || '').trim(),
    productDesc: (sbProductDesc?.value || '').trim(),
    modelTalent: (sbModelTalent?.value || '').trim(),
    bgSetting: (sbBgSetting?.value || '').trim(),
    brief: (sbBriefInput?.value || '').trim(),
    videoUrl: (sbVideoUrlInput?.value || '').trim(),
    duration: parseInt(sbTotalDuration?.value || '10', 10),
    numScenes: parseInt(sbNumScenes?.value || '4', 10),
    formula: sbFormula?.value || 'hook_extreme',
    tiktokStyle: sbTiktokStyle?.value || 'ugc_handheld',
    hookPattern: sbHookPattern?.value || 'auto_smart',
    lockConsistency: sbLockConsistency ? Boolean(sbLockConsistency.checked) : true,
    aspectRatio: currentAspect,
    imageModel: sbImageModelSelect?.value || 'GPT Image 2.5',
    aiModel: sbAiModelSelect?.value || 'google/gemini-2.5-flash',
    productAsset: snapshotStoryboardAsset(sbProductRefBase64, sbProductWeavyAsset, 'product'),
    modelAsset: snapshotStoryboardAsset(sbModelRefBase64, sbModelWeavyAsset, 'model'),
    bgAsset: snapshotStoryboardAsset(sbBgRefBase64, sbBgWeavyAsset, 'background'),
    customAssets: (sbCustomAssets || []).map((asset) => ({
      id: asset.id,
      name: asset.name || '',
      promptDesc: asset.promptDesc || '',
      base64: asset.weavyAsset ? null : (asset.base64 || null),
      weavyAsset: asset.weavyAsset || null,
      role: asset.role || 'custom',
      isUploading: !!asset.isUploading,
      showCheckmark: !!asset.showCheckmark,
    })),
  };
}

export function applyStoryboardReferencePreview(targetRefOrOptions = null, emptyStateEl = null, previewWrapEl = null, previewImgEl = null, value = null) {
  let targetRef, emptyEl, wrapEl, imgEl, val;
  if (targetRefOrOptions && typeof targetRefOrOptions === 'object' && ('previewImgEl' in targetRefOrOptions || 'emptyStateEl' in targetRefOrOptions || 'targetRef' in targetRefOrOptions || 'value' in targetRefOrOptions)) {
    targetRef = targetRefOrOptions.targetRef || null;
    emptyEl = targetRefOrOptions.emptyStateEl || null;
    wrapEl = targetRefOrOptions.previewWrapEl || null;
    imgEl = targetRefOrOptions.previewImgEl || null;
    val = targetRefOrOptions.value !== undefined ? targetRefOrOptions.value : targetRefOrOptions.targetRef;
  } else {
    targetRef = targetRefOrOptions;
    emptyEl = emptyStateEl;
    wrapEl = previewWrapEl;
    imgEl = previewImgEl;
    val = value;
  }

  const imageUrl = val?.weavyAsset?.url || val?.url || val?.thumbnailUrl || val?.src || (typeof val?.base64 === 'string' ? val.base64 : (typeof val === 'string' ? val : null));
  const hasValue = Boolean(imageUrl || val?.weavyAsset?.id || val?.base64);

  if (imgEl) {
    imgEl.src = imageUrl || '';
  }

  if (emptyEl) {
    emptyEl.classList.toggle('hidden', hasValue);
  }

  if (wrapEl) {
    wrapEl.classList.toggle('hidden', !hasValue);
  }

  if (targetRef && typeof targetRef === 'object') {
    targetRef.base64 = val?.base64 || (typeof val === 'string' && val.startsWith('data:') ? val : null);
    targetRef.weavyAsset = val?.weavyAsset || (imageUrl && !targetRef.base64 ? { url: imageUrl, type: 'image' } : null);
  }
}

export function restoreStoryboardFormState({
  project = null,
  currentAspect = '9:16',
  sbProductName = null,
  sbProductDesc = null,
  sbModelTalent = null,
  sbBgSetting = null,
  sbBriefInput = null,
  sbVideoUrlInput = null,
  btnClearUrl = null,
  sbTotalDuration = null,
  sbNumScenes = null,
  sbFormula = null,
  sbTiktokStyle = null,
  sbHookPattern = null,
  sbLockConsistency = null,
  sbImageModelSelect = null,
  sbAiModelSelect = null,
  sbProductEmptyState = null,
  sbProductPreviewWrap = null,
  sbProductImg = null,
  sbModelEmptyState = null,
  sbModelPreviewWrap = null,
  sbModelImg = null,
  sbBgEmptyState = null,
  sbBgPreviewWrap = null,
  sbBgImg = null,
  sbAspectBtns = [],
  sbCustomAssets = [],
} = {}) {
  const inputState = project?.inputState || project || {};

  if (sbProductName) sbProductName.value = inputState.productName || inputState.name || inputState.title || inputState.topic || '';
  if (sbProductDesc) sbProductDesc.value = inputState.productDesc || inputState.description || inputState.desc || '';
  if (sbModelTalent) sbModelTalent.value = inputState.modelTalent || inputState.talent || inputState.model || '';
  if (sbBgSetting) sbBgSetting.value = inputState.bgSetting || inputState.background || inputState.setting || '';
  if (sbBriefInput) sbBriefInput.value = inputState.brief || inputState.creativeBrief || inputState.concept || inputState.notes || '';
  if (sbVideoUrlInput) sbVideoUrlInput.value = inputState.videoUrl || '';
  if (btnClearUrl) btnClearUrl.classList.toggle('hidden', !(sbVideoUrlInput && sbVideoUrlInput.value.trim()));
  if (sbTotalDuration) sbTotalDuration.value = String(inputState.duration || inputState.totalDuration || 10);
  if (sbNumScenes) sbNumScenes.value = String(inputState.numScenes || (Array.isArray(project?.scenes) ? project.scenes.length : 4));
  if (sbFormula) sbFormula.value = inputState.formula || 'hook_extreme';
  if (sbTiktokStyle) sbTiktokStyle.value = inputState.tiktokStyle || 'ugc_handheld';
  if (sbHookPattern) sbHookPattern.value = inputState.hookPattern || 'auto_smart';
  if (sbLockConsistency) sbLockConsistency.checked = inputState.lockConsistency !== undefined ? Boolean(inputState.lockConsistency) : true;
  if (sbImageModelSelect) sbImageModelSelect.value = inputState.imageModel || sbImageModelSelect.value || 'GPT Image 2.5';
  if (sbAiModelSelect) sbAiModelSelect.value = inputState.aiModel || sbAiModelSelect.value || 'google/gemini-2.5-flash';

  const productRefBase64 = inputState.productAsset?.base64 || inputState.productRefBase64 || (typeof inputState.productAsset === 'string' && inputState.productAsset.startsWith('data:') ? inputState.productAsset : null);
  const productWeavyAsset = inputState.productAsset?.weavyAsset || inputState.productWeavyAsset || (inputState.productAsset?.url ? inputState.productAsset : null);
  const modelRefBase64 = inputState.modelAsset?.base64 || inputState.modelRefBase64 || (typeof inputState.modelAsset === 'string' && inputState.modelAsset.startsWith('data:') ? inputState.modelAsset : null);
  const modelWeavyAsset = inputState.modelAsset?.weavyAsset || inputState.modelWeavyAsset || (inputState.modelAsset?.url ? inputState.modelAsset : null);
  const bgRefBase64 = inputState.bgAsset?.base64 || inputState.bgRefBase64 || (typeof inputState.bgAsset === 'string' && inputState.bgAsset.startsWith('data:') ? inputState.bgAsset : null);
  const bgWeavyAsset = inputState.bgAsset?.weavyAsset || inputState.bgWeavyAsset || (inputState.bgAsset?.url ? inputState.bgAsset : null);
  const nextCustomAssets = Array.isArray(inputState.customAssets)
    ? inputState.customAssets.map((asset) => ({ ...asset }))
    : [];

  const nextAspect = inputState.aspectRatio || currentAspect || '9:16';

  sbAspectBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-aspect') === nextAspect);
  });

  applyStoryboardReferencePreview({
    targetRef: { base64: productRefBase64, weavyAsset: productWeavyAsset },
    emptyStateEl: sbProductEmptyState,
    previewWrapEl: sbProductPreviewWrap,
    previewImgEl: sbProductImg,
    value: { base64: productRefBase64, weavyAsset: productWeavyAsset },
  });

  applyStoryboardReferencePreview({
    targetRef: { base64: modelRefBase64, weavyAsset: modelWeavyAsset },
    emptyStateEl: sbModelEmptyState,
    previewWrapEl: sbModelPreviewWrap,
    previewImgEl: sbModelImg,
    value: { base64: modelRefBase64, weavyAsset: modelWeavyAsset },
  });

  applyStoryboardReferencePreview({
    targetRef: { base64: bgRefBase64, weavyAsset: bgWeavyAsset },
    emptyStateEl: sbBgEmptyState,
    previewWrapEl: sbBgPreviewWrap,
    previewImgEl: sbBgImg,
    value: { base64: bgRefBase64, weavyAsset: bgWeavyAsset },
  });

  return {
    currentAspect: nextAspect,
    productRefBase64,
    productWeavyAsset,
    modelRefBase64,
    modelWeavyAsset,
    bgRefBase64,
    bgWeavyAsset,
    customAssets: nextCustomAssets,
  };
}

export function resetStoryboardWorkspaceState({
  sbProductName = null,
  sbProductDesc = null,
  sbModelTalent = null,
  sbBgSetting = null,
  sbBriefInput = null,
  sbVideoUrlInput = null,
  btnClearUrl = null,
  sbTotalDuration = null,
  sbNumScenes = null,
  sbFormula = null,
  sbTiktokStyle = null,
  sbHookPattern = null,
  sbLockConsistency = null,
  sbImageModelSelect = null,
  sbAiModelSelect = null,
  sbProductEmptyState = null,
  sbProductPreviewWrap = null,
  sbProductImg = null,
  sbModelEmptyState = null,
  sbModelPreviewWrap = null,
  sbModelImg = null,
  sbBgEmptyState = null,
  sbBgPreviewWrap = null,
  sbBgImg = null,
  sbAspectBtns = [],
  sbDynamicSceneInfo = null,
  defaultAspect = '9:16',
} = {}) {
  if (sbProductName) sbProductName.value = '';
  if (sbProductDesc) sbProductDesc.value = '';
  if (sbModelTalent) sbModelTalent.value = '';
  if (sbBgSetting) sbBgSetting.value = '';
  if (sbBriefInput) sbBriefInput.value = '';
  if (sbVideoUrlInput) sbVideoUrlInput.value = '';
  if (btnClearUrl) btnClearUrl.classList.add('hidden');
  if (sbTotalDuration) sbTotalDuration.value = '10';
  if (sbNumScenes) sbNumScenes.value = '4';
  if (sbFormula) sbFormula.value = 'hook_extreme';
  if (sbTiktokStyle) sbTiktokStyle.value = 'ugc_handheld';
  if (sbHookPattern) sbHookPattern.value = 'auto_smart';
  if (sbLockConsistency) sbLockConsistency.checked = true;

  sbAspectBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-aspect') === defaultAspect);
  });

  applyStoryboardReferencePreview({
    emptyStateEl: sbProductEmptyState,
    previewWrapEl: sbProductPreviewWrap,
    previewImgEl: sbProductImg,
    value: null,
  });

  applyStoryboardReferencePreview({
    emptyStateEl: sbModelEmptyState,
    previewWrapEl: sbModelPreviewWrap,
    previewImgEl: sbModelImg,
    value: null,
  });

  applyStoryboardReferencePreview({
    emptyStateEl: sbBgEmptyState,
    previewWrapEl: sbBgPreviewWrap,
    previewImgEl: sbBgImg,
    value: null,
  });

  updateDynamicSceneText({
    sbDynamicSceneInfo,
    sbTotalDuration,
    sbNumScenes,
    sbFormula,
  });

  return {
    currentAspect: defaultAspect,
    productRefBase64: null,
    productWeavyAsset: null,
    modelRefBase64: null,
    modelWeavyAsset: null,
    bgRefBase64: null,
    bgWeavyAsset: null,
    customAssets: [],
  };
}

export function getStoryboardFormulaLabelMap() {
  return {
    none: '— None (Bebas AI)',
    hook_extreme: '🔥 Hook Extreme',
    humor_parody: '😂 Humor & Parodi',
    deep_emotional: '🌟 Deep Emotional',
    fast_ugc: '⚡ Fast Cuts UGC',
    hard_sell: '🛍️ Hard Sell',
    faceless_garden_ugc: '🌱 Faceless Garden UGC',
    harvest_pov_taste: '🌾 POV Harvest & Taste',
  };
}

export function updateDynamicSceneText({
  sbDynamicSceneInfo = null,
  sbTotalDuration = null,
  sbNumScenes = null,
  sbFormula = null,
} = {}) {
  if (!sbDynamicSceneInfo) return;
  const dur = sbTotalDuration?.value || '10';
  const scenes = sbNumScenes?.value || '4';
  const formula = sbFormula?.value || 'hook_extreme';
  const formulaName = getStoryboardFormulaLabelMap()[formula] || formula;
  sbDynamicSceneInfo.textContent = `${formulaName} • ${scenes} scene • ${dur} detik`;
}

export function getStoryboardCopilotContext({
  currentSbProject = null,
  activeSbScene = null,
  sbProductName = null,
  sbProductDesc = null,
  sbModelTalent = null,
  sbBgSetting = null,
  sbBriefInput = null,
  sbTotalDuration = null,
  sbNumScenes = null,
  sbFormula = null,
  currentAspect = '9:16',
  sbCustomAssets = [],
  sbCompositeResultUrl = null,
  sbProductWeavyAsset = null,
  sbProductRefBase64 = null,
  sbModelWeavyAsset = null,
  sbModelRefBase64 = null,
  sbBgWeavyAsset = null,
  sbBgRefBase64 = null,
} = {}) {
  const visualReferences = getStoryboardCopilotImages({
    activeSbScene,
    sbCustomAssets,
    sbCompositeResultUrl,
    sbProductWeavyAsset,
    sbProductRefBase64,
    sbModelWeavyAsset,
    sbModelRefBase64,
    sbBgWeavyAsset,
    sbBgRefBase64,
    currentSbProject,
  });

  return {
    project: currentSbProject ? {
      name: currentSbProject.name,
      duration: currentSbProject.duration,
      aspectRatio: currentSbProject.aspectRatio,
      analysis: currentSbProject.analysis,
      metadata: currentSbProject.metadata,
    } : null,
    form: {
      productName: sbProductName?.value || '',
      productDesc: sbProductDesc?.value || '',
      modelTalent: sbModelTalent?.value || '',
      bgSetting: sbBgSetting?.value || '',
      brief: sbBriefInput?.value || '',
      duration: sbTotalDuration?.value || '',
      numScenes: sbNumScenes?.value || '',
      formula: sbFormula?.value || '',
      aspectRatio: currentAspect,
    },
    scene: activeSbScene,
    scenes: currentSbProject?.scenes || [],
    visualReferences: visualReferences.map((image) => ({
      name: image.name,
      label: image.label,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl || image.url,
    })),
  };
}

export function getStoryboardCopilotImages({
  activeSbScene = null,
  sbCustomAssets = [],
  sbCompositeResultUrl = null,
  sbProductWeavyAsset = null,
  sbProductRefBase64 = null,
  sbModelWeavyAsset = null,
  sbModelRefBase64 = null,
  sbBgWeavyAsset = null,
  sbBgRefBase64 = null,
  currentSbProject = null,
} = {}) {
  const images = [];
  const seenUrls = new Set();

  const addImage = (source, name, label, fallbackSource = null) => {
    if (!source) return;
    const asset = source.weavyAsset || source.asset || source;
    const url = asset?.url || asset?.downloadUrl || asset?.thumbnailUrl || source.url || source.base64 || fallbackSource?.url || fallbackSource?.base64;
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    images.push({
      ...asset,
      type: 'image',
      url,
      thumbnailUrl: asset?.thumbnailUrl || url,
      name: asset?.name || name,
      label,
    });
  };

  if (activeSbScene?.imageUrl) {
    addImage({ url: activeSbScene.imageUrl }, `Scene ${activeSbScene.sceneNumber}`, `Scene ${activeSbScene.sceneNumber}`);
  }

  addImage(sbProductWeavyAsset || (sbProductRefBase64 ? { base64: sbProductRefBase64 } : null), 'Foto Produk', 'Produk', { base64: sbProductRefBase64 });
  addImage(sbModelWeavyAsset || (sbModelRefBase64 ? { base64: sbModelRefBase64 } : null), 'Foto Model', 'Model', { base64: sbModelRefBase64 });
  addImage(sbBgWeavyAsset || (sbBgRefBase64 ? { base64: sbBgRefBase64 } : null), 'Foto Background', 'Background', { base64: sbBgRefBase64 });

  sbCustomAssets.forEach((asset, index) => {
    addImage(asset.weavyAsset || (asset.base64 ? { base64: asset.base64 } : null), asset.name || `Asset ${index + 1}`, `Asset ${index + 1}`);
  });

  (currentSbProject?.scenes || []).forEach((scene) => {
    if (scene?.imageUrl) {
      addImage({ url: scene.imageUrl }, `Scene ${scene.sceneNumber}`, `Scene ${scene.sceneNumber}`);
    }
  });

  if (sbCompositeResultUrl) {
    addImage({ url: sbCompositeResultUrl }, '1-Sheet Grid', '1-Sheet');
  } else if (currentSbProject?.compositeGridUrl) {
    addImage({ url: currentSbProject.compositeGridUrl }, '1-Sheet Grid', '1-Sheet');
  }

  return images.slice(0, 5);
}

export function recommendStoryboardImageModel({ scene = null, collectStoryboardRefImages = () => [] } = {}) {
  const text = [scene?.title, scene?.visualDescription, scene?.imagePrompt].filter(Boolean).join(' ').toLowerCase();
  const referenceCount = collectStoryboardRefImages().length;
  if (referenceCount >= 2 || /fashion|model|talent|outfit|clothing|wajah|produk/.test(text)) {
    return 'seedream_v5_pro_edit';
  }
  if (/edit|pose|kamera|camera|background|ubah|replace/.test(text)) {
    return 'nano_banana_pro';
  }
  return 'gpt_image_2_5';
}

export function getStoryboardImageModel(modelId, modelCatalog = []) {
  if (!Array.isArray(modelCatalog) || !modelCatalog.length) return null;
  return modelCatalog.find((model) => (
    model.id === modelId || model.value === modelId || model.name === modelId
  )) || modelCatalog[0];
}
