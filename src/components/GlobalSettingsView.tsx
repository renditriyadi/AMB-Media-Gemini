import React, { useState, useEffect, useRef } from 'react';
import { GEMINI_MAX_CREDITS } from '../lib/provider';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreVertical,
  Lock,
  X,
  Eye,
  EyeOff,
  Trash2,
  Check,
  Loader2,
  Zap,
  RefreshCw,
  Upload,
  FileText,
  User,
  Users,
  Search,
  Pencil,
  BookOpen,
  ChevronDown,
  Copy,
  Square,
  CheckSquare,
  Cloud,
  Database,
  Key,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Ban,
  LayoutList,
  LayoutGrid,
  ExternalLink,
  LogIn,
  Globe,
} from 'lucide-react';
import { GenerationSettings, AppUser, ProviderAccount } from '../types';
import { exchangeRefreshTokenAndGetInfo } from '../lib/weavy';
import { extensionBridge, ExtensionBridgeStatus } from '../lib/extensionBridge';
import { GeminiPlaywrightAddAccount } from './gemini/GeminiPlaywrightAddAccount';

export type { ProviderAccount };

// Helper to sanitize Google email / usernames and remove escape artifacts (like hex \x22 quote residue)
function cleanEmailArtifacts(str?: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/^(\\x22|x22|\\\"|\"|'|%22)/i, '')
    .replace(/(\\x22|x22|\\\"|\"|'|%22)$/i, '')
    .replace(/^x22([a-zA-Z0-9])/i, '$1')
    .trim();
}

function ensureSingleActiveAccount(
  accounts: ProviderAccount[],
  preferredAccountId?: string | null,
): ProviderAccount[] {
  if (accounts.length === 0) return accounts;
  const activeAccount =
    accounts.find((account) => account.id === preferredAccountId) ||
    accounts.find((account) => account.isActive) ||
    accounts[0];
  return accounts.map((account) => ({
    ...account,
    isActive: account.id === activeAccount.id,
  }));
}

export interface ProviderInfo {
  id: string;
  name: string;
  logoType: 'weavy' | 'roboneo' | 'galleri5' | 'kie' | 'runninghub' | 'openai' | 'google' | 'gemini' | 'flow' | 'vids';
  accounts: ProviderAccount[];
}

const GEMINI_BOOKMARKLET_SCRIPT = `javascript:(async()=>{if(!location.host.includes("gemini.google.com")){if(confirm("Buka https://gemini.google.com sekarang?")){location.href="https://gemini.google.com"}return}const c=document.cookie;if(!c||!c.includes("SID=")){alert("Cookie belum ditemukan. Pastikan sudah login di gemini.google.com.");return}try{await navigator.clipboard.writeText(c)}catch(_){}prompt("Cookie Google Gemini (sudah dicopy):",c)})();`;

const GeminiTokenTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(GEMINI_BOOKMARKLET_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Panduan Tambah Akun Google Gemini</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          <span className="text-xs font-medium">{isOpen ? 'Tutup' : 'Buka Panduan'}</span>
          <ChevronDown className={`w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-4">
            {/* Opsi 1: Google Gemini Web Session */}
            <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border border-blue-500/20 space-y-2">
              <p className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <span>🌟 Opsi 1: Google Gemini Web (Cookies / cURL)</span>
              </p>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                Gunakan akun sesi langsung dari <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-bold underline">gemini.google.com</a> untuk interaksi web streaming multi-turn tak terbatas.
              </p>
              <div className="relative group bg-stone-950 dark:bg-[#0E0E12] text-stone-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-all max-h-36 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner my-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-[10px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs z-10"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>Tercopy!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Bookmarklet</span>
                    </>
                  )}
                </button>
                <p className="pr-24 text-stone-300 select-all">{GEMINI_BOOKMARKLET_SCRIPT}</p>
              </div>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                Atau di Network tab inspect F12 copy cURL dari request <code>gemini.google.com</code> lalu paste di form Tambah Akun.
              </p>
            </div>

            {/* Opsi 2: Google AI Studio API Key */}
            <div className="p-3 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border border-purple-500/20 space-y-1.5">
              <p className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <span>🔑 Opsi 2: Google AI Studio API Key (AIzaSy...)</span>
              </p>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                Buka <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 font-bold underline">aistudio.google.com/apikey</a> → <b>Create API Key</b> → copy dan paste di form Tambah Akun.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VidsTokenTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Panduan Tambah Akun Google Vids (cURL Bash)</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          <span className="text-xs font-medium">{isOpen ? 'Tutup' : 'Buka Panduan'}</span>
          <ChevronDown className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-3">
            <p className="leading-relaxed">
              1. Buka <a href="https://docs.google.com/videos" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 underline">docs.google.com/videos</a> atau buka dokumen Vids (.flix) Anda yang sudah login.
            </p>
            <p className="leading-relaxed">
              2. Tekan <strong className="font-bold">F12</strong> (Developer Tools) → buka tab <strong className="font-bold">Network</strong>.
            </p>
            <p className="leading-relaxed">
              3. Refresh halaman (<kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 rounded text-[10px]">F5</kbd>) atau klik di dokumen Vids, cari request apapun ke <code>docs.google.com</code>, <code>appsgenaiserver</code>, atau <code>waa-pa</code>, klik kanan → <strong className="font-bold">Copy → Copy as cURL (bash)</strong>.
            </p>
            <p className="leading-relaxed">
              4. Paste perintah cURL tersebut di form Tambah Akun di bawah. Email, Doc ID, Token Sesi, dan Cookie akan diekstrak otomatis. Setiap akun mendapatkan <strong className="font-bold">500 kuota kredit</strong> (~11 video per siklus)!
            </p>
            <div className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠️ Catatan Penting HttpOnly:</span>
              </p>
              <p>
                Jangan mengambil cookie lewat console/bookmarklet biasa karena cookie penting Google (<code>HSID</code> & <code>SSID</code>) dilindungi <strong>HttpOnly</strong>. Gunakan <strong>Copy as cURL (bash)</strong> dari tab Network agar seluruh cookie tersalin lengkap dan terverifikasi 100%.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FlowTokenTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sampleCurl = `curl --url 'https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData' -H 'authorization: SAPISIDHASH ...' -b 'SID=...; __Secure-1PSID=...; SAPISID=...' ...`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Panduan Tambah Akun Google Flow (cURL Bash)</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          <span className="text-xs font-medium">{isOpen ? 'Tutup' : 'Buka Panduan'}</span>
          <ChevronDown className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-3">
            <p className="leading-relaxed">
              1. Buka <a href="https://flow.google.com" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-600 dark:text-emerald-400 underline">flow.google.com</a> dan pastikan Anda sudah login dengan akun Google Anda.
            </p>
            <p className="leading-relaxed">
              2. Tekan <strong className="font-bold">F12</strong> (Developer Tools) → buka tab <strong className="font-bold">Network</strong>.
            </p>
            <p className="leading-relaxed">
              3. Lakukan aksi di halaman Flow atau refresh, cari request ke <code>GetAsyncData</code>, klik kanan → <strong className="font-bold">Copy → Copy as cURL (bash)</strong>.
            </p>
            <p className="leading-relaxed">
              4. Klik tombol <strong className="font-bold text-emerald-600 dark:text-emerald-400">+ Tambah Akun</strong> di bawah, lalu paste perintah cURL tersebut. Setiap akun mendapatkan <strong className="font-bold">50 kredit harian</strong> Google Flow!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const WEAVY_BOOKMARKLET_SCRIPT = `javascript:(async()=>{const w=r=>new Promise((o,n)=>{r.onsuccess=()=>o(r.result);r.onerror=()=>n(r.error)});if(location.host!=="app.weavy.ai"){alert("Buka app.weavy.ai dulu");return}const db=await w(indexedDB.open("firebaseLocalStorageDb"));const s=db.transaction("firebaseLocalStorage","readonly").objectStore("firebaseLocalStorage");const items=await w(s.getAll());db.close();const t=items.map(i=>(i?.value||i)).filter(v=>v?.stsTokenManager?.refreshToken).map(v=>({e:v.email||"",t:v.stsTokenManager.refreshToken}));if(!t.length){alert("Token tidak ditemukan. Login dulu.");return}try{await navigator.clipboard.writeText(t[0].t)}catch{}prompt("Token "+(t[0].e||"Weavy")+" (sudah dicopy):",t[0].t)})();`;

const WeavyTokenTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(WEAVY_BOOKMARKLET_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Cara Ambil Refresh Token</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                Login ke <a href="https://app.weavy.ai" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">app.weavy.ai</a> dengan akun yang mau ditambahkan.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-2 flex-1 min-w-0">
                <p className="pt-0.5 font-medium">Buat <strong className="font-bold text-stone-900 dark:text-stone-100">bookmark</strong> berisi script ini:</p>
                
                {/* Code Box */}
                <div className="relative group bg-stone-950 dark:bg-[#0E0E12] text-stone-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-all max-h-36 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner my-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-[10px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs z-10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Tercopy!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Kode</span>
                      </>
                    )}
                  </button>
                  <p className="pr-20 text-stone-300 select-all">{WEAVY_BOOKMARKLET_SCRIPT}</p>
                </div>

                {/* Device instructions */}
                <div className="space-y-1.5 text-[11px] text-stone-600 dark:text-stone-400 pt-1 leading-relaxed">
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">HP (Chrome):</strong> Buat bookmark sembarang → Edit → ganti URL-nya dengan kode di atas → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">app.weavy.ai</span> → ketik nama bookmark di address bar.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">PC (Chrome/Edge):</strong> Tampilkan Bookmarks Bar → klik kanan → "Tambah halaman baru" → paste kode di kolom URL → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">app.weavy.ai</span> → klik bookmark.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">Alternatif (F12):</strong> Buka <span className="text-amber-600 dark:text-amber-400 font-medium">app.weavy.ai</span> → tekan F12 → tab Console → paste kode (tanpa "javascript:") → Enter.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                3
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                Token otomatis disalin ke clipboard. Klik <strong className="font-bold text-amber-600 dark:text-amber-400">+ Tambah</strong> lalu paste.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GALLERI5_BOOKMARKLET_SCRIPT = `javascript:(async()=>{const w=r=>new Promise((o,n)=>{r.onsuccess=()=>o(r.result);r.onerror=()=>n(r.error)});if(!location.host.includes("galleri5.com")){alert("Buka aistudio.galleri5.com dulu!");return}try{const db=await w(indexedDB.open("firebaseLocalStorageDb"));const s=db.transaction("firebaseLocalStorage","readonly").objectStore("firebaseLocalStorage");const items=await w(s.getAll());db.close();const t=items.map(i=>(i?.value||i)).filter(v=>v?.stsTokenManager?.refreshToken).map(v=>({e:v.email||"",t:v.stsTokenManager.refreshToken}));if(!t.length){alert("Token tidak ditemukan. Silakan login ke Galleri5 dulu.");return}try{await navigator.clipboard.writeText(t[0].t)}catch{}prompt("Refresh Token Galleri5 ("+(t[0].e||"User")+") - Sudah dicopy:",t[0].t)}catch(e){alert("Gagal mengambil token: "+e.message)}})();`;

const Galleri5TokenTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(GALLERI5_BOOKMARKLET_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Cara Ambil Refresh Token</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                Login ke <a href="https://aistudio.galleri5.com" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">aistudio.galleri5.com</a> dengan akun yang mau ditambahkan.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-2 flex-1 min-w-0">
                <p className="pt-0.5 font-medium">Buat <strong className="font-bold text-stone-900 dark:text-stone-100">bookmark</strong> berisi script ini:</p>
                
                {/* Code Box */}
                <div className="relative group bg-stone-950 dark:bg-[#0E0E12] text-stone-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-all max-h-36 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner my-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-[10px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs z-10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Tercopy!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Kode</span>
                      </>
                    )}
                  </button>
                  <p className="pr-20 text-stone-300 select-all">{GALLERI5_BOOKMARKLET_SCRIPT}</p>
                </div>

                {/* Device instructions */}
                <div className="space-y-1.5 text-[11px] text-stone-600 dark:text-stone-400 pt-1 leading-relaxed">
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">HP (Chrome):</strong> Buat bookmark sembarang → Edit → ganti URL-nya dengan kode di atas → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">aistudio.galleri5.com</span> → ketik nama bookmark di address bar.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">PC (Chrome/Edge):</strong> Tampilkan Bookmarks Bar → klik kanan → "Tambah halaman baru" → paste kode di kolom URL → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">aistudio.galleri5.com</span> → klik bookmark.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">Alternatif (F12):</strong> Buka <span className="text-amber-600 dark:text-amber-400 font-medium">aistudio.galleri5.com</span> → tekan F12 → tab Console → paste kode (tanpa "javascript:") → Enter.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                3
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                Token otomatis disalin ke clipboard. Klik <strong className="font-bold text-amber-600 dark:text-amber-400">+ Add / + Tambah</strong> lalu paste.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KIE_BOOKMARKLET_SCRIPT = `javascript:(async()=>{if(!location.host.includes("kie.ai")){if(confirm("Bookmarklet ini untuk Kie.ai.\\nBuka https://kie.ai sekarang?")){location.href="https://kie.ai"}return}let k="",e="";try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i),val=localStorage.getItem(key);if(!val)continue;try{const p=JSON.parse(val);if(p?.email)e=p.email;if(p?.user?.email)e=p.user.email;if(p?.userInfo?.email)e=p.userInfo.email;if(p?.apiKey)k=p.apiKey;if(p?.token&&!k)k=p.token}catch(_){}}}catch(_){}if(!k||k.includes("•••")){let ic="";const ow=navigator.clipboard?.writeText?navigator.clipboard.writeText.bind(navigator.clipboard):null;if(ow){navigator.clipboard.writeText=async t=>{ic=t;return ow(t)}}const targets=Array.from(document.querySelectorAll('svg,button,[role="button"],span,div,i')).filter(el=>{const cls=(el.className&&typeof el.className==="string")?el.className.toLowerCase():"",ar=(el.getAttribute("aria-label")||"").toLowerCase(),ti=(el.getAttribute("title")||"").toLowerCase(),pt=el.parentElement?.innerText||"";return cls.includes("copy")||ar.includes("copy")||ti.includes("copy")||pt.includes("•••")||(el.innerHTML.includes("<path")&&el.closest("td"))});for(const el of targets){try{el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));if(ic&&!ic.includes("•••")&&ic.length>10){k=ic;break}}catch(_){}}if(ow)navigator.clipboard.writeText=ow}if(!k||k.includes("•••")){const els=document.querySelectorAll("td,tr,div,span,button");for(const el of els){const fk=Object.keys(el).find(k=>k.startsWith("__reactFiber$")||k.startsWith("__reactInternalInstance$"));if(fk){let f=el[fk];while(f){const p=f.memoizedProps;if(p){const c=p.apiKey||p.record?.apiKey||p.record?.key||p.data?.apiKey||p.value;if(typeof c==="string"&&c.length>=16&&!c.includes("•••")){k=c;break}}f=f.return}}if(k&&!k.includes("•••"))break}}if(!k||k.includes("•••")){let at=localStorage.getItem("token")||localStorage.getItem("access_token")||localStorage.getItem("auth_token")||"";if(at&&at.startsWith('"')&&at.endsWith('"')){try{at=JSON.parse(at)}catch(_){}}if(at){try{const res=await fetch("https://api.kie.ai/api/v1/apiKey/list",{headers:{Authorization:at}});const json=await res.json();if(json?.data?.length){k=json.data[0].key||json.data[0].apiKey}}catch(_){}}}if(!k||k.includes("•••")){alert("API Key tidak terdeteksi. Pastikan sudah login di kie.ai.");return}try{await navigator.clipboard.writeText(k)}catch(_){}prompt("API Key "+(e?"("+e+")":"Kie.ai")+" (sudah dicopy):",k)})();`;

const KieApiKeyTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(KIE_BOOKMARKLET_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Cara Ambil API Key Kie.ai</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                Login ke <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">kie.ai</a> dengan akun yang mau ditambahkan.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-2 flex-1 min-w-0">
                <p className="pt-0.5 font-medium">Buat <strong className="font-bold text-stone-900 dark:text-stone-100">bookmark</strong> berisi script ini:</p>
                
                {/* Code Box */}
                <div className="relative group bg-stone-950 dark:bg-[#0E0E12] text-stone-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-all max-h-36 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner my-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-[10px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs z-10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Tercopy!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Kode</span>
                      </>
                    )}
                  </button>
                  <p className="pr-20 text-stone-300 select-all">{KIE_BOOKMARKLET_SCRIPT}</p>
                </div>

                {/* Device instructions */}
                <div className="space-y-1.5 text-[11px] text-stone-600 dark:text-stone-400 pt-1 leading-relaxed">
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">HP (Chrome):</strong> Buat bookmark sembarang → Edit → ganti URL-nya dengan kode di atas → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">kie.ai</span> → ketik nama bookmark di address bar.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">PC (Chrome/Edge):</strong> Tampilkan Bookmarks Bar → klik kanan → "Tambah halaman baru" → paste kode di kolom URL → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">kie.ai</span> → klik bookmark.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">Alternatif (F12):</strong> Buka <span className="text-amber-600 dark:text-amber-400 font-medium">kie.ai</span> → tekan F12 → tab Console → paste kode (tanpa "javascript:") → Enter.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                3
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                API Key otomatis disalin ke clipboard. Klik <strong className="font-bold text-amber-600 dark:text-amber-400">+ Add / + Tambah</strong> lalu paste.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RUNNINGHUB_BOOKMARKLET_SCRIPT = `javascript:(async()=>{if(!location.host.includes("runninghub")){alert("Buka runninghub.ai atau runninghub.cn dulu");return}let key="";const endpoints=["/task/openapi/getKey","/task/openapi/apiKeyList","/uc/openapi/apiKeyList","/uc/openapi/getKey","/api/uc/openapi/apiKeyList","/api/task/openapi/getKey"];for(const ep of endpoints){try{const res=await fetch(ep,{credentials:"include",headers:{Accept:"application/json"}});if(res.ok){const json=await res.json();const list=json?.data?.list||json?.data?.apiKeyList||(Array.isArray(json?.data)?json.data:[json?.data]);for(const item of list){if(item?.apiKey&&item.apiKey.length>=20){key=item.apiKey;break}if(typeof item==="string"&&item.length>=20&&!item.includes("{")){key=item;break}}if(!key&&json?.data?.key){key=json.data.key}if(key)break}}catch{}}if(!key){const storages=[localStorage,sessionStorage];for(const store of storages){for(let i=0;i<store.length;i++){const k=store.key(i);const v=store.getItem(k);if(!v)continue;if(/apikey|open_?api|runninghub/i.test(k)&&/^[a-zA-Z0-9_-]{24,64}$/.test(v)){key=v;break}try{const p=JSON.parse(v);const c=p?.apiKey||p?.openapiKey||p?.data?.apiKey;if(c&&typeof c==="string"&&c.length>=24&&!c.startsWith("eyJ")){key=c;break}}catch{}}if(key)break}}if(!key){const els=Array.from(document.querySelectorAll("input, textarea, code, pre, span, div, p, td"));for(const el of els){const txt=(el.value||el.innerText||el.textContent||"").trim();if(/^[a-fA-F0-9]{32,64}$/.test(txt)||txt.startsWith("rh-")){key=txt;break}}}if(!key){alert("API Key tidak ditemukan. Pastikan sudah login di runninghub.ai");return}try{await navigator.clipboard.writeText(key)}catch{}prompt("API Key RunningHub (sudah dicopy):",key)})();`;

const RunningHubTutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(RUNNINGHUB_BOOKMARKLET_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-200/80 dark:border-white/10 bg-stone-50/80 dark:bg-[#141418] rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-stone-100 dark:hover:bg-[#1E1E26] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Cara Ambil API Key RunningHub (Bookmarklet)</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          <span className="text-xs font-medium">{isOpen ? 'Tutup' : 'Buka Panduan'}</span>
          <ChevronDown className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141418]">
          <div className="pt-2 space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                Login ke <a href="https://www.runninghub.ai" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">runninghub.ai</a> dengan akun yang mau ditambahkan.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-2 flex-1 min-w-0">
                <p className="pt-0.5 font-medium">Buat <strong className="font-bold text-stone-900 dark:text-stone-100">bookmark</strong> berisi script ini:</p>
                
                {/* Code Box */}
                <div className="relative group bg-stone-950 dark:bg-[#0E0E12] text-stone-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-all max-h-36 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner my-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-[10px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs z-10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Tercopy!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Kode</span>
                      </>
                    )}
                  </button>
                  <p className="pr-20 text-stone-300 select-all">{RUNNINGHUB_BOOKMARKLET_SCRIPT}</p>
                </div>

                {/* Device instructions */}
                <div className="space-y-1.5 text-[11px] text-stone-600 dark:text-stone-400 pt-1 leading-relaxed">
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">HP (Chrome):</strong> Buat bookmark sembarang → Edit → ganti URL-nya dengan kode di atas → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">runninghub.ai</span> → ketik nama bookmark di address bar.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">PC (Chrome/Edge):</strong> Tampilkan Bookmarks Bar → klik kanan → "Tambah halaman baru" → paste kode di kolom URL → Buka <span className="text-amber-600 dark:text-amber-400 font-medium">runninghub.ai</span> → klik bookmark.
                  </p>
                  <p>
                    <strong className="text-stone-900 dark:text-stone-200 font-semibold">Alternatif (F12):</strong> Buka <span className="text-amber-600 dark:text-amber-400 font-medium">runninghub.ai</span> → tekan F12 → tab Console → paste kode (tanpa "javascript:") → Enter.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                3
              </span>
              <p className="pt-0.5 font-medium leading-relaxed">
                API Key otomatis disalin ke clipboard & muncul pop-up prompt. Klik <strong className="font-bold text-amber-600 dark:text-amber-400">+ Add Account</strong> di atas lalu paste. Display name (Email) dan saldo RH Coin akan otomatis terbaca!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface GlobalSettingsViewProps {
  settings: GenerationSettings;
  onUpdateSettings: (newSettings: Partial<GenerationSettings>) => void;
  externalProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  onClearExternalProviderId?: () => void;
  currentUser?: AppUser | null;
}

export const GlobalSettingsView: React.FC<GlobalSettingsViewProps> = ({
  settings,
  onUpdateSettings,
  externalProviderId,
  onSelectProvider,
  onClearExternalProviderId,
  currentUser,
}) => {
  const isInitialMountRef = useRef(true);
  const isFetchingRef = useRef(false);
  const isImportingRef = useRef(false);

  // Load stored Weavy, RoboNeo, Galleri5, Kie, RunningHub, and Gemini accounts or default to empty array
  const [providers, setProviders] = useState<ProviderInfo[]>(() => {
    let savedWeavyAccounts: ProviderAccount[] = [];
    let savedGeminiAccounts: ProviderAccount[] = [];
    let savedFlowAccounts: ProviderAccount[] = [];
    let savedVidsAccounts: ProviderAccount[] = [];
    let savedRoboneoAccounts: ProviderAccount[] = [];
    let savedGalleri5Accounts: ProviderAccount[] = [];
    let savedKieAccounts: ProviderAccount[] = [];
    let savedRunninghubAccounts: ProviderAccount[] = [];
    try {
      const itemWeavy = localStorage.getItem('weavy_accounts');
      if (itemWeavy) savedWeavyAccounts = JSON.parse(itemWeavy);
      const itemGemini = localStorage.getItem('gemini_accounts');
      if (itemGemini) {
        const parsed = JSON.parse(itemGemini);
        if (Array.isArray(parsed)) {
          savedGeminiAccounts = parsed.map((a: any) => {
            const cleanEmail = cleanEmailArtifacts(a.email);
            const cleanName = cleanEmailArtifacts(a.name) || (cleanEmail ? cleanEmail.split('@')[0] : 'Gemini User');
            const cleanDisplay = cleanEmailArtifacts(a.displayName) || cleanName;
            return {
              ...a,
              email: cleanEmail,
              name: cleanName,
              displayName: cleanDisplay,
              credits: typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits)) : 0,
              totalCredits: GEMINI_MAX_CREDITS,
            };
          });
          localStorage.setItem('gemini_accounts', JSON.stringify(savedGeminiAccounts));
        }
      }
      const itemFlow = localStorage.getItem('flow_accounts');
      if (itemFlow) {
        const parsed = JSON.parse(itemFlow);
        if (Array.isArray(parsed)) {
          savedFlowAccounts = parsed.map((a: any) => ({
            ...a,
            credits: typeof a.credits === 'number' ? Math.min(50, Math.max(0, a.credits)) : 50,
            totalCredits: 50,
          }));
          localStorage.setItem('flow_accounts', JSON.stringify(savedFlowAccounts));
        }
      }
      const itemRoboneo = localStorage.getItem('roboneo_accounts');
      if (itemRoboneo) savedRoboneoAccounts = JSON.parse(itemRoboneo);
      const itemGalleri5 = localStorage.getItem('galleri5_accounts');
      if (itemGalleri5) savedGalleri5Accounts = JSON.parse(itemGalleri5);
      const itemKie = localStorage.getItem('kie_accounts');
      if (itemKie) savedKieAccounts = JSON.parse(itemKie);
      const itemRunninghub = localStorage.getItem('runninghub_accounts');
      if (itemRunninghub) savedRunninghubAccounts = JSON.parse(itemRunninghub);

      savedVidsAccounts = [];
      const itemVids = localStorage.getItem('vids_accounts');
      if (itemVids) {
        try {
          const parsed = JSON.parse(itemVids);
          if (Array.isArray(parsed)) savedVidsAccounts = parsed;
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Failed to parse saved accounts:', e);
    }

    return [
      {
        id: 'weavy',
        name: 'Weavy',
        logoType: 'weavy',
        accounts: savedWeavyAccounts,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        logoType: 'gemini',
        accounts: savedGeminiAccounts,
      },
      {
        id: 'flow',
        name: 'Google Flow',
        logoType: 'flow',
        accounts: savedFlowAccounts,
      },
      {
        id: 'vids',
        name: 'Google Vids',
        logoType: 'vids',
        accounts: savedVidsAccounts,
      },
      {
        id: 'runninghub',
        name: 'RunningHub',
        logoType: 'runninghub',
        accounts: savedRunninghubAccounts,
      },
      {
        id: 'roboneo',
        name: 'RoboNeo',
        logoType: 'roboneo',
        accounts: savedRoboneoAccounts,
      },
      {
        id: 'kie',
        name: 'Kie.ai',
        logoType: 'kie',
        accounts: savedKieAccounts,
      },
    ];
  });

  // Fetch provider accounts from Google Sheets ONCE on user login / mount
  useEffect(() => {
    if (!currentUser?.userId) return;

    let isMounted = true;
    const fetchFromSheet = async () => {
      try {
        isFetchingRef.current = true;
        const resp = await fetch(`/api/providers/accounts?userId=${encodeURIComponent(currentUser.userId)}`);
        const data = await resp.json();
        if (resp.ok && data.success && data.accounts && isMounted) {
          const { weavy, gemini, flow, vids, roboneo, galleri5, kie, runninghub } = data.accounts;
          const activeGeminiId = localStorage.getItem('gemini_active_account_id');
          const activeWeavyId = localStorage.getItem('weavy_active_account_id');
          const activeFlowId = localStorage.getItem('flow_active_account_id');
          const activeVidsId = localStorage.getItem('vids_active_account_id');
          const activeRunninghubId = localStorage.getItem('runninghub_active_account_id');
          const activeRoboneoId = localStorage.getItem('roboneo_active_account_id');
          const activeKieId = localStorage.getItem('kie_active_account_id');

          const sanitizeAccountsList = (accs: any[], activeId: string | null, storageKey: string, defaultCredits: number = GEMINI_MAX_CREDITS) => {
            if (!Array.isArray(accs) || accs.length === 0) return [];
            let localList: any[] = [];
            try {
              const raw = localStorage.getItem(storageKey);
              if (raw) localList = JSON.parse(raw);
            } catch (e) {}

            const hasExplicitActive = activeId ? accs.some((a) => a.id === activeId) : accs.some((a) => a.isActive);
            return accs.map((a: any, idx: number) => {
              const cleanEmail = cleanEmailArtifacts(a.email);
              const cleanName = cleanEmailArtifacts(a.name) || (cleanEmail ? cleanEmail.split('@')[0] : 'Account User');
              const cleanDisplay = cleanEmailArtifacts(a.displayName) || cleanName;
              const matchedLocal = localList.find((l) =>
                (a.id && l.id === a.id) ||
                (cleanEmail && l.email && l.email.toLowerCase() === cleanEmail.toLowerCase()) ||
                (a.refreshToken && l.refreshToken === a.refreshToken)
              );
              const isThisActive = activeId
                ? (a.id === activeId || matchedLocal?.id === activeId)
                : hasExplicitActive
                ? Boolean(a.isActive)
                : (matchedLocal?.isActive ?? idx === 0);
              const effectiveCredits = typeof matchedLocal?.credits === 'number'
                ? matchedLocal.credits
                : (typeof a.credits === 'number' ? a.credits : (storageKey === 'gemini_accounts' ? 0 : defaultCredits));

              return {
                ...a,
                id: matchedLocal?.id || a.id,
                email: cleanEmail,
                name: cleanName,
                displayName: cleanDisplay,
                isActive: isThisActive,
                credits: effectiveCredits,
                creditSyncStatus: storageKey === 'gemini_accounts'
                  ? (a.creditSyncStatus || matchedLocal?.creditSyncStatus || 'unknown')
                  : undefined,
                totalCredits: typeof matchedLocal?.totalCredits === 'number' ? matchedLocal.totalCredits : (typeof a.totalCredits === 'number' ? a.totalCredits : (storageKey === 'gemini_accounts' ? GEMINI_MAX_CREDITS : (storageKey === 'flow_accounts' ? 50 : undefined))),
              };
            });
          };

          const sanitizedGemini = ensureSingleActiveAccount(
            sanitizeAccountsList(gemini, activeGeminiId, 'gemini_accounts', GEMINI_MAX_CREDITS),
            activeGeminiId,
          );
          const sanitizedWeavy = sanitizeAccountsList(weavy, activeWeavyId, 'weavy_accounts', 150);
          const sanitizedFlow = sanitizeAccountsList(flow, activeFlowId, 'flow_accounts', 50);
          const sanitizedVids = sanitizeAccountsList(vids, activeVidsId, 'vids_accounts', 500);
          const sanitizedRunninghub = sanitizeAccountsList(runninghub, activeRunninghubId, 'runninghub_accounts', 600);
          const sanitizedRoboneo = sanitizeAccountsList(roboneo, activeRoboneoId, 'roboneo_accounts', 100);
          const sanitizedKie = sanitizeAccountsList(kie, activeKieId, 'kie_accounts', 80);

          setProviders([
            {
              id: 'weavy',
              name: 'Weavy',
              logoType: 'weavy',
              accounts: sanitizedWeavy,
            },
            {
              id: 'gemini',
              name: 'Google Gemini',
              logoType: 'gemini',
              accounts: sanitizedGemini,
            },
            {
              id: 'flow',
              name: 'Google Flow',
              logoType: 'flow',
              accounts: sanitizedFlow,
            },
            {
              id: 'vids',
              name: 'Google Vids',
              logoType: 'vids',
              accounts: sanitizedVids,
            },
            {
              id: 'runninghub',
              name: 'RunningHub',
              logoType: 'runninghub',
              accounts: sanitizedRunninghub,
            },
            {
              id: 'roboneo',
              name: 'RoboNeo',
              logoType: 'roboneo',
              accounts: sanitizedRoboneo,
            },
            {
              id: 'kie',
              name: 'Kie.ai',
              logoType: 'kie',
              accounts: sanitizedKie,
            },
          ]);

          // Sync localStorage so deletions and changes persist across page reloads
          localStorage.setItem('weavy_accounts', JSON.stringify(sanitizedWeavy));
          localStorage.setItem('gemini_accounts', JSON.stringify(sanitizedGemini));
          const activeGeminiAccount = sanitizedGemini.find((account) => account.isActive);
          if (activeGeminiAccount) {
            localStorage.setItem('gemini_active_account_id', activeGeminiAccount.id);
          }
          localStorage.setItem('flow_accounts', JSON.stringify(sanitizedFlow));
          localStorage.setItem('runninghub_accounts', JSON.stringify(sanitizedRunninghub));
          localStorage.setItem('roboneo_accounts', JSON.stringify(sanitizedRoboneo));
          localStorage.setItem('kie_accounts', JSON.stringify(sanitizedKie));
          window.dispatchEvent(new Event('accounts-updated'));
          window.dispatchEvent(new Event('flow_accounts_updated'));
        }
      } catch (err) {
        console.warn('[Google Sheets Fetch Error]:', err);
      } finally {
        setTimeout(() => {
          if (isMounted) isFetchingRef.current = false;
        }, 500);
      }
    };

    fetchFromSheet();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.userId]);

  // Helper: Persist specific provider accounts to Google Sheets without spamming other providers
  const saveProviderAccountsToSheet = async (
    providerId: string,
    accounts: ProviderAccount[],
    throwOnError = false,
  ) => {
    if (!currentUser?.userId) return;
    try {
      const response = await fetch(`/api/providers/${providerId}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          accounts,
        }),
      });
      if (!response.ok) {
        throw new Error(`Google Sheets menolak perubahan akun (${response.status}).`);
      }
      const result = await response.json().catch(() => null);
      if (result?.success === false) {
        throw new Error(result.error || 'Google Sheets gagal menyimpan daftar akun.');
      }
    } catch (syncErr) {
      console.warn(`[Google Sheets Update Error - ${providerId}]:`, syncErr);
      if (throwOnError) throw syncErr;
    }
  };

  // Listen to custom background update events (e.g. when App.tsx auto-swaps or updates credits)
  useEffect(() => {
    const handleAccountsUpdated = () => {
      try {
        let savedWeavy: ProviderAccount[] = [];
        let savedGemini: ProviderAccount[] = [];
        let savedFlow: ProviderAccount[] = [];
        let savedVids: ProviderAccount[] = [];
        let savedRoboneo: ProviderAccount[] = [];
        let savedGalleri5: ProviderAccount[] = [];
        let savedKie: ProviderAccount[] = [];
        let savedRunninghub: ProviderAccount[] = [];

        const itemWeavy = localStorage.getItem('weavy_accounts');
        if (itemWeavy) savedWeavy = JSON.parse(itemWeavy);
        const itemGemini = localStorage.getItem('gemini_accounts');
        if (itemGemini) savedGemini = JSON.parse(itemGemini);
        const itemFlow = localStorage.getItem('flow_accounts');
        if (itemFlow) {
          const parsed = JSON.parse(itemFlow);
          if (Array.isArray(parsed)) {
            savedFlow = parsed.map((a: any) => ({
              ...a,
              credits: typeof a.credits === 'number' ? Math.min(50, Math.max(0, a.credits)) : 50,
              totalCredits: 50,
            }));
          }
        }
        const itemVids = localStorage.getItem('vids_accounts');
        if (itemVids) {
          try {
            const parsed = JSON.parse(itemVids);
            if (Array.isArray(parsed)) savedVids = parsed;
          } catch (_) {}
        }
        const itemRoboneo = localStorage.getItem('roboneo_accounts');
        if (itemRoboneo) savedRoboneo = JSON.parse(itemRoboneo);
        const itemGalleri5 = localStorage.getItem('galleri5_accounts');
        if (itemGalleri5) savedGalleri5 = JSON.parse(itemGalleri5);
        const itemKie = localStorage.getItem('kie_accounts');
        if (itemKie) savedKie = JSON.parse(itemKie);
        const itemRunninghub = localStorage.getItem('runninghub_accounts');
        if (itemRunninghub) savedRunninghub = JSON.parse(itemRunninghub);

        setProviders([
          {
            id: 'weavy',
            name: 'Weavy',
            logoType: 'weavy',
            accounts: Array.isArray(savedWeavy) ? savedWeavy : [],
          },
          {
            id: 'gemini',
            name: 'Google Gemini',
            logoType: 'gemini',
            accounts: Array.isArray(savedGemini) ? savedGemini : [],
          },
          {
            id: 'flow',
            name: 'Google Flow',
            logoType: 'flow',
            accounts: Array.isArray(savedFlow) ? savedFlow : [],
          },
          {
            id: 'vids',
            name: 'Google Vids',
            logoType: 'vids',
            accounts: Array.isArray(savedVids) ? savedVids : [],
          },
          {
            id: 'runninghub',
            name: 'RunningHub',
            logoType: 'runninghub',
            accounts: Array.isArray(savedRunninghub) ? savedRunninghub : [],
          },
          {
            id: 'roboneo',
            name: 'RoboNeo',
            logoType: 'roboneo',
            accounts: Array.isArray(savedRoboneo) ? savedRoboneo : [],
          },
          /* galleri5 maintenance
          {
            id: 'galleri5',
            name: 'Galleri5',
            logoType: 'galleri5',
            accounts: Array.isArray(savedGalleri5) ? savedGalleri5 : [],
          },
          */
          {
            id: 'kie',
            name: 'Kie.ai',
            logoType: 'kie',
            accounts: Array.isArray(savedKie) ? savedKie : [],
          },
        ]);
      } catch (e) {}
    };

    // Auto-upgrade any legacy "gemini_user" or "gemini_user@google.com" accounts to real Google identity
    try {
      const rawGemini = localStorage.getItem('gemini_accounts');
      if (rawGemini) {
        const parsedGemini: ProviderAccount[] = JSON.parse(rawGemini);
        const needsUpgrade = parsedGemini.some(
          (a) =>
            a.name === 'gemini_user' ||
            a.displayName === 'gemini_user' ||
            a.email === 'gemini_user@google.com' ||
            !a.email
        );
        if (needsUpgrade) {
          Promise.all(
            parsedGemini.map(async (acc) => {
              if (
                acc.refreshToken &&
                (acc.name === 'gemini_user' ||
                  acc.displayName === 'gemini_user' ||
                  acc.email === 'gemini_user@google.com' ||
                  !acc.email)
              ) {
                try {
                  const resp = await fetch('/api/gemini/accounts/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: acc.refreshToken, email: acc.email }),
                  });
                  const data = await resp.json();
                  if (resp.ok && data.success) {
                    const resolvedEmail = data.email && !data.email.startsWith('gemini_user') ? data.email : acc.email;
                    const resolvedName = data.displayName || data.name || (resolvedEmail ? resolvedEmail.split('@')[0] : acc.name);
                    return {
                      ...acc,
                      email: resolvedEmail,
                      name: resolvedName,
                      displayName: resolvedName,
                      credits: data.ledgerKnown === true && typeof data.credits === 'number'
                        ? Math.min(GEMINI_MAX_CREDITS, data.credits)
                        : (typeof acc.credits === 'number' ? acc.credits : 0),
                      creditsUsed: data.ledgerKnown === true && typeof data.creditsUsed === 'number'
                        ? data.creditsUsed
                        : acc.creditsUsed,
                      totalCredits: GEMINI_MAX_CREDITS,
                      creditSyncStatus: data.ledgerKnown === true ? 'synced' : 'unknown',
                    };
                  }
                } catch (e) {}
              }
              return acc;
            })
          ).then((upgraded) => {
            localStorage.setItem('gemini_accounts', JSON.stringify(upgraded));
            setProviders((prev) =>
              prev.map((p) => (p.id === 'gemini' ? { ...p, accounts: upgraded } : p))
            );
            window.dispatchEvent(new Event('accounts-updated'));
          });
        }
      }
    } catch (e) {}

    window.addEventListener('gemini_accounts_updated', handleAccountsUpdated);
    window.addEventListener('flow_accounts_updated', handleAccountsUpdated);
    window.addEventListener('vids_accounts_updated', handleAccountsUpdated);
    window.addEventListener('weavy_accounts_updated', handleAccountsUpdated);
    window.addEventListener('kie_accounts_updated', handleAccountsUpdated);
    window.addEventListener('galleri5_accounts_updated', handleAccountsUpdated);
    window.addEventListener('runninghub_accounts_updated', handleAccountsUpdated);
    window.addEventListener('accounts-updated', handleAccountsUpdated);
    window.addEventListener('storage', handleAccountsUpdated);
    return () => {
      window.removeEventListener('gemini_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('flow_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('vids_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('weavy_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('kie_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('galleri5_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('runninghub_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('accounts-updated', handleAccountsUpdated);
      window.removeEventListener('storage', handleAccountsUpdated);
    };
  }, []);

  // Navigation view state: 'providers' | 'provider-detail'
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(externalProviderId || null);

  useEffect(() => {
    if (externalProviderId) {
      setSelectedProviderId(externalProviderId);
    } else {
      setSelectedProviderId(null);
    }
  }, [externalProviderId]);

  // Reset active popups, menus, search filter, and selection modes when provider changes
  useEffect(() => {
    setActiveMenuAccountId(null);
    setEditingAccount(null);
    setDesktopSearchTerm('');
    setIsSelectMode(false);
    setSelectedAccountIds([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [selectedProviderId]);

  // Add Account Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reloginAccount, setReloginAccount] = useState<ProviderAccount | null>(null);
  const [addMode, setAddMode] = useState<'single' | 'import' | 'extension'>('single');
  const [tokenInput, setTokenInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [editingAccount, setEditingAccount] = useState<{
    providerId: string;
    accountId: string;
    name: string;
    email: string;
  } | null>(null);
  const [importTextInput, setImportTextInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoImportingExtension, setIsAutoImportingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionBridgeStatus>(() => extensionBridge.getStatus());

  useEffect(() => {
    const unsubscribe = extensionBridge.subscribe(setExtensionStatus);
    return () => unsubscribe();
  }, []);

  // Handler for Auto-Importing active account directly from Chrome Extension Bridge
  const handleAutoImportFromExtension = async (providerId: string = 'weavy') => {
    if (isAutoImportingExtension || isSubmitting) return;
    setIsAutoImportingExtension(true);
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await extensionBridge.autoImportActiveAccount(providerId);
      if (!res.success || !res.account) {
        throw new Error(
          res.error ||
            'Sesi akun tidak ditemukan di tab browser. Pastikan Ekstensi terpasang dan tab https://app.weavy.ai sudah dibuka dan berstatus Login.'
        );
      }

      const rawAcc = res.account;
      const targetProvider = providers.find((p) => p.id === providerId);
      const existingAccounts = targetProvider ? [...targetProvider.accounts] : [];

      const newAccount: ProviderAccount = {
        id: rawAcc.userId ? `acc-weavy-${rawAcc.userId}` : `acc-weavy-${Date.now()}`,
        email: rawAcc.email,
        name: rawAcc.name || rawAcc.email.split('@')[0],
        displayName: rawAcc.name || rawAcc.email.split('@')[0],
        refreshToken: rawAcc.refreshToken,
        idToken: rawAcc.idToken,
        credits: typeof rawAcc.credits === 'number' ? rawAcc.credits : 100,
        totalCredits: typeof rawAcc.totalCredits === 'number' ? rawAcc.totalCredits : 150,
        isActive: true,
        accountStatus: 'active',
        lastChecked: new Date().toISOString(),
      };

      const existingIdx = existingAccounts.findIndex(
        (a) =>
          (a.refreshToken && newAccount.refreshToken && a.refreshToken.trim() === newAccount.refreshToken.trim()) ||
          (a.email && newAccount.email && a.email.toLowerCase() === newAccount.email.toLowerCase())
      );

      // Deactivate all others, set this one active
      const updatedList = existingAccounts.map((a) => ({ ...a, isActive: false }));

      if (existingIdx >= 0) {
        updatedList[existingIdx] = {
          ...updatedList[existingIdx],
          ...newAccount,
          isActive: true,
        };
      } else {
        updatedList.unshift(newAccount);
      }

      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, accounts: updatedList } : p))
      );

      localStorage.setItem(`${providerId}_accounts`, JSON.stringify(updatedList));
      window.dispatchEvent(new Event('accounts-updated'));
      window.dispatchEvent(new Event(`${providerId}_accounts_updated`));
      await saveProviderAccountsToSheet(providerId, updatedList);

      setSuccessMsg(
        `⚡ Berhasil mengimpor akun aktif (${newAccount.email}) dengan ${newAccount.credits} Credits langsung dari tab Weavy!`
      );
      setTimeout(() => {
        setIsAddModalOpen(false);
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengimpor akun dari ekstensi.');
    } finally {
      setIsAutoImportingExtension(false);
      setIsSubmitting(false);
    }
  };
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    saved: number;
    batch: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [openingGeminiBrowserAccountId, setOpeningGeminiBrowserAccountId] = useState<string | null>(null);

  // Rename / Edit account profile & nickname handler
  const handleSaveAccountNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    const newName = editingAccount.name.trim();
    const newEmail = editingAccount.email.trim();
    if (!newName && !newEmail) return;

    const prov = providers.find((p) => p.id === editingAccount.providerId);
    if (!prov) return;

    const newAccounts = prov.accounts.map((a) =>
      a.id === editingAccount.accountId
        ? {
            ...a,
            name: newName || (newEmail ? newEmail.split('@')[0] : a.name),
            displayName: newName || (newEmail ? newEmail.split('@')[0] : a.displayName),
            email: newEmail || a.email,
          }
        : a
    );

    setProviders((prev) =>
      prev.map((p) => (p.id === editingAccount.providerId ? { ...p, accounts: newAccounts } : p))
    );

    localStorage.setItem(`${editingAccount.providerId}_accounts`, JSON.stringify(newAccounts));
    window.dispatchEvent(new Event('accounts-updated'));
    await saveProviderAccountsToSheet(editingAccount.providerId, newAccounts);
    setEditingAccount(null);
  };

  // Callback when a Google Gemini account is added via Playwright or manual cookie
  const handleGeminiAccountAdded = async (newAccount: ProviderAccount, reloginEmail?: string) => {
    const prov = providers.find((p) => p.id === 'gemini');
    const existingAccounts = prov ? [...prov.accounts] : [];
    const previousActiveAccount =
      existingAccounts.find((account) => account.isActive) ||
      existingAccounts.find((account) => account.id === localStorage.getItem('gemini_active_account_id'));

    const existingIdx = existingAccounts.findIndex(
      (a) =>
        a.id === newAccount.id ||
        (a.email && newAccount.email && a.email.toLowerCase() === newAccount.email.toLowerCase()) ||
        (reloginEmail && a.email && a.email.toLowerCase() === reloginEmail.toLowerCase()) ||
        (a.token && newAccount.token && a.token.trim() === newAccount.token.trim()) ||
        (a.refreshToken && newAccount.token && a.refreshToken.trim() === newAccount.token.trim())
    );
    const verifiedAt = new Date().toISOString();

    if (existingIdx >= 0) {
      const existingAccount = existingAccounts[existingIdx];
      const hasSyncedBalance = newAccount.creditSyncStatus === 'synced' && typeof newAccount.credits === 'number';
      existingAccounts[existingIdx] = {
        ...existingAccount,
        ...newAccount,
        id: existingAccount.id,
        email: reloginEmail || newAccount.email || existingAccount.email,
        refreshToken: newAccount.token || existingAccount.refreshToken,
        token: newAccount.token || existingAccount.token,
        credits: hasSyncedBalance ? newAccount.credits : existingAccount.credits,
        creditsUsed: hasSyncedBalance ? newAccount.creditsUsed : existingAccount.creditsUsed,
        totalCredits: GEMINI_MAX_CREDITS,
        creditSyncStatus: hasSyncedBalance ? 'synced' : existingAccount.creditSyncStatus || 'unknown',
        isActive: existingAccount.isActive || newAccount.isActive,
        accountStatus: 'active',
        statusMessage: undefined,
        lastChecked: verifiedAt,
      };
    } else {
      existingAccounts.push({
        ...newAccount,
        accountStatus: 'active',
        statusMessage: undefined,
        lastChecked: verifiedAt,
      });
    }

    const preferredActiveId = newAccount.isActive
      ? existingAccounts[existingIdx >= 0 ? existingIdx : existingAccounts.length - 1].id
      : previousActiveAccount?.id;
    const finalGeminiAccounts = ensureSingleActiveAccount(existingAccounts, preferredActiveId);
    const activeGeminiAccount = finalGeminiAccounts.find((account) => account.isActive);
    setProviders((prev) =>
      prev.map((p) => (p.id === 'gemini' ? { ...p, accounts: finalGeminiAccounts } : p))
    );

    localStorage.setItem('gemini_accounts', JSON.stringify(finalGeminiAccounts));
    if (activeGeminiAccount) {
      localStorage.setItem('gemini_active_account_id', activeGeminiAccount.id);
    }
    window.dispatchEvent(new Event('accounts-updated'));
    window.dispatchEvent(new Event('gemini_accounts_updated'));
    await saveProviderAccountsToSheet('gemini', finalGeminiAccounts);
  };

  // Callback when multiple Google Gemini accounts are imported in batch
  const handleGeminiBatchAccountsAdded = async (newAccounts: ProviderAccount[]) => {
    const prov = providers.find((p) => p.id === 'gemini');
    const existingAccounts = prov ? [...prov.accounts] : [];
    const previousActiveAccount =
      existingAccounts.find((account) => account.isActive) ||
      existingAccounts.find((account) => account.id === localStorage.getItem('gemini_active_account_id'));

    const orderedNewAccounts: ProviderAccount[] = [];
    newAccounts.forEach((newAcc) => {
      const existingIdx = existingAccounts.findIndex(
        (a) =>
          a.id === newAcc.id ||
          (a.email && newAcc.email && a.email.toLowerCase() === newAcc.email.toLowerCase()) ||
          (a.token && newAcc.token && a.token.trim() === newAcc.token.trim())
      );

      if (existingIdx >= 0) {
        existingAccounts[existingIdx] = {
          ...existingAccounts[existingIdx],
          ...newAcc,
        };
      } else {
        orderedNewAccounts.push(newAcc);
      }
    });

    const finalGeminiAccounts = ensureSingleActiveAccount(
      [...existingAccounts, ...orderedNewAccounts],
      previousActiveAccount?.id,
    );
    const activeGeminiAccount = finalGeminiAccounts.find((account) => account.isActive);
    setProviders((prev) =>
      prev.map((p) => (p.id === 'gemini' ? { ...p, accounts: finalGeminiAccounts } : p))
    );

    localStorage.setItem('gemini_accounts', JSON.stringify(finalGeminiAccounts));
    if (activeGeminiAccount) {
      localStorage.setItem('gemini_active_account_id', activeGeminiAccount.id);
    }
    window.dispatchEvent(new Event('accounts-updated'));
    window.dispatchEvent(new Event('gemini_accounts_updated'));
    await saveProviderAccountsToSheet('gemini', finalGeminiAccounts);
  };

  // Helper to extract Refresh Tokens / API Keys and labels from text (supports single-line, pipe, and Email/ApiKey multiline)
  const extractTokensFromText = (text: string, providerId: string = 'weavy'): string[] => {
    if (!text || typeof text !== 'string') return [];

    // Check for structured multi-line Key-Value format (e.g. Email: ... \n ApiKey: ...)
    if (
      providerId === 'runninghub' ||
      text.toLowerCase().includes('email:') ||
      text.toLowerCase().includes('apikey:') ||
      text.toLowerCase().includes('api_key:')
    ) {
      const blocks = text.split(/\r?\n\s*\r?\n/);
      const structuredEntries: string[] = [];

      // 1. Try block-by-block parsing first
      for (const block of blocks) {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let emailVal = '';
        let apiKeyVal = '';
        for (const line of lines) {
          const emMatch = line.match(/^(?:email|user|username|label)\s*[:=]\s*(.+)$/i);
          if (emMatch) emailVal = emMatch[1].trim();
          const keyMatch = line.match(/^(?:apikey|api_key|key|token)\s*[:=]\s*(.+)$/i);
          if (keyMatch) apiKeyVal = keyMatch[1].trim();
        }
        if (apiKeyVal) {
          structuredEntries.push(emailVal ? `${apiKeyVal}|${emailVal}` : apiKeyVal);
        }
      }

      if (structuredEntries.length > 0) {
        return Array.from(new Set(structuredEntries));
      }

      // 2. If lines weren't separated by blank lines, scan sequential lines
      const allLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let pendingEmail = '';
      for (const line of allLines) {
        const emMatch = line.match(/^(?:email|user|username|label)\s*[:=]\s*(.+)$/i);
        if (emMatch) {
          pendingEmail = emMatch[1].trim();
          continue;
        }
        const keyMatch = line.match(/^(?:apikey|api_key|key|token)\s*[:=]\s*(.+)$/i);
        if (keyMatch) {
          const apiKey = keyMatch[1].trim();
          structuredEntries.push(pendingEmail ? `${apiKey}|${pendingEmail}` : apiKey);
          pendingEmail = '';
          continue;
        }
      }

      if (structuredEntries.length > 0) {
        return Array.from(new Set(structuredEntries));
      }
    }

    if (providerId === 'gemini') {
      const trimmed = text.trim();
      // 1. If text is a full curl command or contains -b cookies / headers
      if (
        trimmed.toLowerCase().includes('curl') ||
        trimmed.includes('-b ') ||
        trimmed.includes('--cookie') ||
        trimmed.includes('Cookie:') ||
        trimmed.includes('SAPISIDHASH') ||
        trimmed.includes('ogads-pa')
      ) {
        return [trimmed];
      }

      const tokens: string[] = [];
      // 2. Match AI Studio API Key (AIzaSy...)
      const apiKeyRegex = /(AIza[0-9A-Za-z-_]{35})/g;
      let match;
      while ((match = apiKeyRegex.exec(text)) !== null) {
        if (match[1] && match[1].trim()) {
          tokens.push(match[1].trim());
        }
      }
      // 3. Match cookie strings with __Secure-1PSID / SID
      if (tokens.length === 0) {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        for (const line of lines) {
          if (line.includes('__Secure') || line.includes('SID=') || line.startsWith('AIza')) {
            tokens.push(line);
          }
        }
      }
      if (tokens.length === 0 && trimmed.length > 10) {
        tokens.push(trimmed);
      }
      return Array.from(new Set(tokens));
    }

    if (providerId === 'flow') {
      const trimmed = text.trim();
      return trimmed ? [trimmed] : [];
    }

    if (providerId === 'galleri5' || providerId === 'kie' || providerId === 'runninghub') {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      return Array.from(new Set(lines));
    }

    if (providerId === 'roboneo') {
      const tokens: string[] = [];
      const v2Regex = /(_v2[a-zA-Z0-9#_=\-]+)/g;
      let match;
      while ((match = v2Regex.exec(text)) !== null) {
        if (match[1] && match[1].trim()) {
          tokens.push(match[1].trim());
        }
      }
      if (tokens.length === 0) {
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('_v2') || trimmed.startsWith('v2')) {
            tokens.push(trimmed);
          }
        }
      }
      return Array.from(new Set(tokens));
    }

    // Default Weavy extraction:
    // Support multiple formats:
    // 1) "Refresh Token: AMf-..." or "Refresh_Token: AMf-..."
    // 2) "AMf-..." anywhere in text
    // 3) Line-by-line raw tokens or "token|nickname" format
    const tokens: string[] = [];
    const refreshTokenRegex = /Refresh(?:_|\s*)Token\s*:\s*([^\s\r\n]+)/gi;
    let match;
    while ((match = refreshTokenRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        tokens.push(match[1].trim());
      }
    }

    if (tokens.length === 0) {
      const amfRegex = /(AMf-[a-zA-Z0-9_\-]+)/g;
      while ((match = amfRegex.exec(text)) !== null) {
        if (match[1] && match[1].trim()) {
          tokens.push(match[1].trim());
        }
      }
    }

    // Fallback: Line-by-line check (e.g. pasted direct tokens)
    if (tokens.length === 0) {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      for (const line of lines) {
        if (line.startsWith('AMf-') || line.length > 40) {
          tokens.push(line);
        }
      }
    }

    return Array.from(new Set(tokens));
  };

  // Handle file selection (.txt upload)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportTextInput(content);
        const providerId = selectedProviderId || 'weavy';
        const extracted = extractTokensFromText(content, providerId);
        if (extracted.length > 0) {
          setSuccessMsg(`Terdeteksi ${extracted.length} token dari file ${file.name}.`);
        } else {
          setErrorMsg('Tidak ditemukan token yang valid dalam file .txt ini.');
        }
      }
    };
    reader.readAsText(file);
  };

  // Handle batch import processing with Progressive Auto-Save per 50 accounts & Concurrency Pool
  const handleBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProviderId = selectedProviderId || currentProvider?.id || 'weavy';

    const tokensToProcess = extractTokensFromText(importTextInput, targetProviderId);
    if (tokensToProcess.length === 0) {
      setErrorMsg(
        targetProviderId === 'runninghub'
          ? 'Tidak ditemukan API Key RunningHub yang valid.'
          : targetProviderId === 'kie'
          ? 'Tidak ditemukan API Key Kie.ai yang valid.'
          : targetProviderId === 'galleri5'
          ? 'Tidak ditemukan API Key / Access Token Galleri5 yang valid.'
          : targetProviderId === 'roboneo'
          ? 'Tidak ditemukan Access Token RoboNeo yang valid (_v2...).'
          : 'Tidak ditemukan Refresh Token yang valid. Pastikan format ada "Refresh Token: AMf-..."'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    isImportingRef.current = true;

    setImportProgress({
      current: 0,
      total: tokensToProcess.length,
      saved: 0,
      batch: 0,
    });

    const BATCH_FLUSH_SIZE = 5;
    const CONCURRENCY = 4;

    const accumulatedNewAccounts: ProviderAccount[] = [];
    let completedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let lastFlushedCount = 0;
    let isFlushing = false;

    // Helper: process 1 single token safely
    const processSingleToken = async (rawLine: string, index: number): Promise<ProviderAccount | null> => {
      let token = rawLine;
      let lineNickname = '';
      if (rawLine.includes('|')) {
        const parts = rawLine.split('|');
        token = parts[0].trim();
        lineNickname = parts[1].trim();
      } else if (rawLine.includes(',')) {
        const parts = rawLine.split(',');
        token = parts[0].trim();
        lineNickname = parts[1].trim();
      }

      try {
        if (targetProviderId === 'runninghub') {
          const isCustomEmail = lineNickname.includes('@');
          const resp = await fetch('/api/runninghub/account/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: token,
              customLabel: lineNickname || undefined,
              email: isCustomEmail ? lineNickname : undefined,
            }),
          });
          const data = await resp.json();
          const shortKey = token.length >= 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : token;
          if (resp.ok && data.success) {
            const finalEmail = isCustomEmail
              ? lineNickname
              : (data.email && !data.email.startsWith('rh_') ? data.email : (lineNickname ? `rh_${token.slice(0, 8)}@runninghub.ai` : data.email || `rh_${token.slice(0, 8)}@runninghub.ai`));
            const finalName = lineNickname || (data.name && !data.name.includes('undefined') ? data.name : (data.displayName || `RunningHub (${shortKey})`));
            const finalDisplayName = lineNickname || (data.displayName && !data.displayName.includes('undefined') ? data.displayName : (data.name || `RunningHub (${shortKey})`));

            return {
              id: `acc-runninghub-${Date.now()}-${index}`,
              email: finalEmail,
              name: finalName,
              displayName: finalDisplayName,
              isActive: false,
              hasRefreshToken: true,
              refreshToken: data.apiKey || token,
              credits: data.credits !== undefined && data.credits > 0 ? data.credits : 600,
            };
          } else {
            // Fallback: save token even if network verification has transient issues
            const finalFallbackEmail = isCustomEmail ? lineNickname : (lineNickname ? `rh_${token.slice(0, 8)}@runninghub.ai` : `rh_${token.slice(0, 8)}@runninghub.ai`);
            const finalFallbackName = lineNickname || `RunningHub (${shortKey})`;
            return {
              id: `acc-runninghub-${Date.now()}-${index}`,
              email: finalFallbackEmail,
              name: finalFallbackName,
              displayName: finalFallbackName,
              isActive: false,
              hasRefreshToken: true,
              refreshToken: token,
              credits: 600,
            };
          }
        } else if (targetProviderId === 'kie') {
          const resp = await fetch('/api/kie/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token }),
          });
          const data = await resp.json();
          if (resp.ok && data.success) {
            const nicknameToUse = lineNickname || data.displayName || data.nickname || `Kie.ai (${token.slice(0, 4)}...${token.slice(-4)})`;
            return {
              id: `acc-kie-${Date.now()}-${index}`,
              email: data.email || `kie_${token.slice(0, 8)}@kie.ai`,
              name: nicknameToUse,
              displayName: nicknameToUse,
              isActive: false,
              hasRefreshToken: true,
              refreshToken: data.cleanToken || token,
              credits: data.credits !== undefined ? data.credits : 80,
              totalCredits: data.totalCredits !== undefined ? data.totalCredits : 80,
            };
          }
        } else if (targetProviderId === 'galleri5') {
          const resp = await fetch('/api/galleri5/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token }),
          });
          const data = await resp.json();
          if (resp.ok && data.success) {
            return {
              id: `acc-galleri5-${Date.now()}-${index}`,
              email: data.email || `user_${(data.cleanToken || token).slice(0, 8)}@galleri5.com`,
              name: lineNickname || data.displayName || 'Galleri5 User',
              displayName: data.displayName,
              isActive: false,
              hasRefreshToken: true,
              refreshToken: data.cleanToken || token,
              credits: data.credits,
              totalCredits: data.totalCredits,
              creditsUsed: data.creditsUsed,
            };
          }
        } else if (targetProviderId === 'gemini') {
          const resp = await fetch('/api/gemini/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, customLabel: lineNickname || undefined }),
          });
          const data = await resp.json();
          const shortKey = token.length >= 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : token;
          if (resp.ok && data.success) {
            return {
              id: `acc-gemini-${Date.now()}-${index}`,
              email: data.email || `gemini_${token.slice(0, 8)}@google.com`,
              name: lineNickname || data.name || `Gemini (${shortKey})`,
              displayName: lineNickname || data.displayName || data.name || `Gemini (${shortKey})`,
              isActive: false,
              hasRefreshToken: true,
              refreshToken: data.token || token,
              credits: data.ledgerKnown === true && typeof data.credits === 'number'
                ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, data.credits))
                : 0,
              totalCredits: GEMINI_MAX_CREDITS,
              creditsUsed: typeof data.creditsUsed === 'number' ? data.creditsUsed : undefined,
              creditSyncStatus: data.ledgerKnown === true ? 'synced' : 'unknown',
            };
          }
        } else if (targetProviderId === 'roboneo') {
          const resp = await fetch('/api/roboneo/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token }),
          });
          const data = await resp.json();
          if (resp.ok && data.success) {
            const tokenDisplay = token.length > 20 ? `${token.slice(0, 10)}...${token.slice(-6)}` : token;
            return {
              id: `acc-roboneo-${Date.now()}-${index}`,
              email: data.email || tokenDisplay,
              name: lineNickname || data.name || 'RoboNeo Account',
              isActive: false,
              hasRefreshToken: true,
              refreshToken: token,
              credits: data.credits !== undefined ? data.credits : 100,
              totalCredits: data.totalCredits !== undefined ? data.totalCredits : 100,
            };
          }
        } else if (targetProviderId === 'flow') {
          const resp = await fetch('/api/flow/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, email: lineNickname || undefined }),
          });
          const data = await resp.json();
          if (resp.ok && data.success) {
            const finalEmail = cleanEmailArtifacts(data.email || (lineNickname && lineNickname.includes('@') ? lineNickname : `flow_${Date.now()}_${index}@google.com`));
            const finalName = cleanEmailArtifacts(lineNickname || data.displayName || data.name || (finalEmail ? finalEmail.split('@')[0] : `Flow Account (${index + 1})`));
            return {
              id: `acc-flow-${Date.now()}-${index}`,
              email: finalEmail,
              name: finalName,
              displayName: finalName,
              isActive: false,
              hasRefreshToken: true,
              refreshToken: data.cookies || token,
              token: data.cookies || token,
              cookies: data.cookies || token,
              authHeader: data.authHeader,
              apiKey: data.apiKey,
              credits: typeof data.credits === 'number' ? Math.min(50, data.credits) : 50,
              totalCredits: 50,
            };
          }
        } else {
          // Weavy AI Flow
          const info = await exchangeRefreshTokenAndGetInfo(token);
          return {
            id: `acc-weavy-${Date.now()}-${index}`,
            email: info.email,
            name: lineNickname || info.name,
            displayName: lineNickname || info.name,
            isActive: false,
            hasRefreshToken: true,
            refreshToken: info.refreshToken,
            idToken: info.idToken,
            credits: info.credits,
            totalCredits: info.totalCredits,
          };
        }
      } catch (err) {
        console.error(`Gagal memproses token ${index + 1}:`, err);
      }
      return null;
    };

    // Helper: Flush accumulated accounts to Google Sheets & React State
    const flushToDatabase = async (force: boolean = false) => {
      if (isFlushing) return;
      const currentReady = accumulatedNewAccounts.length;
      if (!force && currentReady - lastFlushedCount < BATCH_FLUSH_SIZE) {
        return;
      }
      if (currentReady === lastFlushedCount) return;

      isFlushing = true;
      try {
        lastFlushedCount = currentReady;

        // 1. Calculate merged accounts
        const currentProv = providers.find((p) => p.id === targetProviderId);
        const mergedAccounts = [...(currentProv?.accounts || [])];
        accumulatedNewAccounts.forEach((newAcc) => {
          const existingIdx = mergedAccounts.findIndex(
            (a) =>
              (a.refreshToken && newAcc.refreshToken && a.refreshToken.trim() === newAcc.refreshToken.trim()) ||
              (newAcc.email && a.email && a.email.toLowerCase() === newAcc.email.toLowerCase() && !newAcc.email.startsWith('rh_'))
          );
          if (existingIdx >= 0) {
            mergedAccounts[existingIdx] = {
              ...mergedAccounts[existingIdx],
              name: newAcc.name || mergedAccounts[existingIdx].name,
              displayName: newAcc.displayName || mergedAccounts[existingIdx].displayName,
              email: (newAcc.email && !newAcc.email.startsWith('rh_')) ? newAcc.email : (mergedAccounts[existingIdx].email || newAcc.email),
              credits: newAcc.credits !== undefined ? newAcc.credits : mergedAccounts[existingIdx].credits,
              totalCredits: newAcc.totalCredits !== undefined ? newAcc.totalCredits : mergedAccounts[existingIdx].totalCredits,
              idToken: newAcc.idToken || mergedAccounts[existingIdx].idToken,
              refreshToken: newAcc.refreshToken || mergedAccounts[existingIdx].refreshToken,
            };
          } else {
            mergedAccounts.push(newAcc);
          }
        });

        if (mergedAccounts.length > 0 && !mergedAccounts.some((a) => a.isActive)) {
          mergedAccounts[0].isActive = true;
        }

        // 2. Update React state immediately
        setProviders((prev) =>
          prev.map((p) => (p.id === targetProviderId ? { ...p, accounts: mergedAccounts } : p))
        );

        // 3. Save to localStorage & trigger update
        localStorage.setItem(`${targetProviderId}_accounts`, JSON.stringify(mergedAccounts));
        window.dispatchEvent(new Event('accounts-updated'));

        // 4. Persist to Google Sheets
        if (currentUser?.userId) {
          await fetch(`/api/providers/${targetProviderId}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.userId,
              accounts: mergedAccounts,
            }),
          });
          console.log(`[Batch Import] Auto-saved batch (${currentReady} akun) ke Google Sheets.`);
        }
      } catch (flushErr) {
        console.warn('[Batch Import Auto-Save Error]:', flushErr);
      } finally {
        isFlushing = false;
      }
    };

    try {
      let currentIndex = 0;
      const worker = async () => {
        while (currentIndex < tokensToProcess.length) {
          const i = currentIndex++;
          const rawLine = tokensToProcess[i];

          const acc = await processSingleToken(rawLine, i);
          completedCount++;

          if (acc) {
            successCount++;
            accumulatedNewAccounts.push(acc);

            // Trigger batch save every 50 accounts
            if (accumulatedNewAccounts.length - lastFlushedCount >= BATCH_FLUSH_SIZE) {
              await flushToDatabase(false);
            }
          } else {
            failCount++;
          }

          setImportProgress({
            current: completedCount,
            total: tokensToProcess.length,
            saved: lastFlushedCount,
            batch: Math.floor(lastFlushedCount / BATCH_FLUSH_SIZE),
          });
        }
      };

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, tokensToProcess.length) },
        () => worker()
      );
      await Promise.all(workers);

      // Final flush for remaining accounts
      await flushToDatabase(true);

      setImportProgress({
        current: tokensToProcess.length,
        total: tokensToProcess.length,
        saved: accumulatedNewAccounts.length,
        batch: Math.ceil(accumulatedNewAccounts.length / BATCH_FLUSH_SIZE),
      });

      if (successCount > 0) {
        setSuccessMsg(
          `Berhasil mengimpor & menyimpan ${successCount} akun ke database Google Sheets.${
            failCount > 0 ? ` (${failCount} token tidak valid/gagal)` : ''
          }`
        );
        setTimeout(() => {
          setIsAddModalOpen(false);
          setImportTextInput('');
          setSuccessMsg(null);
        }, 2200);
      } else {
        setErrorMsg('Gagal memproses semua token yang diimpor. Periksa kembali keaktifan token.');
      }
    } catch (err: any) {
      console.error('Error during batch import:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses impor.');
    } finally {
      isImportingRef.current = false;
      setIsSubmitting(false);
      setTimeout(() => {
        setImportProgress(null);
      }, 1500);
    }
  };

  // Refreshing credit state per account
  const [refreshingAccId, setRefreshingAccId] = useState<string | null>(null);
  const [syncingAccountIds, setSyncingAccountIds] = useState<string[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  // Multi-select deletion state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [deletingAccountIds, setDeletingAccountIds] = useState<string[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isDeletingDeadAccounts, setIsDeletingDeadAccounts] = useState(false);
  const [activeMenuAccountId, setActiveMenuAccountId] = useState<string | null>(null);
  const [desktopSearchTerm, setDesktopSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'hasCredits' | 'zeroCredits' | 'active'>('all');
  const [accountViewMode, setAccountViewMode] = useState<'list' | 'grid'>('list');

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || providers[0];

  const filteredDesktopAccounts = (currentProvider?.accounts || []).filter((acc) => {
    if (desktopSearchTerm.trim()) {
      const term = desktopSearchTerm.trim().toLowerCase();
      const matchSearch =
        acc.email.toLowerCase().includes(term) ||
        (acc.name && acc.name.toLowerCase().includes(term)) ||
        (acc.displayName && acc.displayName.toLowerCase().includes(term));
      if (!matchSearch) return false;
    }

    if (accountFilter === 'hasCredits') {
      const c = typeof acc.credits === 'number' ? acc.credits : 0;
      return c > 0;
    }
    if (accountFilter === 'zeroCredits') {
      const c = typeof acc.credits === 'number' ? acc.credits : 0;
      return c <= 0;
    }
    if (accountFilter === 'active') {
      return !!acc.isActive;
    }

    return true;
  });

  const allAccountsCount = currentProvider?.accounts.length || 0;
  const hasCreditsAccountsCount = (currentProvider?.accounts || []).filter((a) => (typeof a.credits === 'number' ? a.credits : 0) > 0).length;
  const zeroCreditsAccountsCount = (currentProvider?.accounts || []).filter((a) => (typeof a.credits === 'number' ? a.credits : 0) <= 0).length;
  const activeAccountsCount = (currentProvider?.accounts || []).filter((a) => a.isActive).length;

  // Select/activate an account
  const handleSelectActiveAccount = async (providerId: string, accountId: string) => {
    const prov = providers.find((p) => p.id === providerId);
    if (!prov) return;

    const target = prov.accounts.find((a) => a.id === accountId);
    if (target && target.accountStatus && target.accountStatus !== 'active') {
      alert(`Akun "${target.displayName || target.name || target.email}" berstatus FAILED / ${target.statusMessage || target.accountStatus.toUpperCase()} (Mati/Expired). Akun yang gagal tidak dapat diaktifkan. Silakan perbarui cookie/token akun ini.`);
      return;
    }

    const newAccounts = prov.accounts.map((acc) => ({
      ...acc,
      isActive: acc.id === accountId,
    }));

    setProviders((prev) =>
      prev.map((provider) => (provider.id === providerId ? { ...provider, accounts: newAccounts } : provider))
    );

    // Save directly to localStorage & Sheets immediately
    localStorage.setItem(`${providerId}_accounts`, JSON.stringify(newAccounts));
    localStorage.setItem(`${providerId}_active_account_id`, accountId);
    window.dispatchEvent(new Event('accounts-updated'));
    window.dispatchEvent(new Event(`${providerId}_accounts_updated`));
    await saveProviderAccountsToSheet(providerId, newAccounts);
  };

  // Add new account handler
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    const targetProviderId = selectedProviderId || currentProvider?.id || 'weavy';
    if (!cleanToken) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (targetProviderId === 'runninghub') {
        const customNickname = nicknameInput.trim();
        const shortKey = cleanToken.length >= 8 ? `${cleanToken.slice(0, 4)}...${cleanToken.slice(-4)}` : cleanToken;
        const isCustomEmail = customNickname.includes('@');

        const resp = await fetch('/api/runninghub/account/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: cleanToken,
            customLabel: customNickname || undefined,
            email: isCustomEmail ? customNickname : undefined,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'API Key RunningHub tidak valid.');
        }

        const finalEmail = isCustomEmail
          ? customNickname
          : (data.email && !data.email.startsWith('rh_') ? data.email : (customNickname ? `rh_${cleanToken.slice(0, 8)}@runninghub.ai` : data.email || `rh_${cleanToken.slice(0, 8)}@runninghub.ai`));
        const finalName = customNickname || (data.name && !data.name.includes('undefined') ? data.name : (data.displayName || `RunningHub (${shortKey})`));
        const finalDisplayName = customNickname || (data.displayName && !data.displayName.includes('undefined') ? data.displayName : (data.name || `RunningHub (${shortKey})`));

        const prov = providers.find((p) => p.id === 'runninghub');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const newAccount: ProviderAccount = {
          id: `acc-runninghub-${Date.now()}`,
          email: finalEmail,
          name: finalName,
          displayName: finalDisplayName,
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: data.apiKey || cleanToken,
          credits: data.credits !== undefined && data.credits > 0 ? data.credits : 600,
        };

        const existingIdx = existingAccounts.findIndex(
          (a) =>
            (a.refreshToken && cleanToken && a.refreshToken.trim() === cleanToken.trim()) ||
            (data.apiKey && a.refreshToken && a.refreshToken.trim() === data.apiKey.trim()) ||
            (finalEmail && a.email && a.email.toLowerCase() === finalEmail.toLowerCase() && !finalEmail.startsWith('rh_'))
        );

        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            email: finalEmail || existingAccounts[existingIdx].email,
            name: finalName || existingAccounts[existingIdx].name,
            displayName: finalDisplayName || existingAccounts[existingIdx].displayName,
            credits: data.credits !== undefined ? data.credits : existingAccounts[existingIdx].credits,
            refreshToken: data.apiKey || cleanToken,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalRunningHubAccounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'runninghub' ? { ...p, accounts: finalRunningHubAccounts } : p))
        );

        // Immediate LocalStorage and Sheets sync
        localStorage.setItem('runninghub_accounts', JSON.stringify(finalRunningHubAccounts));
        window.dispatchEvent(new Event('accounts-updated'));
        window.dispatchEvent(new Event('runninghub_accounts_updated'));
        await saveProviderAccountsToSheet('runninghub', finalRunningHubAccounts);

        setTokenInput('');
        setNicknameInput('');
        setIsAddModalOpen(false);
        return;
      }

      if (targetProviderId === 'kie') {
        const resp = await fetch('/api/kie/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: cleanToken }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'API Key Kie.ai tidak valid.');
        }

        const customNickname = nicknameInput.trim();
        const nicknameToUse = customNickname || data.displayName || data.nickname || `Kie.ai (${cleanToken.slice(0, 4)}...${cleanToken.slice(-4)})`;

        const prov = providers.find((p) => p.id === 'kie');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const newAccount: ProviderAccount = {
          id: `acc-kie-${Date.now()}`,
          email: data.email || `kie_${cleanToken.slice(0, 8)}@kie.ai`,
          name: nicknameToUse,
          displayName: nicknameToUse,
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: data.cleanToken || cleanToken,
          credits: (data.hasValidCredits && typeof data.credits === 'number') ? data.credits : 80,
          totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : 80,
        };

        const existingIdx = existingAccounts.findIndex(
          (a) =>
            a.refreshToken === (data.cleanToken || cleanToken) ||
            (data.email && a.email && a.email.toLowerCase() === data.email.toLowerCase())
        );

        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            email: data.email || existingAccounts[existingIdx].email,
            name: customNickname || existingAccounts[existingIdx].name || nicknameToUse,
            displayName: customNickname || existingAccounts[existingIdx].displayName || nicknameToUse,
            credits: (data.hasValidCredits && typeof data.credits === 'number') ? data.credits : (typeof existingAccounts[existingIdx].credits === 'number' ? existingAccounts[existingIdx].credits : 80),
            totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : existingAccounts[existingIdx].totalCredits,
            refreshToken: data.cleanToken || cleanToken,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalKieAccounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'kie' ? { ...p, accounts: finalKieAccounts } : p))
        );

        // Immediate LocalStorage and Sheets sync
        localStorage.setItem('kie_accounts', JSON.stringify(finalKieAccounts));
        window.dispatchEvent(new Event('accounts-updated'));
        await saveProviderAccountsToSheet('kie', finalKieAccounts);

        setTokenInput('');
        setNicknameInput('');
        setIsAddModalOpen(false);
        return;
      }

      if (targetProviderId === 'flow') {
        const customNickname = nicknameInput.trim();
        const resp = await fetch('/api/flow/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: cleanToken,
            email: customNickname || undefined,
            nickname: customNickname || undefined,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'cURL atau Cookie Google Flow tidak valid.');
        }

        const finalEmail = cleanEmailArtifacts(data.email || (customNickname.includes('@') ? customNickname : `flow_${Date.now()}@google.com`));
        const finalName = cleanEmailArtifacts(customNickname || data.displayName || data.name || (finalEmail ? finalEmail.split('@')[0] : 'Google Flow User'));

        const prov = providers.find((p) => p.id === 'flow');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const newAccount: ProviderAccount = {
          id: `acc-flow-${Date.now()}`,
          email: finalEmail,
          name: finalName,
          displayName: finalName,
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: data.cookies || cleanToken,
          token: data.cookies || cleanToken,
          cookies: data.cookies,
          authHeader: data.authHeader,
          apiKey: data.apiKey,
          credits: typeof data.credits === 'number' ? Math.min(50, data.credits) : 50,
          totalCredits: 50,
        };

        const isGenericEmail = !finalEmail || finalEmail.startsWith('flow_user_') || finalEmail.startsWith('flow_') || finalEmail === 'flow.user@google.com';
        const existingIdx = existingAccounts.findIndex((a) => {
          const sameToken = (a.token && cleanToken && a.token.trim() === cleanToken.trim()) ||
                            (a.refreshToken && cleanToken && a.refreshToken.trim() === cleanToken.trim()) ||
                            (data.cookies && a.cookies && a.cookies.trim() === data.cookies.trim()) ||
                            (data.cookies && a.token && a.token.trim() === data.cookies.trim());
          const sameRealEmail = !isGenericEmail && a.email && a.email.toLowerCase() === finalEmail.toLowerCase();
          return sameToken || sameRealEmail;
        });

        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            ...newAccount,
            id: existingAccounts[existingIdx].id,
            isActive: existingAccounts[existingIdx].isActive || newAccount.isActive,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalFlowAccounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'flow' ? { ...p, accounts: finalFlowAccounts } : p))
        );

        localStorage.setItem('flow_accounts', JSON.stringify(finalFlowAccounts));
        window.dispatchEvent(new Event('accounts-updated'));
        window.dispatchEvent(new Event('flow_accounts_updated'));
        await saveProviderAccountsToSheet('flow', finalFlowAccounts);

        setTokenInput('');
        setNicknameInput('');
        setIsAddModalOpen(false);
        setSuccessMsg(`Berhasil menambahkan akun Google Flow "${finalName}" (${finalEmail})!`);
        setTimeout(() => setSuccessMsg(null), 3000);
        return;
      }

      if (targetProviderId === 'vids') {
        const customNickname = nicknameInput.trim();
        const resp = await fetch('/api/vids/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: cleanToken,
            email: customNickname || undefined,
            nickname: customNickname || undefined,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'cURL atau Cookie Google Vids tidak valid.');
        }

        const finalEmail = cleanEmailArtifacts(data.email || (customNickname.includes('@') ? customNickname : `vids_${Date.now()}@google.com`));
        const finalName = cleanEmailArtifacts(customNickname || data.displayName || data.name || (finalEmail ? finalEmail.split('@')[0] : 'Google Vids User'));

        const prov = providers.find((p) => p.id === 'vids');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const newAccount: ProviderAccount = {
          id: `acc-vids-${Date.now()}`,
          email: finalEmail,
          name: finalName,
          displayName: finalName,
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: data.cookies || cleanToken,
          token: data.cookies || cleanToken,
          cookies: data.cookies || cleanToken,
          docId: data.docId,
          serverToken: data.serverToken,
          flixDocId: data.docId,
          credits: typeof data.credits === 'number' ? data.credits : 450,
          totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : 500,
        };

        const existingIdx = existingAccounts.findIndex(
          (a) => a.email && a.email.toLowerCase() === finalEmail.toLowerCase()
        );
        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            ...newAccount,
            id: existingAccounts[existingIdx].id,
            isActive: existingAccounts[existingIdx].isActive || newAccount.isActive,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalVidsAccounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'vids' ? { ...p, accounts: finalVidsAccounts } : p))
        );

        localStorage.setItem('vids_accounts', JSON.stringify(finalVidsAccounts));
        window.dispatchEvent(new Event('accounts-updated'));
        window.dispatchEvent(new Event('vids_accounts_updated'));
        await saveProviderAccountsToSheet('vids', finalVidsAccounts);

        setTokenInput('');
        setNicknameInput('');
        setIsAddModalOpen(false);
        setSuccessMsg(`Berhasil menambahkan akun Google Vids "${finalName}" (${finalEmail})!`);
        setTimeout(() => setSuccessMsg(null), 3000);
        return;
      }

      if (targetProviderId === 'gemini') {
        const customNickname = nicknameInput.trim();
        const shortKey = cleanToken.length >= 8 ? `${cleanToken.slice(0, 4)}...${cleanToken.slice(-4)}` : cleanToken;

        const resp = await fetch('/api/gemini/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: cleanToken,
            customLabel: customNickname || undefined,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'Token / Cookie / API Key Gemini tidak valid.');
        }

        const rawEmail = (data.email && !data.email.startsWith('gemini_user@google.com'))
          ? data.email
          : (customNickname && customNickname.includes('@') ? customNickname : data.email || `gemini_${cleanToken.slice(0, 8)}@google.com`);
        const finalEmail = cleanEmailArtifacts(rawEmail);
        const finalName = cleanEmailArtifacts(customNickname || data.name || (finalEmail && finalEmail.includes('@') ? finalEmail.split('@')[0] : `Gemini Account (${shortKey})`));
        const finalDisplayName = cleanEmailArtifacts(customNickname || data.displayName || data.name || finalName);

        const prov = providers.find((p) => p.id === 'gemini');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const newAccount: ProviderAccount = {
          id: `acc-gemini-${Date.now()}`,
          email: finalEmail,
          name: finalName,
          displayName: finalDisplayName,
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: data.token || cleanToken,
          credits: data.ledgerKnown === true && typeof data.credits === 'number'
            ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, data.credits))
            : 0,
          totalCredits: GEMINI_MAX_CREDITS,
          creditsUsed: typeof data.creditsUsed === 'number' ? data.creditsUsed : undefined,
          creditSyncStatus: data.ledgerKnown === true ? 'synced' : 'unknown',
        };

        const existingIdx = existingAccounts.findIndex(
          (a) =>
            (a.refreshToken && cleanToken && a.refreshToken.trim() === cleanToken.trim()) ||
            (data.token && a.refreshToken && a.refreshToken.trim() === data.token.trim()) ||
            (finalEmail && a.email && a.email.toLowerCase() === finalEmail.toLowerCase() && !finalEmail.startsWith('gemini_')) ||
            (a.email === 'gemini_user@google.com') ||
            (a.name === 'gemini_user')
        );

        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            email: finalEmail || existingAccounts[existingIdx].email,
            name: finalName || existingAccounts[existingIdx].name,
            displayName: finalDisplayName || existingAccounts[existingIdx].displayName,
            credits: data.ledgerKnown === true && typeof data.credits === 'number'
              ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, data.credits))
              : (typeof existingAccounts[existingIdx].credits === 'number' ? existingAccounts[existingIdx].credits : 0),
            creditsUsed: data.ledgerKnown === true && typeof data.creditsUsed === 'number'
              ? data.creditsUsed
              : existingAccounts[existingIdx].creditsUsed,
            totalCredits: GEMINI_MAX_CREDITS,
            creditSyncStatus: data.ledgerKnown === true ? 'synced' : existingAccounts[existingIdx].creditSyncStatus || 'unknown',
            refreshToken: data.token || cleanToken,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalGeminiAccounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'gemini' ? { ...p, accounts: finalGeminiAccounts } : p))
        );

        // Immediate LocalStorage and Sheets sync
        localStorage.setItem('gemini_accounts', JSON.stringify(finalGeminiAccounts));
        window.dispatchEvent(new Event('accounts-updated'));
        await saveProviderAccountsToSheet('gemini', finalGeminiAccounts);

        setTokenInput('');
        setNicknameInput('');
        setIsAddModalOpen(false);
        return;
      }

      if (targetProviderId === 'galleri5') {
        const resp = await fetch('/api/galleri5/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: cleanToken }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'Token Galleri5 tidak valid.');
        }

        const prov = providers.find((p) => p.id === 'galleri5');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const newAccount: ProviderAccount = {
          id: `acc-galleri5-${Date.now()}`,
          email: data.email || `user_${(data.cleanToken || cleanToken).slice(0, 8)}@galleri5.com`,
          name: data.displayName || 'Galleri5 User',
          displayName: data.displayName,
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: data.cleanToken || cleanToken,
          credits: data.credits,
          totalCredits: data.totalCredits,
          creditsUsed: data.creditsUsed,
        };

        const existingIdx = existingAccounts.findIndex(
          (a) =>
            a.refreshToken === (data.cleanToken || cleanToken) ||
            (data.email && a.email && a.email.toLowerCase() === data.email.toLowerCase())
        );

        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            email: data.email || existingAccounts[existingIdx].email,
            name: data.displayName || existingAccounts[existingIdx].name,
            displayName: data.displayName || existingAccounts[existingIdx].displayName,
            credits: data.credits,
            totalCredits: data.totalCredits,
            creditsUsed: data.creditsUsed,
            refreshToken: data.cleanToken || cleanToken,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalGalleri5Accounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'galleri5' ? { ...p, accounts: finalGalleri5Accounts } : p))
        );

        localStorage.setItem('galleri5_accounts', JSON.stringify(finalGalleri5Accounts));
        window.dispatchEvent(new Event('accounts-updated'));
        await saveProviderAccountsToSheet('galleri5', finalGalleri5Accounts);

        setTokenInput('');
        setIsAddModalOpen(false);
        return;
      }

      if (targetProviderId === 'roboneo') {
        const resp = await fetch('/api/roboneo/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: cleanToken }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'Token RoboNeo tidak valid.');
        }

        const prov = providers.find((p) => p.id === 'roboneo');
        const existingAccounts = prov ? [...prov.accounts] : [];

        const tokenDisplay = cleanToken.length > 20 ? `${cleanToken.slice(0, 10)}...${cleanToken.slice(-6)}` : cleanToken;
        const newAccount: ProviderAccount = {
          id: `acc-roboneo-${Date.now()}`,
          email: data.email || tokenDisplay,
          name: data.name || 'RoboNeo Account',
          isActive: existingAccounts.length === 0,
          hasRefreshToken: true,
          refreshToken: cleanToken,
          credits: data.credits !== undefined ? data.credits : 100,
          totalCredits: data.totalCredits !== undefined ? data.totalCredits : 100,
        };

        const existingIdx = existingAccounts.findIndex((a) => a.refreshToken === cleanToken);

        if (existingIdx >= 0) {
          existingAccounts[existingIdx] = {
            ...existingAccounts[existingIdx],
            email: data.email || existingAccounts[existingIdx].email,
            name: data.name || existingAccounts[existingIdx].name || 'RoboNeo Account',
            credits: data.credits !== undefined ? data.credits : existingAccounts[existingIdx].credits,
            totalCredits: data.totalCredits !== undefined ? data.totalCredits : existingAccounts[existingIdx].totalCredits,
            refreshToken: cleanToken,
          };
        } else {
          existingAccounts.push(newAccount);
        }

        if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
          existingAccounts[0].isActive = true;
        }

        const finalRoboneoAccounts = [...existingAccounts];
        setProviders((prev) =>
          prev.map((p) => (p.id === 'roboneo' ? { ...p, accounts: finalRoboneoAccounts } : p))
        );

        localStorage.setItem('roboneo_accounts', JSON.stringify(finalRoboneoAccounts));
        window.dispatchEvent(new Event('accounts-updated'));
        await saveProviderAccountsToSheet('roboneo', finalRoboneoAccounts);

        setTokenInput('');
        setIsAddModalOpen(false);
        return;
      }

      // Weavy AI Flow
      const info = await exchangeRefreshTokenAndGetInfo(cleanToken);
      const customNick = nicknameInput.trim();

      const prov = providers.find((p) => p.id === targetProviderId) || providers.find((p) => p.id === 'weavy');
      const existingAccounts = prov ? [...prov.accounts] : [];

      const newAccount: ProviderAccount = {
        id: `acc-weavy-${Date.now()}`,
        email: info.email,
        name: customNick || info.name,
        displayName: customNick || info.name,
        isActive: existingAccounts.length === 0,
        hasRefreshToken: true,
        refreshToken: info.refreshToken,
        idToken: info.idToken,
        credits: info.credits,
        totalCredits: info.totalCredits,
      };

      const existingIdx = existingAccounts.findIndex(
        (a) => a.email.toLowerCase() === newAccount.email.toLowerCase() || a.refreshToken === newAccount.refreshToken
      );

      if (existingIdx >= 0) {
        existingAccounts[existingIdx] = {
          ...existingAccounts[existingIdx],
          email: newAccount.email,
          name: customNick || existingAccounts[existingIdx].name || newAccount.name,
          displayName: customNick || existingAccounts[existingIdx].displayName || newAccount.displayName,
          credits: newAccount.credits,
          totalCredits: newAccount.totalCredits,
          idToken: newAccount.idToken,
          refreshToken: newAccount.refreshToken,
        };
      } else {
        existingAccounts.push(newAccount);
      }

      if (existingAccounts.length > 0 && !existingAccounts.some((a) => a.isActive)) {
        existingAccounts[0].isActive = true;
      }

      const finalWeavyAccounts = [...existingAccounts];
      setProviders((prev) =>
        prev.map((p) => (p.id === targetProviderId ? { ...p, accounts: finalWeavyAccounts } : p))
      );

      localStorage.setItem('weavy_accounts', JSON.stringify(finalWeavyAccounts));
      window.dispatchEvent(new Event('accounts-updated'));
      await saveProviderAccountsToSheet(targetProviderId, finalWeavyAccounts);

      setTokenInput('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Error adding account:', err);
      setErrorMsg(err.message || 'Gagal memverifikasi token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync / Login sesi akun Weavy langsung ke tab browser app.weavy.ai
  const handleSyncWeavyAccountToBrowserTab = async (acc: ProviderAccount) => {
    if (!acc) return;
    setRefreshingAccId(acc.id);
    try {
      const syncRes = await extensionBridge.syncAccountToWeavyTab(
        {
          id: acc.id,
          email: acc.email,
          name: acc.displayName || acc.name,
          displayName: acc.displayName || acc.name,
          refreshToken: acc.refreshToken,
          idToken: acc.idToken,
          credits: acc.credits,
        },
        { mode: 'login' }
      );

      if (syncRes && syncRes.success) {
        const refreshedCredits = typeof syncRes.credits === 'number' ? syncRes.credits : acc.credits;
        const prov = providers.find((p) => p.id === 'weavy');
        if (prov) {
          const newAccs = prov.accounts.map((a) =>
            a.id === acc.id
              ? {
                  ...a,
                  credits: refreshedCredits,
                  isActive: true,
                  accountStatus: 'active' as const,
                  statusMessage: undefined,
                  email: syncRes.email || a.email,
                  idToken: syncRes.idToken || a.idToken,
                  refreshToken: syncRes.refreshToken || a.refreshToken,
                  lastChecked: new Date().toISOString(),
                }
              : { ...a, isActive: false }
          );
          setProviders((prev) => prev.map((p) => (p.id === 'weavy' ? { ...p, accounts: newAccs } : p)));
          localStorage.setItem('weavy_accounts', JSON.stringify(newAccs));
          window.dispatchEvent(new Event('accounts-updated'));
          window.dispatchEvent(new Event('weavy_accounts_updated'));
          await saveProviderAccountsToSheet('weavy', newAccs);
        }
      } else {
        // Login ke tab gagal -> tampilkan alasan pada akun (jangan diam-diam)
        const reason = syncRes?.error || 'Gagal login ke tab Weavy melalui ekstensi.';
        const prov = providers.find((p) => p.id === 'weavy');
        if (prov) {
          const newAccs = prov.accounts.map((a) =>
            a.id === acc.id
              ? {
                  ...a,
                  accountStatus: syncRes?.code === 'AUTH_INVALID' ? ('expired' as const) : a.accountStatus,
                  statusMessage: reason,
                }
              : a
          );
          setProviders((prev) => prev.map((p) => (p.id === 'weavy' ? { ...p, accounts: newAccs } : p)));
        }
      }
    } catch (e: any) {
      console.warn('Sync to browser tab error:', e);
    } finally {
      setRefreshingAccId(null);
    }
  };

  // Refresh credits for single account
  const handleRefreshCredits = async (acc: ProviderAccount) => {
    const targetProviderId = selectedProviderId || currentProvider?.id || 'weavy';
    const hasAuth = Boolean(
      acc.token ||
      acc.refreshToken ||
      acc.cookies ||
      acc.apiKey ||
      ((targetProviderId === 'gemini' || targetProviderId === 'weavy') && acc.email),
    );
    if (!hasAuth || refreshingAccId) return;
    setRefreshingAccId(acc.id);
    try {
      const updated = await refreshSingleAccount(acc, targetProviderId);
      const prov = providers.find((p) => p.id === targetProviderId);
      if (!prov) return;

      let newAccs = prov.accounts.map((a) => (a.id === acc.id ? updated : a));
      // Jika akun yang di-refresh ternyata mati (expired/banned) dan sebelumnya aktif, matikan isActive atau pindah ke akun aktif lain
      if (updated.accountStatus && updated.accountStatus !== 'active' && acc.isActive) {
        const firstHealthy = newAccs.find((a) => a.id !== updated.id && (!a.accountStatus || a.accountStatus === 'active'));
        newAccs = newAccs.map((a) => ({
          ...a,
          isActive: firstHealthy ? a.id === firstHealthy.id : false,
        }));
      }

      setProviders((prev) =>
        prev.map((p) => (p.id === targetProviderId ? { ...p, accounts: newAccs } : p))
      );
      localStorage.setItem(`${targetProviderId}_accounts`, JSON.stringify(newAccs));
      window.dispatchEvent(new Event('accounts-updated'));
      window.dispatchEvent(new Event(`${targetProviderId}_accounts_updated`));
      await saveProviderAccountsToSheet(targetProviderId, newAccs);
    } catch (err: any) {
      console.error('Failed refreshing credits:', err);
    } finally {
      setRefreshingAccId(null);
    }
  };

  const handleGeminiRelogin = (account: ProviderAccount) => {
    if (!account.email) {
      setErrorMsg('Email akun Gemini tidak tersedia untuk proses relogin.');
      return;
    }
    setActiveMenuAccountId(null);
    setReloginAccount(account);
  };

  const handleOpenGeminiAccountBrowser = async (account: ProviderAccount) => {
    if (!account.email) {
      window.alert('Email akun Gemini tidak tersedia untuk membuka browser.');
      return;
    }
    if (openingGeminiBrowserAccountId) return;

    setOpeningGeminiBrowserAccountId(account.id);
    try {
      const response = await fetch('/api/gemini/playwright/profile/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal membuka browser akun Gemini.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuka browser akun Gemini.';
      window.alert(message);
    } finally {
      setOpeningGeminiBrowserAccountId(null);
    }
  };

  // Helper to refresh a single account data from provider backend
  const refreshSingleAccount = async (acc: ProviderAccount, providerId: string): Promise<ProviderAccount> => {
    const hasAuth = Boolean(
      acc.token ||
      acc.refreshToken ||
      acc.cookies ||
      acc.apiKey ||
      ((providerId === 'gemini' || providerId === 'weavy') && acc.email),
    );
    if (!hasAuth) return acc;
    const nowIso = new Date().toISOString();

    const classifyError = (status: number, message?: string): { accountStatus: 'banned' | 'expired' | 'error'; statusMessage: string } => {
      const msg = (message || '').toLowerCase();
      if (status === 403 || msg.includes('ban') || msg.includes('forbidden') || msg.includes('block') || msg.includes('permission_denied') || msg.includes('suspended')) {
        return { accountStatus: 'banned', statusMessage: message || 'Akun terdeteksi Banned / Forbidden (403)' };
      }
      if (
        status === 401 ||
        msg.includes('expired') ||
        msg.includes('unauthorized') ||
        msg.includes('token_expired') ||
        msg.includes('invalid_token') ||
        msg.includes('auth') ||
        msg.includes('kadaluarsa') ||
        msg.includes('tidak valid') ||
        msg.includes('session')
      ) {
        return { accountStatus: 'expired', statusMessage: message || 'Token Kedaluwarsa / Tidak Valid (401)' };
      }
      return { accountStatus: 'error', statusMessage: message || `Error HTTP ${status}` };
    };

    try {
      if (providerId === 'runninghub') {
        const resp = await fetch('/api/runninghub/account/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: acc.refreshToken }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          const isPlaceholderName = !acc.name || acc.name.startsWith('RunningHub (') || acc.name.startsWith('rh_');
          const isPlaceholderEmail = !acc.email || acc.email.includes('@runninghub.ai') || acc.email.startsWith('rh_');
          return {
            ...acc,
            email: (data.email && !data.email.endsWith('@runninghub.ai')) ? data.email : (isPlaceholderEmail && data.email ? data.email : acc.email),
            name: isPlaceholderName && data.displayName ? data.displayName : (data.name || acc.name || data.displayName || data.email),
            displayName: isPlaceholderName && data.displayName ? data.displayName : (data.displayName || acc.displayName || data.email),
            credits: data.credits !== undefined ? data.credits : acc.credits,
            totalCredits: undefined,
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status, data.error || data.message || 'API Key RunningHub tidak valid / nonaktif');
        return {
          ...acc,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else if (providerId === 'kie') {
        const resp = await fetch('/api/kie/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: acc.refreshToken }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return {
            ...acc,
            email: data.email || acc.email,
            name: data.displayName || acc.name,
            displayName: data.displayName || acc.displayName,
            credits: (data.hasValidCredits && typeof data.credits === 'number') ? data.credits : acc.credits,
            totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : acc.totalCredits,
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status, data.error || data.message || 'API Key Kie.ai tidak valid');
        return {
          ...acc,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else if (providerId === 'flow') {
        const tokenToSend = (acc.token || acc.refreshToken || acc.cookies || '').trim();
        const resp = await fetch('/api/flow/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenToSend,
            email: acc.email,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return {
            ...acc,
            email: data.email || acc.email,
            name: data.displayName || data.name || acc.name,
            displayName: data.displayName || acc.displayName,
            token: data.cookies || data.token || acc.token,
            cookies: data.cookies || acc.cookies,
            refreshToken: data.cookies || data.token || acc.refreshToken || acc.token,
            credits: typeof data.credits === 'number' ? data.credits : (typeof acc.credits === 'number' ? acc.credits : 50),
            totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : 50,
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status || 401, data.error || data.message || 'Sesi Cookie / cURL Google Flow tidak valid atau kedaluwarsa');
        return {
          ...acc,
          credits: 0,
          isActive: false,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else if (providerId === 'vids') {
        const tokenToSend = (acc.cookies || acc.token || acc.refreshToken || '').trim();
        const resp = await fetch('/api/vids/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookies: tokenToSend,
            email: acc.email,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return {
            ...acc,
            email: data.email || acc.email,
            token: data.cookies || tokenToSend,
            cookies: data.cookies || tokenToSend,
            docId: data.docId || acc.docId,
            serverToken: data.serverToken || acc.serverToken,
            flixDocId: data.docId || acc.flixDocId,
            credits: typeof data.credits === 'number' ? data.credits : (typeof acc.credits === 'number' ? acc.credits : 0),
            totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : (typeof acc.totalCredits === 'number' ? acc.totalCredits : 500),
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status || 401, data.error || data.message || 'Cookie / sesi Google Vids tidak valid atau kedaluwarsa');
        return {
          ...acc,
          credits: 0,
          isActive: false,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else if (providerId === 'gemini') {
        const tokenToSend = (acc.token || acc.refreshToken || acc.apiKey || acc.cookies || '').trim();
        if (!tokenToSend && !acc.email) {
          return {
            ...acc,
            credits: 0,
            isActive: false,
            accountStatus: 'expired',
            statusMessage: 'EXPIRED',
            lastChecked: nowIso,
          };
        }

        const resp = await fetch('/api/gemini/accounts/sync-daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenToSend,
            email: acc.email,
            id: acc.id,
            name: acc.displayName || acc.name,
            cookies: acc.cookies || (tokenToSend.includes('__Secure') || tokenToSend.includes('SID=') ? tokenToSend : undefined),
            apiKey: acc.apiKey || (tokenToSend.startsWith('AIza') ? tokenToSend : undefined),
          }),
        });

        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success && data.accountStatus !== 'expired') {
          const serverCredits = typeof data.remainingCredits === 'number'
            ? data.remainingCredits
            : data.credits;
          const hasKnownLedger = data.ledgerKnown === true && typeof serverCredits === 'number';
          const resolvedCredits = hasKnownLedger
            ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, serverCredits))
            : (typeof acc.credits === 'number' ? acc.credits : 0);

          return {
            ...acc,
            email: data.email || acc.email,
            name: data.displayName || data.name || acc.name,
            displayName: data.displayName || acc.displayName,
            photoUrl: data.photoUrl || acc.photoUrl,
            tier: data.tier || acc.tier,
            token: data.token || acc.token || (data.cookies ? data.cookies : acc.token),
            cookies: data.cookies || acc.cookies,
            credits: resolvedCredits,
            creditsUsed: hasKnownLedger && typeof data.used === 'number'
              ? data.used
              : hasKnownLedger && typeof data.usedTotal === 'number'
              ? data.usedTotal
              : hasKnownLedger && typeof data.usedToday === 'number'
                ? data.usedToday
                : acc.creditsUsed,
            totalCredits: GEMINI_MAX_CREDITS,
            creditSyncStatus: hasKnownLedger ? 'synced' : 'unknown',
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status || 401, data.error || data.message || 'Sesi Cookie / API Key Google Gemini tidak valid atau kedaluwarsa');
        return {
          ...acc,
          credits: 0,
          isActive: false,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else if (providerId === 'galleri5') {
        const resp = await fetch('/api/galleri5/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: acc.refreshToken }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return {
            ...acc,
            email: data.email || acc.email,
            name: data.displayName || acc.name,
            displayName: data.displayName || acc.displayName,
            credits: data.credits,
            totalCredits: data.totalCredits,
            creditsUsed: data.creditsUsed,
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status, data.error || data.message || 'Token Galleri5 kedaluwarsa');
        return {
          ...acc,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else if (providerId === 'roboneo' || acc.refreshToken.startsWith('_v2') || acc.refreshToken.startsWith('v2')) {
        const resp = await fetch('/api/roboneo/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: acc.refreshToken }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return {
            ...acc,
            email: data.email || acc.email,
            name: data.name || acc.name,
            credits: data.credits !== undefined ? data.credits : acc.credits,
            totalCredits: data.totalCredits !== undefined ? data.totalCredits : acc.totalCredits,
            accountStatus: 'active',
            statusMessage: undefined,
            lastChecked: nowIso,
          };
        }

        const errInfo = classifyError(resp.status, data.error || data.message || 'Access token RoboNeo kedaluwarsa');
        return {
          ...acc,
          accountStatus: errInfo.accountStatus,
          statusMessage: errInfo.statusMessage,
          lastChecked: nowIso,
        };
      } else {
        const isPlaceholderName = !acc.name || acc.name.startsWith('acc-') || acc.name === 'Weavy User';
        const info = await exchangeRefreshTokenAndGetInfo(acc.refreshToken || '', acc.email);
        return {
          ...acc,
          email: info.email || acc.email,
          name: isPlaceholderName ? info.name : acc.name,
          displayName: acc.displayName || acc.name || info.name,
          credits: info.credits > 0 ? info.credits : acc.credits,
          totalCredits: info.totalCredits,
          idToken: info.idToken || acc.idToken,
          refreshToken: info.refreshToken || acc.refreshToken,
          accountStatus: 'active',
          statusMessage: undefined,
          lastChecked: nowIso,
        };
      }
    } catch (err: any) {
      console.error(`Failed refreshing account ${acc.id}:`, err);
      const errInfo = classifyError(500, err?.message || 'Gagal memverifikasi token');
      return {
        ...acc,
        accountStatus: errInfo.accountStatus,
        statusMessage: errInfo.statusMessage,
        lastChecked: nowIso,
      };
    }
  };

  // Sync / Refresh all accounts in current provider with real-time step-by-step progress
  const handleRefreshAllAccounts = async () => {
    if (!currentProvider || isSyncingAll || currentProvider.accounts.length === 0) return;
    const targetProviderId = currentProvider.id;
    const total = currentProvider.accounts.length;
    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total });
    setSyncingAccountIds([]);

    const refreshedAccounts: ProviderAccount[] = [...currentProvider.accounts];

    try {
      const concurrency = 3;
      let completedCount = 0;
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < refreshedAccounts.length) {
          const index = currentIndex++;
          const acc = refreshedAccounts[index];
          
          // Mark this account as actively syncing (spinning icon)
          setSyncingAccountIds((prev) => [...prev, acc.id]);

          const updated = await refreshSingleAccount(acc, targetProviderId);
          refreshedAccounts[index] = updated;
          
          // Remove from actively syncing once done
          setSyncingAccountIds((prev) => prev.filter((id) => id !== acc.id));

          completedCount++;
          setSyncProgress({ current: completedCount, total });

          // Live update providers state per account so UI counters update immediately
          setProviders((prev) =>
            prev.map((p) =>
              p.id === targetProviderId
                ? {
                    ...p,
                    accounts: p.accounts.map((a) => (a.id === updated.id ? updated : a)),
                  }
                : p
            )
          );
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, refreshedAccounts.length) }, () => worker());
      await Promise.all(workers);

      // Ensure if active account became dead/expired/failed, auto-switch active to an alive account
      const hasActiveHealthy = refreshedAccounts.some((a) => a.isActive && (!a.accountStatus || a.accountStatus === 'active'));
      let finalAccounts = refreshedAccounts;
      if (!hasActiveHealthy) {
        const firstHealthy = refreshedAccounts.find((a) => !a.accountStatus || a.accountStatus === 'active');
        if (firstHealthy) {
          finalAccounts = refreshedAccounts.map((a) => ({
            ...a,
            isActive: a.id === firstHealthy.id,
          }));
        }
      }

      setProviders((prev) =>
        prev.map((p) => (p.id === targetProviderId ? { ...p, accounts: finalAccounts } : p))
      );

      // Save to localStorage & Google Sheets after all accounts finish
      localStorage.setItem(`${targetProviderId}_accounts`, JSON.stringify(finalAccounts));
      window.dispatchEvent(new Event('accounts-updated'));
      window.dispatchEvent(new Event(`${targetProviderId}_accounts_updated`));
      await saveProviderAccountsToSheet(targetProviderId, finalAccounts);
    } finally {
      setIsSyncingAll(false);
      setSyncProgress(null);
      setSyncingAccountIds([]);
    }
  };

  // Toggle single account selection for bulk delete
  const handleToggleSelectAccount = (accId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accId) ? prev.filter((id) => id !== accId) : [...prev, accId]
    );
  };

  // Select all accounts
  const handleSelectAll = () => {
    if (!currentProvider) return;
    if (selectedAccountIds.length === currentProvider.accounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(currentProvider.accounts.map((a) => a.id));
    }
  };

  const deleteGeminiPersistentProfiles = async (accountsToDelete: ProviderAccount[]) => {
    const emails = [...new Set(accountsToDelete.map((account) => account.email?.trim()).filter(Boolean))];
    const results = await Promise.all(
      emails.map(async (email) => {
        const response = await fetch('/api/gemini/playwright/profile/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || `Gagal menghapus profil Gemini untuk ${email}.`);
        }
      })
    );
    return results;
  };

  const deleteVidsPersistentSessions = async (accountsToDelete: ProviderAccount[]) => {
    const emails = [...new Set(accountsToDelete.map((account) => account.email?.trim().toLowerCase()).filter(Boolean))];
    await Promise.all(
      emails.map(async (email) => {
        const response = await fetch('/api/vids/accounts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || `Gagal menghapus sesi Google Vids untuk ${email}.`);
        }
      })
    );
  };

  // Delete selected accounts
  const handleDeleteSelected = async () => {
    if (!selectedProviderId || selectedAccountIds.length === 0 || isDeletingSelected) return;
    const targetProviderId = selectedProviderId;

    const prov = providers.find((p) => p.id === targetProviderId);
    if (!prov) return;

    const accountsToDelete = prov.accounts.filter((acc) => selectedAccountIds.includes(acc.id));
    const newAccounts = prov.accounts.filter((acc) => !selectedAccountIds.includes(acc.id));
    if (newAccounts.length > 0 && !newAccounts.some((a) => a.isActive)) {
      newAccounts[0].isActive = true;
    }

    setIsDeletingSelected(true);
    try {
      if (targetProviderId === 'gemini') {
        await deleteGeminiPersistentProfiles(accountsToDelete);
      } else if (targetProviderId === 'vids') {
        await deleteVidsPersistentSessions(accountsToDelete);
      }
      await saveProviderAccountsToSheet(targetProviderId, newAccounts, true);

      setProviders((prev) =>
        prev.map((provider) => (provider.id === targetProviderId ? { ...provider, accounts: newAccounts } : provider))
      );

      localStorage.setItem(`${targetProviderId}_accounts`, JSON.stringify(newAccounts));
      window.dispatchEvent(new Event('accounts-updated'));
      setSelectedAccountIds([]);
      setIsSelectMode(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus akun. Akun tetap berada di daftar.');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  // 1-Click Delete all dead/invalid accounts (banned, expired, error)
  const handleDeleteDeadAccounts = async () => {
    if (!currentProvider || isDeletingDeadAccounts) return;
    const targetProviderId = currentProvider.id;
    const deadAccounts = currentProvider.accounts.filter(
      (a) => a.accountStatus && a.accountStatus !== 'active'
    );

    if (deadAccounts.length === 0) return;

    if (!window.confirm(`Hapus ${deadAccounts.length} akun mati (banned / expired / error) dari ${currentProvider.name}?`)) {
      return;
    }

    const aliveAccounts = currentProvider.accounts.filter(
      (a) => !a.accountStatus || a.accountStatus === 'active'
    );

    if (aliveAccounts.length > 0 && !aliveAccounts.some((a) => a.isActive)) {
      aliveAccounts[0].isActive = true;
    }

    setIsDeletingDeadAccounts(true);
    try {
      if (targetProviderId === 'gemini') {
        await deleteGeminiPersistentProfiles(deadAccounts);
      } else if (targetProviderId === 'vids') {
        await deleteVidsPersistentSessions(deadAccounts);
      }
      await saveProviderAccountsToSheet(targetProviderId, aliveAccounts, true);

      setProviders((prev) =>
        prev.map((provider) =>
          provider.id === targetProviderId ? { ...provider, accounts: aliveAccounts } : provider
        )
      );

      localStorage.setItem(`${targetProviderId}_accounts`, JSON.stringify(aliveAccounts));
      window.dispatchEvent(new Event('accounts-updated'));
      if (targetProviderId === 'runninghub') {
        window.dispatchEvent(new Event('runninghub_accounts_updated'));
      }
      setSelectedAccountIds((prev) => prev.filter((id) => !deadAccounts.some((d) => d.id === id)));
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus akun mati. Akun tetap berada di daftar.');
    } finally {
      setIsDeletingDeadAccounts(false);
    }
  };

  // Delete single account via menu
  const handleDeleteSingle = async (providerId: string, accountId: string) => {
    if (deletingAccountIds.includes(accountId)) return;
    const prov = providers.find((p) => p.id === providerId);
    if (!prov) return;

    const accountToDelete = prov.accounts.find((account) => account.id === accountId);
    if (!accountToDelete) return;

    const newAccounts = prov.accounts.filter((a) => a.id !== accountId);
    if (newAccounts.length > 0 && !newAccounts.some((a) => a.isActive)) {
      newAccounts[0].isActive = true;
    }

    setDeletingAccountIds((prev) => [...prev, accountId]);
    try {
      if (providerId === 'gemini') {
        await deleteGeminiPersistentProfiles([accountToDelete]);
      } else if (providerId === 'vids') {
        await deleteVidsPersistentSessions([accountToDelete]);
      }
      await saveProviderAccountsToSheet(providerId, newAccounts, true);

      setProviders((prev) =>
        prev.map((provider) => (provider.id === providerId ? { ...provider, accounts: newAccounts } : provider))
      );

      localStorage.setItem(`${providerId}_accounts`, JSON.stringify(newAccounts));
      window.dispatchEvent(new Event('accounts-updated'));
      setActiveMenuAccountId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus akun. Akun tetap berada di daftar.');
    } finally {
      setDeletingAccountIds((prev) => prev.filter((id) => id !== accountId));
    }

  };

  // Render provider logo helper
  const renderProviderLogo = (logoType: 'weavy' | 'roboneo' | 'galleri5' | 'kie' | 'runninghub' | 'openai' | 'google' | 'gemini' | 'flow' | 'vids') => {
    if (logoType === 'vids') {
      return (
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-2xs overflow-hidden p-1">
          <img
            src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
            alt="Google Vids"
            className="w-5 h-5 rounded object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }
    if (logoType === 'flow') {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-base shrink-0 border border-emerald-500/20">
          <span>F</span>
        </div>
      );
    }
    if (logoType === 'gemini' || logoType === 'google') {
      return (
        <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E1E26] border border-stone-200/80 dark:border-white/10 flex items-center justify-center p-1 shrink-0 shadow-2xs">
          <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="geminiLogoGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1B72E8" />
                <stop offset="35%" stopColor="#7C3AED" />
                <stop offset="70%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            <path
              d="M14 1.5C14 8.40356 8.40356 14 1.5 14C8.40356 14 14 19.5964 14 26.5C14 19.5964 19.5964 14 26.5 14C19.5964 14 14 8.40356 14 1.5Z"
              fill="url(#geminiLogoGradMain)"
            />
          </svg>
        </div>
      );
    }
    if (logoType === 'runninghub') {
      return (
        <img
          src="https://www.runninghub.ai/favicon.ico?v=1.4"
          alt="RunningHub"
          className="w-8 h-8 rounded-lg object-contain shrink-0"
          referrerPolicy="no-referrer"
        />
      );
    }
    if (logoType === 'kie') {
      return (
        <img
          src="https://kie.ai/logo.png"
          alt="Kie.ai"
          className="w-8 h-8 rounded-lg object-contain shrink-0"
          referrerPolicy="no-referrer"
        />
      );
    }
    if (logoType === 'galleri5') {
      return (
        <>
          <img
            src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
            alt="Galleri5"
            className="w-8 h-8 object-contain shrink-0 dark:hidden"
            referrerPolicy="no-referrer"
          />
          <img
            src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
            alt="Galleri5"
            className="w-8 h-8 object-contain shrink-0 hidden dark:block"
            referrerPolicy="no-referrer"
          />
        </>
      );
    }
    if (logoType === 'weavy') {
      return (
        <>
          <img
            src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg"
            alt="Weavy"
            className="w-8 h-8 object-contain shrink-0 dark:hidden"
            referrerPolicy="no-referrer"
          />
          <img
            src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
            alt="Weavy"
            className="w-8 h-8 object-contain shrink-0 hidden dark:block"
            referrerPolicy="no-referrer"
          />
        </>
      );
    }
    if (logoType === 'roboneo') {
      return (
        <img
          src="https://www.roboneo.com/favicon.ico"
          alt="RoboNeo"
          className="w-8 h-8 rounded-lg object-contain shrink-0"
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-base shrink-0">
        <span>G</span>
      </div>
    );
  };

  // Render Inline Add Account Card for non-Gemini providers (Weavy, RoboNeo, Kie, RunningHub) - NO POPUP!
  const renderInlineAddAccountForOtherProviders = () => {
    if (!currentProvider) return null;

    return (
      <div className="bg-[#FAF9F6] dark:bg-[#141418] rounded-2xl border border-stone-300 dark:border-white/10 p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-white/10 pb-3">
          <div className="flex items-center gap-3">
            {renderProviderLogo(currentProvider.logoType)}
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Tambah Akun — {currentProvider.name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tambahkan token atau impor akun untuk provider {currentProvider.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isSubmitting && setIsAddModalOpen(false)}
            disabled={isSubmitting}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Tutup Form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-stone-200/70 dark:bg-[#181820] p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              if (!isSubmitting) {
                setAddMode('single');
                setErrorMsg(null);
                setSuccessMsg(null);
              }
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              addMode === 'single'
                ? currentProvider.id === 'flow'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : currentProvider.id === 'vids'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            {currentProvider.id === 'flow' ? 'cURL Bash (Disarankan)' : currentProvider.id === 'vids' ? 'Cookie / cURL Vids' : 'Single Token / Key'}
          </button>
          {currentProvider.id === 'weavy' && (
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) {
                  setAddMode('extension');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                addMode === 'extension'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Auto-Import Tab Weavy</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!isSubmitting) {
                setAddMode('import');
                setErrorMsg(null);
                setSuccessMsg(null);
              }
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              addMode === 'import'
                ? currentProvider.id === 'flow'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'bg-amber-600 text-white shadow-2xs font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import TXT File</span>
          </button>
        </div>

        {addMode === 'extension' && currentProvider.id === 'weavy' ? (
          <div className="space-y-4 py-2">
            {/* Status Signal Badge */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              extensionStatus.isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
            }`}>
              <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${
                extensionStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`} />
              <div className="space-y-1 text-xs">
                <p className="font-bold">
                  {extensionStatus.isConnected
                    ? `🟢 Signal Ekstensi Terhubung (V.${extensionStatus.version || '3.0.0'})`
                    : '🟡 Menghubungkan ke Ekstensi Chrome Weavy...'}
                </p>
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                  {extensionStatus.isConnected
                    ? 'Ekstensi siap membaca sesi login aktif dari tab app.weavy.ai Anda secara instan dan aman, bypass Cloudflare WAF 403.'
                    : 'Pastikan ekstensi ektension-weavy sudah dipasang (Load Unpacked) di Chrome dan Anda membuka tab https://app.weavy.ai yang sudah Login.'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
                {successMsg}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleAutoImportFromExtension('weavy')}
                disabled={isSubmitting || isAutoImportingExtension}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isAutoImportingExtension ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membaca Sesi dari Tab Weavy...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>⚡ Baca Sesi &amp; Auto-Import Akun Aktif Sekarang</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-stone-100/70 dark:bg-[#181820] rounded-xl border border-stone-200/80 dark:border-white/5 text-[11px] text-stone-500 dark:text-stone-400 space-y-1 leading-relaxed">
              <p className="font-semibold text-stone-700 dark:text-stone-300">💡 Cara Kerja Auto-Import Ekstensi:</p>
              <ol className="list-decimal list-inside space-y-1 text-[10px]">
                <li>Buka tab baru browser dan masuk ke <a href="https://app.weavy.ai" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 font-bold underline">https://app.weavy.ai</a> (pastikan akun sudah Login).</li>
                <li>Klik tombol di atas, Ekstensi akan otomatis mengambil token asli dan kuota akun aktif tanpa perlu inspect token secara manual.</li>
                <li>Akun otomatis tersimpan dan aktif di AMB Media, siap generate video tanpa blokir 403.</li>
              </ol>
            </div>
          </div>
        ) : addMode === 'single' ? (
          <form onSubmit={handleAddAccount} className="space-y-4">
            {currentProvider.id === 'flow' ? (
              /* DEDICATED cURL BASH INPUT FOR GOOGLE FLOW */              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>Perintah cURL (bash) flow.google.com</span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      50 Kredit / Hari
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) {
                          setTokenInput(clip);
                          setErrorMsg(null);
                        }
                      } catch (e) {
                        alert('Silakan tekan Ctrl+V / Cmd+V pada kotak teks untuk paste.');
                      }
                    }}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Tempel dari Clipboard</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={6}
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={`curl --url 'https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData' \\\n  -H 'authorization: SAPISIDHASH ...' \\\n  -b 'SID=...; __Secure-1PSID=...; SAPISID=...' ...`}
                    required
                    disabled={isSubmitting}
                    className="w-full p-3.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono leading-relaxed custom-scrollbar shadow-inner"
                  />
                  {tokenInput && (
                    <button
                      type="button"
                      onClick={() => setTokenInput('')}
                      className="absolute top-2.5 right-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-[10px] font-sans font-semibold cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>

                {tokenInput.trim() ? (
                  <div className="flex items-center gap-2 text-[11px] pt-0.5">
                    {tokenInput.includes('SAPISID') || tokenInput.includes('SID=') || tokenInput.includes('curl') ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Format cURL / Cookie Google Flow Terdeteksi</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Pastikan menyalin seluruh perintah cURL lengkap dengan Cookie (-b) dan Authorization (-H)
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            ) : currentProvider.id === 'vids' ? (
              /* DEDICATED Cookie / cURL INPUT FOR GOOGLE VIDS */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>Cookie / cURL Google Vids</span>
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      ~11 Video / 500 Kuota
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) {
                          setTokenInput(clip);
                          setErrorMsg(null);
                        }
                      } catch (e) {
                        alert('Silakan tekan Ctrl+V / Cmd+V pada kotak teks untuk paste.');
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-95 px-2.5 py-1 rounded-lg border border-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Tempel dari Clipboard</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={6}
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={`curl --url 'https://docs.google.com/videos/...' \\\n  -H 'authorization: SAPISIDHASH ...' \\\n  -H 'x-server-token: ...' \\\n  -b 'HSID=...; SSID=...; SID=...; SAPISID=...' ...\n\n(Cukup salin 'Copy as cURL (bash)' dari tab Network DevTools, email & kuota 500 kredit akan terdeteksi otomatis)`}
                    required
                    disabled={isSubmitting}
                    className="w-full p-3.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-mono leading-relaxed custom-scrollbar shadow-inner"
                  />
                  {tokenInput && (
                    <button
                      type="button"
                      onClick={() => setTokenInput('')}
                      className="absolute top-2.5 right-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-[10px] font-sans font-semibold cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>

                {tokenInput.trim() ? (
                  <div className="flex items-center gap-2 text-[11px] pt-0.5">
                    {tokenInput.includes('SAPISID') || tokenInput.includes('SID=') || tokenInput.includes('curl') ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-indigo-500" />
                        <span>Format cURL / Cookie Google Vids Terdeteksi</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Pastikan menyalin seluruh Cookie atau cURL lengkap dengan SID, SAPISID
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              /* REGULAR INPUT FOR OTHER PROVIDERS */
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                  {currentProvider.id === 'runninghub'
                    ? 'API Key RunningHub'
                    : currentProvider.id === 'galleri5'
                    ? 'Refresh Token Galleri5 (AMf-...)'
                    : currentProvider.id === 'roboneo'
                    ? 'Access Token (_v2...)'
                    : currentProvider.id === 'kie'
                    ? 'API Key Kie.ai'
                    : 'Refresh Token (AMf-...)'}
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={
                      currentProvider.id === 'runninghub'
                        ? 'Paste API Key RunningHub di sini...'
                        : currentProvider.id === 'galleri5'
                        ? 'Paste Galleri5 refresh token (AMf-...) di sini...'
                        : currentProvider.id === 'roboneo'
                        ? 'Paste RoboNeo access token (_v2...) di sini...'
                        : currentProvider.id === 'kie'
                        ? 'Paste Kie.ai API Key di sini...'
                        : `Paste ${currentProvider.name} refresh token (AMf-...) di sini...`
                    }
                    required
                    disabled={isSubmitting}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Nama / Label Akun (Opsional)
                </label>
                <span className="text-[10px] text-stone-400">Contoh: Akun Utama, Cadangan Flow 1</span>
              </div>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Beri nama panggilan akun ini..."
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
                {successMsg}
              </div>
            )}

            {currentProvider.id === 'flow' ? (
              <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-stone-600 dark:text-stone-300 space-y-1.5">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current" />
                  <span>Sistem Otomatis Google Flow</span>
                </p>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Cookie dan SAPISIDHASH akan diekstrak secara otomatis. Akun langsung aktif dengan kuota <b>50 kredit harian</b> untuk render video di Google Flow.
                </p>
              </div>
            ) : currentProvider.id === 'vids' ? (
              <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-stone-600 dark:text-stone-300 space-y-1.5">
                <p className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 fill-current" />
                  <span>Verifikasi Otomatis Google Vids</span>
                </p>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Cookie Google Vids akan diverifikasi dan kuota akun langsung ditampilkan. Kuota standar <b>500 kredit</b> (~11 video per siklus).
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 bg-stone-100/70 dark:bg-[#181820] rounded-xl border border-stone-200/80 dark:border-white/5 text-xs text-stone-500 dark:text-stone-400">
                <Lock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Token akan diverifikasi dan disimpan secara aman di browser dan sinkronisasi cloud Anda.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-stone-200/80 hover:bg-stone-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !tokenInput.trim()}
                className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  currentProvider.id === 'flow'
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:bg-stone-400'
                    : currentProvider.id === 'vids'
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:bg-stone-400'
                    : 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 disabled:bg-stone-400 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>
                    {currentProvider.id === 'flow'
                      ? 'Simpan Akun Flow (50 Kredit)'
                      : currentProvider.id === 'vids'
                      ? 'Simpan Akun Vids (~500 Kuota)'
                      : 'Simpan Akun'}
                  </span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBatchImport} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                Upload File (.txt)
              </label>
              <label className="flex flex-col items-center justify-center p-4 sm:p-5 border-2 border-dashed border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 rounded-2xl cursor-pointer transition-all text-center">
                <FileText className="w-7 h-7 text-amber-600 dark:text-amber-400 mb-1.5" />
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Klik untuk upload file .txt</span>
                <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                  Sistem otomatis mengekstrak token dari file
                </span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  disabled={isSubmitting}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                  Atau Paste Teks Token:
                </label>
                {importTextInput.trim() && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {extractTokensFromText(importTextInput, currentProvider.id).length} Token Terdeteksi
                  </span>
                )}
              </div>
              <textarea
                rows={3}
                value={importTextInput}
                onChange={(e) => {
                  setImportTextInput(e.target.value);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                placeholder={`Paste token per baris atau format email:token di sini...`}
                disabled={isSubmitting}
                className="w-full p-3 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all custom-scrollbar"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
                {successMsg}
              </div>
            )}

            {importProgress && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-amber-800 dark:text-amber-200">
                  <span>Memverifikasi Akun...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-amber-200 dark:bg-amber-950 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-600 h-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / Math.max(importProgress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-stone-200/80 hover:bg-stone-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !importTextInput.trim()}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 disabled:bg-stone-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengimpor Akun...</span>
                  </>
                ) : (
                  <span>Proses Import Batch</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-28 w-full max-w-[1720px] mx-auto">
      {/* ========================================================= */}
      {/* MOBILE / TABLET LAYOUT (< lg breakpoint)                 */}
      {/* ========================================================= */}
      <div className="lg:hidden">
        {/* VIEW 1: Main Settings / AI Providers list */}
        {!selectedProviderId ? (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Settings</h1>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">AI Providers</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Kelola akun AI provider yang kamu gunakan.</p>
            </div>

            <div className="space-y-2 pt-1">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => {
                    setSelectedProviderId(provider.id);
                    onSelectProvider?.(provider.id);
                    setIsSelectMode(false);
                    setSelectedAccountIds([]);
                  }}
                  className="bg-white dark:bg-[#141418] rounded-2xl p-4 border border-stone-200/80 dark:border-white/10 shadow-2xs flex items-center justify-between cursor-pointer hover:border-amber-500/50 dark:hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    {renderProviderLogo(provider.logoType)}
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {provider.name}
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-normal mt-0.5">
                        {(() => {
                          const dead = provider.accounts.filter((a) => a.accountStatus && a.accountStatus !== 'active').length;
                          if (provider.accounts.length === 0) return 'Belum ada akun';
                          return dead > 0
                            ? `${provider.accounts.length} akun · ${dead} bermasalah`
                            : `${provider.accounts.length} akun · ${provider.accounts.length} aktif`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {provider.accounts.length > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          provider.accounts.some((a) => a.accountStatus && a.accountStatus !== 'active') ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                    <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* VIEW 2 & 3: Provider Detail View on Mobile */
          <div key={currentProvider?.id || 'weavy'} className="space-y-4">
            {/* Header row with back button, center title, and right Add button */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-white/10">
              <button
                onClick={() => {
                  setSelectedProviderId(null);
                  onClearExternalProviderId?.();
                  setIsSelectMode(false);
                }}
                className="p-1 -ml-1 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg transition-colors cursor-pointer"
                title="Kembali ke AI Providers"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 text-center">
                {currentProvider?.name || 'Weavy'}
              </h2>

              <div className="flex items-center gap-1.5">
                {currentProvider?.id === 'weavy' && (
                  <button
                    type="button"
                    onClick={() => handleAutoImportFromExtension('weavy')}
                    disabled={isAutoImportingExtension}
                    className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-amber-500/30"
                    title="Auto-Import akun aktif dari tab Weavy"
                  >
                    {isAutoImportingExtension ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 fill-current" />}
                    <span>Auto-Import</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setTokenInput('');
                    setIsAddModalOpen(true);
                  }}
                  className="text-xs font-bold text-white dark:text-stone-950 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            {/* Accounts Section Header & Action Buttons */}
            <div className="flex items-start justify-between pt-1">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Accounts</h3>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Pilih akun yang ingin digunakan.</p>
              </div>

              {currentProvider && currentProvider.accounts.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  {!isSelectMode && (
                    <button
                      onClick={handleRefreshAllAccounts}
                      disabled={isSyncingAll}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-xl transition-colors border shadow-2xs cursor-pointer ${
                        isSyncingAll
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 dark:bg-amber-500/20'
                          : 'text-amber-700 dark:text-stone-100 bg-amber-500/10 hover:bg-amber-500/20 dark:bg-[#141418] dark:hover:bg-[#1E1E26] border-amber-500/20 dark:border-white/10'
                      }`}
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingAll ? 'animate-spin text-amber-600 dark:text-amber-400' : ''}`} />
                      <span>
                        {isSyncingAll && syncProgress
                          ? `Sync ${syncProgress.current}/${syncProgress.total}`
                          : 'Sync All'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsSelectMode(!isSelectMode);
                      if (isSelectMode) setSelectedAccountIds([]);
                    }}
                    title={isSelectMode ? 'Selesai Pilih' : 'Pilih Banyak'}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer shrink-0 ${
                      isSelectMode
                        ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 font-bold shadow-2xs'
                        : 'bg-stone-100 dark:bg-[#141418] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-200/80 dark:hover:bg-[#1E1E26]'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 shrink-0 text-stone-500 dark:text-stone-400" />
                    <span>{isSelectMode ? 'Selesai' : 'Pilih Banyak'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Weavy / Gemini / Flow / Galleri5 / Kie / RunningHub Refresh Token & API Key Tutorial Collapsible */}
            {currentProvider?.id === 'weavy' && <WeavyTokenTutorial />}
            {currentProvider?.id === 'gemini' && <GeminiTokenTutorial />}
            {currentProvider?.id === 'flow' && <FlowTokenTutorial />}
            {currentProvider?.id === 'galleri5' && <Galleri5TokenTutorial />}
            {currentProvider?.id === 'kie' && <KieApiKeyTutorial />}
            {currentProvider?.id === 'runninghub' && <RunningHubTutorial />}
            {currentProvider?.id === 'vids' && <VidsTokenTutorial />}

            {/* Dead Accounts Alert & Quick 1-Click Action Bar (Mobile) */}
            {currentProvider && currentProvider.accounts.some((a) => a.accountStatus && a.accountStatus !== 'active') && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300 truncate">
                      {currentProvider.accounts.filter((a) => a.accountStatus && a.accountStatus !== 'active').length} Akun Mati / Banned
                    </p>
                    <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 truncate">
                      Otomatis dilewati saat batch generate
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteDeadAccounts}
                  disabled={isDeletingDeadAccounts}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-70 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors shadow-2xs cursor-pointer disabled:cursor-wait"
                >
                  {isDeletingDeadAccounts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  <span>{isDeletingDeadAccounts ? 'Menghapus...' : 'Hapus Akun Mati'}</span>
                </button>
              </div>
            )}

            {/* Select All & Delete Bar in Select Mode */}
            {isSelectMode && currentProvider && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedAccountIds.length === 0 || isDeletingSelected}
                  title={selectedAccountIds.length > 0 ? `Hapus ${selectedAccountIds.length} Akun Terpilih` : 'Pilih akun yang ingin dihapus'}
                  className="p-3 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 disabled:bg-stone-100 dark:disabled:bg-[#141418] disabled:text-stone-300 dark:disabled:text-stone-600 rounded-xl transition-all border border-rose-500/20 disabled:border-stone-200 dark:disabled:border-white/10 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                >
                  {isDeletingSelected ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>

                <div
                  onClick={handleSelectAll}
                  className="flex-1 flex items-center gap-3 p-3 bg-stone-100 dark:bg-[#141418] rounded-xl border border-stone-200 dark:border-white/10 cursor-pointer text-xs font-bold text-stone-800 dark:text-stone-200"
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedAccountIds.length === currentProvider.accounts.length &&
                      currentProvider.accounts.length > 0
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                  />
                  <span>Pilih Semua Akun ({selectedAccountIds.length}/{currentProvider.accounts.length})</span>
                </div>
              </div>
            )}

            {/* INLINE ADD ACCOUNT PANEL (NO POPUP!) */}
            {isAddModalOpen && currentProvider && (
              <div className="my-2">
                {currentProvider.id === 'gemini' ? (
                  <GeminiPlaywrightAddAccount
                    onAccountAdded={(account) => handleGeminiAccountAdded(account, reloginAccount.email)}
                    onBatchAccountsAdded={handleGeminiBatchAccountsAdded}
                    onClose={() => setIsAddModalOpen(false)}
                    existingAccountsCount={currentProvider.accounts.length}
                    existingAccounts={currentProvider.accounts}
                  />
                ) : (
                  renderInlineAddAccountForOtherProviders()
                )}
              </div>
            )}

            {/* Accounts List or Empty State */}
            {!currentProvider || currentProvider.accounts.length === 0 ? (
              !isAddModalOpen ? (
                <div className="py-12 px-4 bg-white/80 dark:bg-[#141418] rounded-2xl border border-dashed border-stone-200 dark:border-white/10 text-center space-y-1.5 my-2 shadow-2xs">
                  <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Belum ada akun tersimpan</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed max-w-xs mx-auto">
                    Klik + Add di pojok kanan atas untuk memasukkan refresh token kamu.
                  </p>
                </div>
              ) : null
            ) : (
              <div className="space-y-3">
                {currentProvider.accounts.map((acc) => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  const isRefreshing = refreshingAccId === acc.id || syncingAccountIds.includes(acc.id);
                  const isDeleting = deletingAccountIds.includes(acc.id);

                  const isDead = acc.accountStatus && acc.accountStatus !== 'active';

                  return (
                    <div
                      key={acc.id}
                      className={`rounded-2xl p-3.5 border transition-all flex items-center justify-between relative group ${
                        isDead
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-rose-400/40 dark:border-rose-500/30 shadow-2xs'
                          : 'bg-[#EFECE6] hover:bg-white dark:bg-[#141418] dark:hover:bg-[#1E1E26] border border-stone-300 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Radio or Checkbox */}
                        {isSelectMode ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectAccount(acc.id)}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectActiveAccount(currentProvider.id, acc.id)}
                            className="p-1 shrink-0 cursor-pointer"
                          >
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                acc.isActive
                                  ? 'border-amber-600 bg-amber-600 dark:border-amber-500 dark:bg-amber-500'
                                  : 'border-stone-300 dark:border-white/20 hover:border-amber-500'
                              }`}
                            >
                              {acc.isActive && <div className="w-2 h-2 rounded-full bg-white dark:bg-stone-950" />}
                            </div>
                          </button>
                        )}

                        {/* Email & Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p
                              onClick={() => !isSelectMode && handleSelectActiveAccount(currentProvider.id, acc.id)}
                              className={`text-xs font-bold truncate cursor-pointer transition-colors ${
                                isDead
                                  ? 'text-rose-700 dark:text-rose-400 hover:text-rose-800'
                                  : 'text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400'
                              }`}
                            >
                              {acc.displayName || acc.name || acc.email}
                            </p>
                            {acc.email && acc.email !== (acc.displayName || acc.name) && (
                              <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate">({acc.email})</span>
                            )}
                            {acc.accountStatus === 'banned' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-600 text-white rounded-md text-[9px] font-extrabold uppercase tracking-wide shrink-0">
                                <Ban className="w-2.5 h-2.5" />
                                <span>BANNED</span>
                              </span>
                            )}
                            {acc.accountStatus === 'expired' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md text-[9px] font-extrabold uppercase tracking-wide shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>EXPIRED</span>
                              </span>
                            )}
                            {acc.accountStatus === 'error' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-md text-[9px] font-bold uppercase tracking-wide shrink-0">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                <span>ERROR</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 dark:bg-white/10 text-amber-700 dark:text-stone-200 border border-amber-500/20 dark:border-white/10 rounded-md text-[10px] font-bold">
                              <Zap className="w-3 h-3 fill-current text-amber-600 dark:text-amber-400" />
                              <span>
                                {(() => {
                                  const c = acc.credits !== undefined ? acc.credits : 0;
                                  if (currentProvider?.id === 'runninghub') {
                                    return `${typeof c === 'number' ? c.toLocaleString() : c} RH Coins`;
                                  }
                                  if (currentProvider?.id === 'gemini') {
                                    const numC = typeof c === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, c)) : 0;
                                    return `${numC} / ${GEMINI_MAX_CREDITS} Credits${acc.creditSyncStatus === 'unknown' ? ' (Belum sinkron)' : ''}`;
                                  }
                                  if (currentProvider?.id === 'flow') {
                                    const numC = typeof c === 'number' ? Math.min(50, Math.max(0, c)) : 50;
                                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 50;
                                    return `${numC} / ${numT} Credits`;
                                  }
                                  if (currentProvider?.id === 'roboneo') {
                                    return `${typeof c === 'number' ? c.toLocaleString() : c} Credits`;
                                  }
                                  const defaultQ = currentProvider?.id === 'galleri5' ? 200 : currentProvider?.id === 'kie' ? 80 : currentProvider?.id === 'roboneo' ? 70 : 150;
                                  const numC = typeof c === 'number' ? c : 0;
                                  const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 0;
                                  const t = currentProvider?.id === 'kie'
                                    ? (numT > 80 ? numT : Math.max(numC, 80))
                                    : currentProvider?.id === 'galleri5'
                                    ? (numT > 200 ? numT : Math.max(numC, 200))
                                    : currentProvider?.id === 'roboneo'
                                    ? (numT > 70 ? numT : Math.max(numC, 70))
                                    : (numT > defaultQ ? numT : Math.max(numC, defaultQ));
                                  return `${typeof c === 'number' ? c.toLocaleString() : c} / ${typeof t === 'number' ? t.toLocaleString() : t} Credits`;
                                })()}
                              </span>
                            </div>

                            {acc.hasRefreshToken && (
                              <div className="inline-flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                                <Lock className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                                <span>Token saved</span>
                              </div>
                            )}

                            {acc.statusMessage && isDead && (
                              <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium w-full">
                                {acc.statusMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!isSelectMode && (
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleRefreshCredits(acc)}
                            disabled={isRefreshing}
                            title="Refresh token & kuota"
                            className="p-1.5 text-stone-400 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-[#1E1E26] rounded-lg transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600 dark:text-amber-400' : ''}`} />
                          </button>

                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveMenuAccountId(
                                  activeMenuAccountId === acc.id ? null : acc.id
                                )
                              }
                              className="p-1.5 text-stone-400 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1E1E26] rounded-lg transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeMenuAccountId === acc.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-20 cursor-default"
                                  onClick={() => setActiveMenuAccountId(null)}
                                />
                                <div className="absolute right-0 top-8 z-30 w-40 bg-white dark:bg-[#1E1E26] border border-stone-200/80 dark:border-white/10 rounded-xl shadow-lg p-1 text-xs space-y-0.5">
                                  <button
                                    onClick={() => {
                                      handleSelectActiveAccount(currentProvider.id, acc.id);
                                      setActiveMenuAccountId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 dark:hover:bg-[#141418] text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 font-medium text-left cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    <span>Set as Active</span>
                                  </button>
                                  {currentProvider.id === 'weavy' && (
                                    <button
                                      onClick={() => {
                                        handleSyncWeavyAccountToBrowserTab(acc);
                                        setActiveMenuAccountId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-left cursor-pointer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                      <span>Login ke Tab Weavy</span>
                                    </button>
                                  )}
                                  {currentProvider.id === 'gemini' && (
                                    <button
                                      onClick={() => {
                                        void handleOpenGeminiAccountBrowser(acc);
                                        setActiveMenuAccountId(null);
                                      }}
                                      disabled={Boolean(openingGeminiBrowserAccountId)}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-500/10 disabled:opacity-60 text-amber-700 dark:text-amber-300 font-medium text-left cursor-pointer"
                                    >
                                      {openingGeminiBrowserAccountId === acc.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Globe className="w-3.5 h-3.5" />}
                                      <span>Buka Browser Gemini</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleRefreshCredits(acc);
                                      setActiveMenuAccountId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 dark:hover:bg-[#141418] text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 font-medium text-left cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    <span>Refresh Token</span>
                                  </button>
                                  {currentProvider.id === 'gemini' && (
                                    <button
                                      onClick={() => handleGeminiRelogin(acc)}
                                      disabled={Boolean(reloginAccount)}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-500/10 disabled:opacity-60 text-amber-700 dark:text-amber-300 font-medium text-left cursor-pointer"
                                    >
                                      <LogIn className="w-3.5 h-3.5" />
                                      <span>Relogin Gemini</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteSingle(currentProvider.id, acc.id)}
                                    disabled={isDeleting}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-500/10 disabled:opacity-70 text-rose-600 dark:text-rose-400 font-medium text-left cursor-pointer disabled:cursor-wait"
                                  >
                                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    <span>{isDeleting ? 'Menghapus...' : 'Delete Account'}</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom note */}
            <p className="text-[11px] text-stone-400 dark:text-stone-500 text-center pt-4 leading-relaxed">
              Akun yang dipilih akan digunakan untuk semua generasi dengan {currentProvider?.name || 'Weavy'}.
            </p>


          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* DESKTOP LAYOUT (lg breakpoint and above)                  */}
      {/* Option 2: Fixed Header & KPI Panel + Inner Scroll List    */}
      {/* ========================================================= */}
      <div className="hidden lg:block">

        <div className="flex items-start gap-6">
        {/* RIGHT: Provider detail */}
        <div className="flex-1 min-w-0 space-y-4">
        {/* TOP CARD: Header, KPI strip, Tutorial & Action Toolbar */}
        <div key={`header-${currentProvider?.id || 'weavy'}`} className="bg-[#FAF9F6] dark:bg-[#141418] rounded-2xl p-5 border border-stone-300 dark:border-white/10 shadow-xs space-y-4 text-stone-900 dark:text-stone-100">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3.5 border-b border-stone-200/80 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3">
                {renderProviderLogo(currentProvider.logoType)}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">{currentProvider?.name || 'Weavy'} Accounts</h2>
                    <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
                      ({currentProvider?.accounts.length || 0})
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Kelola akun {currentProvider?.name || 'Weavy'}, refresh token, dan alokasi kredit untuk pembuatan video.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Metrics: single compact strip */}
          {currentProvider && (() => {
            const accs = currentProvider.accounts;
            const deadCount = accs.filter((a) => a.accountStatus && a.accountStatus !== 'active').length;
            const activeAcc = accs.find((a) => a.isActive);
            const activeLabel = activeAcc ? (activeAcc.displayName || activeAcc.name || activeAcc.email || 'Belum dipilih') : 'Belum dipilih';
            const totalCredits = accs.reduce(
              (sum, a) =>
                sum +
                (typeof a.credits === 'number'
                  ? currentProvider.id === 'gemini'
                    ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits))
                    : a.credits
                  : currentProvider.id === 'gemini'
                  ? 0
                  : 0),
              0
            );
            const creditUnit = currentProvider.id === 'runninghub' ? 'RH Coins' : 'Credits';
            return (
              <div className={`grid ${deadCount > 0 ? 'grid-cols-4' : 'grid-cols-3'} bg-white dark:bg-[#181820] border border-stone-200 dark:border-white/10 rounded-xl divide-x divide-stone-200 dark:divide-white/10 shadow-2xs`}>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Total Akun</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-0.5">{accs.length}</p>
                </div>
                <div className="px-4 py-3 min-w-0">
                  <p className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Akun Aktif Dipakai</p>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 truncate mt-1.5" title={activeLabel}>{activeLabel}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    {currentProvider.id === 'runninghub' ? 'Total Saldo RH Coins' : 'Total Kuota Kredit'}
                  </p>
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono mt-0.5">
                    {totalCredits.toLocaleString()}{' '}
                    <span className="text-[11px] font-normal text-stone-500 dark:text-stone-400">{creditUnit}</span>
                  </p>
                </div>
                {deadCount > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Akun Mati / Banned</p>
                    <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">{deadCount}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Dead Accounts Alert Banner with 1-Click Cleanup Action (Desktop) */}
          {currentProvider && currentProvider.accounts.some((a) => a.accountStatus && a.accountStatus !== 'active') && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-600/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 truncate">
                    Ditemukan {currentProvider.accounts.filter((a) => a.accountStatus && a.accountStatus !== 'active').length} akun tidak valid / token expired / kena ban
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400/90 truncate mt-0.5">
                    Akun ini otomatis dilewati sistem saat Batch Generate agar proses generate kamu tidak terganggu.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeleteDeadAccounts}
                disabled={isDeletingDeadAccounts}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-70 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all shadow-xs cursor-pointer disabled:cursor-wait"
              >
                {isDeletingDeadAccounts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeletingDeadAccounts ? 'Menghapus...' : 'Hapus Semua Akun Mati'}</span>
              </button>
            </div>
          )}

          {/* Weavy / Gemini / Flow / Galleri5 / Kie / RunningHub Refresh Token & API Key Tutorial Collapsible */}
          {currentProvider?.id === 'weavy' && <WeavyTokenTutorial />}
          {currentProvider?.id === 'gemini' && <GeminiTokenTutorial />}
          {currentProvider?.id === 'flow' && <FlowTokenTutorial />}
          {currentProvider?.id === 'galleri5' && <Galleri5TokenTutorial />}
          {currentProvider?.id === 'kie' && <KieApiKeyTutorial />}
          {currentProvider?.id === 'runninghub' && <RunningHubTutorial />}
          {currentProvider?.id === 'vids' && <VidsTokenTutorial />}

          {/* Search & Action Buttons Bar */}
          {currentProvider && currentProvider.accounts.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-0.5">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-stone-400 dark:text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={desktopSearchTerm}
                  onChange={(e) => setDesktopSearchTerm(e.target.value)}
                  placeholder="Cari akun berdasarkan email..."
                  className="w-full pl-9 pr-8 py-2 bg-[#EFECE6] dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-500 dark:placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white dark:focus:bg-[#141418] transition-all"
                />
                {desktopSearchTerm && (
                  <button
                    onClick={() => setDesktopSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons aligned with Search bar */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {isSelectMode && (
                  <>
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={selectedAccountIds.length === 0 || isDeletingSelected}
                      title={selectedAccountIds.length > 0 ? `Hapus ${selectedAccountIds.length} Akun Terpilih` : 'Pilih akun yang ingin dihapus'}
                      className="p-2 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 disabled:bg-stone-100 dark:disabled:bg-[#181820] disabled:text-stone-300 dark:disabled:text-stone-600 rounded-xl transition-all border border-rose-500/20 disabled:border-stone-200 dark:disabled:border-white/10 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                    >
                      {isDeletingSelected ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>

                    <div
                      onClick={handleSelectAll}
                      className="flex items-center gap-2 px-3 py-2 bg-stone-100 dark:bg-[#181820] rounded-xl border border-stone-200 dark:border-white/10 cursor-pointer text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-[#1E1E26] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedAccountIds.length === currentProvider.accounts.length &&
                          currentProvider.accounts.length > 0
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                      />
                      <span>Pilih Semua ({selectedAccountIds.length}/{currentProvider.accounts.length})</span>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedAccountIds([]);
                  }}
                  title={isSelectMode ? 'Selesai Pilih' : 'Pilih Banyak'}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shrink-0 ${
                    isSelectMode
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 font-bold shadow-2xs'
                      : 'bg-stone-100 dark:bg-[#181820] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-200/80 dark:hover:bg-[#1E1E26]'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5 shrink-0 text-stone-500 dark:text-stone-400" />
                  <span className="hidden sm:inline">{isSelectMode ? 'Selesai' : 'Pilih Banyak'}</span>
                </button>

                <button
                  onClick={handleRefreshAllAccounts}
                  disabled={isSyncingAll}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all border shadow-2xs cursor-pointer ${
                    isSyncingAll
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 dark:bg-amber-500/20 dark:border-amber-500/40'
                      : 'text-amber-700 dark:text-stone-100 bg-amber-500/10 hover:bg-amber-500/20 dark:bg-[#181820] dark:hover:bg-[#1E1E26] border-amber-500/20 dark:border-white/10'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin text-amber-600 dark:text-amber-400' : 'text-amber-600 dark:text-stone-300'}`} />
                  <span className="font-mono">
                    {isSyncingAll && syncProgress
                      ? `Sync ${syncProgress.current}/${syncProgress.total}`
                      : `Sync All (${currentProvider.accounts.length})`}
                  </span>
                </button>

                {currentProvider.id === 'weavy' && (
                  <button
                    type="button"
                    onClick={() => handleAutoImportFromExtension('weavy')}
                    disabled={isAutoImportingExtension}
                    title="Baca sesi & kuota akun aktif dari tab app.weavy.ai via Ekstensi"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 active:scale-[0.99] rounded-xl transition-all border border-amber-500/35 shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    {isAutoImportingExtension ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-current text-amber-600 dark:text-amber-400" />
                    )}
                    <span>Auto-Import Weavy</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setTokenInput('');
                    setIsAddModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white dark:text-stone-950 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Tambah Akun</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CARD: Dedicated Accounts List Container with Inner Scroll */}
        <div className="bg-[#FAF9F6] dark:bg-[#141418] rounded-2xl p-4 sm:p-5 border border-stone-300 dark:border-white/10 shadow-xs space-y-3 text-stone-900 dark:text-stone-100">
          {/* Subheader info & Filter bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-stone-200/80 dark:border-white/10">
            {/* Left: Title + Quick Filter Chips */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 mr-1">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Daftar Akun</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-white/10 text-stone-600 dark:text-stone-300 font-bold">
                  {filteredDesktopAccounts.length}
                </span>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAccountFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    accountFilter === 'all'
                      ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-950 font-bold shadow-2xs'
                      : 'bg-stone-200/70 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10'
                  }`}
                >
                  Semua ({allAccountsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('hasCredits')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    accountFilter === 'hasCredits'
                      ? 'bg-amber-600 text-white dark:bg-amber-500 dark:text-stone-950 font-bold shadow-2xs'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                  }`}
                >
                  <Zap className="w-3 h-3 fill-current" />
                  <span>Ada Kredit ({hasCreditsAccountsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('zeroCredits')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    accountFilter === 'zeroCredits'
                      ? 'bg-stone-700 text-white dark:bg-stone-600 font-bold shadow-2xs'
                      : 'bg-stone-200/70 dark:bg-white/5 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10'
                  }`}
                >
                  Kredit Habis ({zeroCreditsAccountsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('active')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    accountFilter === 'active'
                      ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-950 font-bold shadow-2xs'
                      : 'bg-stone-200/70 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Aktif ({activeAccountsCount})</span>
                </button>
              </div>
            </div>

            {/* Right: Search indicator & View Mode Switcher */}
            <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto">
              {desktopSearchTerm && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                  Hasil "{desktopSearchTerm}"
                </span>
              )}

              {/* View mode toggle (List vs Grid) & Inline Add Toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-stone-200/80 dark:bg-white/10 p-0.5 rounded-xl border border-stone-300/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setAccountViewMode('list')}
                    title="Tampilan Baris Ramping (List View)"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs ${
                      accountViewMode === 'list'
                        ? 'bg-white dark:bg-[#181820] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span className="text-[10px] pr-0.5 hidden sm:inline">List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountViewMode('grid')}
                    title="Tampilan Kartu (Grid View)"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs ${
                      accountViewMode === 'grid'
                        ? 'bg-white dark:bg-[#181820] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="text-[10px] pr-0.5 hidden sm:inline">Grid</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* INLINE ADD ACCOUNT PANEL (NO POPUP!) */}
          {isAddModalOpen && currentProvider && (
            <div className="pt-1 pb-3">
              {currentProvider.id === 'gemini' ? (
                <GeminiPlaywrightAddAccount
                  onAccountAdded={handleGeminiAccountAdded}
                  onBatchAccountsAdded={handleGeminiBatchAccountsAdded}
                  onClose={() => setIsAddModalOpen(false)}
                  existingAccountsCount={currentProvider.accounts.length}
                  existingAccounts={currentProvider.accounts}
                />
              ) : (
                renderInlineAddAccountForOtherProviders()
              )}
            </div>
          )}

          {/* Accounts List Container with Dedicated Inner Scroll */}
          <div className="max-h-[540px] xl:max-h-[620px] 2xl:max-h-[700px] overflow-y-auto pr-1 custom-scrollbar space-y-2.5">
            {!currentProvider || currentProvider.accounts.length === 0 ? (
              !isAddModalOpen ? (
                <div className="py-14 text-center bg-stone-50/80 dark:bg-[#181820] rounded-2xl border border-dashed border-stone-200 dark:border-white/10 p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Belum Ada Akun Tersimpan</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-md mx-auto mt-1">
                      Tambahkan akun {currentProvider?.name || 'AI'} kamu menggunakan Playwright otomatis, Refresh Token / Key, atau import langsung dari file TXT.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setTokenInput('');
                      setIsAddModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Akun Sekarang</span>
                  </button>
                </div>
              ) : null
            ) : filteredDesktopAccounts.length === 0 ? (
              <div className="py-10 text-center bg-stone-50/60 dark:bg-[#181820] rounded-2xl border border-stone-200 dark:border-white/10 p-6 space-y-2">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Tidak ada akun yang sesuai kriteria filter atau pencarian saat ini.
                </p>
                <button
                  onClick={() => {
                    setDesktopSearchTerm('');
                    setAccountFilter('all');
                  }}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Reset Filter & Pencarian
                </button>
              </div>
            ) : accountViewMode === 'list' ? (
              /* LIST VIEW: Compact, streamlined rows */
              <div className="space-y-1.5">
                {filteredDesktopAccounts.map((acc) => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  const isRefreshing = refreshingAccId === acc.id || syncingAccountIds.includes(acc.id);
                  const isDeleting = deletingAccountIds.includes(acc.id);
                  const isDead = acc.accountStatus && acc.accountStatus !== 'active';
                  const accountTitle = acc.displayName || acc.name || acc.email;
                  const showSubEmail = acc.email && acc.email !== accountTitle;
                  const initialLetter = accountTitle ? accountTitle.charAt(0).toUpperCase() : 'A';

                  // Format credits
                  const c = acc.credits !== undefined ? acc.credits : 0;
                  let creditLabel = '';
                  if (currentProvider?.id === 'runninghub') {
                    creditLabel = `${typeof c === 'number' ? c.toLocaleString() : c} RH Coins`;
                  } else if (currentProvider?.id === 'gemini') {
                    const numC = typeof c === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, c)) : 0;
                    creditLabel = `${numC} / ${GEMINI_MAX_CREDITS} Credits${acc.creditSyncStatus === 'unknown' ? ' (Belum sinkron)' : ''}`;
                  } else if (currentProvider?.id === 'flow') {
                    const numC = typeof c === 'number' ? Math.min(50, Math.max(0, c)) : 50;
                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 50;
                    creditLabel = `${numC} / ${numT} Credits`;
                  } else if (currentProvider?.id === 'vids') {
                    const numC = typeof c === 'number' ? Math.max(0, c) : 0;
                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 500;
                    const estVideos = Math.floor(numC / 40);
                    creditLabel = `${numC} / ${numT} Credits (~${estVideos} Video)`;
                  } else if (currentProvider?.id === 'roboneo') {
                    creditLabel = `${typeof c === 'number' ? c.toLocaleString() : c} Credits`;
                  } else {
                    const defaultQ = currentProvider?.id === 'galleri5' ? 200 : currentProvider?.id === 'kie' ? 80 : currentProvider?.id === 'roboneo' ? 70 : 150;
                    const numC = typeof c === 'number' ? c : 0;
                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 0;
                    const t = currentProvider?.id === 'kie'
                      ? (numT > 80 ? numT : Math.max(numC, 80))
                      : currentProvider?.id === 'galleri5'
                      ? (numT > 200 ? numT : Math.max(numC, 200))
                      : currentProvider?.id === 'roboneo'
                      ? (numT > 70 ? numT : Math.max(numC, 70))
                      : (numT > defaultQ ? numT : Math.max(numC, defaultQ));
                    creditLabel = `${typeof c === 'number' ? c.toLocaleString() : c} / ${typeof t === 'number' ? t.toLocaleString() : t} Credits`;
                  }
                  const numCredits = typeof c === 'number' ? c : 0;
                  const hasCredits = numCredits > 0;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        if (isSelectMode) {
                          handleToggleSelectAccount(acc.id);
                        } else if (isDead || (acc.accountStatus && acc.accountStatus !== 'active')) {
                          alert(`Akun "${acc.displayName || acc.name || acc.email}" berstatus FAILED / ${acc.statusMessage || acc.accountStatus?.toUpperCase() || 'EXPIRED'} dan tidak dapat diaktifkan.`);
                        } else if (!acc.isActive) {
                          handleSelectActiveAccount(currentProvider.id, acc.id);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 group cursor-pointer ${
                        acc.isActive
                          ? 'bg-[#EFECE6] hover:bg-white dark:bg-[#191922] dark:hover:bg-[#1E1E26] border-amber-500/60 dark:border-amber-500/50 shadow-xs'
                          : isDead
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/20 border-rose-400/40'
                          : 'bg-[#EFECE6] hover:bg-white dark:bg-[#181820] dark:hover:bg-[#1E1E26] border-stone-300/90 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20'
                      }`}
                    >
                      {/* Left: Radio/Checkbox + Avatar + Title & Email */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                        {isSelectMode ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectAccount(acc.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              acc.isActive
                                ? 'border-amber-500 bg-amber-500 dark:border-amber-400 dark:bg-amber-400'
                                : 'border-stone-400 dark:border-white/20 group-hover:border-amber-500 bg-white dark:bg-[#141418]'
                            }`}
                          >
                            {acc.isActive && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                          </div>
                        )}

                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          acc.isActive
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : isDead
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : 'bg-stone-300/80 dark:bg-white/10 text-stone-700 dark:text-stone-300'
                        }`}>
                          {initialLetter}
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-bold truncate ${
                              acc.isActive
                                ? 'text-stone-900 dark:text-white'
                                : isDead
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                            }`}>
                              {accountTitle}
                            </span>

                            {acc.accountStatus === 'banned' && (
                              <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[9px] font-extrabold uppercase shrink-0">
                                BANNED
                              </span>
                            )}
                            {acc.accountStatus === 'expired' && (
                              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded text-[9px] font-extrabold uppercase shrink-0">
                                EXPIRED
                              </span>
                            )}
                            {acc.accountStatus === 'error' && (
                              <span className="px-1.5 py-0.2 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded text-[9px] font-bold uppercase shrink-0">
                                ERROR
                              </span>
                            )}
                          </div>

                          {showSubEmail && (
                            <p className="text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate" title={acc.email}>
                              {acc.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Credits Pill + Active Badge + Action Icons */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Credits Badge */}
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold shrink-0 border transition-colors ${
                            hasCredits
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              : 'bg-stone-200/50 dark:bg-white/5 text-stone-400 dark:text-stone-500 border-stone-300/40 dark:border-white/5'
                          }`}
                        >
                          <Zap className={`w-3 h-3 fill-current ${hasCredits ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`} />
                          <span className="font-mono text-[11px]">{creditLabel}</span>
                        </div>

                        {/* Active / Status Badge */}
                        {isDead || (acc.accountStatus && acc.accountStatus !== 'active') ? (
                          <span
                            className="px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-extrabold text-[10px] rounded-md uppercase tracking-wider shrink-0"
                            title={acc.statusMessage || 'Sesi Cookie / Account Terlogout / Failed'}
                          >
                            FAILED
                          </span>
                        ) : acc.isActive ? (
                          <span className="px-2 py-0.5 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] rounded-md border border-amber-500/40 uppercase tracking-wider shrink-0">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-stone-500 dark:text-stone-400 font-medium text-[10px] rounded-md border border-stone-300 dark:border-white/10 uppercase tracking-wider shrink-0">
                            Non-Aktif
                          </span>
                        )}

                        {/* Action buttons on row */}
                        {!isSelectMode && (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAccount({
                                  providerId: currentProvider.id,
                                  accountId: acc.id,
                                  name: acc.displayName || acc.name || '',
                                  email: acc.email || '',
                                });
                              }}
                              title="Edit Nickname & Email Akun"
                              className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {currentProvider.id === 'weavy' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSyncWeavyAccountToBrowserTab(acc);
                                }}
                                disabled={isRefreshing}
                                title="Login & Sinkronkan ke Tab Browser Weavy (Bypass 403)"
                                className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              </button>
                            )}

                            {currentProvider.id === 'gemini' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenGeminiAccountBrowser(acc);
                                }}
                                disabled={Boolean(openingGeminiBrowserAccountId)}
                                title="Buka Browser Gemini dengan profil akun ini"
                                className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                              >
                                {openingGeminiBrowserAccountId === acc.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                              </button>
                            )}

                            {currentProvider.id === 'gemini' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeminiRelogin(acc);
                                }}
                                disabled={Boolean(reloginAccount) || isRefreshing}
                                title="Relogin Google Gemini"
                                className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefreshCredits(acc);
                              }}
                              disabled={isRefreshing}
                              title="Sync / Refresh Kuota"
                              className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600 dark:text-amber-400' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingle(currentProvider.id, acc.id);
                              }}
                              disabled={isDeleting}
                              title={isDeleting ? 'Menghapus akun...' : 'Hapus Akun Ini'}
                              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-70 rounded-lg transition-colors cursor-pointer disabled:cursor-wait"
                            >
                              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* GRID VIEW: Clean, streamlined card grid without clutter */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredDesktopAccounts.map((acc) => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  const isRefreshing = refreshingAccId === acc.id || syncingAccountIds.includes(acc.id);
                  const isDeleting = deletingAccountIds.includes(acc.id);
                  const isDead = acc.accountStatus && acc.accountStatus !== 'active';
                  const accountTitle = acc.displayName || acc.name || acc.email;
                  const showSubEmail = acc.email && acc.email !== accountTitle;
                  const initialLetter = accountTitle ? accountTitle.charAt(0).toUpperCase() : 'A';

                  // Format credits
                  const c = acc.credits !== undefined ? acc.credits : 0;
                  let creditLabel = '';
                  if (currentProvider?.id === 'runninghub') {
                    creditLabel = `${typeof c === 'number' ? c.toLocaleString() : c} RH Coins`;
                  } else if (currentProvider?.id === 'gemini') {
                    const numC = typeof c === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, c)) : 0;
                    creditLabel = `${numC} / ${GEMINI_MAX_CREDITS} Credits${acc.creditSyncStatus === 'unknown' ? ' (Belum sinkron)' : ''}`;
                  } else if (currentProvider?.id === 'flow') {
                    const numC = typeof c === 'number' ? Math.min(50, Math.max(0, c)) : 50;
                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 50;
                    creditLabel = `${numC} / ${numT} Credits`;
                  } else if (currentProvider?.id === 'vids') {
                    const numC = typeof c === 'number' ? Math.max(0, c) : 0;
                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 500;
                    const estVideos = Math.floor(numC / 40);
                    creditLabel = `${numC} / ${numT} Credits (~${estVideos} Video)`;
                  } else if (currentProvider?.id === 'roboneo') {
                    creditLabel = `${typeof c === 'number' ? c.toLocaleString() : c} Credits`;
                  } else {
                    const defaultQ = currentProvider?.id === 'galleri5' ? 200 : currentProvider?.id === 'kie' ? 80 : currentProvider?.id === 'roboneo' ? 70 : 150;
                    const numC = typeof c === 'number' ? c : 0;
                    const numT = typeof acc.totalCredits === 'number' && acc.totalCredits > 0 ? acc.totalCredits : 0;
                    const t = currentProvider?.id === 'kie'
                      ? (numT > 80 ? numT : Math.max(numC, 80))
                      : currentProvider?.id === 'galleri5'
                      ? (numT > 200 ? numT : Math.max(numC, 200))
                      : currentProvider?.id === 'roboneo'
                      ? (numT > 70 ? numT : Math.max(numC, 70))
                      : (numT > defaultQ ? numT : Math.max(numC, defaultQ));
                    creditLabel = `${typeof c === 'number' ? c.toLocaleString() : c} / ${typeof t === 'number' ? t.toLocaleString() : t} Credits`;
                  }
                  const numCredits = typeof c === 'number' ? c : 0;
                  const hasCredits = numCredits > 0;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        if (isSelectMode) {
                          handleToggleSelectAccount(acc.id);
                        } else if (isDead || (acc.accountStatus && acc.accountStatus !== 'active')) {
                          alert(`Akun "${acc.displayName || acc.name || acc.email}" berstatus FAILED / ${acc.statusMessage || acc.accountStatus?.toUpperCase() || 'EXPIRED'} dan tidak dapat diaktifkan.`);
                        } else if (!acc.isActive) {
                          handleSelectActiveAccount(currentProvider.id, acc.id);
                        }
                      }}
                      className={`rounded-xl p-3 border transition-all duration-150 flex flex-col justify-between gap-2.5 group cursor-pointer shadow-2xs ${
                        acc.isActive
                          ? 'bg-[#EFECE6] hover:bg-white dark:bg-[#191922] dark:hover:bg-[#1E1E26] border-amber-500/60 dark:border-amber-500/50 shadow-xs'
                          : isDead
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/20 border-rose-400/40'
                          : 'bg-[#EFECE6] hover:bg-white dark:bg-[#181820] dark:hover:bg-[#1E1E26] border-stone-300/90 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20'
                      }`}
                    >
                      {/* Top row: Radio + Avatar + Name + Action buttons */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                          {isSelectMode ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectAccount(acc.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                acc.isActive
                                  ? 'border-amber-500 bg-amber-500 dark:border-amber-400 dark:bg-amber-400'
                                  : 'border-stone-400 dark:border-white/20 group-hover:border-amber-500 bg-white dark:bg-[#141418]'
                              }`}
                            >
                              {acc.isActive && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                            </div>
                          )}

                          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                            acc.isActive
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                              : isDead
                              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                              : 'bg-stone-300/80 dark:bg-white/10 text-stone-700 dark:text-stone-300'
                          }`}>
                            {initialLetter}
                          </div>

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs font-bold truncate ${
                                acc.isActive
                                  ? 'text-stone-900 dark:text-white'
                                  : isDead
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                              }`} title={accountTitle}>
                                {accountTitle}
                              </p>
                            </div>
                            {showSubEmail && (
                              <p className="text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate" title={acc.email}>
                                {acc.email}
                              </p>
                            )}
                          </div>
                        </div>

                        {!isSelectMode && (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAccount({
                                  providerId: currentProvider.id,
                                  accountId: acc.id,
                                  name: acc.displayName || acc.name || '',
                                  email: acc.email || '',
                                });
                              }}
                              title="Edit Nickname & Email Akun"
                              className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {currentProvider.id === 'weavy' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSyncWeavyAccountToBrowserTab(acc);
                                }}
                                disabled={isRefreshing}
                                title="Login & Sinkronkan ke Tab Browser Weavy (Bypass 403)"
                                className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              </button>
                            )}

                            {currentProvider.id === 'gemini' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenGeminiAccountBrowser(acc);
                                }}
                                disabled={Boolean(openingGeminiBrowserAccountId)}
                                title="Buka Browser Gemini dengan profil akun ini"
                                className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                              >
                                {openingGeminiBrowserAccountId === acc.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                              </button>
                            )}

                            {currentProvider.id === 'gemini' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeminiRelogin(acc);
                                }}
                                disabled={Boolean(reloginAccount) || isRefreshing}
                                title="Relogin Google Gemini"
                                className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefreshCredits(acc);
                              }}
                              disabled={isRefreshing}
                              title="Sync / Refresh Kuota"
                              className="p-1.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600 dark:text-amber-400' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingle(currentProvider.id, acc.id);
                              }}
                              disabled={isDeleting}
                              title={isDeleting ? 'Menghapus akun...' : 'Hapus Akun Ini'}
                              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-70 rounded-lg transition-colors cursor-pointer disabled:cursor-wait"
                            >
                              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bottom row: Credit badge & Active status indicator */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-stone-200/60 dark:border-white/5">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 border ${
                            hasCredits
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              : 'bg-stone-200/50 dark:bg-white/5 text-stone-400 dark:text-stone-500 border-stone-300/40 dark:border-white/5'
                          }`}
                        >
                          <Zap className={`w-3 h-3 fill-current ${hasCredits ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`} />
                          <span className="font-mono">{creditLabel}</span>
                        </div>

                        {isDead || (acc.accountStatus && acc.accountStatus !== 'active') ? (
                          <span
                            className="px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-extrabold text-[10px] rounded-md uppercase tracking-wider"
                            title={acc.statusMessage || 'Sesi Cookie / Account Terlogout / Failed'}
                          >
                            FAILED
                          </span>
                        ) : acc.isActive ? (
                          <span className="px-2 py-0.5 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] rounded-md border border-amber-500/40 uppercase tracking-wider">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-stone-500 dark:text-stone-400 font-medium text-[10px] rounded-md border border-stone-300 dark:border-white/10 uppercase tracking-wider">
                            Non-Aktif
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pinned Bottom status note under inner scroll */}
          <div className="pt-2 border-t border-stone-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-stone-400 dark:text-stone-500">
            <span>
              Akun {currentProvider?.name || 'Weavy'} yang ditandai <b className="text-emerald-600 dark:text-emerald-400">Aktif</b> akan otomatis digunakan untuk seluruh proses generasi video.
            </span>
            {currentProvider && currentProvider.accounts.length > 0 && (
              <span className="font-mono text-[10px] shrink-0">
                {activeAccountsCount === 1
                  ? '✓ 1 Akun Aktif'
                  : activeAccountsCount > 1
                  ? `⚠ ${activeAccountsCount} Akun Aktif`
                  : '⚠ Belum Dipilih'}
              </span>
            )}
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* MODAL: EDIT / RENAME ACCOUNT NICKNAME & EMAIL */}
      {reloginAccount && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/55 p-3 sm:p-6">
          <div className="w-full max-w-4xl my-auto">
            <GeminiPlaywrightAddAccount
              key={reloginAccount.email}
              onAccountAdded={handleGeminiAccountAdded}
              onClose={() => setReloginAccount(null)}
              existingAccountsCount={currentProvider?.accounts.length || 0}
              existingAccounts={currentProvider?.accounts || []}
              reloginEmail={reloginAccount.email}
            />
          </div>
        </div>
      )}

      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className="absolute inset-0"
            onClick={() => setEditingAccount(null)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#141418] rounded-2xl shadow-2xl p-5 space-y-4 z-10 animate-in fade-in zoom-in-95 duration-150 border border-stone-200 dark:border-white/10 text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Edit Profil & Label Akun</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1E1E26] rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountNickname} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Nickname / Nama Akun
                </label>
                <input
                  type="text"
                  value={editingAccount.name}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, name: e.target.value })
                  }
                  placeholder="Contoh: Akun Utama atau Nama Profil"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-[#181820] border border-stone-200 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white dark:focus:bg-[#141418] transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Alamat Email Akun
                </label>
                <input
                  type="email"
                  value={editingAccount.email}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, email: e.target.value })
                  }
                  placeholder="Contoh: akun@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-[#181820] border border-stone-200 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white dark:focus:bg-[#141418] transition-all font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-[#1E1E26] rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white dark:text-stone-950 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};