import React, { useState } from 'react';
import { Sparkles, Lock, User, Mail, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Sun, Moon } from 'lucide-react';
import { AppUser } from '../types';

interface AuthScreenProps {
  onLoginSuccess: (user: AppUser) => void;
  isDarkMode: boolean;
  onToggleDarkMode: (e?: React.MouseEvent) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMsg('Username wajib diisi.');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('Password wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegisterMode) {
        // Register flow
        const resp = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            password: cleanPass,
            email: email.trim(),
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Gagal mendaftarkan user.');
        }

        setSuccessMsg(`Akun "${data.user.userName}" berhasil didaftarkan!`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 1000);
      } else {
        // Login flow
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            password: cleanPass,
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Username atau password salah.');
        }

        // Langsung login tanpa delay notifikasi
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      let msg = err.message || 'Username atau password salah.';
      if (/sheet|spreadsheet|database|\bdb\b|sql/i.test(msg)) {
        msg = 'Username atau password salah.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-stone-100 dark:bg-[#09090B] text-stone-900 dark:text-stone-100 transition-colors duration-300 relative overflow-hidden selection:bg-amber-200 selection:text-amber-900">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-600/10 dark:bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-display text-base sm:text-lg font-normal tracking-tight text-stone-900 dark:text-stone-100">
              AMB MEDIA
            </h1>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 font-mono tracking-wider uppercase">
              Video & Image Studio
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2.5 rounded-2xl bg-white/80 dark:bg-stone-900/80 hover:bg-stone-200/80 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer shadow-2xs"
          title="Ganti Tema"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-stone-600" />
          )}
        </button>
      </div>

      {/* Center Auth Card Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-md bg-white/95 dark:bg-[#141418]/95 backdrop-blur-xl border border-stone-200/90 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl transition-all duration-300 relative">
          
          {/* Card Title & Description */}
          <div className="text-center space-y-2 mb-6">
            <h2 className="font-serif-display text-2xl font-normal text-stone-900 dark:text-white">
              {isRegisterMode ? 'Daftar Akun Baru' : 'Silakan Masuk'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
              Gunakan akun yang terdaftar untuk mengakses studio.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-start gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukan username lengkap"
                  disabled={isLoading}
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            {/* Email Input (if register mode) */}
            {isRegisterMode && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: tempatnyacod@gmail.com"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  disabled={isLoading}
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-900 font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                    <span>Memproses...</span>
                  </>
                ) : isRegisterMode ? (
                  <span>Daftarkan Akun</span>
                ) : (
                  <span>Masuk ke Studio</span>
                )}
              </button>
            </div>

            {/* Clickable Text Link */}
            <div className="text-center pt-2">
              {!isRegisterMode ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline"
                  >
                    Masuk ke Studio
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-6xl mx-auto px-6 py-4 text-center text-xs text-stone-400 dark:text-stone-500 z-10">
        AMB Media
      </div>
    </div>
  );
};
