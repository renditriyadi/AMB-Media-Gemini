import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Terminal,
  ShieldCheck,
  KeyRound,
  FileText,
  Upload,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Code2,
  CheckCircle2,
  HelpCircle,
  Smartphone,
  Lock,
  ArrowRight,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { ProviderAccount } from '../../types';

interface VidsPlaywrightAddAccountProps {
  onAccountAdded: (account: ProviderAccount) => void;
  onBatchAccountsAdded?: (accounts: ProviderAccount[]) => void;
  onClose: () => void;
  existingAccountsCount: number;
  existingAccounts?: ProviderAccount[];
  reloginEmail?: string;
}

type AddTabMode = 'playwright' | 'cookie' | 'import' | 'local_script';

const VIDS_MAX_CREDITS = 500;
const VIDS_PLAYWRIGHT_SESSION_KEY = 'vids_playwright_active_session_id';
const VIDS_PLAYWRIGHT_BATCH_KEY = 'vids_playwright_active_batch_id';
const handledPlaywrightSessions = new Set<string>();
const handledBatchAccounts = new Set<string>();

const VIDS_BOOKMARKLET_SCRIPT = `javascript:(async()=>{if(!location.host.includes("docs.google.com")){if(confirm("Buka https://docs.google.com/videos/u/0/ sekarang?")){location.href="https://docs.google.com/videos/u/0/"}return}const c=document.cookie;if(!c||!c.includes("SID=")){alert("Cookie belum ditemukan. Pastikan sudah login di docs.google.com/videos.");return}try{await navigator.clipboard.writeText(c)}catch(_){}prompt("Cookie Google Vids (sudah dicopy):",c)})();`;

const getStoredPlaywrightId = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStoredPlaywrightId = (key: string, value: string | null) => {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('[Vids Playwright] Could not persist UI session state:', error);
  }
};

export const VidsPlaywrightAddAccount: React.FC<VidsPlaywrightAddAccountProps> = ({
  onAccountAdded,
  onBatchAccountsAdded,
  onClose,
  existingAccountsCount,
  existingAccounts,
  reloginEmail,
}) => {
  const [activeTab, setActiveTab] = useState<AddTabMode>('playwright');

  // Playwright Form State
  const [email, setEmail] = useState(reloginEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reloginNeedsPassword, setReloginNeedsPassword] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [batchEmails, setBatchEmails] = useState('');
  const [batchPassword, setBatchPassword] = useState('');
  const [isStartingBatch, setIsStartingBatch] = useState(() =>
    Boolean(getStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY))
  );
  const [batchId, setBatchId] = useState<string | null>(() =>
    getStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY)
  );
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);
  const [logSource, setLogSource] = useState<'single' | 'batch'>(() =>
    getStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY) ? 'batch' : 'single'
  );
  const savedBatchAccountIdsRef = useRef<Set<string>>(new Set());
  const reloginStartedRef = useRef(false);

  // Playwright Active Session State
  const [sessionId, setSessionId] = useState<string | null>(() =>
    getStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY)
  );
  const [sessionStatus, setSessionStatus] = useState<string>(() =>
    getStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY) ? 'starting' : 'idle'
  );
  const [currentStep, setCurrentStep] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [challengeType, setChallengeType] = useState<string | null>(null);
  const [challengePrompt, setChallengePrompt] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSubmitting2FA, setIsSubmitting2FA] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cookie / cURL Form State
  const [cookieInput, setCookieInput] = useState('');
  const [cookieNickname, setCookieNickname] = useState('');
  const [showCookie, setShowCookie] = useState(false);
  const [isVerifyingCookie, setIsVerifyingCookie] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  // Batch Import Form State
  const [batchText, setBatchText] = useState('');
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Local Script Runner State
  const [localScriptLang, setLocalScriptLang] = useState<'node' | 'python'>('node');
  const [copiedScript, setCopiedScript] = useState(false);
  const [scripts, setScripts] = useState<{ nodeScript: string; pythonScript: string } | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoFollowLogsRef = useRef(true);
  const consoleLogs = logSource === 'batch' ? batchLogs : logs;

  const resolvePlaywrightAccountCredits = async (account: ProviderAccount): Promise<ProviderAccount> => {
    const accountEmail = reloginEmail || account.email;
    const existingAccount = existingAccounts?.find(
      (candidate) =>
        Boolean(accountEmail && candidate.email?.toLowerCase() === accountEmail.toLowerCase())
    );
    try {
      const response = await fetch(`/api/vids/quota?email=${encodeURIComponent(accountEmail)}`);
      const data = await response.json();
      if (response.ok && data.success && typeof data.credits === 'number') {
        return {
          ...account,
          email: data.email || account.email,
          cookies: data.cookies || account.cookies,
          token: data.cookies || account.token,
          docId: data.docId || account.docId,
          serverToken: data.serverToken || account.serverToken,
          credits: data.credits,
          creditsUsed: data.usedCredits ?? Math.max(0, (data.totalCredits || VIDS_MAX_CREDITS) - data.credits),
          totalCredits: data.totalCredits || VIDS_MAX_CREDITS,
          creditSyncStatus: 'synced',
        };
      }
    } catch (error) {
      console.warn('[Vids Playwright] Could not sync account credits after login:', error);
    }

    return {
      ...account,
      email: accountEmail || account.email,
      credits: typeof existingAccount?.credits === 'number' ? existingAccount.credits : (account.credits ?? VIDS_MAX_CREDITS),
      creditsUsed: existingAccount?.creditsUsed,
      totalCredits: existingAccount?.totalCredits || VIDS_MAX_CREDITS,
      creditSyncStatus: 'unknown',
    };
  };

  useEffect(() => {
    const container = logsContainerRef.current;
    if (consoleLogs.length > 0 && container && shouldAutoFollowLogsRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [consoleLogs]);

  // Load scripts once
  useEffect(() => {
    fetch('/api/vids/playwright/scripts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setScripts({
            nodeScript: data.nodeScript,
            pythonScript: data.pythonScript,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Poll active Playwright session
  useEffect(() => {
    if (!sessionId) return;
    const activeStatuses = [
      'starting',
      'navigating_login',
      'filling_credentials',
      'awaiting_2fa',
      'navigating_vids',
      'extracting_session',
    ];

    if (!activeStatuses.includes(sessionStatus)) return;

    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/vids/playwright/status/${sessionId}`);
        const data = await resp.json();

        if (resp.ok && data.success) {
          setSessionStatus(data.status);
          setCurrentStep(data.currentStep || '');
          if (Array.isArray(data.logs)) setLogs(data.logs);
          if (data.challengeType) setChallengeType(data.challengeType);
          if (data.challengePrompt) setChallengePrompt(data.challengePrompt);
          if (data.screenshotBase64) setScreenshotBase64(data.screenshotBase64);

          if (data.status === 'success' && data.account) {
            if (!handledPlaywrightSessions.has(sessionId)) {
              handledPlaywrightSessions.add(sessionId);
              try {
                const accountWithCredits = await resolvePlaywrightAccountCredits(data.account);
                await onAccountAdded(accountWithCredits);
                setSuccessMsg(
                  `Berhasil! Akun Google Vids (${accountWithCredits.email}) telah terhubung. Kredit: ${accountWithCredits.credits ?? 0}/${accountWithCredits.totalCredits || VIDS_MAX_CREDITS}.`
                );
              } catch (error) {
                handledPlaywrightSessions.delete(sessionId);
                throw error;
              }
            }
            setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, null);
          } else if (data.status === 'error') {
            setErrorMsg(data.error || 'Terjadi kesalahan saat otomasi login Playwright Google Vids.');
            setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, null);
          } else if (data.status === 'cancelled') {
            setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, null);
          }
        } else if (resp.status === 404) {
          setSessionStatus('error');
          setErrorMsg(data.error || 'Sesi Playwright sudah kedaluwarsa. Silakan mulai ulang proses grab akun.');
          setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, null);
        } else if (!resp.ok) {
          throw new Error(data.error || `Gagal membaca status Playwright (HTTP ${resp.status}).`);
        }
      } catch (err) {
        console.warn('[Vids Playwright Status Poll Error]:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionId, sessionStatus, onAccountAdded]);

  // Poll batch session
  useEffect(() => {
    if (!batchId || !isStartingBatch) return;
    let stopped = false;
    const pollBatch = async () => {
      try {
        const resp = await fetch(`/api/vids/playwright/batch-status/${batchId}`);
        const data = await resp.json();
        if (stopped) return;
        if (resp.status === 404) {
          setIsStartingBatch(false);
          setBatchId(null);
          setStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY, null);
          setErrorMsg(data.error || 'Sesi batch Playwright sudah kedaluwarsa. Silakan mulai ulang proses grab akun.');
          return;
        }
        if (!resp.ok || !data.success) {
          throw new Error(data.error || `Gagal membaca status batch Playwright (HTTP ${resp.status}).`);
        }

        if (Array.isArray(data.logs)) setBatchLogs(data.logs);
        setCurrentStep(
          data.currentEmail
            ? `Akun ${Math.min(data.completed + 1, data.total)}/${data.total}: ${data.currentEmail}`
            : `Batch selesai: ${data.completed}/${data.total}`
        );
        setBatchSummary(`Proses batch: ${data.completed}/${data.total} selesai, ${data.successful} berhasil, ${data.failed} gagal.`);

        const completedResults = (Array.isArray(data.results) ? data.results : [])
          .filter((result: any) => {
            const accountId = result?.account?.id;
            return (
              result?.success &&
              result?.account &&
              accountId &&
              !savedBatchAccountIdsRef.current.has(accountId) &&
              !handledBatchAccounts.has(`${batchId}:${accountId}`)
            );
          });

        const completedAccounts = await Promise.all(
          completedResults.map(async (result: any) => {
            const account: ProviderAccount = {
              id: result.account.id,
              name: result.account.name || result.account.displayName || result.email,
              displayName: result.account.displayName || result.account.name || result.email,
              email: result.account.email || result.email,
              token: result.account.token || '',
              providerId: 'vids' as const,
              tier: result.account.tier || 'Google Vids (Web Session)',
              credits: typeof result.account.credits === 'number' ? result.account.credits : VIDS_MAX_CREDITS,
              totalCredits: result.account.totalCredits || VIDS_MAX_CREDITS,
              creditsUsed: typeof result.account.creditsUsed === 'number' ? result.account.creditsUsed : 0,
              isActive: false,
              photoUrl: result.account.photoUrl,
              serverToken: result.account.serverToken,
              docId: result.account.docId,
              accountStatus: 'active',
              lastChecked: new Date().toISOString(),
            };
            return resolvePlaywrightAccountCredits(account);
          })
        );

        if (completedAccounts.length > 0) {
          completedAccounts.forEach((account) => {
            savedBatchAccountIdsRef.current.add(account.id);
            handledBatchAccounts.add(`${batchId}:${account.id}`);
          });
          if (onBatchAccountsAdded) {
            try {
              await onBatchAccountsAdded(completedAccounts);
            } catch (error) {
              completedAccounts.forEach((account) => {
                handledBatchAccounts.delete(`${batchId}:${account.id}`);
              });
              throw error;
            }
          } else {
            try {
              await Promise.all(completedAccounts.map((account) => onAccountAdded(account)));
            } catch (error) {
              completedAccounts.forEach((account) => {
                handledBatchAccounts.delete(`${batchId}:${account.id}`);
              });
              throw error;
            }
          }
        }

        if (data.status !== 'running') {
          setIsStartingBatch(false);
          setBatchId(null);
          setStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY, null);
          setSuccessMsg(
            `${data.successful}/${data.total} akun batch berhasil diproses${data.failed ? `, ${data.failed} gagal` : ''}. Akun berhasil disimpan.`
          );
          setBatchEmails('');
          setBatchPassword('');
        }
      } catch (err) {
        console.warn('[Vids Playwright Batch Poll Error]:', err);
      }
    };

    void pollBatch();
    const interval = setInterval(() => void pollBatch(), 1000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [batchId, isStartingBatch, onAccountAdded, onBatchAccountsAdded]);

  // Start Playwright flow
  const handleStartLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Alamat email Google dan kata sandi wajib diisi.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsStarting(true);
    setLogSource('single');
    shouldAutoFollowLogsRef.current = true;
    setLogs([]);
    setChallengeType(null);
    setChallengePrompt(null);
    setScreenshotBase64(null);
    setTwoFactorCode('');

    try {
      const resp = await fetch('/api/vids/playwright/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Gagal memulai otomasi Playwright Google Vids.');
      }

      setSessionId(data.sessionId);
      setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, data.sessionId);
      setSessionStatus(data.status);
      setCurrentStep(data.step);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal terhubung ke server otomasi Playwright Google Vids.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartRelogin = async () => {
    if (!reloginEmail) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsStarting(true);
    setLogSource('single');
    shouldAutoFollowLogsRef.current = true;
    setLogs([]);
    setChallengeType(null);
    setChallengePrompt(null);
    setScreenshotBase64(null);
    setTwoFactorCode('');

    try {
      const resp = await fetch('/api/vids/playwright/relogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: reloginEmail }),
      });
      const data = await resp.json();
      if (resp.status === 404) {
        setReloginNeedsPassword(true);
        setSessionStatus('idle');
        setErrorMsg(data.error || 'Kredensial belum tersimpan. Masukkan kata sandi sekali untuk profil ini.');
        return;
      }
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Gagal memulai relogin Google Vids.');
      }

      setSessionId(data.sessionId);
      setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, data.sessionId);
      setSessionStatus(data.status);
      setCurrentStep(data.step);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal terhubung ke server relogin Google Vids.');
      setSessionStatus('error');
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!reloginEmail || reloginStartedRef.current) return;
    reloginStartedRef.current = true;
    void handleStartRelogin();
  }, [reloginEmail]);

  const parseBatchEmailList = (value: string): string[] =>
    value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.includes('@'));

  const getRegisteredEmails = (): Set<string> => {
    const set = new Set<string>();
    if (Array.isArray(existingAccounts)) {
      existingAccounts.forEach((acc) => {
        if (acc.email) set.add(acc.email.trim().toLowerCase());
      });
    }
    try {
      const local = JSON.parse(localStorage.getItem('vids_accounts') || '[]');
      if (Array.isArray(local)) {
        local.forEach((acc: any) => {
          if (acc?.email) set.add(String(acc.email).trim().toLowerCase());
        });
      }
    } catch (_) {}
    return set;
  };

  const handleStartBatchPlaywright = async () => {
    const parsedEmails = parseBatchEmailList(batchEmails);

    if (parsedEmails.length === 0) {
      setErrorMsg('Masukkan daftar email Google Vids, satu email per baris atau dipisah koma.');
      return;
    }

    if (!batchPassword.trim()) {
      setErrorMsg('Password wajib diisi agar semua akun batch bisa login dengan password yang sama.');
      return;
    }

    const registeredSet = getRegisteredEmails();
    const alreadyRegistered = parsedEmails.filter((em) => registeredSet.has(em.toLowerCase()));
    const emailsToProcess = parsedEmails.filter((em) => !registeredSet.has(em.toLowerCase()));

    // Jika SEMUA email yang diinput sudah terdaftar sebelumnya:
    if (alreadyRegistered.length > 0 && emailsToProcess.length === 0) {
      setErrorMsg(
        `Semua (${alreadyRegistered.length}) email yang dimasukkan sudah terdaftar dalam sistem. Grab otomatis dilewati (skip) agar tidak diproses dua kali.`
      );
      setBatchSummary(
        `Semua akun sudah terdaftar: ${alreadyRegistered.join(', ')}. Proses grab dilewati (skip).`
      );
      setIsStartingBatch(false);
      return;
    }

    const timeNow = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const initialLogs: string[] = [];
    if (alreadyRegistered.length > 0) {
      initialLogs.push(
        `[${timeNow}] ⏭️ [SKIP] Melewatkan ${alreadyRegistered.length} akun yang sudah terdaftar sebelumnya agar tidak di-grab dua kali:`
      );
      alreadyRegistered.forEach((e) => {
        initialLogs.push(`   - ${e} (Sudah ada di database)`);
      });
    }
    initialLogs.push(
      `[${timeNow}] 🔄 Menyiapkan batch Playwright Google Vids (${emailsToProcess.length} akun baru)...`
    );

    setErrorMsg(null);
    setSuccessMsg(
      alreadyRegistered.length > 0
        ? `Memproses ${emailsToProcess.length} akun baru (${alreadyRegistered.length} akun yang sudah terdaftar dilewati).`
        : null
    );
    setBatchSummary(
      alreadyRegistered.length > 0
        ? `${alreadyRegistered.length} akun dilewati (skip). Menyiapkan batch ${emailsToProcess.length} akun baru...`
        : `Menyiapkan batch Playwright (${emailsToProcess.length} akun)...`
    );
    setIsStartingBatch(true);
    setLogSource('batch');
    shouldAutoFollowLogsRef.current = true;
    setBatchLogs(initialLogs);
    savedBatchAccountIdsRef.current.clear();

    try {
      const resp = await fetch('/api/vids/playwright/start-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailsToProcess,
          password: batchPassword,
          existingEmails: Array.from(registeredSet),
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Gagal memulai batch akun Playwright Google Vids.');
      }

      const total = Number(data.total || 0);
      setBatchSummary(
        alreadyRegistered.length > 0
          ? `Batch dimulai: 0/${total} akun selesai (${alreadyRegistered.length} akun dilewati).`
          : `Batch dimulai: 0/${total} akun selesai.`
      );
      setBatchId(data.batchId);
      setStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY, data.batchId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Batch Playwright Google Vids gagal dijalankan.');
      setIsStartingBatch(false);
    }
  };

  // Submit 2FA Code
  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    if (!twoFactorCode.trim() && challengeType !== 'phone_prompt') {
      setErrorMsg('Masukkan kode 6 digit verifikasi 2FA.');
      return;
    }

    setIsSubmitting2FA(true);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/vids/playwright/submit-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          code: twoFactorCode.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Gagal memverifikasi kode 2FA.');
      }

      // Resume polling
      setSessionStatus('navigating_vids');
      setCurrentStep('Kode 2FA terverifikasi! Membuka portal Google Vids...');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memverifikasi kode 2FA.');
    } finally {
      setIsSubmitting2FA(false);
    }
  };

  // Cancel Playwright Session / Batch
  const handleCancelPlaywright = async () => {
    if (batchId && isStartingBatch) {
      try {
        await fetch('/api/vids/playwright/cancel-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId }),
        });
      } catch (_) {}
      setIsStartingBatch(false);
      setBatchId(null);
      setStoredPlaywrightId(VIDS_PLAYWRIGHT_BATCH_KEY, null);
      setBatchSummary('Batch Playwright Google Vids telah dibatalkan.');
    }
    if (sessionId) {
      try {
        await fetch('/api/vids/playwright/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (_) {}
      setSessionId(null);
      setStoredPlaywrightId(VIDS_PLAYWRIGHT_SESSION_KEY, null);
      setSessionStatus('idle');
      setCurrentStep('');
      setChallengeType(null);
      setChallengePrompt(null);
      setErrorMsg(null);
    }
  };

  // Verify and Save manual Cookie / cURL
  const handleVerifyManualCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) {
      setErrorMsg('Cookie atau bash cURL Google Vids wajib diisi.');
      return;
    }

    setIsVerifyingCookie(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const resp = await fetch('/api/vids/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cookieInput.trim(),
          nickname: cookieNickname.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Verifikasi cookie / cURL Google Vids gagal.');
      }

      const shortId = Math.random().toString(36).slice(2, 6);
      const newAcc: ProviderAccount = {
        id: `acc-vids-${Date.now()}-${shortId}`,
        name: data.name || cookieNickname.trim() || data.email?.split('@')[0] || 'Google Vids User',
        displayName: data.name || cookieNickname.trim() || data.email?.split('@')[0] || 'Google Vids User',
        email: data.email || 'vids.user@google.com',
        token: cookieInput.trim(),
        providerId: 'vids',
        tier: 'Google Vids (Web Session)',
        credits: data.credits ?? VIDS_MAX_CREDITS,
        totalCredits: data.totalCredits ?? VIDS_MAX_CREDITS,
        creditsUsed: Math.max(0, (data.totalCredits ?? VIDS_MAX_CREDITS) - (data.credits ?? VIDS_MAX_CREDITS)),
        isActive: existingAccountsCount === 0,
        photoUrl: data.photoUrl,
        serverToken: data.serverToken,
        docId: data.docId,
        accountStatus: 'active',
        lastChecked: new Date().toISOString(),
      };

      await onAccountAdded(newAcc);
      setSuccessMsg(`Berhasil menambahkan akun Google Vids "${newAcc.name}" (${newAcc.email})! Kredit: ${newAcc.credits}/${newAcc.totalCredits}.`);
      setCookieInput('');
      setCookieNickname('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memverifikasi cookie Google Vids.');
    } finally {
      setIsVerifyingCookie(false);
    }
  };

  // Helper for batch import
  const handleBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 10);

    if (lines.length === 0) {
      setErrorMsg('Tidak ditemukan baris cookie atau token valid pada teks yang dimasukkan.');
      return;
    }

    setIsImportingBatch(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setBatchProgress({ current: 0, total: lines.length });

    const newAccounts: ProviderAccount[] = [];
    const registeredSet = getRegisteredEmails();
    let skippedDuplicates = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const resp = await fetch('/api/vids/accounts/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: line }),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          const accountEmail = (data.email || '').trim().toLowerCase();
          if (accountEmail && (registeredSet.has(accountEmail) || newAccounts.some((a) => a.email.toLowerCase() === accountEmail))) {
            skippedDuplicates++;
            setBatchProgress({ current: i + 1, total: lines.length });
            continue;
          }

          const shortId = Math.random().toString(36).slice(2, 6);
          newAccounts.push({
            id: `acc-vids-${Date.now()}-${i}-${shortId}`,
            name: data.name || data.email?.split('@')[0] || `Vids User ${i + 1}`,
            displayName: data.name || data.email?.split('@')[0] || `Vids User ${i + 1}`,
            email: data.email || `vids_${i + 1}@google.com`,
            token: data.token || line,
            providerId: 'vids',
            tier: 'Google Vids (Web Session)',
            credits: data.credits ?? VIDS_MAX_CREDITS,
            totalCredits: data.totalCredits ?? VIDS_MAX_CREDITS,
            creditsUsed: Math.max(0, (data.totalCredits ?? VIDS_MAX_CREDITS) - (data.credits ?? VIDS_MAX_CREDITS)),
            isActive: existingAccountsCount === 0 && newAccounts.length === 0,
            photoUrl: data.photoUrl,
            serverToken: data.serverToken,
            docId: data.docId,
            accountStatus: 'active',
            lastChecked: new Date().toISOString(),
          });
        }
      } catch (e) {}
      setBatchProgress({ current: i + 1, total: lines.length });
    }

    setIsImportingBatch(false);
    if (newAccounts.length > 0) {
      setSuccessMsg(
        `Berhasil mengimpor ${newAccounts.length} akun Google Vids!${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} akun yang sudah terdaftar dilewati)` : ''
        }`
      );
      if (onBatchAccountsAdded) {
        onBatchAccountsAdded(newAccounts);
      } else {
        newAccounts.forEach((acc) => onAccountAdded(acc));
      }
      setBatchText('');
    } else {
      setErrorMsg(
        skippedDuplicates > 0
          ? `Semua (${skippedDuplicates}) akun pada teks sudah terdaftar dalam sistem. Grab dilewati (skip).`
          : 'Tidak ada akun yang berhasil diverifikasi dari file/teks.'
      );
    }
  };

  const copyToClipboard = (text: string, type: 'bookmarklet' | 'script') => {
    navigator.clipboard.writeText(text);
    if (type === 'bookmarklet') {
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  const isAutomationRunning = [
    'starting',
    'navigating_login',
    'filling_credentials',
    'awaiting_2fa',
    'navigating_vids',
    'extracting_session',
  ].includes(sessionStatus);

  // Stepper calculations
  const steps = [
    { id: 'start', label: '1. Inisialisasi' },
    { id: 'login', label: '2. Login Akun' },
    { id: '2fa', label: '3. Verifikasi 2FA' },
    { id: 'vids', label: '4. Aktivasi Vids' },
    { id: 'done', label: '5. Selesai' },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'starting':
        return 0;
      case 'navigating_login':
      case 'filling_credentials':
        return 1;
      case 'awaiting_2fa':
        return 2;
      case 'navigating_vids':
      case 'extracting_session':
        return 3;
      case 'success':
        return 4;
      default:
        return -1;
    }
  };

  const activeStepIdx = getStepIndex(sessionStatus);
  const isReloginSessionRunning = isAutomationRunning;

  return (
    <div className="bg-[#FAF9F6] dark:bg-[#141418] rounded-2xl border border-stone-300 dark:border-white/10 p-4 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
      {/* Top Header with Clean Close Action */}
      <div className="flex items-start justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-stone-900 dark:text-stone-100 font-sans tracking-tight">
              {reloginEmail ? 'Relogin Akun Google Vids' : 'Tambah Akun Google Vids'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <Sparkles className="w-3 h-3" />
              <span>Playwright Engine</span>
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            {reloginEmail
              ? `Memperbarui sesi Google Vids untuk ${reloginEmail}.`
              : 'Pilih metode otomasi login Google atau masukkan sesi cookie docs.google.com/videos langsung tanpa popup.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (reloginEmail && sessionId && isReloginSessionRunning) {
              void fetch('/api/vids/playwright/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              }).catch((error) => console.warn('[Vids Relogin Cancel Error]:', error));
            }
            onClose();
          }}
          disabled={Boolean(reloginEmail && isStarting)}
          className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 disabled:cursor-wait disabled:opacity-50"
          title="Tutup Form Tambah Akun"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Navigation Bar (Anti-Pill, Zero-Pill Discipline) */}
      {!reloginEmail && (
        <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-[#181820] rounded-xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveTab('playwright');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'playwright'
                ? 'bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Playwright Otomatis</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cookie');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'cookie'
                ? 'bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Cookie & cURL Sesi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Import File TXT</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('local_script');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'local_script'
                ? 'bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Script Runner Lokal</span>
          </button>
        </div>
      )}

      {/* Global Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <span className="leading-relaxed font-semibold">{successMsg}</span>
        </div>
      )}

      {/* TAB 1: PLAYWRIGHT AUTO LOGIN */}
      {activeTab === 'playwright' && (
        <div className="space-y-4">
          {/* Informative banner */}
          <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-600 dark:text-stone-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <Bot className="w-4 h-4" />
              <span>Otomasi Browser Playwright (Stealth Headless)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
              Playwright akan membuka browser Chrome di server, login ke Google Accounts secara aman, menyetujui aktivasi portal Google Vids, dan mengekstrak cookie sesi otentikasi secara otomatis tanpa perlu salin cURL manual.
            </p>
          </div>

          {reloginEmail && !reloginNeedsPassword && sessionStatus === 'error' && !isStarting && (
            <button
              type="button"
              onClick={() => void handleStartRelogin()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Coba Relogin Lagi
            </button>
          )}

          {/* Stepper Progress Bar (Visible when active) */}
          {(isAutomationRunning || isStartingBatch) && (
            <div className="space-y-2 p-3.5 bg-stone-100/80 dark:bg-[#181820] rounded-xl border border-stone-200 dark:border-white/10">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-400 font-bold">
                    {currentStep || (isStartingBatch ? 'Memproses batch akun...' : 'Memproses otomasi...')}
                  </span>
                </span>
                {!isStartingBatch && (
                  <span className="font-mono text-[11px] text-stone-400">
                    {Math.max(0, activeStepIdx + 1)} / {steps.length}
                  </span>
                )}
              </div>

              {/* Progress Steps Indicators (Single) */}
              {!isStartingBatch && (
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {steps.map((st, idx) => {
                    const isDone = activeStepIdx > idx || sessionStatus === 'success';
                    const isCurrent = activeStepIdx === idx;
                    return (
                      <div key={st.id} className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            isDone
                              ? 'bg-emerald-600 dark:bg-emerald-500'
                              : isCurrent
                              ? 'bg-amber-600 dark:bg-amber-500 animate-pulse'
                              : 'bg-stone-300 dark:bg-white/10'
                          }`}
                        />
                        <p className="text-[9px] font-medium text-stone-500 dark:text-stone-400 truncate">
                          {st.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2FA Challenge Box (If Google requests verification) */}
          {sessionStatus === 'awaiting_2fa' && (
            <div className="p-4 bg-amber-500/10 dark:bg-amber-950/20 border-2 border-amber-500/40 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Verifikasi Keamanan Google Terdeteksi (2FA)
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {challengePrompt || 'Google meminta konfirmasi atau kode 6 digit verifikasi untuk mengizinkan login.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit2FA} className="space-y-3 pt-1">
                {challengeType === 'phone_prompt' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Buka notifikasi Google di smartphone Anda dan ketuk <b>"Ya"</b>. Sistem akan otomatis mendeteksi persetujuan tersebut.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting2FA}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
                    >
                      {isSubmitting2FA ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengecek persetujuan...</span>
                        </>
                      ) : (
                        <span>Saya Sudah Ketuk "Ya" di Ponsel</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="Masukkan 6 digit kode (G-123456)..."
                      className="flex-1 min-w-[200px] px-3.5 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting2FA || !twoFactorCode.trim()}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 dark:disabled:bg-stone-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmitting2FA ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>Kirim Kode 2FA</span>
                    </button>
                  </div>
                )}

                {/* Screenshot inspection if available */}
                {screenshotBase64 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowScreenshot(!showScreenshot)}
                      className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showScreenshot ? 'Sembunyikan Cuplikan Layar' : 'Lihat Layar Browser Google'}</span>
                    </button>
                    {showScreenshot && (
                      <div className="mt-2 p-1 bg-stone-900 rounded-xl border border-stone-700 overflow-hidden max-h-64 overflow-y-auto">
                        <img
                          src={screenshotBase64}
                          alt="Playwright Google Challenge Screen"
                          className="w-full object-contain rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Form Credentials: Side-by-Side (Single Account & Batch Account) */}
          {(!reloginEmail || reloginNeedsPassword) && !isAutomationRunning && sessionStatus !== 'success' && !isStartingBatch && (
            <div className={`grid grid-cols-1 ${reloginEmail ? '' : 'lg:grid-cols-2'} gap-4 items-stretch`}>
              <form onSubmit={handleStartLogin} autoComplete="off" className="space-y-3.5 rounded-2xl border border-stone-300 dark:border-white/10 bg-white dark:bg-[#181820] p-4">
                {reloginNeedsPassword && (
                  <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                    Masukkan kata sandi sekali untuk menyimpan kredensial terenkripsi pada profil server ini. Setelah login berhasil, relogin berikutnya dapat berjalan tanpa memasukkan ulang kata sandi.
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200/80 dark:border-white/10">
                  <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                    <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Single Account</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                      Email Akun Google <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="vids-account-email"
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="namaakun@gmail.com"
                      required
                      disabled={isStarting}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                      Kata Sandi Google <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="vids-account-password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi..."
                        required
                        disabled={isStarting}
                        className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 bg-stone-200/80 hover:bg-stone-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isStarting || !email.trim() || !password.trim()}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 disabled:bg-stone-400 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memulai Otomasi Playwright...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5" />
                        <span>{reloginEmail ? 'Mulai Relogin Google Vids' : 'Mulai Login & Aktivasi Google Vids'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {!reloginEmail && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                      <Bot className="w-4 h-4" />
                      <span>Batch Account</span>
                    </div>
                    <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">1 password untuk semua email</span>
                  </div>

                  <textarea
                    rows={4}
                    name="vids-batch-emails"
                    autoComplete="off"
                    value={batchEmails}
                    onChange={(e) => setBatchEmails(e.target.value)}
                    placeholder={'email1@gmail.com\nemail2@gmail.com\nemail3@gmail.com'}
                    className="w-full p-3 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2.5">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="vids-batch-password"
                        autoComplete="new-password"
                        value={batchPassword}
                        onChange={(e) => setBatchPassword(e.target.value)}
                        placeholder="Password yang sama untuk semua email..."
                        className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartBatchPlaywright}
                      disabled={isStartingBatch || batchEmails.trim().length === 0 || !batchPassword.trim()}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 disabled:bg-stone-400 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isStartingBatch ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses Batch...</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5" />
                          <span>Start Batch Playwright</span>
                        </>
                      )}
                    </button>
                  </div>

                  {batchSummary && (
                    <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-2">
                      {batchSummary}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active cancel action */}
          {(isAutomationRunning || isStartingBatch) && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-stone-400">
                {isStartingBatch
                  ? 'Batch Playwright Google Vids sedang berjalan di background...'
                  : 'Browser Playwright sedang berjalan di background...'}
              </span>
              <button
                type="button"
                onClick={handleCancelPlaywright}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isStartingBatch ? 'Batalkan Batch' : 'Batalkan Otomasi'}
              </button>
            </div>
          )}

          {/* Real-time Terminal Log Console */}
          {consoleLogs.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-stone-400" />
                  <span>Log Terminal Otomasi Playwright</span>
                </span>
                <span className="font-mono text-[10px]">{consoleLogs.length} baris</span>
              </div>
              <div
                ref={logsContainerRef}
                onScroll={(event) => {
                  const container = event.currentTarget;
                  shouldAutoFollowLogsRef.current =
                    container.scrollHeight - container.scrollTop - container.clientHeight <= 24;
                }}
                className="bg-stone-950 dark:bg-[#0E0E12] text-stone-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed max-h-44 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner custom-scrollbar space-y-0.5"
              >
                {consoleLogs.map((log, idx) => (
                  <p
                    key={idx}
                    className={`select-text ${
                      log.includes('ERROR') || log.includes('Gagal') || log.includes('❌')
                        ? 'text-rose-400'
                        : log.includes('SUKSES') || log.includes('Berhasil') || log.includes('🎉')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('2FA') || log.includes('Verifikasi')
                        ? 'text-amber-300 font-semibold'
                        : log.includes('SKIP') || log.includes('⏭️')
                        ? 'text-sky-300 font-medium'
                        : 'text-stone-300'
                    }`}
                  >
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL COOKIE & CURL */}
      {activeTab === 'cookie' && (
        <form onSubmit={handleVerifyManualCookie} className="space-y-3.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                Cookie Sesi Google Vids atau Perintah Bash cURL
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(VIDS_BOOKMARKLET_SCRIPT, 'bookmarklet')}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedBookmarklet ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Bookmarklet Tercopy!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy 1-Click Bookmarklet</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={4}
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              placeholder={`Paste cURL bash mentah dari Network tab (GetAsyncData atau generate) ATAU salin Cookie Google Vids:\n\ncurl --url 'https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData' \\\n  -H 'authorization: SAPISIDHASH ...' \\\n  -b 'SAPISID=...; SID=...; ...'`}
              required
              disabled={isVerifyingCookie}
              className="w-full p-3 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all custom-scrollbar"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Nama / Email Akun (Opsional)
            </label>
            <input
              type="text"
              value={cookieNickname}
              onChange={(e) => setCookieNickname(e.target.value)}
              placeholder="Biarkan kosong (otomatis deteksi Google) atau ketik nama kustom..."
              disabled={isVerifyingCookie}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-stone-200/80 hover:bg-stone-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isVerifyingCookie || !cookieInput.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:bg-stone-400"
            >
              {isVerifyingCookie ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memverifikasi Sesi Cookie...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Verifikasi & Simpan Akun Vids</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: BATCH TXT IMPORT */}
      {activeTab === 'import' && (
        <form onSubmit={handleBatchImport} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
              Paste Baris Cookie / Token Akun Google Vids
            </label>
            <textarea
              rows={5}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Paste 1 token / cookie / cURL Google Vids per baris..."
              disabled={isImportingBatch}
              className="w-full p-3 bg-white dark:bg-[#181820] border border-stone-300 dark:border-white/10 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all custom-scrollbar"
            />
          </div>

          {batchProgress && (
            <div className="p-3 bg-amber-500/10 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200 font-semibold">
              <div className="flex justify-between">
                <span>Memverifikasi akun batch...</span>
                <span>
                  {batchProgress.current} / {batchProgress.total}
                </span>
              </div>
              <div className="w-full bg-amber-200 dark:bg-amber-950 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-600 h-full transition-all"
                  style={{
                    width: `${(batchProgress.current / Math.max(batchProgress.total, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-stone-200/80 hover:bg-stone-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isImportingBatch || !batchText.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:bg-stone-400"
            >
              {isImportingBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengimpor Akun...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Proses Import Batch</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: LOCAL RUNNER PLAYWRIGHT SCRIPT */}
      {activeTab === 'local_script' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-stone-600 dark:text-stone-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-purple-800 dark:text-purple-300">
              <Code2 className="w-4 h-4" />
              <span>Jalankan Playwright di Komputer / Laptop Anda (Headful)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
              Jika akun Google Anda menggunakan Passkey biometric, hardware YubiKey, atau proteksi ketat Google Bot, Anda dapat menjalankan script Playwright ini di terminal PC Anda dengan Chrome nyata (`headless: false`). Cookie sesi akan otomatis dicopy untuk dipaste di sini.
            </p>
          </div>

          {/* Lang Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLocalScriptLang('node')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  localScriptLang === 'node'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-stone-200/80 dark:bg-white/10 text-stone-600 dark:text-stone-400'
                }`}
              >
                Node.js (JavaScript)
              </button>
              <button
                type="button"
                onClick={() => setLocalScriptLang('python')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  localScriptLang === 'python'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-stone-200/80 dark:bg-white/10 text-stone-600 dark:text-stone-400'
                }`}
              >
                Python
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const targetScript =
                  localScriptLang === 'node'
                    ? scripts?.nodeScript || ''
                    : scripts?.pythonScript || '';
                copyToClipboard(targetScript, 'script');
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              {copiedScript ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script {localScriptLang === 'node' ? 'Node.js' : 'Python'}</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer */}
          <div className="relative bg-stone-950 dark:bg-[#0E0E12] text-stone-300 p-4 rounded-xl font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto border border-stone-800 dark:border-white/10 shadow-inner custom-scrollbar">
            <pre>
              {localScriptLang === 'node'
                ? scripts?.nodeScript || '// Memuat script Node.js...'
                : scripts?.pythonScript || '# Memuat script Python...'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
