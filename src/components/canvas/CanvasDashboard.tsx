import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Folder,
  Trash2,
  MoreVertical,
  Edit2,
  Copy,
  Download,
  RotateCcw,
  ChevronDown,
  Check,
  ExternalLink,
} from 'lucide-react';
import { CanvasFile, CanvasRecipe } from '../../types/canvas';
import { formatLastEdited } from '../../lib/canvasFileManager';

interface CanvasDashboardProps {
  files: CanvasFile[];
  activeWorkspaceName?: string;
  userAvatarInitial?: string;
  weavyAccounts?: any[];
  activeAccountId?: string;
  onSelectAccount?: (accId: string) => void;
  onCreateNewFile: (presetRecipe?: CanvasRecipe, title?: string) => void;
  onOpenFile: (file: CanvasFile) => void;
  onDuplicateFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onDeleteFile: (fileId: string, permanent?: boolean) => void;
  onRestoreFile: (fileId: string) => void;
  onCleanEmptyFiles?: () => void;
  onBackToApp?: () => void;
}

type TabType = 'myFiles' | 'trash';

export const CanvasDashboard: React.FC<CanvasDashboardProps> = ({
  files,
  activeWorkspaceName = 'Tempat Fashion',
  userAvatarInitial = 'T',
  weavyAccounts = [],
  activeAccountId,
  onSelectAccount,
  onCreateNewFile,
  onOpenFile,
  onDuplicateFile,
  onRenameFile,
  onDeleteFile,
  onRestoreFile,
  onCleanEmptyFiles,
  onBackToApp,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('myFiles');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  // Check if there are redundant empty untitled files
  const hasEmptyFiles = useMemo(() => {
    return files.some(
      (f) =>
        !f.isTrash &&
        (!f.name || f.name === 'untitled') &&
        (!f.recipe || !f.recipe.nodes || f.recipe.nodes.length === 0)
    );
  }, [files]);

  // Active dropdown menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-container]')) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (editingFileId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingFileId]);

  // Support pasting image on dashboard to create a new canvas file directly
  useEffect(() => {
    const handleDashboardPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        ((activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type !== 'file') ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isTyping) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      let file: File | null = null;
      if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const f = clipboardData.files[i];
          if (f.type.startsWith('image/')) {
            file = f;
            break;
          }
        }
      }
      if (!file && clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            file = item.getAsFile();
            if (file) break;
          }
        }
      }

      if (file) {
        e.preventDefault();
        e.stopPropagation();
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const width = img.naturalWidth || 512;
            const height = img.naturalHeight || 512;
            const detectedRatio =
              width / height >= 1.5
                ? '16:9'
                : width / height >= 1.15
                ? '4:3'
                : height / width >= 1.5
                ? '9:16'
                : height / width >= 1.15
                ? '3:4'
                : '1:1';

            const newRecipe: CanvasRecipe = {
              id: `recipe_${Date.now()}`,
              name: file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Pasted Image Flow',
              nodes: [
                {
                  id: `node_imageInput_${Date.now()}`,
                  type: 'imageInput',
                  title: 'Source Image',
                  subtitle: 'Input gambar referensi',
                  colorTheme: 'blue',
                  position: { x: 120, y: 160 },
                  inputs: [],
                  outputs: [
                    { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
                  ],
                  data: {
                    imageUrl: dataUrl,
                    fileName: file?.name || 'pasted_image.png',
                    naturalWidth: width,
                    naturalHeight: height,
                    aspectRatio: detectedRatio,
                  },
                },
              ],
              edges: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            onCreateNewFile(
              newRecipe,
              file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Pasted Image Recipe'
            );
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
    };

    window.addEventListener('paste', handleDashboardPaste);
    return () => window.removeEventListener('paste', handleDashboardPaste);
  }, [onCreateNewFile]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    let result = files;

    if (activeTab === 'trash') {
      result = result.filter((f) => f.isTrash);
    } else {
      result = result.filter((f) => !f.isTrash);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }

    return result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [files, activeTab, searchQuery]);

  const handleStartRename = (e: React.MouseEvent, file: CanvasFile) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingFileId(file.id);
    setEditingTitle(file.name);
  };

  const handleSaveRename = (fileId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameFile(fileId, trimmed);
    }
    setEditingFileId(null);
  };

  const handleExportJSON = (e: React.MouseEvent, file: CanvasFile) => {
    e.stopPropagation();
    setMenuOpenId(null);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(file.recipe, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${file.name.replace(/\s+/g, '_')}_recipe.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="canvas-light-skin w-full h-screen bg-[#111114] text-stone-100 flex overflow-hidden font-sans select-none">
      {/* LEFT SIDEBAR (Identical to Weavy) */}
      <aside className="w-64 bg-[#141417] border-r border-white/5 flex flex-col justify-between shrink-0 p-4">
        <div className="flex flex-col gap-4">
          {/* Workspace Switcher */}
          <div className="relative" data-menu-container>
            <div
              onClick={() => {
                if (weavyAccounts && weavyAccounts.length > 0) {
                  setIsWorkspaceMenuOpen((prev) => !prev);
                }
              }}
              className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
              title="Ganti akun Weavy / Workspace aktif"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {userAvatarInitial}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-stone-200 group-hover:text-white truncate leading-tight">
                    {activeWorkspaceName}
                  </span>
                  {weavyAccounts && weavyAccounts.length > 0 && (
                    <span className="text-[10px] text-stone-400 truncate">
                      {weavyAccounts.find((a: any) => a.id === activeAccountId || a.isActive)?.credits ?? 0} Kredit
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 group-hover:text-stone-200 shrink-0 transition-transform ${isWorkspaceMenuOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown for switching Weavy accounts */}
            {isWorkspaceMenuOpen && weavyAccounts && weavyAccounts.length > 0 && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-white/5 flex items-center justify-between">
                  <span>Pilih Akun Weavy</span>
                  <span>{weavyAccounts.length} Akun</span>
                </div>
                <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                  {weavyAccounts.map((acc: any) => {
                    const isCurrent = acc.id === activeAccountId || (!activeAccountId && acc.isActive);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          if (onSelectAccount) {
                            onSelectAccount(acc.id);
                          }
                          setIsWorkspaceMenuOpen(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-sky-500/20 text-white font-semibold border border-sky-500/30'
                            : 'hover:bg-white/5 text-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isCurrent ? 'bg-sky-500 text-white' : 'bg-stone-800 text-stone-300'
                          }`}>
                            {(acc.name || acc.email || 'W').charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="truncate text-xs leading-tight">
                              {acc.name || (acc.email ? acc.email.split('@')[0] : 'Akun Weavy')}
                            </p>
                            {acc.email && (
                              <p className="text-[10px] text-stone-400 truncate">{acc.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[11px] font-bold text-amber-400">
                            {typeof acc.credits === 'number' ? acc.credits : 0} K
                          </span>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* + Create New File Button */}
          <button
            type="button"
            onClick={() => onCreateNewFile()}
            className="w-full h-10 px-4 rounded-xl bg-white hover:bg-stone-100 active:scale-[0.98] text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-stone-950 stroke-[2.5]" />
            <span>Create New File</span>
          </button>


          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 mt-2">
            <button
              type="button"
              onClick={() => setActiveTab('myFiles')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'myFiles'
                  ? 'bg-[#222227] text-white font-semibold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
              }`}
            >
              <Folder className="w-4 h-4 shrink-0" />
              <span>My Files</span>
              <span className="ml-auto text-[10px] text-stone-500">
                {files.filter((f) => !f.isTrash).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'trash'
                  ? 'bg-[#222227] text-white font-semibold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
              }`}
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Trash</span>
              {files.filter((f) => f.isTrash).length > 0 && (
                <span className="ml-auto text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full">
                  {files.filter((f) => f.isTrash).length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <span>← Generator Studio</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#16161a]">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between shrink-0">
          <h1 className="text-base font-bold text-white tracking-tight">
            {activeTab === 'myFiles' && 'My files'}
            {activeTab === 'trash' && 'Trash'}
          </h1>

          <div className="flex items-center gap-3">
            {/* Clean empty files button if there are empty files */}
            {activeTab === 'myFiles' && hasEmptyFiles && onCleanEmptyFiles && (
              <button
                type="button"
                onClick={onCleanEmptyFiles}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202026] hover:bg-rose-500/15 text-stone-300 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 text-xs font-medium transition-all cursor-pointer select-none active:scale-95"
                title="Hapus semua draft kosong yang belum memiliki node"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Bersihkan File Kosong</span>
              </button>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-56 h-8 pl-8 pr-3 rounded-xl bg-[#202026] border border-white/5 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#202026] border border-white/5 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#2d2d35] text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="List view"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#2d2d35] text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-center text-stone-400">
                  <Folder className="w-10 h-10 stroke-1 text-stone-500 mb-3" />
                  <h3 className="text-xs font-semibold text-stone-300">
                    {activeTab === 'trash' ? 'Trash is empty' : 'Belum ada file canvas'}
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-1 max-w-sm mb-4">
                    {activeTab === 'trash'
                      ? 'File yang dihapus akan muncul di sini.'
                      : searchQuery
                      ? `Tidak ada file yang cocok dengan "${searchQuery}".`
                      : 'Kanvas Anda masih bersih. Buat file baru untuk mulai merangkai alur AI buatan Anda sendiri.'}
                  </p>
                  {activeTab === 'myFiles' && (
                    <button
                      type="button"
                      onClick={() => onCreateNewFile()}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Buat File Kanvas Bersih</span>
                    </button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                /* GRID VIEW (Exact match to Weavy screenshot) */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {filteredFiles.map((file) => {
                    // Extract preview images from recipe if available
                    const imageNodes = file.recipe?.nodes?.filter(
                      (n) =>
                        (n.type === 'imageViewer' && n.data?.resultUrl) ||
                        (n.type === 'imageInput' && n.data?.imageUrl)
                    ) || [];

                    const hasImages = imageNodes.length > 0;

                    return (
                      <div
                        key={file.id}
                        onClick={() => !file.isTrash && onOpenFile(file)}
                        className={`group relative rounded-2xl bg-[#1c1c22] border border-white/5 hover:border-white/20 transition-all flex flex-col overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-0.5 ${
                          file.isTrash ? 'opacity-70' : 'cursor-pointer'
                        }`}
                      >
                        {/* THUMBNAIL AREA (3:4 aspect ratio matching Weavy) */}
                        <div className="aspect-[3/4] w-full bg-[#121215] relative overflow-hidden flex items-center justify-center p-3 border-b border-white/5">
                          {hasImages ? (
                            /* Visual miniature node graph preview with images */
                            <div className="w-full h-full relative flex items-center justify-center">
                              {/* Background miniature connections */}
                              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                                <path
                                  d="M 20 40 Q 60 70 100 60"
                                  fill="none"
                                  stroke="#a855f7"
                                  strokeWidth="1.5"
                                />
                                <path
                                  d="M 80 80 Q 120 110 160 90"
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="1.5"
                                />
                              </svg>

                              {/* Mini Node Cards representation */}
                              <div className="flex items-center gap-1.5 z-10 scale-90">
                                {imageNodes.slice(0, 3).map((node, idx) => {
                                  const imgUrl =
                                    node.type === 'imageViewer'
                                      ? node.data?.resultUrl
                                      : node.data?.imageUrl;

                                  return (
                                    <div
                                      key={node.id || idx}
                                      className="w-16 rounded-lg bg-[#1a1a20] border border-white/10 p-1 shadow-md overflow-hidden flex flex-col"
                                    >
                                      <div className="h-1.5 w-6 rounded-full bg-stone-600 mb-1" />
                                      {imgUrl ? (
                                        <img
                                          src={imgUrl}
                                          alt="Preview"
                                          className="w-full aspect-[9/16] object-cover rounded-md"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="w-full aspect-[9/16] bg-stone-800 rounded-md" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            /* Weavy Clean Flowchart Schematic Icon (As seen in untitled cards) */
                            <div className="w-full h-full flex items-center justify-center">
                              <svg
                                className="w-10 h-10 text-white/30 group-hover:text-white/60 transition-colors"
                                viewBox="0 0 48 48"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                {/* Left Source Node */}
                                <rect x="6" y="20" width="10" height="8" rx="2" />
                                {/* Connecting Wires */}
                                <path d="M16 24h8m0 0v-10h8m-8 10v10h8" />
                                {/* Right Top Target Node */}
                                <rect x="32" y="10" width="10" height="8" rx="2" />
                                {/* Right Bottom Target Node */}
                                <rect x="32" y="30" width="10" height="8" rx="2" />
                              </svg>
                            </div>
                          )}

                          {/* Quick Options Button (...) */}
                          <div
                            data-menu-container
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === file.id ? null : file.id);
                              }}
                              className="w-6 h-6 rounded-lg bg-[#202026]/90 hover:bg-[#2d2d35] text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {menuOpenId === file.id && (
                              <div className="absolute right-0 top-7 w-36 py-1 rounded-xl bg-[#202026] border border-white/10 shadow-2xl z-40 text-xs flex flex-col">
                                {!file.isTrash ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => handleStartRename(e, file)}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-stone-300 hover:text-white transition-colors text-left"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Rename</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId(null);
                                        onDuplicateFile(file.id);
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-stone-300 hover:text-white transition-colors text-left"
                                    >
                                      <Copy className="w-3 h-3" />
                                      <span>Duplicate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleExportJSON(e, file)}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 text-stone-300 hover:text-white transition-colors text-left"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Export JSON</span>
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId(null);
                                        onDeleteFile(file.id, false);
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/10 text-rose-400 transition-colors text-left"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Move to Trash</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId(null);
                                        onRestoreFile(file.id);
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-500/10 text-emerald-400 transition-colors text-left"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Restore</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId(null);
                                        onDeleteFile(file.id, true);
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/15 text-rose-400 transition-colors text-left"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete Forever</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* CARD INFO FOOTER */}
                        <div className="p-3 bg-[#1c1c22]">
                          {editingFileId === file.id ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                ref={renameInputRef}
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(file.id);
                                  if (e.key === 'Escape') setEditingFileId(null);
                                }}
                                className="w-full bg-[#141418] border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(file.id)}
                                className="p-1 rounded bg-amber-500 text-stone-950 hover:bg-amber-400"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <h3 className="text-xs font-semibold text-stone-200 truncate group-hover:text-white transition-colors">
                              {file.name || 'untitled'}
                            </h3>
                          )}
                          <p className="text-[11px] text-stone-500 mt-1 truncate">
                            {formatLastEdited(file.updatedAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* LIST VIEW */
                <div className="w-full bg-[#1c1c22] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold text-stone-500 border-b border-white/5">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-3">Nodes</div>
                    <div className="col-span-3">Last edited</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => !file.isTrash && onOpenFile(file)}
                        className={`grid grid-cols-12 items-center px-4 py-3 text-xs transition-colors group ${
                          file.isTrash ? 'opacity-70' : 'hover:bg-white/5 cursor-pointer'
                        }`}
                      >
                        <div className="col-span-6 flex items-center gap-3">
                          <Folder className="w-4 h-4 text-stone-400 group-hover:text-amber-400 transition-colors shrink-0" />
                          <span className="font-medium text-stone-200 group-hover:text-white truncate">
                            {file.name}
                          </span>
                        </div>
                        <div className="col-span-3 text-stone-400 text-[11px]">
                          {file.recipe?.nodes?.length || 0} nodes
                        </div>
                        <div className="col-span-3 text-stone-500 text-[11px] flex items-center justify-between">
                          <span>{formatLastEdited(file.updatedAt)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === file.id ? null : file.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-stone-300 transition-opacity"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
        </div>
      </main>
    </div>
  );
};
