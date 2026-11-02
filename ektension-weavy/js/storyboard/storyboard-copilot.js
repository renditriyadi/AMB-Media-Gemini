import { extractStoryboardCopilotAction } from './storyboard-intent.js';
import { renderChatStoryboardCopilotCard, extractStoryboardProjectFromData } from '../chat/chat-render.js';

export function initStoryboardCopilot({
  documentRef = document,
  storage = null,
  getContext = () => ({}),
  sendMessage = null,
  onGenerateRequest = null,
  onCreateProjectRequest = null,
  onApplyProject = null,
  formatMessage = (text) => String(text || ''),
  showAlert = null,
  openImageSourcePicker = null,
  escapeHtml = (value) => String(value || ''),
  openLightbox = null,
  onNewSession = null,
} = {}) {
  const panel = documentRef.getElementById('storyboardCopilotPanel');
  const resizer = documentRef.getElementById('storyboardCopilotResizer');
  const openButton = documentRef.getElementById('btnOpenStoryboardCopilot');
  const closeButton = documentRef.getElementById('btnCloseStoryboardCopilot');
  const messagesEl = documentRef.getElementById('storyboardCopilotMessages');
  const contextEl = documentRef.getElementById('storyboardCopilotContext');
  const visualContextEl = documentRef.getElementById('storyboardCopilotVisualContext');
  const form = documentRef.getElementById('storyboardCopilotForm');
  const input = documentRef.getElementById('storyboardCopilotInput');
  const addImageButton = documentRef.getElementById('btnStoryboardCopilotAddImage');
  const fileInput = documentRef.getElementById('storyboardCopilotFileInput');
  const attachmentsEl = documentRef.getElementById('storyboardCopilotAttachments');
  const modelSelect = documentRef.getElementById('storyboardCopilotModelSelect');
  const sendButton = form?.querySelector('.send-btn');
  const newSessionButton = documentRef.getElementById('btnNewStoryboardCopilotSession');
  const historyButton = documentRef.getElementById('btnStoryboardCopilotHistory');
  const historyNewSessionButton = documentRef.getElementById('btnHistoryNewStoryboardCopilotSession');
  const historyPopover = documentRef.getElementById('storyboardCopilotHistoryPopover');
  const historyList = documentRef.getElementById('storyboardCopilotHistoryList');
  const btnScrollToBottom = documentRef.getElementById('btnStoryboardCopilotScrollToBottom');
  if (!panel || !messagesEl || !form || !input) return null;

  const storageKey = 'weavy_storyboard_copilot_sessions';
  let sessions = [];
  let currentSessionId = null;
  let copilotImages = [];
  let isSending = false;
  let isCopilotAutoScrollActive = true;
  let isProgrammaticCopilotScroll = false;
  let isUserScrollingCopilot = false;
  let copilotUserScrollTimeout = null;

  const createSession = () => ({
    id: `sb_copilot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: 'Percakapan Baru',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    dolaConvId: null,
    dolaSectionId: null,
    dolaMessageIndex: null,
  });

  const getCurrentSession = () => sessions.find((session) => session.id === currentSessionId) || sessions[0] || null;

  const persistSessions = async () => {
    if (storage?.set) {
      await storage.set(storageKey, sessions);
    }
  };

  const closeHistory = () => {
    historyPopover?.classList.add('hidden');
    historyButton?.setAttribute('aria-expanded', 'false');
  };

  const formatSessionDate = (session) => {
    const date = new Date(session.updatedAt || session.createdAt || 0);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const roleLabels = {
    product: 'Produk',
    model: 'Model / Talent',
    background: 'Background',
    custom: 'Asset lain',
  };

  const quickSuggestions = [
    { label: 'Review', prompt: 'Review storyboard saat ini dan beri saran prioritas.' },
    { label: 'Konsisten', prompt: 'Cek konsistensi produk, model, dan background di seluruh scene.' },
    { label: 'Budget', prompt: 'Berapa estimasi biaya untuk generate scene aktif?' },
    { label: 'Next', prompt: 'Apa langkah selanjutnya yang paling efektif untuk storyboard ini?' },
  ];

  const getSceneLabel = () => {
    const context = getContext() || {};
    return context.scene?.sceneNumber ? `Scene ${context.scene.sceneNumber} aktif` : 'Semua storyboard aktif';
  };

  const getSessionStatusLabel = () => {
    const currentSession = getCurrentSession();
    if (!currentSession?.messages?.length) return 'Siap bantu review & revisi storyboard';
    const lastMessage = currentSession.messages[currentSession.messages.length - 1];
    return lastMessage.role === 'assistant' ? 'Status: siap lanjutkan aksi berikutnya' : 'Status: menunggu arahan berikutnya';
  };

  const formatChatTime = (isoString) => {
    if (!isoString) {
      const d = new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  function cleanCopilotMarkdown(text) {
    const raw = String(text || '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '');
    const { cleanText } = extractStoryboardCopilotAction(raw);
    return cleanText || raw;
  }

  const sendIconHtml = `
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  `;

  const updateComposerState = () => {
    if (!input || !sendButton) return;
    input.disabled = isSending;
    input.placeholder = isSending ? 'Storyboard Copilot sedang berpikir...' : 'Diskusikan storyboard atau scene ini...';
    sendButton.disabled = isSending;
    sendButton.classList.toggle('is-loading', isSending);
    sendButton.setAttribute('aria-busy', String(isSending));
    sendButton.title = isSending ? 'Storyboard Copilot sedang merespons...' : 'Kirim Pesan';
    sendButton.innerHTML = isSending
      ? '<span class="send-btn-spinner" aria-hidden="true"></span>'
      : sendIconHtml;
  };

  const render = (options = {}) => {
    const forceScroll = (typeof options === 'boolean') ? options : Boolean(options?.forceScroll);
    const smooth = options?.smooth !== false;
    const context = getContext() || {};
    const currentSession = getCurrentSession();
    const messages = currentSession?.messages || [];
    updateComposerState();
    if (contextEl) {
      contextEl.innerHTML = '';
      contextEl.style.display = 'none';
    }
    if (visualContextEl) {
      const visualReferences = Array.isArray(context.visualReferences) ? context.visualReferences : [];
      visualContextEl.innerHTML = visualReferences.length
        ? visualReferences.map((image) => `
            <div class="storyboard-copilot-visual-chip" title="${escapeHtml(image.name || image.label || 'Visual context')}">
              <img src="${escapeHtml(image.thumbnailUrl || image.url)}" alt="${escapeHtml(image.name || 'Visual context')}" onerror="this.onerror=null; const chip=this.closest('.storyboard-copilot-visual-chip'); if(chip) chip.remove(); else this.style.display='none';">
              <span>${escapeHtml(image.label || image.name || 'Visual')}</span>
            </div>
          `).join('')
        : '';
    }

    renderHistory();
    const directorPresets = [
      {
        icon: '🎬',
        title: 'Iklan Sinematik',
        desc: 'Hook dramatis, visual mewah & CTA',
        prompt: 'Rancang storyboard iklan sinematik premium 4 scene untuk produk ini dengan hook dramatis dan visual memukau.'
      },
      {
        icon: '📱',
        title: 'TikTok UGC Viral',
        desc: 'Problem, proof & keranjang kuning',
        prompt: 'Buat storyboard TikTok UGC viral 4 scene dengan hook masalah relatable, demo produk, dan CTA keranjang kuning.'
      },
      {
        icon: '🍜',
        title: 'Kuliner & Estetik',
        desc: 'Macro shot & visual menggugah',
        prompt: 'Rancang storyboard video estetik F&B/kuliner dengan macro shot tekstur dan alur menggugah selera.'
      },
      {
        icon: '⚡',
        title: 'Review & Konsistensi',
        desc: 'Audit hook, model & budget koin',
        prompt: 'Review storyboard saat ini: periksa hook opening, konsistensi model & background, serta estimasi biaya koin.'
      }
    ];

    messagesEl.innerHTML = messages.length
      ? messages.map((message, index) => {
          const isUser = message.role === 'user';
          const formattedContent = formatMessage(cleanCopilotMarkdown(message.content));

          let attachmentsHtml = '';
          if (message.attachments && message.attachments.length > 0) {
            attachmentsHtml = `
              <div class="bubble-attachments">
                ${message.attachments
                  .map((img) => `<img src="${escapeHtml(img.thumbnailUrl || img.url || img.base64)}" class="bubble-img-thumb lightbox-trigger cursor-grab active:cursor-grabbing" alt="${escapeHtml(img.name || img.label || 'Referensi')}" data-full-src="${escapeHtml(img.url || img.thumbnailUrl || img.base64)}" draggable="true" onerror="this.onerror=null; this.remove();">`)
                  .join('')}
              </div>
            `;
          }

          if (isUser) {
            return `
              <div class="chat-bubble-row user">
                <div class="message-meta">
                  <span class="meta-sender">User</span>
                  <span class="meta-time">${formatChatTime(message.timestamp)}</span>
                </div>
                <div class="chat-bubble">
                  ${attachmentsHtml}
                  <div class="bubble-content">${formattedContent}</div>
                </div>
              </div>
            `;
          }

          let actionCardHtml = '';
          if (message.actionData && (message.actionData.action === 'create_storyboard_project' || message.actionData.project)) {
            if (!formattedContent.includes('chat-storyboard-copilot-card')) {
              const projectData = message.actionData.project || message.actionData;
              try {
                actionCardHtml = renderChatStoryboardCopilotCard(projectData);
              } catch (_) {
                const proj = message.actionData.project || {};
                const title = proj.title || proj.productName || 'Storyboard Baru';
                const numScenes = proj.numScenes || (Array.isArray(proj.scenes) ? proj.scenes.length : 4);
                const duration = proj.duration || 10;
                const aspect = proj.aspectRatio || '9:16';
                actionCardHtml = `
                  <div class="copilot-action-card" data-msg-idx="${index}" style="margin-top: 10px; padding: 10px 12px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                      <span style="font-size: 10px; font-weight: 700; color: #f59e0b; letter-spacing: 0.5px;">🎬 DRAFT STORYBOARD SIAP</span>
                      <span style="font-size: 10px; color: var(--text-muted); background: var(--bg-tertiary, #27272a); padding: 2px 6px; border-radius: 4px;">${numScenes} Scene · ${duration}s · ${escapeHtml(aspect)}</span>
                    </div>
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary);">${escapeHtml(title)}</div>
                    <div style="display: flex; gap: 6px; margin-top: 2px;">
                      <button type="button" class="btn-copilot-apply-project" data-msg-idx="${index}" style="flex: 1; background: #f59e0b; color: #000; border: none; border-radius: 6px; padding: 7px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <span>✓ Terapkan ke Storyboard</span>
                      </button>
                      <button type="button" class="btn-copilot-review-popup" data-msg-idx="${index}" style="background: var(--bg-surface-soft, rgba(255,255,255,0.08)); color: var(--text-primary); border: 1px solid var(--border-color, rgba(255,255,255,0.15)); border-radius: 6px; padding: 7px 10px; font-size: 11px; cursor: pointer;">
                        <span>Buka Pop-up</span>
                      </button>
                    </div>
                  </div>
                `;
              }
            }
          }

          return `
            <div class="chat-bubble-row assistant">
              <div class="message-meta">
                <svg class="meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <circle cx="12" cy="5" r="2"/>
                  <path d="M12 7v4"/>
                  <line x1="8" y1="16" x2="8" y2="16"/>
                  <line x1="16" y1="16" x2="16" y2="16"/>
                </svg>
                <span class="meta-sender">${escapeHtml(message.modelDisplayName || 'Storyboard AI')}</span>
                <span class="meta-time">${formatChatTime(message.timestamp)}</span>
              </div>
              <div class="chat-bubble">
                ${attachmentsHtml}
                <div class="bubble-content">${formattedContent}</div>
                ${actionCardHtml}
              </div>
            </div>
          `;
        }).join('')
      : `<div class="welcome-card storyboard-agent-welcome" style="margin: auto 0; text-align: center; padding: 12px 6px;">
          <div class="welcome-icon-glow" style="margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
            </svg>
          </div>
          <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">Storyboard AI Copilot</h3>
          <p style="font-size: 12px; line-height: 1.4; color: var(--text-muted); margin: 0 0 14px;">Asisten sutradara AI untuk merancang hook, alur scene, angle visual, dan revisi alur storyboard.</p>
          
          <div class="storyboard-preset-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left; margin-bottom: 8px;">
            ${directorPresets.map((preset) => `
              <button type="button" class="btn-copilot-preset" data-prompt="${escapeHtml(preset.prompt)}" style="background: var(--bg-surface-soft, rgba(255,255,255,0.04)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px 10px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; gap: 2px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: flex; items-center: center; gap: 5px;">
                  <span>${preset.icon}</span>
                  <span>${preset.title}</span>
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); line-height: 1.3;">${preset.desc}</div>
              </button>
            `).join('')}
          </div>
        </div>`;
    const distanceFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    if (forceScroll || isCopilotAutoScrollActive || distanceFromBottom < 120 || messagesEl.scrollTop === 0) {
      if (forceScroll) {
        isCopilotAutoScrollActive = true;
        scrollToBottomCopilot(smooth);
      } else {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }
    updateCopilotScrollToBottom();

    const getSessionAttachments = () => {
      const currentSession = getCurrentSession();
      const list = [];
      const keys = new Set();
      const addImg = (img) => {
        if (!img) return;
        const k = img.url || img.base64 || img.thumbnailUrl || img.downloadUrl || img.id || img.name;
        if (k && !keys.has(k)) {
          keys.add(k);
          list.push(img);
        }
      };
      (currentSession?.messages || []).forEach((m) => {
        (m.attachments || []).forEach(addImg);
      });
      copilotImages.forEach(addImg);
      return list;
    };

    const findMsgActionData = (btn) => {
      const idxAttr = btn.getAttribute('data-msg-idx');
      const idx = idxAttr !== null && idxAttr !== '' ? Number(idxAttr) : -1;
      const currentSession = getCurrentSession();
      let actionData = null;
      if (idx >= 0 && currentSession?.messages?.[idx]?.actionData) {
        actionData = currentSession.messages[idx].actionData;
      } else {
        const bubbleRow = btn.closest('.chat-bubble-row');
        const rows = Array.from(messagesEl.querySelectorAll('.chat-bubble-row.assistant'));
        const rowIdx = rows.indexOf(bubbleRow);
        const assistantMsgs = currentSession?.messages?.filter((m) => m.role === 'assistant') || [];
        if (rowIdx >= 0 && assistantMsgs[rowIdx]?.actionData) {
          actionData = assistantMsgs[rowIdx].actionData;
        } else {
          const found = (currentSession?.messages || []).slice().reverse().find((m) => m?.actionData?.action === 'create_storyboard_project');
          actionData = found?.actionData || null;
        }
      }

      if (actionData) {
        if (!Array.isArray(actionData.referenceImages) || actionData.referenceImages.length === 0) {
          actionData.referenceImages = getSessionAttachments();
        }
      }
      return actionData;
    };

    messagesEl.querySelectorAll('.btn-apply-storyboard-from-chat').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encProject = btn.getAttribute('data-project') || '';
        let proj = null;
        if (encProject) {
          try {
            proj = JSON.parse(decodeURIComponent(encProject));
          } catch (_) {}
        }
        let actionData = findMsgActionData(btn);
        if (proj) {
          actionData = {
            action: 'create_storyboard_project',
            type: 'create_storyboard_project',
            project: proj,
            referenceImages: getSessionAttachments(),
          };
        }
        if (actionData && typeof onCreateProjectRequest === 'function') {
          onCreateProjectRequest(actionData);
        } else if (actionData && typeof onApplyProject === 'function') {
          onApplyProject(actionData);
        }
      });
    });

    messagesEl.querySelectorAll('.btn-copilot-apply-project').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const actionData = findMsgActionData(btn);
        if (actionData && typeof onCreateProjectRequest === 'function') {
          onCreateProjectRequest(actionData);
        } else if (actionData && typeof onApplyProject === 'function') {
          btn.disabled = true;
          const origHtml = btn.innerHTML;
          btn.innerHTML = '<span>Menerapkan...</span>';
          try {
            await onApplyProject(actionData);
            btn.innerHTML = '<span>✓ Berhasil Terpasang</span>';
          } catch (err) {
            btn.innerHTML = origHtml;
            btn.disabled = false;
            showAlert?.(`Gagal menerapkan: ${err.message}`, 'error');
          }
        }
      });
    });

    messagesEl.querySelectorAll('.btn-copilot-review-popup').forEach((btn) => {
      btn.addEventListener('click', () => {
        const actionData = findMsgActionData(btn);
        if (actionData && typeof onCreateProjectRequest === 'function') {
          onCreateProjectRequest(actionData);
        }
      });
    });

    messagesEl.querySelectorAll('.btn-copilot-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-prompt');
        if (p && input) {
          input.value = p;
          input.focus();
          form.requestSubmit();
        }
      });
    });

    messagesEl.querySelectorAll('.code-copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.nextElementSibling ? btn.nextElementSibling.textContent : '';
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code);
          const origText = btn.textContent;
          btn.textContent = 'Tersalin!';
          setTimeout(() => (btn.textContent = origText), 1500);
        } catch {}
      });
    });

    messagesEl.querySelectorAll('.btn-copy-prompt-card').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const p = btn.getAttribute('data-prompt');
        if (p) {
          try {
            await navigator.clipboard.writeText(decodeURIComponent(p));
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
          } catch {}
        }
      });
    });

    messagesEl.querySelectorAll('.btn-copy-scene-item').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btn.classList.contains('copied')) return;
        const encText = btn.getAttribute('data-scene-text');
        const text = encText ? decodeURIComponent(encText) : '';
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add('copied');
          const origHtml = btn.innerHTML;
          btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="color:#4ade80; font-weight:700;">Tersalin</span>
          `;
          const scNum = btn.getAttribute('data-scene-num') || '';
          showAlert?.(`📋 Scene ${scNum} berhasil disalin lengkap dengan ikon!`, 'success');
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = origHtml;
          }, 2000);
        } catch (_) {}
      });
    });

    messagesEl.querySelectorAll('.lightbox-trigger').forEach((el) => {
      el.addEventListener('click', () => {
        const src = el.getAttribute('data-full-src') || el.src;
        if (src && typeof openLightbox === 'function') {
          openLightbox(src, 'image', el.getAttribute('alt') || 'Pratinjau Referensi');
        }
      });
    });

    if (attachmentsEl) {
      attachmentsEl.classList.toggle('hidden', copilotImages.length === 0);
      attachmentsEl.innerHTML = copilotImages.map((image, index) => `
        <div class="storyboard-copilot-attachment">
          <img src="${escapeHtml(image.thumbnailUrl || image.url || image.base64)}" alt="${escapeHtml(image.name || 'Referensi')}" onerror="this.onerror=null; const parent=this.closest('.storyboard-copilot-attachment'); if(parent) parent.remove(); else this.style.display='none';">
          <select class="storyboard-copilot-attachment-role" data-index="${index}" aria-label="Peran gambar ${index + 1}">
            ${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${image.referenceRole === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <button type="button" data-index="${index}" title="Hapus gambar">×</button>
        </div>
      `).join('');
      attachmentsEl.querySelectorAll('.storyboard-copilot-attachment-role').forEach((select) => {
        select.addEventListener('change', () => {
          copilotImages[Number(select.dataset.index)].referenceRole = select.value;
          render();
        });
      });
      attachmentsEl.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          copilotImages.splice(Number(button.dataset.index), 1);
          render();
        });
      });
    }
  };

  const renderHistory = () => {
    if (!historyList) return;

    const sortedSessions = [...sessions].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    if (sortedSessions.length === 0) {
      historyList.innerHTML = '<div class="chat-session-history-empty">Belum ada riwayat Copilot.</div>';
      return;
    }

    historyList.innerHTML = sortedSessions.map((session) => `
      <div class="storyboard-copilot-history-item ${session.id === currentSessionId ? 'active' : ''}">
        <button type="button" class="storyboard-copilot-history-select" data-session-id="${escapeHtml(session.id)}">
          <span class="storyboard-copilot-history-copy">
            <strong>${escapeHtml(session.title || 'Percakapan Baru')}</strong>
            <small>${formatSessionDate(session)}${session.messages?.length ? ` · ${session.messages.length} pesan` : ''}</small>
          </span>
        </button>
        <button type="button" class="storyboard-copilot-history-delete" data-session-id="${escapeHtml(session.id)}" title="Hapus percakapan" aria-label="Hapus percakapan">&times;</button>
      </div>
    `).join('');

    historyList.querySelectorAll('.storyboard-copilot-history-select').forEach((button) => {
      button.addEventListener('click', () => {
        const createProjectModal = documentRef.getElementById('storyboardCreateProjectModal');
        const generateSceneModal = documentRef.getElementById('storyboardGenerateConfirmModal');
        if (createProjectModal) {
          createProjectModal.classList.add('hidden');
          createProjectModal.style.removeProperty('display');
        }
        if (generateSceneModal) {
          generateSceneModal.classList.add('hidden');
          generateSceneModal.style.removeProperty('display');
        }

        currentSessionId = button.dataset.sessionId;
        copilotImages = [];
        render();
        closeHistory();
      });
    });

    historyList.querySelectorAll('.storyboard-copilot-history-delete').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const session = sessions.find((item) => item.id === button.dataset.sessionId);
        if (!session || !confirm(`Hapus percakapan "${session.title || 'Percakapan Baru'}"?`)) return;

        sessions = sessions.filter((item) => item.id !== session.id);
        if (currentSessionId === session.id) {
          if (sessions.length === 0) {
            const nextSession = createSession();
            sessions = [nextSession];
            currentSessionId = nextSession.id;
          } else {
            currentSessionId = sessions[0].id;
          }
        }
        await persistSessions();
        render();
      });
    });
  };

  const open = () => {
    panel.classList.remove('hidden');
    resizer?.classList.remove('hidden');
    render();
    input.focus();
  };
  const close = () => {
    panel.classList.add('hidden');
    resizer?.classList.add('hidden');
  };

  const startNewSession = async () => {
    const createProjectModal = documentRef.getElementById('storyboardCreateProjectModal');
    const generateSceneModal = documentRef.getElementById('storyboardGenerateConfirmModal');
    if (createProjectModal) {
      createProjectModal.classList.add('hidden');
      createProjectModal.style.removeProperty('display');
    }
    if (generateSceneModal) {
      generateSceneModal.classList.add('hidden');
      generateSceneModal.style.removeProperty('display');
    }

    const newSession = createSession();
    sessions.unshift(newSession);
    currentSessionId = newSession.id;
    copilotImages = [];
    input.value = '';
    await persistSessions();
    render();
    closeHistory();
    input.focus();

    if (typeof onNewSession === 'function') {
      try {
        await onNewSession(newSession);
      } catch (err) {
        console.warn('[Storyboard Copilot] onNewSession callback warning:', err);
      }
    }
  };

  const setPanelWidth = (width) => {
    const shell = panel.parentElement;
    if (!shell) return;
    const shellWidth = shell.getBoundingClientRect().width;
    const maxWidth = Math.max(260, Math.floor(shellWidth * 0.58));
    const minWidth = Math.min(260, Math.floor(shellWidth * 0.3));
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, width));
    panel.style.width = `${nextWidth}px`;
    panel.style.flex = `0 0 ${nextWidth}px`;
  };

  let isResizing = false;
  const stopResizing = (event) => {
    if (!isResizing) return;
    isResizing = false;
    resizer?.classList.remove('dragging');
    if (event?.pointerId && resizer?.hasPointerCapture?.(event.pointerId)) {
      try {
        resizer.releasePointerCapture(event.pointerId);
      } catch (_) {}
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  resizer?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    isResizing = true;
    resizer.classList.add('dragging');
    try {
      resizer.setPointerCapture?.(event.pointerId);
    } catch (_) {}
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });
  resizer?.addEventListener('pointermove', (event) => {
    if (!isResizing) return;
    const shell = panel.parentElement;
    if (shell) {
      const bounds = shell.getBoundingClientRect();
      setPanelWidth(bounds.right - event.clientX);
    }
  });
  resizer?.addEventListener('pointerup', stopResizing);
  resizer?.addEventListener('pointercancel', stopResizing);
  window.addEventListener('pointerup', stopResizing);
  resizer?.addEventListener('dblclick', () => {
    panel.style.width = '';
    panel.style.flex = '';
  });
  resizer?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setPanelWidth(panel.offsetWidth + (event.key === 'ArrowLeft' ? 24 : -24));
  });

  window.addEventListener('resize', () => {
    if (panel.style.width && !panel.classList.contains('hidden')) {
      const currentWidth = parseFloat(panel.style.width);
      if (!Number.isNaN(currentWidth)) {
        setPanelWidth(currentWidth);
      }
    }
  });

  openButton?.addEventListener('click', open);
  closeButton?.addEventListener('click', close);

  const updateCopilotScrollToBottom = () => {
    if (!messagesEl || !btnScrollToBottom) return;
    const diff = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    if (diff > 40) {
      btnScrollToBottom.classList.remove('hidden');
      btnScrollToBottom.classList.add('visible');
    } else {
      btnScrollToBottom.classList.add('hidden');
      btnScrollToBottom.classList.remove('visible');
    }
  };

  const handleCopilotScroll = () => {
    updateCopilotScrollToBottom();
    if (isProgrammaticCopilotScroll || !messagesEl) return;
    const diff = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    if (isUserScrollingCopilot && diff > 70) {
      isCopilotAutoScrollActive = false;
    } else if (diff <= 25) {
      isCopilotAutoScrollActive = true;
    }
  };

  const scrollToBottomCopilot = (smooth = true) => {
    if (!messagesEl) return;
    isProgrammaticCopilotScroll = true;
    const performScroll = () => {
      if (!messagesEl) return;
      if (smooth && typeof messagesEl.scrollTo === 'function') {
        messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
      } else {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    };
    performScroll();
    requestAnimationFrame(() => {
      performScroll();
      setTimeout(() => {
        performScroll();
        isProgrammaticCopilotScroll = false;
        updateCopilotScrollToBottom();
      }, 50);
    });
    if (btnScrollToBottom) {
      btnScrollToBottom.classList.add('hidden');
      btnScrollToBottom.classList.remove('visible');
    }
  };

  messagesEl?.addEventListener('scroll', handleCopilotScroll, { passive: true });
  messagesEl?.addEventListener('wheel', () => {
    isUserScrollingCopilot = true;
    clearTimeout(copilotUserScrollTimeout);
    copilotUserScrollTimeout = setTimeout(() => { isUserScrollingCopilot = false; }, 400);
  }, { passive: true });
  messagesEl?.addEventListener('touchstart', () => {
    isUserScrollingCopilot = true;
  }, { passive: true });
  messagesEl?.addEventListener('touchend', () => {
    clearTimeout(copilotUserScrollTimeout);
    copilotUserScrollTimeout = setTimeout(() => { isUserScrollingCopilot = false; }, 400);
  }, { passive: true });
  btnScrollToBottom?.addEventListener('click', (e) => {
    e.preventDefault();
    isCopilotAutoScrollActive = true;
    scrollToBottomCopilot(true);
  });

  newSessionButton?.addEventListener('click', startNewSession);
  historyNewSessionButton?.addEventListener('click', startNewSession);
  historyButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = !historyPopover?.classList.contains('hidden');
    if (!isOpen) renderHistory();
    historyPopover?.classList.toggle('hidden', isOpen);
    historyButton.setAttribute('aria-expanded', String(!isOpen));
  });
  documentRef.addEventListener('click', (event) => {
    if (historyPopover && !historyPopover.contains(event.target) && event.target !== historyButton) {
      closeHistory();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const getCopilotImageKey = (image) => {
    if (!image) return '';
    return (
      image.url ||
      image.thumbnailUrl ||
      image.downloadUrl ||
      image.base64 ||
      image.src ||
      image.id ||
      `${image.name || 'image'}_${image.referenceRole || image.role || 'custom'}`
    );
  };

  const addCopilotImage = (image) => {
    if (!image) return false;
    const normalized = {
      ...image,
      type: 'image',
      referenceRole: image.referenceRole || image.role || 'custom',
      url: image.url || image.thumbnailUrl || image.downloadUrl || image.base64 || '',
      thumbnailUrl: image.thumbnailUrl || image.url || image.downloadUrl || image.base64 || '',
    };
    const key = getCopilotImageKey(normalized);
    if (!key) return false;
    const exists = copilotImages.some((existing) => getCopilotImageKey(existing) === key);
    if (exists) return false;
    copilotImages.push(normalized);
    return true;
  };

  const resizeImageFile = async (file, maxDim = 1280, quality = 0.85) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
            return;
          }
          resolve(e.target?.result || null);
        };
        img.onerror = () => resolve(e.target?.result || null);
        img.src = e.target?.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const addLocalFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    const loaded = await Promise.all(files.map(async (file) => {
      const base64 = await resizeImageFile(file, 1280, 0.85);
      if (!base64) return null;
      return {
        id: `sb_copilot_file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: 'image',
        base64,
        referenceRole: 'custom',
      };
    }));
    const added = loaded.filter(Boolean).filter((image) => addCopilotImage(image));
    if (added.length) render();
  };

  addImageButton?.addEventListener('click', () => {
    if (openImageSourcePicker) {
      openImageSourcePicker({
        fileInput,
        onUploadFiles: addLocalFiles,
        onLibraryAsset: (asset) => {
          if (addCopilotImage({ ...asset, type: 'image', referenceRole: asset.role || 'custom' })) {
            render();
          }
        },
      });
    } else {
      fileInput?.click();
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || isSending || typeof sendMessage !== 'function') return;

    const currentSession = getCurrentSession();
    if (!currentSession) return;

    const context = getContext() || {};
    const messageImages = copilotImages.map((image) => ({ ...image }));
    const userMessage = {
      role: 'user',
      content: text,
      attachments: messageImages,
      timestamp: new Date().toISOString(),
    };
    currentSession.messages.push(userMessage);
    currentSession.updatedAt = new Date().toISOString();
    if (currentSession.messages.length === 1) {
      currentSession.title = text.length > 32 ? `${text.substring(0, 32)}...` : text;
    }
    input.value = '';
    copilotImages = [];
    isSending = true;
    updateComposerState();
    isCopilotAutoScrollActive = true;
    render({ forceScroll: true });
    scrollToBottomCopilot(true);

    const modelDisplayName = modelSelect?.options[modelSelect.selectedIndex]?.text || 'Storyboard AI';
    const assistantMessage = {
      role: 'assistant',
      content: 'Sedang lihat konteks storyboard dan menyiapkan saran yang paling relevan...',
      timestamp: new Date().toISOString(),
      modelDisplayName,
    };
    currentSession.messages.push(assistantMessage);
    render({ forceScroll: true });
    scrollToBottomCopilot(true);
    await persistSessions();

    try {
      const result = await sendMessage({
        text,
        history: currentSession.messages.slice(0, -1),
        context,
        images: messageImages,
        model: modelSelect?.value,
        session: currentSession,
        onStatus: async (statusText) => {
          assistantMessage.content = statusText;
          render();
          if (isCopilotAutoScrollActive) {
            scrollToBottomCopilot(false);
          }
        },
        onAttachImages: async (newAttachments) => {
          if (!userMessage.attachments) userMessage.attachments = [];
          newAttachments.forEach((att) => {
            const url = att.url || att.base64;
            if (!userMessage.attachments.some((a) => (a.url || a.base64) === url)) {
              userMessage.attachments.push(att);
            }
          });
          render();
          if (isCopilotAutoScrollActive) {
            scrollToBottomCopilot(false);
          }
        },
      });
      let handledAction = false;
      let rawCleanText = '';
      let extractedAction = null;

      if (result && typeof result === 'object') {
        if (result.convId) {
          currentSession.dolaConvId = result.convId;
          if (result.sectionId) currentSession.dolaSectionId = result.sectionId;
          if (typeof result.msgIndex === 'number') currentSession.dolaMessageIndex = result.msgIndex;
        }
        rawCleanText = result.text || '';
        extractedAction = result.action || null;
      } else if (typeof result === 'string') {
        const parsed = extractStoryboardCopilotAction(result);
        rawCleanText = parsed.cleanText;
        extractedAction = parsed.action;
      }

      if (extractedAction) {
        if (!Array.isArray(extractedAction.referenceImages) || extractedAction.referenceImages.length === 0) {
          const sessionImgs = [];
          const seen = new Set();
          (currentSession.messages || []).forEach((m) => {
            (m.attachments || []).forEach((att) => {
              const k = att.url || att.base64 || att.id || att.name;
              if (k && !seen.has(k)) {
                seen.add(k);
                sessionImgs.push(att);
              }
            });
          });
          extractedAction.referenceImages = sessionImgs;
        }
        assistantMessage.actionData = extractedAction;
        if ((extractedAction.action === 'generate_scene' || extractedAction.action === 'generate_scenes') && typeof onGenerateRequest === 'function') {
          await onGenerateRequest(extractedAction);
          const requestedScenes = Array.isArray(extractedAction.scenes)
            ? extractedAction.scenes.map((scene) => scene.sceneNumber || scene.id).join(', ')
            : (extractedAction.sceneNumber || extractedAction.sceneId || 'scene terpilih');
          currentSession.messages[currentSession.messages.length - 1].content = rawCleanText || `Permintaan generate ${requestedScenes} sudah disiapkan. Silakan periksa model dan konfirmasi sebelum render.`;
          handledAction = true;
        } else if (extractedAction.action === 'create_storyboard_project' && typeof onCreateProjectRequest === 'function') {
          assistantMessage.content = rawCleanText || (typeof result === 'string' ? result : result?.text) || '🎬 Draft alur storyboard telah disiapkan.';
          try {
            await onCreateProjectRequest(extractedAction);
          } catch (_) {}
          handledAction = true;
        }
      }

      if (!handledAction) {
        currentSession.messages[currentSession.messages.length - 1].content = rawCleanText || result || 'Belum ada saran yang bisa diberikan.';
      }
    } catch (error) {
      currentSession.messages[currentSession.messages.length - 1].content = `Gagal menghubungi Storyboard AI: ${error.message || 'Terjadi kesalahan.'}`;
      showAlert?.('Storyboard Copilot gagal memproses pesan.', 'error');
    } finally {
      currentSession.updatedAt = new Date().toISOString();
      await persistSessions();
      isSending = false;
      updateComposerState();
      render();
      if (isCopilotAutoScrollActive) {
        scrollToBottomCopilot(true);
      }
    }
  });

  const initializeSessions = async () => {
    const savedSessions = storage?.get ? await storage.get(storageKey) : null;
    sessions = Array.isArray(savedSessions) ? savedSessions : [];
    if (!sessions.length) {
      const initialSession = createSession();
      sessions = [initialSession];
      currentSessionId = initialSession.id;
      await persistSessions();
    } else {
      currentSessionId = sessions[0].id;
    }
    render();
  };

  const receiveProductData = async ({ title, price, store, desc, usps = [], images = [], thumbnail = null, dolaConvId = null }) => {
    open();
    let currentSession = getCurrentSession();
    if (!currentSession) {
      currentSession = createSession();
      sessions.unshift(currentSession);
      currentSessionId = currentSession.id;
    }
    if (dolaConvId) {
      currentSession.dolaConvId = dolaConvId;
    }

    // Pasang gambar-gambar referensi visual yang dibawa dari sesi menu chat ke Copilot
    copilotImages = [];
    const seenImageKeys = new Set();
    const addImgToCopilot = (imgData, defaultName, defaultRole = 'product') => {
      if (!imgData) return;
      const url = typeof imgData === 'string'
        ? (imgData.startsWith('http') ? imgData : '')
        : (imgData.url || (imgData.base64?.startsWith('http') ? imgData.base64 : ''));
      const base64 = typeof imgData === 'string'
        ? (imgData.startsWith('data:') ? imgData : '')
        : (imgData.base64 || '');
      const rawSrc = base64 || url || (typeof imgData === 'string' ? imgData : '');
      if (!rawSrc) return;
      const key = rawSrc.length > 80 ? `${rawSrc.slice(0, 40)}_${rawSrc.slice(-30)}` : rawSrc;
      if (seenImageKeys.has(key)) return;
      seenImageKeys.add(key);

      addCopilotImage({
        id: `sb_img_transferred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: (typeof imgData === 'object' && imgData.name) ? imgData.name : defaultName,
        url: url || rawSrc,
        base64: base64 || rawSrc,
        thumbnailUrl: rawSrc,
        referenceRole: (typeof imgData === 'object' && (imgData.referenceRole || imgData.role)) ? (imgData.referenceRole || imgData.role) : defaultRole,
      });
    };

    if (thumbnail) {
      addImgToCopilot(thumbnail, `${title || 'Produk'} (Referensi Utama)`, 'product');
    }
    if (Array.isArray(images)) {
      images.forEach((img, i) => {
        addImgToCopilot(img, (typeof img === 'object' && img.name) ? img.name : `Foto Referensi #${i + 1}`, 'product');
      });
    }

    let uspText = '';
    if (Array.isArray(usps) && usps.length > 0) {
      uspText = `\n✨ **USP Produk:**\n${usps.map((u) => `- ${u}`).join('\n')}`;
    }

    const imgCountText = copilotImages.length > 0
      ? `\n🖼️ **${copilotImages.length} Gambar Referensi** dari sesi chat telah terpasang di Copilot.\n`
      : '';

    const welcomeText = `🎬 **Data Produk Terhubung ke Storyboard Copilot!**\n\n` +
      `📦 **${title}**\n` +
      `${store ? `🏪 Toko/Kreator: **${store}**\n` : ''}` +
      `${price ? `💰 Harga: **${price}**\n` : ''}` +
      `${uspText}\n` +
      `${imgCountText}\n` +
      `Saya sedang menghubungkan konteks produk & gambar referensi ke AI untuk merancang storyboard komersial...`;

    const assistantMsg = {
      role: 'assistant',
      content: welcomeText,
      timestamp: new Date().toISOString(),
      modelDisplayName: 'AI Worker Bridge',
      attachments: copilotImages.map((img) => ({ ...img })),
    };

    currentSession.messages.push(assistantMsg);
    currentSession.updatedAt = new Date().toISOString();
    await persistSessions();
    render();
  };

  const sendPrompt = async (promptText) => {
    if (!promptText || !input) return;
    open();
    input.value = promptText;
    form.requestSubmit();
  };

  initializeSessions();
  return { 
    open, 
    close, 
    render, 
    getMessages: () => [...(getCurrentSession()?.messages || [])],
    receiveProductData,
    sendPrompt,
  };
}
