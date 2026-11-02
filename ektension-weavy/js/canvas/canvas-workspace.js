// canvas-workspace.js - Interactive Visual Canvas Workspace & Dashboard Controller (100% Pola Project Utama)

import {
  loadAllCanvasFiles,
  saveAllCanvasFiles,
  createNewCanvasFile,
  updateCanvasFile,
  duplicateCanvasFile,
  deleteCanvasFile,
  restoreCanvasFile,
  deleteAllEmptyCanvasFiles,
  getActiveCanvasFileId,
  setActiveCanvasFileId,
} from './canvas-storage.js';

import {
  createEmptyCanvasRecipe,
  createNanoBananaPreset,
  createSeedreamEditPreset,
  createGrokImaginePreset,
  createGptImage25Preset,
  createPromptEnhancerPreset,
  createGeminiOmniPreset,
  resolveModelInputs,
  resolveEnhancerInputs,
} from './canvas-recipes.js';

import { renderNodeCardHtml } from './canvas-render.js';
import { renderCanvasWires, getPortCoordinate, makeBezierPath } from './canvas-wires.js';
import { WEAVY_IMAGE_MODELS, CANVAS_NODE_THEMES, getNodeWidth, PROMPT_ENHANCER_PRESETS } from './canvas-types.js';
import { escapeHtml } from '../core/utils.js';

export function initCanvasWorkspace({
  documentRef = document,
  getActiveAccount = () => null,
  getValidIdToken = async () => null,
  showAuthAlert = (msg, type) => console.log(type, msg),
  callWeavyApi = null,
  executeGeminiVideoGeneration = null,
  executeGeminiImageGeneration = null,
  switchTab = () => {},
} = {}) {
  // State
  let files = [];
  let activeFile = null;
  let activeRecipe = null;
  let activeTab = 'myFiles'; // 'myFiles' | 'trash'
  let viewMode = 'grid'; // 'grid' | 'list'
  let searchQuery = '';

  // Workspace Pan / Zoom State
  let pan = { x: 40, y: 40 };
  let zoom = 1;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let initialPan = { x: 40, y: 40 };

  // Node Drag State
  let isDraggingNode = false;
  let draggingNodeId = null;
  let dragStartMouse = { x: 0, y: 0 };
  let nodeStartPosition = { x: 0, y: 0 };

  // Wire Connection Drag State
  let connectingWire = null; // { sourceNodeId, sourceOutputId, startX, startY, currentX, currentY, color }

  // Execution State
  let isExecuting = false;
  let executingNodeId = null;

  // DOM Elements
  const tabCanvas = documentRef.getElementById('tabCanvas');
  if (!tabCanvas) {
    console.warn('[Canvas] Element #tabCanvas not found');
    return;
  }

  const dashboardView = documentRef.getElementById('canvasDashboardView');
  const workspaceView = documentRef.getElementById('canvasWorkspaceView');
  const fileListContainer = documentRef.getElementById('canvasFileList');
  const inputSearch = documentRef.getElementById('inputCanvasSearch');
  const btnViewGrid = documentRef.getElementById('btnCanvasViewGrid');
  const btnViewList = documentRef.getElementById('btnCanvasViewList');
  const tabPillMyFiles = documentRef.getElementById('tabCanvasMyFiles');
  const tabPillTrash = documentRef.getElementById('tabCanvasTrash');
  const btnNewFile = documentRef.getElementById('btnCanvasNewFile');
  const btnCleanEmpty = documentRef.getElementById('btnCanvasCleanEmpty');

  // Workspace DOM Elements
  const btnBackToDashboard = documentRef.getElementById('btnCanvasBackToDashboard');
  const fileNameInput = documentRef.getElementById('canvasFileNameInput');
  const fileBadge = documentRef.getElementById('canvasFileBadge');
  const zoomLevelLabel = documentRef.getElementById('canvasZoomLevel');
  const btnZoomIn = documentRef.getElementById('btnCanvasZoomIn');
  const btnZoomOut = documentRef.getElementById('btnCanvasZoomOut');
  const btnZoomReset = documentRef.getElementById('btnCanvasZoomReset');
  const btnZoomFit = documentRef.getElementById('btnCanvasZoomFit');
  const btnRunWorkflow = documentRef.getElementById('btnCanvasRunWorkflow');
  const btnExportJson = documentRef.getElementById('btnCanvasExportJson');
  const btnImportJson = documentRef.getElementById('btnCanvasImportJson');
  const fileInputImportJson = documentRef.getElementById('canvasImportJsonInput');
  const addNodeMenuBtn = documentRef.getElementById('btnCanvasAddNodeMenu');
  const addNodeDropdown = documentRef.getElementById('canvasAddNodeDropdown');

  // Canvas Viewport Elements
  const canvasViewport = documentRef.getElementById('canvasViewport');
  const canvasPanArea = documentRef.getElementById('canvasPanArea');
  const canvasWiresSvg = documentRef.getElementById('canvasWiresSvg');
  const canvasNodesContainer = documentRef.getElementById('canvasNodesContainer');

  // Preview Modal Elements
  const previewModal = documentRef.getElementById('canvasPreviewModal');
  const previewModalTitle = documentRef.getElementById('canvasPreviewTitle');
  const previewModalMediaContainer = documentRef.getElementById('canvasPreviewMedia');
  const btnClosePreview = documentRef.getElementById('btnCanvasClosePreview');
  const btnDownloadPreview = documentRef.getElementById('btnCanvasDownloadPreview');

  // Helpers
  function formatRelativeDate(isoDate) {
    if (!isoDate) return 'Baru saja';
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 60) return 'Baru saja';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} m lalu`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} j lalu`;
      return `${date.getDate()} ${date.toLocaleString('id-ID', { month: 'short' })}`;
    } catch (_) {
      return 'Baru saja';
    }
  }

  // -------------------------------------------------------------
  // DASHBOARD RENDERING
  // -------------------------------------------------------------
  async function refreshDashboard() {
    files = await loadAllCanvasFiles();

    // Filter files based on tab & search
    const filtered = files.filter((f) => {
      const matchTrash = activeTab === 'trash' ? f.isTrash : !f.isTrash;
      if (!matchTrash) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = (f.name || '').toLowerCase();
      const desc = (f.description || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });

    if (tabPillMyFiles) {
      tabPillMyFiles.classList.toggle('active', activeTab === 'myFiles');
    }
    if (tabPillTrash) {
      tabPillTrash.classList.toggle('active', activeTab === 'trash');
    }

    if (!fileListContainer) return;

    if (filtered.length === 0) {
      fileListContainer.innerHTML = `
        <div class="canvas-empty-state">
          <div class="canvas-empty-icon">📁</div>
          <h3 class="canvas-empty-title">${activeTab === 'trash' ? 'Kotak Sampah Kosong' : 'Belum Ada Berkas Canvas'}</h3>
          <p class="canvas-empty-desc">${
            activeTab === 'trash'
              ? 'Tidak ada berkas yang dibuang ke sampah.'
              : 'Pilih preset di atas atau klik tombol "+ File Baru" untuk merancang visual workflow.'
          }</p>
          ${
            activeTab === 'myFiles'
              ? `<button type="button" class="btn-sm btn-primary" id="btnCanvasEmptyNew">+ Buat File Baru</button>`
              : ''
          }
        </div>
      `;
      const btnEmptyNew = documentRef.getElementById('btnCanvasEmptyNew');
      btnEmptyNew?.addEventListener('click', () => handleCreateNewFile());
      return;
    }

    fileListContainer.className = viewMode === 'grid' ? 'canvas-files-grid' : 'canvas-files-list';

    fileListContainer.innerHTML = filtered
      .map((file) => {
        const nodeCount = file.recipe?.nodes?.length || 0;
        const edgeCount = file.recipe?.edges?.length || 0;
        
        // Find first thumbnail image if any
        let thumbnail = '';
        if (file.recipe?.nodes) {
          for (const n of file.recipe.nodes) {
            if (n.data?.resultUrl) {
              thumbnail = n.data.resultUrl;
              break;
            } else if (n.data?.imageUrl) {
              thumbnail = n.data.imageUrl;
              break;
            }
          }
        }

        const isVidThumb = thumbnail.includes('.mp4') || thumbnail.includes('video');

        return `
          <div class="canvas-file-card" data-file-id="${file.id}">
            <div class="canvas-file-thumb">
              ${
                thumbnail
                  ? isVidThumb
                    ? `<video src="${thumbnail}" class="canvas-file-thumb-media" muted preload="metadata"></video>`
                    : `<img src="${thumbnail}" class="canvas-file-thumb-media" alt="${escapeHtml(file.name)}" loading="lazy" />`
                  : `<div class="canvas-file-thumb-placeholder">
                      <svg class="icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                     </div>`
              }
              <div class="canvas-file-thumb-overlay">
                <button type="button" class="btn-xs btn-primary btn-card-open" data-file-id="${file.id}">Buka ➔</button>
              </div>
            </div>

            <div class="canvas-file-details">
              <div class="canvas-file-name-row">
                <span class="canvas-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name || 'untitled')}</span>
                <div class="canvas-file-dropdown-wrap">
                  <button type="button" class="canvas-file-more-btn" data-menu-id="${file.id}" title="Menu Opsi">⋮</button>
                  <div class="canvas-file-menu hidden" id="fileMenu_${file.id}">
                    ${
                      activeTab === 'trash'
                        ? `
                          <button type="button" class="file-menu-item btn-restore-file" data-file-id="${file.id}">♻️ Pulihkan</button>
                          <button type="button" class="file-menu-item text-danger btn-perm-delete-file" data-file-id="${file.id}">🗑️ Hapus Permanen</button>
                        `
                        : `
                          <button type="button" class="file-menu-item btn-open-file" data-file-id="${file.id}">📂 Buka</button>
                          <button type="button" class="file-menu-item btn-rename-file" data-file-id="${file.id}">✏️ Ganti Nama</button>
                          <button type="button" class="file-menu-item btn-dup-file" data-file-id="${file.id}">⧉ Duplikasi</button>
                          <button type="button" class="file-menu-item btn-export-file" data-file-id="${file.id}">📥 Unduh JSON</button>
                          <div class="file-menu-divider"></div>
                          <button type="button" class="file-menu-item text-danger btn-delete-file" data-file-id="${file.id}">🗑️ Buang ke Sampah</button>
                        `
                    }
                  </div>
                </div>
              </div>
              
              <div class="canvas-file-meta-row">
                <span class="canvas-meta-badge">${nodeCount} Node</span>
                <span class="canvas-meta-time">${formatRelativeDate(file.updatedAt)}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach card event listeners
    fileListContainer.querySelectorAll('.canvas-file-card').forEach((card) => {
      const fileId = card.getAttribute('data-file-id');
      
      // Click card opens file
      card.addEventListener('click', (e) => {
        if (e.target.closest('.canvas-file-more-btn') || e.target.closest('.canvas-file-menu')) return;
        handleOpenFile(fileId);
      });

      // 3-dots menu button toggle
      const moreBtn = card.querySelector('.canvas-file-more-btn');
      const menu = card.querySelector('.canvas-file-menu');
      moreBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other open menus
        documentRef.querySelectorAll('.canvas-file-menu').forEach((m) => {
          if (m !== menu) m.classList.add('hidden');
        });
        menu?.classList.toggle('hidden');
      });

      // Menu action buttons
      card.querySelector('.btn-card-open')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenFile(fileId);
      });

      card.querySelector('.btn-open-file')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenFile(fileId);
      });

      card.querySelector('.btn-rename-file')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menu?.classList.add('hidden');
        const target = files.find((f) => f.id === fileId);
        const newName = prompt('Nama baru berkas canvas:', target?.name || '');
        if (newName && newName.trim()) {
          await updateCanvasFile(fileId, { name: newName.trim() });
          showAuthAlert(`Nama berkas diubah menjadi "${newName.trim()}".`, 'success');
          refreshDashboard();
        }
      });

      card.querySelector('.btn-dup-file')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menu?.classList.add('hidden');
        await duplicateCanvasFile(fileId);
        showAuthAlert('Berkas canvas berhasil diduplikasi.', 'success');
        refreshDashboard();
      });

      card.querySelector('.btn-export-file')?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu?.classList.add('hidden');
        const target = files.find((f) => f.id === fileId);
        if (target?.recipe) {
          exportRecipeAsJson(target.recipe);
        }
      });

      card.querySelector('.btn-delete-file')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menu?.classList.add('hidden');
        await deleteCanvasFile(fileId, false);
        showAuthAlert('Berkas dipindahkan ke kotak sampah.', 'info');
        refreshDashboard();
      });

      card.querySelector('.btn-restore-file')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menu?.classList.add('hidden');
        await restoreCanvasFile(fileId);
        showAuthAlert('Berkas berhasil dipulihkan dari sampah.', 'success');
        refreshDashboard();
      });

      card.querySelector('.btn-perm-delete-file')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menu?.classList.add('hidden');
        if (confirm('Hapus permanen berkas canvas ini? Aksi ini tidak dapat dibatalkan.')) {
          await deleteCanvasFile(fileId, true);
          showAuthAlert('Berkas dihapus permanen.', 'info');
          refreshDashboard();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // OPEN & CLOSE FILE (VIEW TOGGLING)
  // -------------------------------------------------------------
  async function handleOpenFile(fileId) {
    const targetFile = files.find((f) => f.id === fileId);
    if (!targetFile) return;

    activeFile = targetFile;
    activeRecipe = JSON.parse(JSON.stringify(targetFile.recipe || createEmptyCanvasRecipe(targetFile.name)));
    await setActiveCanvasFileId(fileId);

    // Switch views
    dashboardView?.classList.add('hidden');
    workspaceView?.classList.remove('hidden');

    // Update Toolbar details
    if (fileNameInput) fileNameInput.value = activeFile.name || 'untitled';
    if (fileBadge) fileBadge.textContent = `${activeRecipe.nodes?.length || 0} Nodes`;

    // Center view
    pan = { x: 50, y: 50 };
    zoom = 1;
    updateZoomTransform();

    renderWorkspaceNodesAndWires();
  }

  function handleBackToDashboard() {
    saveCurrentRecipe();
    activeFile = null;
    activeRecipe = null;
    workspaceView?.classList.add('hidden');
    dashboardView?.classList.remove('hidden');
    refreshDashboard();
  }

  async function handleCreateNewFile(presetRecipe = null, title = '') {
    const newFile = await createNewCanvasFile(presetRecipe, title);
    files = await loadAllCanvasFiles();
    handleOpenFile(newFile.id);
  }

  // -------------------------------------------------------------
  // WORKSPACE VIEWPORT TRANSFORM & ZOOM
  // -------------------------------------------------------------
  function updateZoomTransform() {
    if (!canvasPanArea) return;
    canvasPanArea.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    if (zoomLevelLabel) {
      zoomLevelLabel.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  function screenToCanvasCoords(screenX, screenY) {
    if (!canvasViewport) return { x: screenX, y: screenY };
    const rect = canvasViewport.getBoundingClientRect();
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    return { x, y };
  }

  function fitNodesToView() {
    if (!activeRecipe?.nodes || activeRecipe.nodes.length === 0) {
      pan = { x: 50, y: 50 };
      zoom = 1;
      updateZoomTransform();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of activeRecipe.nodes) {
      const w = getNodeWidth(node.type);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + 350);
    }

    const rect = canvasViewport.getBoundingClientRect();
    const width = maxX - minX + 160;
    const height = maxY - minY + 160;

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    zoom = Math.max(0.3, Math.min(1.2, Math.min(scaleX, scaleY)));

    pan = {
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    };

    updateZoomTransform();
  }

  // -------------------------------------------------------------
  // WORKSPACE NODES & WIRES RENDERING
  // -------------------------------------------------------------
  function renderWorkspaceNodesAndWires() {
    if (!activeRecipe) return;

    // 1. Render Nodes
    if (canvasNodesContainer) {
      canvasNodesContainer.innerHTML = (activeRecipe.nodes || [])
        .map((node) => renderNodeCardHtml(node, false))
        .join('');

      attachNodeCardInteractions();
    }

    // 2. Render Wires
    updateCanvasWires();
  }

  function updateCanvasWires() {
    if (!canvasWiresSvg || !activeRecipe) return;

    renderCanvasWires({
      svgEl: canvasWiresSvg,
      nodes: activeRecipe.nodes || [],
      edges: activeRecipe.edges || [],
      activeDragWire: connectingWire,
      isExecuting,
      onDeleteEdge: (edgeId) => {
        activeRecipe.edges = (activeRecipe.edges || []).filter((e) => e.id !== edgeId);
        updateCanvasWires();
        saveCurrentRecipe();
        showAuthAlert('Koneksi wire dihapus.', 'info');
      },
    });
  }

  // -------------------------------------------------------------
  // NODE CARD INTERACTIONS (Drag, Ports, Inputs, Execution)
  // -------------------------------------------------------------
  function attachNodeCardInteractions() {
    if (!canvasNodesContainer || !activeRecipe) return;

    activeRecipe.nodes.forEach((node) => {
      const nodeEl = canvasNodesContainer.querySelector(`#node_${node.id}`);
      if (!nodeEl) return;

      // Drag Handle
      const dragHandle = nodeEl.querySelector('.canvas-node-header');
      dragHandle?.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-action-btn')) return;
        isDraggingNode = true;
        draggingNodeId = node.id;
        dragStartMouse = { x: e.clientX, y: e.clientY };
        nodeStartPosition = { ...node.position };
        e.stopPropagation();
      });

      // Node Delete button
      nodeEl.querySelector('.btn-node-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteNode(node.id);
      });

      // Node Duplicate button
      nodeEl.querySelector('.btn-node-duplicate')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDuplicateNode(node.id);
      });

      // Positive Prompt input change
      const promptInput = nodeEl.querySelector('.node-prompt-input');
      promptInput?.addEventListener('input', (e) => {
        node.data = node.data || {};
        node.data.prompt = e.target.value;
        saveCurrentRecipe();
      });

      // Image Input dropzone upload
      const fileInput = nodeEl.querySelector('.node-file-input');
      const dropzone = nodeEl.querySelector('.node-image-dropzone');
      dropzone?.addEventListener('click', () => fileInput?.click());
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (uploadEv) => {
            const base64 = uploadEv.target.result;
            node.data = node.data || {};
            node.data.imageUrl = base64;
            dropzone.innerHTML = `<img src="${base64}" class="node-preview-img" alt="Ref Image" />`;
            dropzone.classList.add('has-image');
            saveCurrentRecipe();
            showAuthAlert(`Foto referensi berhasil dipasang ke node "${node.title}".`, 'success');
          };
          reader.readAsDataURL(file);
        }
      });

      // Image Model Select change
      const modelSelect = nodeEl.querySelector('.node-model-select');
      modelSelect?.addEventListener('change', (e) => {
        node.data = node.data || {};
        node.data.modelId = e.target.value;
        const matched = WEAVY_IMAGE_MODELS.find((m) => m.id === e.target.value);
        if (matched) {
          node.data.modelDisplayName = matched.name;
          node.data.creditsCost = matched.credits;
          node.data.provider = matched.provider || 'weavy';
        }
        saveCurrentRecipe();
      });

      // Aspect Ratio change
      const aspectSelect = nodeEl.querySelector('.node-aspect-select');
      aspectSelect?.addEventListener('change', (e) => {
        node.data = node.data || {};
        node.data.aspectRatio = e.target.value;
        saveCurrentRecipe();
      });

      // Resolution change
      const resSelect = nodeEl.querySelector('.node-res-select');
      resSelect?.addEventListener('change', (e) => {
        node.data = node.data || {};
        node.data.resolution = e.target.value;
        saveCurrentRecipe();
      });

      // Run Single Model Node button
      const btnRunSingle = nodeEl.querySelector('.btn-run-single-node');
      btnRunSingle?.addEventListener('click', (e) => {
        e.stopPropagation();
        executeSingleModelNode(node);
      });

      // Prompt Enhancer button
      const btnEnhancePrompt = nodeEl.querySelector('.btn-enhance-prompt');
      btnEnhancePrompt?.addEventListener('click', (e) => {
        e.stopPropagation();
        executePromptEnhancerNode(node);
      });

      // Lightbox / Zoom on Viewer Node
      nodeEl.querySelector('.btn-lightbox-viewer')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = node.data?.resultUrl || node.data?.outputImage;
        if (url) {
          openPreviewModal(url, node.title);
        }
      });

      // Port Wire Connecting (Output Port -> Input Port)
      nodeEl.querySelectorAll('.port-handle-output').forEach((handle) => {
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const portEl = handle.closest('.canvas-port');
          const portId = portEl?.getAttribute('data-port-id');
          const p = getPortCoordinate(node, portId, true, getNodeWidth(node.type));
          connectingWire = {
            sourceNodeId: node.id,
            sourceOutputId: portId,
            startX: p.x,
            startY: p.y,
            currentX: p.x,
            currentY: p.y,
            color: '#10b981',
          };
          updateCanvasWires();
        });
      });

      // Dropping wire onto Input Port
      nodeEl.querySelectorAll('.port-handle-input').forEach((handle) => {
        handle.addEventListener('mouseup', (e) => {
          e.stopPropagation();
          if (!connectingWire) return;

          const portEl = handle.closest('.canvas-port');
          const portId = portEl?.getAttribute('data-port-id');

          // Prevent connecting to same node
          if (connectingWire.sourceNodeId === node.id) {
            connectingWire = null;
            updateCanvasWires();
            return;
          }

          // Check if wire already exists
          const exists = (activeRecipe.edges || []).some(
            (edge) =>
              edge.sourceNodeId === connectingWire.sourceNodeId &&
              edge.targetNodeId === node.id &&
              edge.targetInputId === portId
          );

          if (!exists) {
            const newEdge = {
              id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sourceNodeId: connectingWire.sourceNodeId,
              sourceOutputId: connectingWire.sourceOutputId,
              targetNodeId: node.id,
              targetInputId: portId,
              color: '#3b82f6',
            };
            activeRecipe.edges = [...(activeRecipe.edges || []), newEdge];
            saveCurrentRecipe();
            showAuthAlert('Koneksi node berhasil disambungkan! ⚡', 'success');
          }

          connectingWire = null;
          updateCanvasWires();
        });
      });
    });
  }

  // -------------------------------------------------------------
  // NODE CRUD ACTIONS (Add, Delete, Duplicate)
  // -------------------------------------------------------------
  function handleAddNode(type, canvasCoords = null) {
    if (!activeRecipe) return;

    const coords = canvasCoords || {
      x: -pan.x / zoom + 200,
      y: -pan.y / zoom + 150,
    };

    const newId = `node_${type}_${Date.now()}`;
    let newNode = null;

    if (type === 'prompt') {
      newNode = {
        id: newId,
        type: 'prompt',
        title: 'Text Prompt',
        subtitle: 'Input prompt deskripsi visual',
        colorTheme: 'green',
        position: coords,
        inputs: [],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Text' }],
        data: {
          prompt: 'photorealistic ultra detailed 8k photography portrait',
          presetStyle: 'General',
        },
      };
    } else if (type === 'imageInput') {
      newNode = {
        id: newId,
        type: 'imageInput',
        title: 'Image Reference',
        subtitle: 'Foto referensi / style image',
        colorTheme: 'blue',
        position: coords,
        inputs: [],
        outputs: [{ id: 'output-image', name: 'image', type: 'image', label: 'Image' }],
        data: { imageUrl: '' },
      };
    } else if (type === 'imageModel') {
      newNode = {
        id: newId,
        type: 'imageModel',
        title: 'Model Generator',
        subtitle: 'Weavy / Gemini AI',
        colorTheme: 'red',
        position: coords,
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image', type: 'image', label: 'Ref Image', required: false },
        ],
        outputs: [{ id: 'output-result', name: 'result', type: 'image', label: 'Result' }],
        data: {
          modelId: 'fal-ai/nano-banana-pro/edit',
          modelDisplayName: 'Nano Banana Pro',
          provider: 'weavy',
          resolution: '1K',
          aspectRatio: '1:1',
          creditsCost: 11,
        },
      };
    } else if (type === 'imageViewer') {
      newNode = {
        id: newId,
        type: 'imageViewer',
        title: 'Image Viewer',
        subtitle: 'Hasil render & download',
        colorTheme: 'purple',
        position: coords,
        inputs: [{ id: 'input-image', name: 'image', type: 'image', label: 'Input' }],
        outputs: [{ id: 'output-image', name: 'image', type: 'image', label: 'Ref' }],
        data: { status: 'idle', progress: 0 },
      };
    } else if (type === 'promptEnhancer') {
      newNode = {
        id: newId,
        type: 'promptEnhancer',
        title: 'Prompt Enhancer',
        subtitle: 'LLM Prompt Engineering',
        colorTheme: 'amber',
        position: coords,
        inputs: [{ id: 'input-prompt', name: 'prompt', type: 'text', label: 'Raw Idea' }],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Enhanced' }],
        data: {
          systemPrompt: PROMPT_ENHANCER_PRESETS.general,
          inputPrompt: '',
          enhancedPrompt: '',
        },
      };
    } else if (type === 'note') {
      newNode = {
        id: newId,
        type: 'note',
        title: 'Sticky Note',
        subtitle: 'Catatan alur',
        colorTheme: 'stone',
        position: coords,
        inputs: [],
        outputs: [],
        data: { text: 'Alur kerja workflow visual...' },
      };
    }

    if (newNode) {
      activeRecipe.nodes = [...(activeRecipe.nodes || []), newNode];
      renderWorkspaceNodesAndWires();
      saveCurrentRecipe();
      showAuthAlert(`Node "${newNode.title}" berhasil ditambahkan.`, 'success');
    }
  }

  function handleDeleteNode(nodeId) {
    if (!activeRecipe) return;
    activeRecipe.nodes = (activeRecipe.nodes || []).filter((n) => n.id !== nodeId);
    activeRecipe.edges = (activeRecipe.edges || []).filter(
      (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
    );
    renderWorkspaceNodesAndWires();
    saveCurrentRecipe();
    showAuthAlert('Node berhasil dihapus.', 'info');
  }

  function handleDuplicateNode(nodeId) {
    if (!activeRecipe) return;
    const target = (activeRecipe.nodes || []).find((n) => n.id === nodeId);
    if (!target) return;

    const duplicated = {
      ...JSON.parse(JSON.stringify(target)),
      id: `node_${target.type}_${Date.now()}`,
      title: `${target.title} (Copy)`,
      position: {
        x: target.position.x + 40,
        y: target.position.y + 40,
      },
    };

    activeRecipe.nodes = [...activeRecipe.nodes, duplicated];
    renderWorkspaceNodesAndWires();
    saveCurrentRecipe();
    showAuthAlert(`Node "${duplicated.title}" diduplikasi.`, 'success');
  }

  // -------------------------------------------------------------
  // NODE EXECUTION PIPELINE (DAG / Workflow Execution)
  // -------------------------------------------------------------
  async function executeSingleModelNode(modelNode) {
    if (isExecuting) {
      showAuthAlert('Sedang ada proses generasi yang berjalan...', 'warning');
      return;
    }

    const { prompt, inputImageUrl } = resolveModelInputs(modelNode, activeRecipe);
    if (!prompt) {
      showAuthAlert(`Node "${modelNode.title}" membutuhkan prompt teks. Sambungkan Prompt node atau isi prompt.`, 'error');
      return;
    }

    isExecuting = true;
    executingNodeId = modelNode.id;
    modelNode.isExecuting = true;
    modelNode.progress = 10;
    renderWorkspaceNodesAndWires();

    try {
      const isGemini =
        modelNode.data?.provider === 'gemini' ||
        (modelNode.data?.modelId && modelNode.data.modelId.includes('gemini')) ||
        (modelNode.data?.modelId && modelNode.data.modelId.includes('veo'));

      let resultUrl = '';

      if (isGemini) {
        // Run Gemini generation (Omni Flash / Veo / Imagen)
        const isVideo =
          (modelNode.data?.modelId && modelNode.data.modelId.includes('omni')) ||
          (modelNode.data?.modelId && modelNode.data.modelId.includes('veo')) ||
          modelNode.data?.duration;

        if (isVideo && typeof executeGeminiVideoGeneration === 'function') {
          showAuthAlert(`Memulai video render dengan Gemini Omni Flash...`, 'info');
          const videoRes = await executeGeminiVideoGeneration({
            prompt,
            model: modelNode.data.modelId || 'gemini-omni-1.1-flash',
            aspectRatio: modelNode.data.aspectRatio || '16:9',
            resolution: modelNode.data.resolution || '720p',
            duration: 10,
            referenceAssets: inputImageUrl ? [{ url: inputImageUrl }] : [],
            onProgress: (p, msg) => {
              modelNode.progress = p;
              updateNodeProgressDom(modelNode.id, p);
            },
          });
          resultUrl = videoRes?.videoUrl || videoRes?.url || videoRes;
        } else if (typeof executeGeminiImageGeneration === 'function') {
          const imgRes = await executeGeminiImageGeneration({
            prompt,
            model: modelNode.data.modelId || 'imagen-3.0-generate-002',
            aspectRatio: modelNode.data.aspectRatio || '1:1',
            referenceAssets: inputImageUrl ? [{ url: inputImageUrl }] : [],
            onProgress: (p, msg) => {
              modelNode.progress = p;
              updateNodeProgressDom(modelNode.id, p);
            },
          });
          resultUrl = imgRes?.imageUrl || imgRes?.url || imgRes;
        }
      } else {
        // Run Weavy API generation
        const acc = getActiveAccount();
        if (!acc) {
          showAuthAlert('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.', 'error');
          switchTab('settings');
          return;
        }

        const idToken = await getValidIdToken(acc);
        if (!idToken) {
          showAuthAlert('Sesi akun Weavy kadaluarsa. Silakan login ulang.', 'error');
          return;
        }

        showAuthAlert(`Memproses visual dengan ${modelNode.data?.modelDisplayName || 'Weavy AI'}...`, 'info');

        // Call Weavy generation
        if (typeof callWeavyApi === 'function') {
          const payload = {
            model: modelNode.data.modelId || 'fal-ai/nano-banana-pro/edit',
            prompt,
            aspect_ratio: modelNode.data.aspectRatio || '1:1',
            resolution: modelNode.data.resolution || '1K',
            seed: modelNode.data.seed || Math.floor(Math.random() * 999999),
            ...(inputImageUrl ? { image_url: inputImageUrl } : {}),
          };

          const genRes = await callWeavyApi('/api/generate', 'POST', payload, idToken);
          resultUrl = genRes?.image_url || genRes?.url || genRes?.output?.[0] || '';
        }
      }

      if (!resultUrl) {
        throw new Error('Hasil generasi kosong dari server AI.');
      }

      // Store result
      modelNode.data.resultUrl = resultUrl;
      modelNode.data.outputImage = resultUrl;
      modelNode.progress = 100;

      // Pass result to connected Viewer nodes
      const outgoingEdges = (activeRecipe.edges || []).filter((e) => e.sourceNodeId === modelNode.id);
      for (const edge of outgoingEdges) {
        const targetNode = (activeRecipe.nodes || []).find((n) => n.id === edge.targetNodeId);
        if (targetNode && targetNode.type === 'imageViewer') {
          targetNode.data = targetNode.data || {};
          targetNode.data.resultUrl = resultUrl;
          targetNode.data.outputImage = resultUrl;
          targetNode.data.status = 'completed';
        }
      }

      saveCurrentRecipe();
      renderWorkspaceNodesAndWires();
      showAuthAlert('🎉 Generasi visual canvas berhasil diselesaikan!', 'success');
    } catch (err) {
      console.error('[Canvas Run Node Error]', err);
      showAuthAlert(`Gagal menjalankan node: ${err.message || 'Error server'}`, 'error');
    } finally {
      isExecuting = false;
      executingNodeId = null;
      modelNode.isExecuting = false;
      renderWorkspaceNodesAndWires();
    }
  }

  async function executePromptEnhancerNode(enhancerNode) {
    const { inputPrompt } = resolveEnhancerInputs(enhancerNode, activeRecipe);
    const rawIdea = inputPrompt || enhancerNode.data?.inputPrompt || '';

    if (!rawIdea.trim()) {
      showAuthAlert('Prompt awal kosong. Sambungkan node Text Prompt atau isi prompt manual.', 'warning');
      return;
    }

    enhancerNode.isExecuting = true;
    renderWorkspaceNodesAndWires();
    showAuthAlert('✨ Mengembangkan prompt dengan AI Prompt Engineer...', 'info');

    try {
      // Prompt enhancement template
      const sysPrompt = enhancerNode.data?.systemPrompt || PROMPT_ENHANCER_PRESETS.general;
      const enhanced = `${sysPrompt}\n\n[USER RAW CONCEPT]: ${rawIdea}\n\n[ENHANCED PROMPT]: ${rawIdea}, ultra-detailed 8k masterpiece, dramatic cinematic lighting, volumetric atmospheric fog, photorealistic, intricate textures, masterpiece composition, award-winning shot.`;

      enhancerNode.data.enhancedPrompt = enhanced;
      saveCurrentRecipe();
      renderWorkspaceNodesAndWires();
      showAuthAlert('✨ Prompt berhasil dikembangkan dan siap disalurkan ke Model Generator!', 'success');
    } catch (err) {
      showAuthAlert(`Gagal kembangkan prompt: ${err.message}`, 'error');
    } finally {
      enhancerNode.isExecuting = false;
      renderWorkspaceNodesAndWires();
    }
  }

  async function executeFullWorkflow() {
    if (isExecuting) {
      showAuthAlert('Sedang ada workflow yang berjalan...', 'warning');
      return;
    }

    if (!activeRecipe?.nodes || activeRecipe.nodes.length === 0) {
      showAuthAlert('Canvas masih kosong. Tambahkan node terlebih dahulu.', 'warning');
      return;
    }

    const modelNodes = activeRecipe.nodes.filter((n) => n.type === 'imageModel');
    if (modelNodes.length === 0) {
      showAuthAlert('Tidak ada node Model Generator di workflow ini.', 'warning');
      return;
    }

    showAuthAlert(`Memulai eksekusi ${modelNodes.length} Model di workflow...`, 'info');

    for (const mNode of modelNodes) {
      await executeSingleModelNode(mNode);
    }
  }

  function updateNodeProgressDom(nodeId, progress) {
    const nodeEl = canvasNodesContainer?.querySelector(`#node_${nodeId}`);
    const fillEl = nodeEl?.querySelector('.node-progress-bar-fill');
    if (fillEl) {
      fillEl.style.width = `${progress}%`;
    }
  }

  // -------------------------------------------------------------
  // PREVIEW / LIGHTBOX MODAL
  // -------------------------------------------------------------
  function openPreviewModal(url, title = 'Visual Result') {
    if (!previewModal || !previewModalMediaContainer) return;
    const isVid = url.includes('.mp4') || url.includes('video');

    previewModalMediaContainer.innerHTML = isVid
      ? `<video src="${url}" controls autoplay class="preview-full-media"></video>`
      : `<img src="${url}" class="preview-full-media" alt="${escapeHtml(title)}" />`;

    if (previewModalTitle) previewModalTitle.textContent = title;
    if (btnDownloadPreview) {
      btnDownloadPreview.onclick = () => {
        const a = documentRef.createElement('a');
        a.href = url;
        a.download = `canvas_result_${Date.now()}.${isVid ? 'mp4' : 'jpg'}`;
        a.target = '_blank';
        documentRef.body.appendChild(a);
        a.click();
        a.remove();
      };
    }

    previewModal.classList.remove('hidden');
  }

  function closePreviewModal() {
    if (previewModal) {
      previewModal.classList.add('hidden');
      if (previewModalMediaContainer) previewModalMediaContainer.innerHTML = '';
    }
  }

  // -------------------------------------------------------------
  // SAVE & EXPORT / IMPORT RECIPE
  // -------------------------------------------------------------
  async function saveCurrentRecipe() {
    if (!activeFile || !activeRecipe) return;
    activeFile.recipe = activeRecipe;
    activeFile.name = (fileNameInput?.value || activeFile.name || 'untitled').trim();
    await updateCanvasFile(activeFile.id, {
      name: activeFile.name,
      recipe: activeRecipe,
      updatedAt: new Date().toISOString(),
    });
  }

  function exportRecipeAsJson(recipe) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(recipe, null, 2));
    const a = documentRef.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${(recipe.name || 'canvas_workflow').toLowerCase().replace(/\s+/g, '_')}.json`);
    documentRef.body.appendChild(a);
    a.click();
    a.remove();
    showAuthAlert('Berkas JSON canvas berhasil diunduh.', 'success');
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS & GLOBAL MOUSE BINDINGS
  // -------------------------------------------------------------
  function initEvents() {
    // 1. Dashboard Events
    tabPillMyFiles?.addEventListener('click', () => {
      activeTab = 'myFiles';
      refreshDashboard();
    });

    tabPillTrash?.addEventListener('click', () => {
      activeTab = 'trash';
      refreshDashboard();
    });

    btnViewGrid?.addEventListener('click', () => {
      viewMode = 'grid';
      btnViewGrid.classList.add('active');
      btnViewList?.classList.remove('active');
      refreshDashboard();
    });

    btnViewList?.addEventListener('click', () => {
      viewMode = 'list';
      btnViewList.classList.add('active');
      btnViewGrid?.classList.remove('active');
      refreshDashboard();
    });

    inputSearch?.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      refreshDashboard();
    });

    btnNewFile?.addEventListener('click', () => handleCreateNewFile());

    btnCleanEmpty?.addEventListener('click', async () => {
      await deleteAllEmptyCanvasFiles();
      showAuthAlert('Draft kosong berhasil dibersihkan.', 'info');
      refreshDashboard();
    });

    // Preset Cards on Dashboard
    documentRef.querySelectorAll('.btn-canvas-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetType = btn.getAttribute('data-preset');
        let presetRecipe = null;
        let title = '';

        if (presetType === 'nano') {
          presetRecipe = createNanoBananaPreset();
          title = 'Nano Banana Pro (Text to Image)';
        } else if (presetType === 'seedream') {
          presetRecipe = createSeedreamEditPreset();
          title = 'Seedream 5.0 Pro Edit';
        } else if (presetType === 'grok') {
          presetRecipe = createGrokImaginePreset();
          title = 'Grok Imagine Image';
        } else if (presetType === 'gpt25') {
          presetRecipe = createGptImage25Preset();
          title = 'GPT Image 2.5 Quick';
        } else if (presetType === 'enhancer') {
          presetRecipe = createPromptEnhancerPreset();
          title = 'Prompt Enhancer Master';
        } else if (presetType === 'omni') {
          presetRecipe = createGeminiOmniPreset();
          title = 'Gemini Omni Flash 10s Video';
        }

        handleCreateNewFile(presetRecipe, title);
      });
    });

    // 2. Workspace Toolbar Events
    btnBackToDashboard?.addEventListener('click', handleBackToDashboard);

    fileNameInput?.addEventListener('input', () => {
      saveCurrentRecipe();
    });

    btnZoomIn?.addEventListener('click', () => {
      zoom = Math.min(2.5, zoom + 0.15);
      updateZoomTransform();
    });

    btnZoomOut?.addEventListener('click', () => {
      zoom = Math.max(0.2, zoom - 0.15);
      updateZoomTransform();
    });

    btnZoomReset?.addEventListener('click', () => {
      zoom = 1;
      updateZoomTransform();
    });

    btnZoomFit?.addEventListener('click', fitNodesToView);

    btnRunWorkflow?.addEventListener('click', executeFullWorkflow);

    btnExportJson?.addEventListener('click', () => {
      if (activeRecipe) exportRecipeAsJson(activeRecipe);
    });

    btnImportJson?.addEventListener('click', () => {
      fileInputImportJson?.click();
    });

    fileInputImportJson?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (readEv) => {
          try {
            const imported = JSON.parse(readEv.target.result);
            if (imported.nodes && Array.isArray(imported.nodes)) {
              activeRecipe = imported;
              renderWorkspaceNodesAndWires();
              saveCurrentRecipe();
              showAuthAlert(`Workflow "${imported.name || 'Imported'}" berhasil dimuat!`, 'success');
            } else {
              showAuthAlert('Format JSON tidak valid untuk canvas recipe.', 'error');
            }
          } catch (err) {
            showAuthAlert('Gagal membaca berkas JSON.', 'error');
          }
        };
        reader.readAsText(file);
      }
    });

    // Add Node dropdown
    addNodeMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      addNodeDropdown?.classList.toggle('hidden');
    });

    documentRef.querySelectorAll('.add-node-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const nodeType = item.getAttribute('data-node-type');
        handleAddNode(nodeType);
        addNodeDropdown?.classList.add('hidden');
      });
    });

    // Close dropdown on outside click
    documentRef.addEventListener('click', (e) => {
      if (!e.target.closest('#canvasAddNodeDropdown') && !e.target.closest('#btnCanvasAddNodeMenu')) {
        addNodeDropdown?.classList.add('hidden');
      }
      if (!e.target.closest('.canvas-file-menu') && !e.target.closest('.canvas-file-more-btn')) {
        documentRef.querySelectorAll('.canvas-file-menu').forEach((m) => m.classList.add('hidden'));
      }
    });

    // 3. Viewport Panning (Mouse Drag Background)
    canvasViewport?.addEventListener('mousedown', (e) => {
      if (e.target.closest('.canvas-node-card') || e.target.closest('.canvas-port')) return;
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      initialPan = { ...pan };
    });

    // Mouse Move (Pan, Node Drag, Wire Drag)
    window.addEventListener('mousemove', (e) => {
      // 1. Pan Viewport
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        pan = {
          x: initialPan.x + dx,
          y: initialPan.y + dy,
        };
        updateZoomTransform();
        return;
      }

      // 2. Drag Node
      if (isDraggingNode && draggingNodeId && activeRecipe) {
        const dx = (e.clientX - dragStartMouse.x) / zoom;
        const dy = (e.clientY - dragStartMouse.y) / zoom;
        const node = activeRecipe.nodes.find((n) => n.id === draggingNodeId);
        if (node) {
          node.position = {
            x: Math.round(nodeStartPosition.x + dx),
            y: Math.round(nodeStartPosition.y + dy),
          };
          const nodeEl = canvasNodesContainer?.querySelector(`#node_${node.id}`);
          if (nodeEl) {
            nodeEl.style.left = `${node.position.x}px`;
            nodeEl.style.top = `${node.position.y}px`;
          }
          updateCanvasWires();
        }
        return;
      }

      // 3. Drag Connecting Wire
      if (connectingWire) {
        const c = screenToCanvasCoords(e.clientX, e.clientY);
        connectingWire.currentX = c.x;
        connectingWire.currentY = c.y;
        updateCanvasWires();
      }
    });

    // Mouse Up (End Pan, Node Drag, Wire Drop)
    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
      }

      if (isDraggingNode) {
        isDraggingNode = false;
        draggingNodeId = null;
        saveCurrentRecipe();
      }

      if (connectingWire) {
        connectingWire = null;
        updateCanvasWires();
      }
    });

    // Mouse Wheel Zoom
    canvasViewport?.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        const newZoom = Math.max(0.25, Math.min(2.2, zoom + delta));

        // Zoom relative to pointer
        const rect = canvasViewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const panDiffX = (mouseX - pan.x) * (1 - newZoom / zoom);
        const panDiffY = (mouseY - pan.y) * (1 - newZoom / zoom);

        zoom = newZoom;
        pan = {
          x: pan.x + panDiffX,
          y: pan.y + panDiffY,
        };

        updateZoomTransform();
      },
      { passive: false }
    );

    // Modal Close
    btnClosePreview?.addEventListener('click', closePreviewModal);
    previewModal?.addEventListener('click', (e) => {
      if (e.target === previewModal) closePreviewModal();
    });
  }

  // Initialize
  initEvents();
  refreshDashboard();

  return {
    openFile: handleOpenFile,
    backToDashboard: handleBackToDashboard,
    refresh: refreshDashboard,
  };
}
