import React from 'react';
import { Sparkles, Award, Zap, ChevronRight, Heart, Sun, Moon, Mail, ShieldCheck } from 'lucide-react';
import { AppUser } from '../types';

interface ProfileViewProps {
  favoriteCount: number;
  totalGenerationsCount: number;
  onNavigateHistory: () => void;
  currentUser?: AppUser | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (e?: React.MouseEvent) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  favoriteCount,
  totalGenerationsCount,
  onNavigateHistory,
  currentUser,
  onOpenLogin,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const fullName = currentUser?.userName || 'Belum Login';
  const userEmail = currentUser?.email || 'email@domain.com';
  const userInitials = getInitials(currentUser?.userName);

  return (
    <div className="space-y-6 pb-20 max-w-xl mx-auto">
      {/* Profile Header Card */}
      <div className="bg-white/90 dark:bg-stone-900/90 text-stone-900 dark:text-white rounded-xl p-6 relative overflow-hidden border border-stone-200/90 dark:border-stone-800 transition-colors duration-300">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xl font-bold border border-amber-500/30 font-serif-display shrink-0">
              {userInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-display text-xl font-normal text-stone-900 dark:text-white">
                  {fullName}
                </h2>
                <span className="px-2.5 py-0.5 bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  {currentUser ? 'VERIFIED' : 'GUEST'}
                </span>
              </div>
              <p className="font-sans-body text-xs text-stone-500 dark:text-stone-400 font-light mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                <span>{userEmail}</span>
              </p>
              {currentUser?.userId && (
                <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>ID: {currentUser.userId}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-stone-100 dark:border-stone-800">
          <div className="bg-stone-50/80 dark:bg-stone-800/50 p-3.5 rounded-lg border border-stone-200/70 dark:border-stone-700/60 transition-colors">
            <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-semibold font-sans-body">
              Total Generasi
            </p>
            <p className="text-lg font-bold text-stone-900 dark:text-white mt-0.5 font-mono">{totalGenerationsCount}</p>
          </div>

          <div
            onClick={onNavigateHistory}
            className="bg-stone-50/80 dark:bg-stone-800/50 p-3.5 rounded-lg border border-stone-200/70 dark:border-stone-700/60 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1 font-sans-body">
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 dark:text-rose-400 dark:fill-rose-400" />
              <span>Favorit Disimpan</span>
            </p>
            <p className="text-lg font-bold text-stone-900 dark:text-white mt-0.5 font-mono">{favoriteCount}</p>
          </div>
        </div>
      </div>

      {/* Credits Card */}
      <div className="bg-white/90 dark:bg-stone-900/90 rounded-xl border border-stone-200/90 dark:border-stone-800 p-5 space-y-3 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="font-serif-display text-base font-normal text-stone-900 dark:text-stone-100">Kredit AI Studio</h3>
          </div>
          <span className="text-xs font-mono font-medium text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            50 / 50 Tersedia
          </span>
        </div>

        <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
          <div className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full w-[100%]" />
        </div>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-light">Kredit direset setiap bulan secara otomatis.</p>
      </div>

      {/* Account Settings List */}
      <div className="bg-white/90 dark:bg-stone-900/90 rounded-xl border border-stone-200/90 dark:border-stone-800 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800 text-xs transition-colors duration-300">
        <button
          onClick={onNavigateHistory}
          className="w-full flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3 text-stone-700 dark:text-stone-300 font-medium">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Kelola Gallery & Hasil Generasi</span>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>

        <button
          onClick={() => {}}
          className="w-full flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3 text-stone-700 dark:text-stone-300 font-medium">
            <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Status Akun: Terverifikasi</span>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>

        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="w-full flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 text-stone-700 dark:text-stone-300 font-medium">
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-amber-600 dark:text-stone-400" />
              )}
              <span>Tema Tampilan (Mode {isDarkMode ? 'Gelap' : 'Terang'})</span>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 flex items-center gap-1.5">
              {isDarkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                  <span>Mode Gelap</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span>Mode Terang</span>
                </>
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
