import React, { useState, useRef, useEffect } from 'react';
import { Eye, Sparkles, Sun, Moon, ChevronDown, User as UserIcon, LogOut, Download, Package, Check, X, ExternalLink, Zap } from 'lucide-react';
import { NavTab, AppUser } from '../types';
import { extensionBridge, ExtensionBridgeStatus } from '../lib/extensionBridge';

interface HeaderProps {
  activeTab: NavTab;
  providerName?: string;
  currentUser?: AppUser | null;
  onOpenSettings: () => void;
  onOpenInfo?: () => void;
  onOpenLogin?: () => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onSyncHistory?: () => void;
  isSyncingHistory?: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: (e?: React.MouseEvent) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  providerName = 'Weavy',
  currentUser,
  onOpenSettings,
  onOpenInfo,
  onOpenLogin,
  onOpenProfile,
  onLogout,
  onSyncHistory,
  isSyncingHistory,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionBridgeStatus>(() => extensionBridge.getStatus());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = extensionBridge.subscribe(setExtensionStatus);
    return () => unsubscribe();
  }, []);

  const handleDownloadExtension = async (type: string = 'weavy') => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const resp = await fetch(`/api/extension/download?type=${type}&t=${Date.now()}`);
      if (!resp.ok) {
        throw new Error(`Server returned status ${resp.status}`);
      }
      const blob = await resp.blob();
      const filename = type === 'gemini' ? 'ektension-gemini-google.zip' : 'ektension-weavy.zip';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      setShowExtensionModal(true);
    } catch (err) {
      console.warn('Fallback direct download:', err);
      const fallbackFilename = type === 'gemini' ? 'ektension-gemini-google.zip' : 'ektension-weavy.zip';
      const link = document.createElement('a');
      link.href = `/api/extension/download?type=${type}&t=${Date.now()}`;
      link.download = fallbackFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShowExtensionModal(true);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'generate':
        return { title: 'Generate', subtitle: 'Create videos and images with AI' };
      case 'batch':
        return { title: 'Batch', subtitle: 'Generate multiple videos with RunningHub' };
      case 'canvas':
        return { title: 'Canvas Studio', subtitle: 'Visual node workflow & Weavy recipe generator' };
      case 'history':
        return { title: 'Histori Generasi', subtitle: 'Semua riwayat media hasil pembuatan AI' };
      case 'chat':
        return { title: 'AI Chat & Copilot', subtitle: 'Percakapan multimodal, bedah produk e-commerce & pembuatan naskah' };
      case 'studio':
        return { title: 'Studio Storyboard', subtitle: 'Analisis multimodal video, scene generation & composite 1-sheet' };
      case 'settings':
        return { title: 'Settings', subtitle: 'Manage AI providers and accounts' };
      case 'profile':
        return { title: 'Profile', subtitle: 'User settings and preferences' };
      default:
        return { title: 'AMB Media', subtitle: 'AI Video Generator' };
    }
  };

  const { title, subtitle } = getTabTitle();

  const userInitial = currentUser?.firstName?.charAt(0).toUpperCase() || currentUser?.userName?.charAt(0).toUpperCase() || 'U';
  const displayFirstName = currentUser?.firstName || currentUser?.userName?.split(' ')[0] || 'Tamu';

  return (
    <header className="sticky top-0 z-30 bg-[#ECE9E3]/95 dark:bg-[#0E0E12]/90 backdrop-blur-md border-b border-stone-300 dark:border-white/8 px-4 py-3.5 transition-colors duration-300">
      <div className="w-full max-w-[1720px] mx-auto flex items-center justify-between">
        {/* Mobile App Title */}
        <div className="flex lg:hidden items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 dark:border-amber-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif-display text-base font-normal text-stone-900 dark:text-stone-100 leading-none">AMB Media</h1>
            <p className="font-sans-body text-[10px] text-stone-500 dark:text-stone-400 font-light mt-0.5">Video & Image Generator</p>
          </div>
        </div>

        {/* Desktop Breadcrumb / Title */}
        <div className="hidden lg:block">
          <h1 className="font-serif-display text-2xl font-normal text-stone-900 dark:text-stone-100 tracking-tight leading-snug">{title}</h1>
          <p className="font-sans-body text-xs text-stone-500 dark:text-stone-400 font-light">{subtitle}</p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Download Extension ZIP Button */}
          <button
            type="button"
            onClick={() => handleDownloadExtension('weavy')}
            disabled={isDownloading}
            className="p-2 text-stone-600 dark:text-amber-400 hover:text-stone-900 dark:hover:text-amber-300 hover:bg-stone-200/60 dark:hover:bg-amber-500/10 rounded-lg border border-transparent dark:border-white/5 transition-all cursor-pointer flex items-center justify-center relative group"
            title={
              extensionStatus.isConnected
                ? `Ekstensi Chrome Terhubung (v${extensionStatus.version || '3.0.0'}) - Klik untuk opsi unduh/panduan`
                : 'Download Ekstensi Chrome (ZIP) - Weavy, Gemini Omni, Canvas & Storyboard'
            }
            aria-label="Download Ekstensi Chrome ZIP"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-stone-600 dark:text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
            )}
            {/* Live Extension Signal Status Dot */}
            {extensionStatus.isConnected && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#ECE9E3] dark:ring-[#0E0E12] animate-pulse" />
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 text-stone-600 dark:text-amber-400 hover:text-stone-900 dark:hover:text-amber-300 hover:bg-stone-200/60 dark:hover:bg-amber-500/10 rounded-lg border border-transparent dark:border-white/5 transition-all cursor-pointer flex items-center justify-center"
            title={isDarkMode ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-stone-600 shrink-0" />
            )}
          </button>

          {/* Live Web Preview Button */}
          <a
            href={typeof window !== 'undefined' && (window.location.origin.includes('run.app') || window.location.origin.includes('aistudio'))
              ? window.location.origin
              : 'https://ais-pre-vzqpjq2uff6j4kc6hy3dzw-680100048602.asia-southeast1.run.app'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-amber-300 hover:bg-stone-200/60 dark:hover:bg-white/5 rounded-lg border border-transparent dark:border-white/5 transition-all cursor-pointer flex items-center justify-center relative group"
            title="Buka Live Preview Web (run.app)"
            aria-label="Buka Live Preview Web"
          >
            <Eye className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
          </a>

          {/* User Profile Badge with Dropdown */}
          {currentUser ? (
            <div className="relative pl-2 border-l border-stone-200 dark:border-white/10" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer text-left select-none"
                title="Menu Pengguna"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold text-xs flex items-center justify-center border border-amber-500/30 dark:border-amber-500/40">
                  {userInitial}
                </div>
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 max-w-[100px] truncate">
                  {displayFirstName}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu (Profile & Keluar) */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800 rounded-xl shadow-lg p-1 z-50 animate-fade-in divide-y divide-stone-100 dark:divide-stone-800">
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                      {currentUser.userName}
                    </p>
                    <p className="text-[10px] text-stone-400 truncate">
                      {currentUser.email || 'Akun Terverifikasi'}
                    </p>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (onOpenProfile) onOpenProfile();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-stone-700 dark:text-stone-300 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer text-left font-medium"
                    >
                      <UserIcon className="w-4 h-4 text-amber-500" />
                      <span>Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-white/10 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center border border-amber-500/30">
                <UserIcon className="w-4 h-4" />
              </div>
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Extension Install Guide Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-stone-50 dark:bg-[#121318] border border-stone-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#18181f]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-stone-900 dark:text-white">Ekstensi Chrome Siap Dipasang</h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">ektension-weavy.zip berhasil diunduh</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Steps */}
            <div className="p-5 space-y-3.5 text-xs text-stone-700 dark:text-stone-300">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>File <strong>ektension-weavy.zip</strong> telah dikirim ke folder Downloads komputer Anda.</span>
              </div>

              <div className="space-y-2.5 pt-1">
                <p className="font-semibold text-stone-900 dark:text-white text-xs">Cara Pasang di Google Chrome:</p>
                <ol className="space-y-2 list-decimal list-inside text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
                  <li><strong>Ekstrak</strong> file <code className="px-1 py-0.5 bg-stone-200 dark:bg-white/10 rounded">ektension-weavy.zip</code> ke folder komputer Anda.</li>
                  <li>Buka browser Chrome, buka tab baru lalu ketik: <code className="px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded font-mono font-semibold">chrome://extensions</code></li>
                  <li>Aktifkan sakelar <strong>&quot;Developer mode&quot;</strong> (Mode pengembang) di pojok kanan atas.</li>
                  <li>Klik tombol <strong>&quot;Load unpacked&quot;</strong> (Muat yang belum dibongkar) di pojok kiri atas.</li>
                  <li>Pilih folder <code className="px-1 py-0.5 bg-stone-200 dark:bg-white/10 rounded">ektension-weavy</code> yang sudah diekstrak tadi.</li>
                  <li>Selesai! Fitur Weavy, Google Gemini (Omni Flash), Storyboard, dan Canvas siap digunakan di ekstensi.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-stone-100/60 dark:bg-[#16171d] border-t border-stone-200 dark:border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadExtension('weavy')}
                  className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Ulang (Weavy)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-xs shadow-sm transition-colors cursor-pointer"
              >
                Mengerti &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
