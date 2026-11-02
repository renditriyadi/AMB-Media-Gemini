export function makeStoryboardRevisionSnapshot(project, label = 'save') {
  if (!project) return null;
  return {
    label,
    savedAt: new Date().toISOString(),
    name: project.name || 'Storyboard Baru',
    duration: Number(project.duration || 0),
    aspectRatio: project.aspectRatio || '9:16',
    scenes: JSON.parse(JSON.stringify(Array.isArray(project.scenes) ? project.scenes : [])),
  };
}

export function pushStoryboardRevision(project, label = 'save') {
  if (!project) return;
  const snapshot = makeStoryboardRevisionSnapshot(project, label);
  if (!snapshot) return;
  const history = Array.isArray(project.revisionHistory) ? project.revisionHistory : [];
  const signature = JSON.stringify(snapshot);
  const isDuplicate = history.some((entry) => JSON.stringify(entry.snapshot || entry) === signature);
  if (isDuplicate) return;
  history.unshift({ label, savedAt: snapshot.savedAt, snapshot });
  project.revisionHistory = history.slice(0, 12);
}

export function stripPersistedImageData(value) {
  if (!value || typeof value !== 'object') return value;
  const cleanAsset = (asset) => {
    if (!asset || typeof asset !== 'object') return asset;
    return {
      ...asset,
      base64: null,
      weavyAsset: asset.weavyAsset ? { ...asset.weavyAsset, base64: null } : null,
    };
  };

  const safeProject = { ...value };
  if (safeProject.inputState) {
    safeProject.inputState = {
      ...safeProject.inputState,
      productAsset: cleanAsset(safeProject.inputState.productAsset),
      modelAsset: cleanAsset(safeProject.inputState.modelAsset),
      bgAsset: cleanAsset(safeProject.inputState.bgAsset),
      customAssets: (safeProject.inputState.customAssets || []).map(cleanAsset),
    };
  }
  safeProject.revisionHistory = (safeProject.revisionHistory || []).map((entry) => ({
    ...entry,
    snapshot: entry.snapshot ? stripPersistedImageData(entry.snapshot) : entry.snapshot,
  }));
  return safeProject;
}

export async function restoreStoryboardRevision(ctx = {}, index) {
  if (!ctx.currentSbProject || !Array.isArray(ctx.currentSbProject.revisionHistory) || !ctx.currentSbProject.revisionHistory[index]) return false;
  const revision = ctx.currentSbProject.revisionHistory[index];
  const snapshot = revision.snapshot || revision;
  if (!snapshot || !Array.isArray(snapshot.scenes)) return false;

  ctx.currentSbProject.name = snapshot.name || ctx.currentSbProject.name || 'Storyboard Baru';
  ctx.currentSbProject.duration = Number(snapshot.duration || ctx.currentSbProject.duration || 0);
  ctx.currentSbProject.aspectRatio = snapshot.aspectRatio || ctx.currentSbProject.aspectRatio || '9:16';
  ctx.currentSbProject.scenes = JSON.parse(JSON.stringify(snapshot.scenes));
  ctx.currentSbProject.updatedAt = new Date().toISOString();

  ctx.renderStoryboardProject(ctx.currentSbProject);
  await ctx.handleSaveSbProject(false);
  ctx.showAuthAlert(`Versi revisi "${revision.label || 'revisi'}" berhasil dipulihkan.`, 'success');
  return true;
}

export async function handleSaveSbProject(ctx = {}, showToast = true) {
  if (!ctx.currentSbProject) return;
  ctx.currentSbProject.inputState = ctx.getStoryboardFormSnapshot();
  if (ctx.sbCompositeResultUrl) ctx.currentSbProject.compositeGridUrl = ctx.sbCompositeResultUrl;
  pushStoryboardRevision(ctx.currentSbProject, 'save');
  const existingIndex = ctx.savedSbProjects.findIndex((p) => p.id === ctx.currentSbProject.id);
  if (existingIndex >= 0) {
    ctx.savedSbProjects[existingIndex] = ctx.currentSbProject;
  } else {
    ctx.savedSbProjects.unshift(ctx.currentSbProject);
  }
  const persistedProjects = ctx.savedSbProjects.map(stripPersistedImageData);
  await ctx.storage.set('weavy_storyboards', persistedProjects);
  ctx.renderSavedStoryboards();
  ctx.renderLibrary();
  if (showToast) {
    ctx.showAuthAlert(`Proyek "${ctx.currentSbProject.name}" berhasil disimpan!`, 'success');
  }
}

export async function loadSavedStoryboards(ctx = {}) {
  ctx.savedSbProjects = (await ctx.storage.get('weavy_storyboards')) || [];
  ctx.renderSavedStoryboards();
}

export function renderSavedStoryboards(ctx = {}) {
  ctx.renderSavedStoryboardsUi({
    sbSavedProjectsContainer: ctx.sbSavedProjectsContainer,
    savedSbProjects: ctx.savedSbProjects,
    escapeHtml: ctx.escapeHtml,
    onLoad: async (id) => {
      const proj = ctx.savedSbProjects.find((p) => p.id === id);
      if (proj) {
        ctx.currentSbProject = proj;
        ctx.sbCompositeResultUrl = proj.compositeGridUrl || null;
        ctx.activeSbScene = null;
        ctx.restoreStoryboardFormState(proj);
        ctx.renderStoryboardProject(proj);
        if (ctx.sbOutputSection) {
          ctx.sbOutputSection.classList.remove('hidden');
          ctx.sbOutputSection.style.removeProperty('display');
        }
        if (typeof ctx.persistCurrentStoryboardSelection === 'function') {
          await ctx.persistCurrentStoryboardSelection();
        } else {
          await ctx.storage.set('weavy_current_storyboard_id', proj.id);
        }
        ctx.sbOutputSection?.scrollIntoView({ behavior: 'smooth' });
        ctx.showAuthAlert(`Proyek "${proj.name}" dimuat.`, 'info');
      }
    },
    onDelete: async (id) => {
      const project = ctx.savedSbProjects.find((item) => item.id === id);
      if (typeof ctx.confirmDelete === 'function' && !(await ctx.confirmDelete(project?.name || 'Storyboard ini'))) return;
      const wasActive = ctx.currentSbProject?.id === id;
      ctx.savedSbProjects = ctx.savedSbProjects.filter((p) => p.id !== id);
      ctx.setSavedSbProjects?.(ctx.savedSbProjects);
      await ctx.storage.set('weavy_storyboards', ctx.savedSbProjects.map(stripPersistedImageData));
      if (wasActive) {
        ctx.currentSbProject = null;
        ctx.sbCompositeResultUrl = null;
        ctx.setCurrentSbProject?.(null);
        ctx.sbOutputSection?.classList.add('hidden');
        if (ctx.sbScenesGrid) ctx.sbScenesGrid.innerHTML = '';
        await ctx.storage.set('weavy_current_storyboard_id', null);
      }
      ctx.renderSavedStoryboards();
    },
  });
}

export async function handleClearSbHistory(ctx = {}) {
  if (typeof ctx.confirmClear === 'function' && !(await ctx.confirmClear('semua storyboard tersimpan'))) return;
  ctx.savedSbProjects = [];
  ctx.setSavedSbProjects?.([]);
  ctx.currentSbProject = null;
  ctx.sbCompositeResultUrl = null;
  ctx.setCurrentSbProject?.(null);
  ctx.sbOutputSection?.classList.add('hidden');
  if (ctx.sbScenesGrid) ctx.sbScenesGrid.innerHTML = '';
  await ctx.storage.set('weavy_storyboards', []);
  await ctx.storage.set('weavy_current_storyboard_id', null);
  ctx.renderSavedStoryboards();
  ctx.showAuthAlert('Seluruh proyek storyboard berhasil dihapus.', 'info');
}
