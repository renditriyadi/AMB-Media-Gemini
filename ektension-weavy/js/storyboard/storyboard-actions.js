import { sanitizeSceneImagePrompt } from './storyboard-generation.js';

export function bindSceneCardInteractions({
  sbScenesGrid = null,
  currentSbProject = null,
  showCopyTooltip = null,
  showAuthAlert = null,
  generateSingleSceneVisual = null,
  downloadMediaBlob = null,
  openMediaLightbox = null,
  handleSaveSbProject = null,
  navigatorRef = navigator,
}) {
  if (!sbScenesGrid) return;

  // 1. Inline Prompt Editing Toggle & Sync
  sbScenesGrid.querySelectorAll('.btn-edit-prompt:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const box = document.getElementById(`prompt_box_${id}`);
      const textarea = document.getElementById(`prompt_edit_${id}`);
      if (!textarea) return;

      const isEditing = !textarea.classList.contains('hidden');
      if (isEditing) {
        textarea.classList.add('hidden');
        if (box) box.classList.remove('hidden');
        btn.textContent = '✏️ Edit';
        if (typeof handleSaveSbProject === 'function') {
          handleSaveSbProject(false);
        }
        showAuthAlert?.('Prompt adegan berhasil disimpan!', 'success');
      } else {
        textarea.classList.remove('hidden');
        if (box) box.classList.add('hidden');
        textarea.focus();
        btn.textContent = '💾 Simpan';
      }
    });
  });

  sbScenesGrid.querySelectorAll('.sb-prompt-edit-textarea:not([data-bound])').forEach((ta) => {
    ta.setAttribute('data-bound', 'true');
    ta.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const val = e.target.value;
      const sc = currentSbProject?.scenes?.find((s) => String(s.id) === String(id));
      if (sc) sc.imagePrompt = val;

      const box = document.getElementById(`prompt_box_${id}`);
      if (box) box.textContent = val;

      const card = document.getElementById(`card_${id}`);
      const copyPromptBtn = card?.querySelector('.btn-copy-prompt');
      if (copyPromptBtn) copyPromptBtn.setAttribute('data-text', val);
    });
  });

  // 2. Lightbox Zoom on Generated Scene Visual
  sbScenesGrid.querySelectorAll('.sb-scene-img:not([data-bound])').forEach((img) => {
    img.setAttribute('data-bound', 'true');
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = img.getAttribute('src');
      if (!url) return;
      const card = img.closest('.sb-scene-card');
      const sceneNum = card?.querySelector('.sb-scene-num')?.textContent || 'Scene Visual';
      if (typeof openMediaLightbox === 'function') {
        openMediaLightbox(url, 'image', `${sceneNum} - Pratinjau Resolusi Tinggi`);
      } else {
        window.open(url, '_blank');
      }
    });
  });

  // 3. Bulletproof Scene Image Download
  sbScenesGrid.querySelectorAll('.btn-download-scene:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = btn.getAttribute('data-url');
      const filename = btn.getAttribute('data-filename') || 'scene_visual.png';
      if (!url) return;

      if (typeof downloadMediaBlob === 'function') {
        await downloadMediaBlob(url, filename);
      } else if (typeof chrome !== 'undefined' && chrome?.downloads?.download) {
        chrome.downloads.download({ url, filename, saveAs: false });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  });

  sbScenesGrid.querySelectorAll('.sc-img-prompt:not([data-bound])').forEach((ta) => {
    ta.setAttribute('data-bound', 'true');
    ta.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const sc = currentSbProject?.scenes?.find((s) => s.id === id);
      if (sc) sc.imagePrompt = e.target.value;
    });
  });

  sbScenesGrid.querySelectorAll('.sc-vid-prompt:not([data-bound])').forEach((ta) => {
    ta.setAttribute('data-bound', 'true');
    ta.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const sc = currentSbProject?.scenes?.find((s) => s.id === id);
      if (sc) sc.videoPrompt = e.target.value;
    });
  });

  sbScenesGrid.querySelectorAll('.sb-prompt-box:not([data-bound])').forEach((box) => {
    box.setAttribute('data-bound', 'true');
    box.addEventListener('click', () => {
      box.classList.toggle('expanded');
    });
  });

  sbScenesGrid.querySelectorAll('.btn-copy-vo:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', (e) => {
      navigatorRef.clipboard.writeText(e.currentTarget.getAttribute('data-text') || '');
      showCopyTooltip?.(e.currentTarget);
    });
  });

  sbScenesGrid.querySelectorAll('.btn-copy-ost:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', (e) => {
      navigatorRef.clipboard.writeText(e.currentTarget.getAttribute('data-text') || '');
      showCopyTooltip?.(e.currentTarget);
    });
  });

  sbScenesGrid.querySelectorAll('.btn-copy-prompt:not([data-bound]), .btn-copy-motion:not([data-bound]), .btn-copy-video-prompt:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', (e) => {
      navigatorRef.clipboard.writeText(e.currentTarget.getAttribute('data-text') || '');
      showCopyTooltip?.(e.currentTarget);
    });
  });

  sbScenesGrid.querySelectorAll('.btn-copy-full-scene:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const sc = currentSbProject?.scenes?.find((s) => s.id === id);
      if (!sc) return;

      const cleanImgPrompt = sanitizeSceneImagePrompt(sc.imagePrompt || '', sc, currentSbProject);
      if (cleanImgPrompt && cleanImgPrompt !== sc.imagePrompt) {
        sc.imagePrompt = cleanImgPrompt;
        const card = document.getElementById(`card_${sc.id}`);
        const promptBox = card?.querySelector('.sb-prompt-box');
        if (promptBox) promptBox.textContent = cleanImgPrompt;
        const copyPromptBtn = card?.querySelector('.btn-copy-prompt');
        if (copyPromptBtn) copyPromptBtn.setAttribute('data-text', cleanImgPrompt);
      }

      let text = `🎬 Scene ${sc.sceneNumber || 1}: ${sc.title || `Adegan ${sc.sceneNumber || 1}`}\n`;
      const metaParts = [];
      if (sc.duration || sc.durationSec) metaParts.push(`⏱️ Durasi: ${sc.duration || `${sc.durationSec}s`}`);
      else if (sc.timecode) metaParts.push(`⏱️ ${sc.timecode}`);
      if (sc.cameraAngle || sc.cameraMovement) metaParts.push(`🎥 Shot/Angle: ${sc.cameraAngle || sc.cameraMovement}`);
      if (sc.lighting) metaParts.push(`💡 Lighting: ${sc.lighting}`);
      if (metaParts.length > 0) text += `${metaParts.join(' | ')}\n`;
      if (sc.visualDescription) text += `🖼️ Visual: ${sc.visualDescription}\n`;

      if (Array.isArray(sc.shoots) && sc.shoots.length > 0) {
        text += `🎬 Sub-Shots (${sc.shoots.length} Shoot):\n`;
        sc.shoots.forEach((sh, sIdx) => {
          const sTime = (sh.start !== undefined && sh.end !== undefined) ? `${sh.start}–${sh.end}s` : `${sIdx * 3}–${(sIdx + 1) * 3}s`;
          text += `  • Shoot ${sh.shootNumber || (sIdx + 1)} (${sTime}): ${sh.visualDescription || ''}\n`;
          if (sh.voiceover) text += `    🎙️ "${sh.voiceover}"\n`;
        });
      }

      if (sc.videoPrompt) text += `🎬 Motion: ${sc.videoPrompt}\n`;
      if (sc.voiceover) text += `🎙️ VO: "${sc.voiceover}"\n`;
      if (sc.voInstruction) text += `🎙️ Instruksi Voice Over: ${sc.voInstruction}\n`;
      if (sc.videoInstruction) text += `🚫 Instruksi Video: ${sc.videoInstruction}\n`;
      if (sc.onScreenText) text += `💬 Teks Layar: ${sc.onScreenText}\n`;
      if (sc.imagePrompt) text += `🖼️ Prompt Gambar: ${sc.imagePrompt}\n`;
      text = text.trim();

      navigatorRef.clipboard.writeText(text);

      const orig = btn.innerHTML;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success, #5ec98f)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span style="color:var(--success, #5ec98f);">Tersalin!</span>`;
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.disabled = false;
      }, 2000);

      showAuthAlert?.(`Naskah Scene ${sc.sceneNumber} berhasil disalin!`, 'success');
    });
  });

const inFlightSceneClicks = new Set();

  sbScenesGrid.querySelectorAll('.btn-gen-single-scene:not([data-bound]), .btn-re-render:not([data-bound])').forEach((btn) => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      if (!id || btn.disabled || inFlightSceneClicks.has(id)) return;

      inFlightSceneClicks.add(id);

      // Lock all render buttons on this specific scene card simultaneously
      const card = document.getElementById(`card_${id}`);
      const relatedBtns = card ? Array.from(card.querySelectorAll('.btn-gen-single-scene, .btn-re-render')) : [btn];
      const origStates = relatedBtns.map((b) => ({ btn: b, disabled: b.disabled, html: b.innerHTML }));

      relatedBtns.forEach((b) => {
        b.disabled = true;
        if (b.classList.contains('btn-gen-single-scene')) {
          b.innerHTML = '⏳ Menyiapkan...';
        }
      });

      try {
        if (typeof generateSingleSceneVisual === 'function') {
          await generateSingleSceneVisual(id);
        }
      } catch (err) {
        console.warn(`[Scene ${id} Click Error]:`, err);
        origStates.forEach(({ btn: b, html }) => {
          b.disabled = false;
          b.innerHTML = html;
        });
      } finally {
        setTimeout(() => {
          inFlightSceneClicks.delete(id);
        }, 300);
      }
    });
  });
}

export function updateCompletedBadgeUi({ sbCompletedBadge = null, currentSbProject = null }) {
  if (!sbCompletedBadge || !currentSbProject || !currentSbProject.scenes) return;
  const completedCount = currentSbProject.scenes.filter((s) => s.status === 'completed' && s.imageUrl).length;
  sbCompletedBadge.textContent = `${completedCount} / ${currentSbProject.scenes.length} Selesai`;
}
