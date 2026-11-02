// canvas-render.js - HTML Node Card Renderers for Visual Canvas (100% Pola Project Utama)

import { CANVAS_NODE_THEMES, WEAVY_IMAGE_MODELS, getNodeWidth } from './canvas-types.js';
import { escapeHtml } from '../core/utils.js';

export function renderNodeCardHtml(node, isSelected = false) {
  const theme = CANVAS_NODE_THEMES[node.colorTheme || 'blue'] || CANVAS_NODE_THEMES.blue;
  const width = getNodeWidth(node.type);
  const isExecuting = node.isExecuting;
  const progress = node.progress || 0;

  // Render Ports
  const inputsHtml = (node.inputs || [])
    .map(
      (port) => `
      <div class="canvas-port canvas-port-input" data-port-id="${port.id}" data-port-type="${port.type}" title="${escapeHtml(port.label || port.name)}">
        <span class="port-handle port-handle-input"></span>
        <span class="port-label">${escapeHtml(port.label || port.name)}</span>
      </div>
    `
    )
    .join('');

  const outputsHtml = (node.outputs || [])
    .map(
      (port) => `
      <div class="canvas-port canvas-port-output" data-port-id="${port.id}" data-port-type="${port.type}" title="${escapeHtml(port.label || port.name)}">
        <span class="port-label">${escapeHtml(port.label || port.name)}</span>
        <span class="port-handle port-handle-output"></span>
      </div>
    `
    )
    .join('');

  // Render Body based on type
  let bodyContent = '';

  if (node.type === 'prompt') {
    const promptText = node.data?.prompt || '';
    const style = node.data?.presetStyle || 'General';
    bodyContent = `
      <div class="node-field">
        <label class="node-field-label">Positive Prompt</label>
        <textarea class="node-textarea node-prompt-input" rows="3" placeholder="Deskripsikan visual yang ingin dibuat...">${escapeHtml(promptText)}</textarea>
      </div>
      <div class="node-meta-row">
        <span class="node-pill-badge">${escapeHtml(style)}</span>
      </div>
    `;
  } else if (node.type === 'imageInput') {
    const imgUrl = node.data?.imageUrl || '';
    bodyContent = `
      <div class="node-image-dropzone ${imgUrl ? 'has-image' : ''}">
        ${
          imgUrl
            ? `<img src="${imgUrl}" class="node-preview-img" alt="Ref Image" />`
            : `<div class="node-dropzone-placeholder">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Upload Foto Referensi</span>
               </div>`
        }
        <input type="file" class="node-file-input hidden" accept="image/*" />
      </div>
    `;
  } else if (node.type === 'imageModel') {
    const modelId = node.data?.modelId || 'fal-ai/nano-banana-pro/edit';
    const aspect = node.data?.aspectRatio || '1:1';
    const resolution = node.data?.resolution || '1K';
    const credits = node.data?.creditsCost || 11;
    const modelOptions = WEAVY_IMAGE_MODELS.map(
      (m) => `<option value="${m.id}" ${m.id === modelId ? 'selected' : ''}>${escapeHtml(m.name)} (${m.credits} Koin)</option>`
    ).join('');

    bodyContent = `
      <div class="node-field">
        <label class="node-field-label">Pilih Model AI</label>
        <select class="node-select node-model-select">
          ${modelOptions}
        </select>
      </div>
      <div class="node-params-grid">
        <div class="node-field">
          <label class="node-field-label">Aspect Ratio</label>
          <select class="node-select node-aspect-select">
            <option value="1:1" ${aspect === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
            <option value="16:9" ${aspect === '16:9' ? 'selected' : ''}>16:9 (Landscape)</option>
            <option value="9:16" ${aspect === '9:16' ? 'selected' : ''}>9:16 (Vertical)</option>
            <option value="4:3" ${aspect === '4:3' ? 'selected' : ''}>4:3 (Photo)</option>
            <option value="3:4" ${aspect === '3:4' ? 'selected' : ''}>3:4 (Portrait)</option>
          </select>
        </div>
        <div class="node-field">
          <label class="node-field-label">Resolusi</label>
          <select class="node-select node-res-select">
            <option value="1K" ${resolution === '1K' ? 'selected' : ''}>1K (Standard)</option>
            <option value="2K" ${resolution === '2K' ? 'selected' : ''}>2K (High Detail)</option>
            <option value="4K" ${resolution === '4K' ? 'selected' : ''}>4K (Ultra)</option>
            <option value="720p" ${resolution === '720p' ? 'selected' : ''}>720p HD</option>
            <option value="1080p" ${resolution === '1080p' ? 'selected' : ''}>1080p FHD</option>
          </select>
        </div>
      </div>
      <div class="node-action-row">
        <button type="button" class="btn-xs btn-primary btn-run-single-node" title="Jalankan model ini">
          <span>⚡ Jalankan Model</span>
        </button>
      </div>
    `;
  } else if (node.type === 'imageViewer') {
    const resultUrl = node.data?.resultUrl || node.data?.outputImage || '';
    const isVid = resultUrl.includes('.mp4') || resultUrl.includes('video');
    bodyContent = `
      <div class="node-viewer-container ${resultUrl ? 'has-media' : ''}">
        ${
          resultUrl
            ? isVid
              ? `<video src="${resultUrl}" controls class="node-result-video"></video>`
              : `<img src="${resultUrl}" class="node-result-img" alt="Generated Result" />`
            : `<div class="node-viewer-empty">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span>Menunggu eksekusi...</span>
               </div>`
        }
      </div>
      ${
        resultUrl
          ? `<div class="node-viewer-footer">
              <a href="${resultUrl}" download="canvas_render_${Date.now()}.${isVid ? 'mp4' : 'jpg'}" class="btn-xs btn-outline" target="_blank">📥 Unduh</a>
              <button type="button" class="btn-xs btn-ghost btn-lightbox-viewer">🔍 Zoom</button>
             </div>`
          : ''
      }
    `;
  } else if (node.type === 'promptEnhancer') {
    const sys = node.data?.systemPrompt || '';
    bodyContent = `
      <div class="node-field">
        <label class="node-field-label">System Prompt Enhancer</label>
        <textarea class="node-textarea node-sys-prompt" rows="3">${escapeHtml(sys)}</textarea>
      </div>
      <div class="node-action-row">
        <button type="button" class="btn-xs btn-primary btn-enhance-prompt">✨ Kembangkan Prompt</button>
      </div>
    `;
  } else if (node.type === 'anyLLM') {
    const model = node.data?.model || 'google/gemini-2.5-flash';
    const text = node.data?.generatedText || 'Menunggu input teks...';
    bodyContent = `
      <div class="node-field">
        <label class="node-field-label">Model Reasoning</label>
        <span class="node-pill-badge">${escapeHtml(model)}</span>
      </div>
      <div class="node-llm-output">${escapeHtml(text)}</div>
    `;
  } else if (node.type === 'note') {
    const noteText = node.data?.text || '';
    bodyContent = `
      <textarea class="node-textarea node-note-textarea" rows="4" placeholder="Tuliskan catatan workflow...">${escapeHtml(noteText)}</textarea>
    `;
  }

  // Progress Bar if executing
  const progressHtml = isExecuting
    ? `
      <div class="node-progress-bar-wrap">
        <div class="node-progress-bar-fill" style="width: ${progress}%;"></div>
      </div>
    `
    : '';

  return `
    <div 
      class="canvas-node-card ${isSelected ? 'selected' : ''} ${isExecuting ? 'executing' : ''}" 
      id="node_${node.id}" 
      data-node-id="${node.id}" 
      style="left: ${node.position.x}px; top: ${node.position.y}px; width: ${width}px; border-color: ${theme.border}; box-shadow: 0 4px 20px ${theme.glow};"
    >
      <!-- Header -->
      <div class="canvas-node-header" style="background: ${theme.bg};">
        <div class="node-header-title-wrap">
          <span class="node-drag-handle" title="Drag untuk memindahkan">⋮⋮</span>
          <span class="node-title">${escapeHtml(node.title)}</span>
        </div>
        <div class="node-header-actions">
          <button type="button" class="node-action-btn btn-node-duplicate" title="Duplikasi node">⧉</button>
          <button type="button" class="node-action-btn btn-node-delete" title="Hapus node">✕</button>
        </div>
      </div>

      ${progressHtml}

      <!-- Ports & Content Body -->
      <div class="canvas-node-ports-row">
        <div class="node-ports-inputs">${inputsHtml}</div>
        <div class="node-ports-outputs">${outputsHtml}</div>
      </div>

      <div class="canvas-node-body">
        ${bodyContent}
      </div>
    </div>
  `;
}
