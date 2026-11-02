import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  Download,
  Trash2,
  Eye,
  Copy,
  Check,
  Clock,
  Layers,
  AlertCircle,
  Film,
  Archive,
  Loader2,
  Search,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import JSZip from 'jszip';
import { BatchJobItem, GenerationItem, ProviderAccount } from '../types';
import { BatchJobDetailModal } from './BatchJobDetailModal';
import { safeFetchJson } from '../utils';

interface BatchViewProps {
  onAddGenerationToHistory?: (item: GenerationItem) => void;
  onSwitchToHistory?: () => void;
}

type StatusFilter = 'all' | 'processing' | 'queued' | 'completed' | 'failed';

interface TargetImageItem {
  id: string;
  file: File;
  preview: string;
  name: string;
}

export const BatchView: React.FC<BatchViewProps> = ({
  onAddGenerationToHistory,
}) => {
  // Stored active/saved jobs in queue
  const [jobs, setJobs] = useState<BatchJobItem[]>(() => {
    try {
      const saved = localStorage.getItem('amb_batch_jobs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: BatchJobItem) => !item.id?.startsWith('batch_demo_'));
        }
      }
    } catch (e) {}
    return [];
  });

  // Direct Input Media States (No extra staged cards!)
  const [targetImages, setTargetImages] = useState<TargetImageItem[]>([]);
  const [motionVideo, setMotionVideo] = useState<{ file?: File; preview?: string; name?: string } | null>(null);
  const [isCreatorExpanded, setIsCreatorExpanded] = useState<boolean>(true);

  // Execution & UI states
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<BatchJobItem | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Total elapsed timer for the entire batch session
  const [batchElapsedSeconds, setBatchElapsedSeconds] = useState<number>(0);
  const batchTimerRef = useRef<any>(null);

  // File input refs for direct clicks
  const targetImageInputRef = useRef<HTMLInputElement>(null);
  const motionVideoInputRef = useRef<HTMLInputElement>(null);

  // Safe sync to local storage (stripping large binary payloads)
  useEffect(() => {
    try {
      const sanitized = jobs.map((j) => ({
        ...j,
        imageFile: undefined,
        referenceImageFile: undefined,
        motionVideoFile: undefined,
        imageDataUrl: j.uploadedImageFileName
          ? undefined
          : j.imageDataUrl && j.imageDataUrl.length > 40000
          ? undefined
          : j.imageDataUrl,
        referenceImageDataUrl: undefined,
        motionVideoDataUrl: undefined,
      }));
      localStorage.setItem('amb_batch_jobs', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('[Batch Storage Quota Warning]:', e);
    }
  }, [jobs]);

  // Load RunningHub accounts (filter out dead/banned/expired accounts)
  const getRunningHubAccounts = (): ProviderAccount[] => {
    try {
      const raw = localStorage.getItem('runninghub_accounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Exclude banned / expired / dead accounts from batch pool
          return parsed.filter((a: ProviderAccount) => !a.accountStatus || a.accountStatus === 'active');
        }
      }
    } catch (e) {}
    return [];
  };

  const getAccountApiKey = (acc?: ProviderAccount | any): string => {
    if (!acc) return '';
    return (acc.refreshToken || acc.accessToken || acc.idToken || acc.email || '').trim();
  };

  const runningHubAccounts = getRunningHubAccounts();
  const totalCoins = runningHubAccounts.reduce(
    (sum, a) => sum + (typeof a.credits === 'number' ? a.credits : 0),
    0
  );

  // Stats calculation
  const totalJobs = jobs.length;
  const queuedCount = jobs.filter((j) => j.status === 'queued').length;
  const processingCount = jobs.filter((j) => j.status === 'processing').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  const completionPercentage =
    totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  // Estimated Time calculation
  const availableWorkersCount = Math.max(runningHubAccounts.length, 1);
  const remainingJobsCount = queuedCount + processingCount;
  const estimatedSecondsTotal = Math.round(
    (remainingJobsCount * 150) / Math.max(availableWorkersCount, 1)
  );

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer loop for batch execution
  useEffect(() => {
    if (isBatchRunning || processingCount > 0) {
      batchTimerRef.current = setInterval(() => {
        setBatchElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    }
    return () => {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    };
  }, [isBatchRunning, processingCount]);

  // Upload helper for RunningHub
  const uploadBatchMediaToRunningHub = async (
    fileOrUrl: any,
    apiKey: string,
    mimeType: string,
    fileName: string
  ): Promise<string> => {
    if (!apiKey) {
      throw new Error('apiKey RunningHub wajib disertakan. Hubungkan akun di menu Settings.');
    }

    if (
      typeof fileOrUrl === 'string' &&
      !fileOrUrl.startsWith('data:') &&
      !fileOrUrl.startsWith('blob:') &&
      !fileOrUrl.startsWith('http://') &&
      !fileOrUrl.startsWith('https://')
    ) {
      return fileOrUrl;
    }

    const formData = new FormData();
    formData.append('apiKey', apiKey);

    if (fileOrUrl instanceof File && fileOrUrl.size > 0) {
      formData.append('file', fileOrUrl);
      formData.append('fileName', fileOrUrl.name || fileName);
    } else if (fileOrUrl instanceof Blob && fileOrUrl.size > 0) {
      formData.append('file', fileOrUrl, fileName);
      formData.append('fileName', fileName);
    } else if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('data:')) {
      const response = await fetch(fileOrUrl);
      const blob = await response.blob();
      formData.append('file', blob, fileName);
      formData.append('fileName', fileName);
    } else if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('blob:')) {
      try {
        const response = await fetch(fileOrUrl);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
        formData.append('fileName', fileName);
      } catch (blobErr) {
        formData.append('url', fileOrUrl);
        formData.append('fileName', fileName);
      }
    } else if (typeof fileOrUrl === 'string' && (fileOrUrl.startsWith('http://') || fileOrUrl.startsWith('https://'))) {
      formData.append('url', fileOrUrl);
      formData.append('fileName', fileName);
    } else {
      throw new Error(`Media ${fileName} tidak memiliki data file atau URL yang valid.`);
    }

    const res = await fetch('/api/runninghub/upload', {
      method: 'POST',
      body: formData,
    });

    const resData = await res.json();
    if (!res.ok || !resData.success || !resData.fileName) {
      throw new Error(resData.error || `Gagal mengunggah media ${fileName} ke RunningHub.`);
    }

    return resData.fileName;
  };

  // Helper to auto-sync RunningHub credits after job completion
  const autoSyncRunningHubCredits = async (apiKey?: string) => {
    if (!apiKey) return;
    try {
      const { ok, data } = await safeFetchJson('/api/runninghub/account/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (ok && data?.success) {
        const raw = localStorage.getItem('runninghub_accounts');
        if (raw) {
          const accs = JSON.parse(raw);
          if (Array.isArray(accs)) {
            const updated = accs.map((a: any) => {
              const accKey = (a.refreshToken || a.accessToken || a.idToken || a.email || '').trim();
              if (accKey === apiKey.trim() || a.id === apiKey) {
                return {
                  ...a,
                  credits: typeof data.credits === 'number' ? data.credits : a.credits,
                  totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : a.totalCredits,
                };
              }
              return a;
            });
            localStorage.setItem('runninghub_accounts', JSON.stringify(updated));
            window.dispatchEvent(new Event('runninghub_accounts_updated'));
            window.dispatchEvent(new Event('accounts-updated'));
          }
        }
      }
    } catch (e) {
      console.warn('[Batch Auto-sync credits error]:', e);
    }
  };

  // ==================== DIRECT MEDIA HANDLERS ====================

  // Handle adding target images (multi-selection)
  const handleTargetImagesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const newItems: TargetImageItem[] = fileArray.map((file, idx) => ({
      id: `img_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));

    setTargetImages((prev) => [...prev, ...newItems]);
  };

  // Remove a single target image from card
  const handleRemoveTargetImage = (id: string) => {
    setTargetImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Clear all target images
  const handleClearTargetImages = () => {
    setTargetImages([]);
  };

  // Handle motion video selection
  const handleMotionVideoSelected = (file: File) => {
    if (!file.type.startsWith('video/')) return;
    const preview = URL.createObjectURL(file);
    setMotionVideo({ file, preview, name: file.name });
  };

  // Submit current direct inputs into active batch queue
  const handleAddToQueue = (startImmediately: boolean = false) => {
    if (targetImages.length === 0) {
      alert('Harap masukkan minimal 1 Target Gambar.');
      return;
    }

    if (!motionVideo?.file && !motionVideo?.preview) {
      alert('Harap pilih Video Referensi Gerak (Motion Video) terlebih dahulu agar animasi dapat diproses.');
      return;
    }

    const startOrder = jobs.length + 1;
    const newJobs: BatchJobItem[] = targetImages.map((img, idx) => ({
      id: `job_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      order: startOrder + idx,
      mediaUrl: img.preview,
      mediaType: 'image',
      mediaName: img.name,
      imageFile: img.file,
      imageDataUrl: img.preview,
      motionVideoUrl: motionVideo.preview,
      motionVideoName: motionVideo.name || 'motion_reference.mp4',
      motionVideoFile: motionVideo.file,
      status: 'queued',
      account: 'Auto',
      duration: '--:--',
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
      model: 'Motion Control 1080HD',
    }));

    setJobs((prev) => [...prev, ...newJobs]);
    setTargetImages([]); // Clear inputs once added

    if (startImmediately) {
      setIsBatchRunning(true);
    }
  };

  // ==================== DISPATCHER & QUEUE RUNNER ====================

  useEffect(() => {
    if (!isBatchRunning) return;

    const allAccounts = getRunningHubAccounts();
    const maxConcurrent = Math.max(allAccounts.length, 1);
    const currentProcessing = jobs.filter((j) => j.status === 'processing');

    if (currentProcessing.length < maxConcurrent && queuedCount > 0) {
      const nextJob = jobs.find((j) => j.status === 'queued');
      if (nextJob) {
        const busyKeyList = currentProcessing.map((j) => j.accountApiKey).filter(Boolean);
        const validWithCoins = allAccounts.filter((a) => {
          const key = getAccountApiKey(a);
          return key && a.accountStatus !== 'error' && (a.credits === undefined || a.credits > 0);
        });

        const freeAccount =
          validWithCoins.find((a) => {
            const key = getAccountApiKey(a);
            return key && !busyKeyList.includes(key);
          }) ||
          validWithCoins.find((a) => a.isActive) ||
          validWithCoins[0] ||
          allAccounts.find((a) => {
            const key = getAccountApiKey(a);
            return key && !busyKeyList.includes(key);
          }) ||
          allAccounts.find((a) => a.isActive) ||
          allAccounts[0];

        const accountMask = freeAccount
          ? `•••• ${String(freeAccount.name || freeAccount.email || freeAccount.id).slice(-3).toUpperCase()}`
          : 'Auto';

        executeSingleBatchJob(nextJob.id, freeAccount, accountMask);
      }
    }

    if (queuedCount === 0 && processingCount === 0 && totalJobs > 0) {
      setIsBatchRunning(false);
    }
  }, [isBatchRunning, jobs, queuedCount, processingCount]);

  const executeSingleBatchJob = async (
    jobId: string,
    account?: ProviderAccount,
    accountMask?: string
  ) => {
    const jobItem = jobs.find((j) => j.id === jobId);
    if (!jobItem) return;

    const allAccounts = getRunningHubAccounts();
    const validWithCoins = allAccounts.filter((a) => {
      const key = getAccountApiKey(a);
      return key && a.accountStatus !== 'error' && (a.credits === undefined || a.credits > 0);
    });

    const targetAccount = account || validWithCoins.find((a) => a.isActive) || validWithCoins[0] || allAccounts.find((a) => a.isActive) || allAccounts[0];
    const apiKey = getAccountApiKey(targetAccount);

    if (!apiKey) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'failed',
                errorMessage: 'API Key RunningHub belum disetting di Settings.',
              }
            : j
        )
      );
      return;
    }

    const fallbackKeys = allAccounts
      .filter((a) => {
        const k = getAccountApiKey(a);
        return k && k !== apiKey && a.accountStatus !== 'error';
      })
      .sort((a, b) => (b.credits ?? 600) - (a.credits ?? 600))
      .map(getAccountApiKey);

    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'processing',
              account: accountMask || (targetAccount?.name ? `•••• ${String(targetAccount.name).slice(-3).toUpperCase()}` : 'Auto'),
              accountApiKey: apiKey,
              progress: 10,
              timeAgo: 'Just now',
            }
          : j
      )
    );

    let jobStartTime = Date.now();
    const jobTimerInterval = setInterval(() => {
      const jobElapsed = Math.floor((Date.now() - jobStartTime) / 1000);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId && j.status === 'processing'
            ? {
                ...j,
                duration: formatTimer(jobElapsed),
                elapsedSeconds: jobElapsed,
                progress: Math.min(15 + Math.floor(jobElapsed * 2.2), 94),
              }
            : j
        )
      );
    }, 1000);

    try {
      // 1. Upload Target Image (Node #30)
      const uploadedImage = await uploadBatchMediaToRunningHub(
        jobItem.imageFile || jobItem.imageDataUrl || jobItem.mediaUrl,
        apiKey,
        'image/jpeg',
        jobItem.mediaName || 'input_image.jpg'
      );

      // 2. Upload Motion Reference Video (Node #33)
      let uploadedVideo = jobItem.uploadedVideoFileName || '';
      if (jobItem.motionVideoFile || jobItem.motionVideoDataUrl || jobItem.motionVideoUrl) {
        uploadedVideo = await uploadBatchMediaToRunningHub(
          jobItem.motionVideoFile || jobItem.motionVideoDataUrl || jobItem.motionVideoUrl || '',
          apiKey,
          'video/mp4',
          jobItem.motionVideoName || 'motion_reference.mp4'
        );
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                uploadedImageFileName: uploadedImage,
                uploadedVideoFileName: uploadedVideo,
                progress: 25,
              }
            : j
        )
      );

      // Submit generation task without prompt requirement
      const targetWorkflowId = jobItem.model === 'MiniMax H3 Turbo Video'
        ? '2098388825144184833'
        : jobItem.model === 'S2 Motion Control'
        ? '2091060763809492994'
        : '2088843516532506626';
      const payload = {
        apiKey: apiKey || undefined,
        fallbackApiKeys: fallbackKeys,
        image: uploadedImage,
        video:
          uploadedVideo ||
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        workflowId: targetWorkflowId,
        model: jobItem.model || 'Motion Control',
      };

      const { ok, data } = await safeFetchJson('/api/runninghub/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const serverTaskId = data?.taskId || data?.sessionId;
      const isQueueMaxed = data?.isQueueMaxed === true || data?.queued === true;
      const usedKey = data?.usedApiKey || apiKey;

      // Update exhausted accounts
      if (Array.isArray(data?.exhaustedApiKeys) && data.exhaustedApiKeys.length > 0) {
        try {
          const raw = localStorage.getItem('runninghub_accounts');
          if (raw) {
            const accs = JSON.parse(raw);
            if (Array.isArray(accs)) {
              let changed = false;
              const updated = accs.map((a: any) => {
                const key = getAccountApiKey(a);
                if (data.exhaustedApiKeys.includes(key)) {
                  changed = true;
                  return { ...a, credits: 0, totalCredits: 0, statusMessage: 'Koin habis (0 Coins)', accountStatus: 'error' };
                }
                return a;
              });
              if (changed) {
                localStorage.setItem('runninghub_accounts', JSON.stringify(updated));
                window.dispatchEvent(new Event('runninghub_accounts_updated'));
              }
            }
          }
        } catch (e) {}
      }

      if (!ok || isQueueMaxed || !serverTaskId) {
        clearInterval(jobTimerInterval);

        if (isQueueMaxed || (!ok && String(data?.error || '').toUpperCase().includes('QUEUE'))) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'queued',
                    errorMessage: 'Antre di RunningHub (Semua akun sibuk / antrean penuh)...',
                  }
                : j
            )
          );
        } else {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'failed',
                    errorMessage: data?.error || 'Gagal membuat task di RunningHub.',
                    progress: 0,
                  }
                : j
            )
          );
          autoSyncRunningHubCredits(apiKey);
        }
        return;
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                taskId: serverTaskId,
                accountApiKey: usedKey,
                errorMessage: undefined,
              }
            : j
        )
      );

      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount += 1;

        if (pollCount > 900) {
          clearInterval(pollInterval);
          clearInterval(jobTimerInterval);
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'failed',
                    errorMessage: 'Waktu tunggu melebihi batas (Timeout).',
                  }
                : j
            )
          );
          autoSyncRunningHubCredits(usedKey);
          return;
        }

        try {
          const { ok: pollOk, data: pollData } = await safeFetchJson('/api/runninghub/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: usedKey || apiKey,
              taskId: serverTaskId,
            }),
          });

          if (!pollOk) return;

          const rawOutputs = Array.isArray(pollData?.outputs)
            ? pollData.outputs
            : Array.isArray(pollData?.data?.outputs)
            ? pollData.data.outputs
            : Array.isArray(pollData?.data)
            ? pollData.data
            : [];

          let outputCandidate = '';
          for (const item of rawOutputs) {
            if (typeof item === 'string' && item.startsWith('http')) {
              outputCandidate = item;
              break;
            } else if (item && typeof item === 'object') {
              const u =
                item.fileUrl ||
                item.file_url ||
                item.url ||
                item.downloadUrl ||
                item.download_url ||
                item.ossUrl ||
                item.oss_url ||
                item.videoUrl ||
                item.video_url ||
                item.outputUrl ||
                item.resultUrl ||
                item.src;
              if (u) {
                outputCandidate = u;
                break;
              }
            }
          }

          const resultMediaUrl =
            pollData?.videoUrl ||
            pollData?.mediaUrl ||
            pollData?.outputUrl ||
            pollData?.resultUrl ||
            pollData?.fileUrl ||
            outputCandidate ||
            (typeof pollData?.data === 'string' && pollData.data.startsWith('http') ? pollData.data : '') ||
            pollData?.data?.fileUrl ||
            pollData?.data?.url ||
            '';

          const isSuccess =
            pollData?.status === 'SUCCESS' ||
            pollData?.status === 'completed' ||
            pollData?.rawStatus === 'SUCCESS' ||
            pollData?.rawStatus === 'COMPLETED' ||
            pollData?.rawStatus === 'FINISH' ||
            pollData?.rawStatus === 'FINISHED';

          const isCompleted = isSuccess || Boolean(resultMediaUrl);

          if (isCompleted) {
            clearInterval(pollInterval);
            clearInterval(jobTimerInterval);

            const finalMedia = resultMediaUrl || jobItem.mediaUrl || '';
            const finalElapsed = Math.max(Math.floor((Date.now() - jobStartTime) / 1000), 1);

            setJobs((prev) =>
              prev.map((j) =>
                j.id === jobId
                  ? {
                      ...j,
                      status: 'completed',
                      progress: 100,
                      resultUrl: finalMedia,
                      duration: formatTimer(finalElapsed),
                      elapsedSeconds: finalElapsed,
                      timeAgo: 'Just now',
                    }
                  : j
              )
            );

            autoSyncRunningHubCredits(usedKey);

            if (onAddGenerationToHistory) {
              onAddGenerationToHistory({
                id: `gen_batch_${serverTaskId}_${Date.now()}`,
                mode: 'video',
                title: jobItem.mediaName || 'Batch Motion Video',
                prompt: '',
                createdAt: new Date().toISOString(),
                timestamp: 'Just now',
                aspectRatio: '9:16 (Vertical)',
                resolution: '1080p',
                duration: formatTimer(finalElapsed),
                model: 'Motion Control 1080HD',
                thumbnailUrl: jobItem.mediaUrl,
                mediaUrl: finalMedia,
                status: 'completed',
                taskId: serverTaskId,
                provider: 'runninghub',
                providerName: 'RunningHub',
              });
            }
          } else if (
            pollData?.status === 'FAILED' ||
            pollData?.status === 'failed' ||
            pollData?.rawStatus === 'FAILED' ||
            pollData?.rawStatus === 'FAIL' ||
            pollData?.rawStatus === 'ERROR'
          ) {
            clearInterval(pollInterval);
            clearInterval(jobTimerInterval);

            setJobs((prev) =>
              prev.map((j) =>
                j.id === jobId
                  ? {
                      ...j,
                      status: 'failed',
                      errorMessage: pollData?.error || pollData?.errorMessage || pollData?.msg || 'Gagal merender di RunningHub.',
                    }
                  : j
              )
            );
            autoSyncRunningHubCredits(usedKey);
          }
        } catch (pollErr) {
          console.warn('[Batch Job Polling Warning]:', pollErr);
        }
      }, 3000);
    } catch (err: any) {
      clearInterval(jobTimerInterval);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'failed',
                errorMessage: err.message || 'Gagal mengirim task ke RunningHub.',
              }
            : j
        )
      );
      autoSyncRunningHubCredits(apiKey);
    }
  };

  // Job item actions
  const handleDuplicateJob = (job: BatchJobItem) => {
    const newJob: BatchJobItem = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      order: jobs.length + 1,
      status: 'queued',
      account: 'Auto',
      taskId: undefined,
      resultUrl: undefined,
      duration: '--:--',
      progress: 0,
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
    };
    setJobs((prev) => [...prev, newJob]);
  };

  const handleDeleteJob = (id: string) => {
    setJobs((prev) => {
      const filtered = prev.filter((j) => j.id !== id);
      return filtered.map((j, idx) => ({ ...j, order: idx + 1 }));
    });
  };

  const handleRerunJob = (job: BatchJobItem) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id
          ? {
              ...j,
              status: 'queued',
              progress: 0,
              duration: '--:--',
              errorMessage: undefined,
              resultUrl: undefined,
            }
          : j
      )
    );
  };

  const handleClearCompleted = () => {
    setJobs((prev) => {
      const remaining = prev.filter((j) => j.status !== 'completed');
      return remaining.map((j, idx) => ({ ...j, order: idx + 1 }));
    });
  };

  const handleClearAll = () => {
    setJobs([]);
    setIsBatchRunning(false);
    setBatchElapsedSeconds(0);
    try {
      localStorage.removeItem('amb_batch_jobs');
    } catch (e) {}
  };

  const handleDownloadSingle = (job: BatchJobItem) => {
    if (!job.resultUrl) return;
    const a = document.createElement('a');
    a.href = job.resultUrl;
    a.download = `AMB_Batch_Job_${String(job.order).padStart(2, '0')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllZip = async () => {
    const completedJobs = jobs.filter((j) => j.status === 'completed' && j.resultUrl);
    if (completedJobs.length === 0) {
      alert('Belum ada video yang selesai (Completed) untuk diunduh.');
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('AMB_Batch_Videos');

      for (let i = 0; i < completedJobs.length; i++) {
        const job = completedJobs[i];
        try {
          const resp = await fetch(job.resultUrl!);
          const blob = await resp.blob();
          const fileName = `AMB_Batch_${String(job.order).padStart(2, '0')}_${(
            job.mediaName || 'video'
          ).replace(/\.[^/.]+$/, '')}.mp4`;
          folder?.file(fileName, blob);
        } catch (fileErr) {
          console.warn('Gagal mengunduh file untuk zip:', job.id, fileErr);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `AMB_Batch_Export_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Gagal membuat file ZIP: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  const copyTaskId = (taskId: string) => {
    navigator.clipboard.writeText(taskId);
    setCopiedTaskId(taskId);
    setTimeout(() => setCopiedTaskId(null), 2000);
  };

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== 'all' && j.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMedia = j.mediaName?.toLowerCase().includes(q);
        const matchTask = j.taskId?.toLowerCase().includes(q);
        const matchAccount = j.account?.toLowerCase().includes(q);
        const matchMotion = j.motionVideoName?.toLowerCase().includes(q);
        return matchMedia || matchTask || matchAccount || matchMotion;
      }
      return true;
    });
  }, [jobs, statusFilter, searchQuery]);

  const isAddDisabled = targetImages.length === 0 || !motionVideo;

  return (
    <div className="w-full space-y-5 text-stone-900 dark:text-stone-100 animate-in fade-in duration-150">
      {/* 1. TOP PIPELINE INFO & MASTER CONTROLS */}
      <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Pipeline Context & Worker Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Job Motion Pipeline</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Auto Dispatcher
            </span>
          </div>

          <div className="h-4 w-px bg-stone-300 dark:bg-stone-800 hidden sm:block" />

          {/* RunningHub Status info */}
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-900/80 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-800 font-medium text-stone-700 dark:text-stone-300">
              <img
                src="https://www.runninghub.ai/favicon.ico?v=1.4"
                alt="RunningHub"
                className="w-3.5 h-3.5 object-contain"
                referrerPolicy="no-referrer"
              />
              <span>RunningHub</span>
            </div>
            <span>•</span>
            <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
              {runningHubAccounts.length} Akun ({totalCoins.toLocaleString()} Coins)
            </span>
          </div>
        </div>

        {/* Right: Master Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Start / Pause Master Button */}
          {isBatchRunning ? (
            <button
              type="button"
              onClick={() => setIsBatchRunning(false)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-white" />
              <span>Pause Batch</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={jobs.length === 0 || queuedCount === 0}
              onClick={() => setIsBatchRunning(true)}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-stone-950" />
              <span>Start Batch {queuedCount > 0 ? `(${queuedCount})` : ''}</span>
            </button>
          )}

          {/* Download ZIP */}
          {completedCount > 0 && (
            <button
              type="button"
              disabled={isZipping}
              onClick={handleDownloadAllZip}
              className="px-3.5 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Unduh semua video yang selesai ke file ZIP"
            >
              {isZipping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>ZIP ({completedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. DIRECT INLINE INPUT PANEL: 2 CLEAN CARDS (NO SEPARATE STAGED CARDS OR POPUPS!) */}
      <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Creator Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Input Media Batch
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Unggah target gambar (1 atau multi-gambar) dan video referensi gerakan secara langsung.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatorExpanded(!isCreatorExpanded)}
            className="p-1.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors cursor-pointer"
            title={isCreatorExpanded ? 'Sembunyikan Panel Input' : 'Tampilkan Panel Input'}
          >
            {isCreatorExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* 2 Cards Grid (When Expanded) */}
        {isCreatorExpanded && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CARD 1: TARGET GAMBAR (IMAGE) - PREVIEW DIRECTLY INSIDE THIS CARD */}
              <div className="bg-stone-50/80 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-xl p-4 flex flex-col justify-between min-h-[190px]">
                {/* Card Top Label */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Target Gambar (Image)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {targetImages.length > 0 && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                        {targetImages.length} Foto Terpilih
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Wajib • Multi-pilih
                    </span>
                  </div>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={targetImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleTargetImagesSelected(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />

                {/* CASE A: No Images Uploaded Yet */}
                {targetImages.length === 0 && (
                  <div
                    onClick={() => targetImageInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files) {
                        handleTargetImagesSelected(e.dataTransfer.files);
                      }
                    }}
                    className="border-2 border-dashed border-stone-300 dark:border-stone-700/80 hover:border-amber-500/70 dark:hover:border-amber-500/70 rounded-xl p-5 text-center cursor-pointer transition-all bg-white dark:bg-[#111116] flex flex-col items-center justify-center flex-1"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Pilih Foto Target
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Klik atau drag & drop (Bisa pilih puluhan gambar sekaligus)
                    </p>
                  </div>
                )}

                {/* CASE B: Single Image Uploaded */}
                {targetImages.length === 1 && (
                  <div className="relative rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111116] p-3 flex items-center gap-3.5 flex-1">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-stone-950 border border-stone-200 dark:border-stone-800 shrink-0">
                      {targetImages[0].preview ? (
                        <img
                          src={targetImages[0].preview}
                          alt={targetImages[0].name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block truncate">
                        {targetImages[0].name}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                        ✓ Gambar siap diproses
                      </span>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => targetImageInputRef.current?.click()}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Tambah Foto Lain
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTargetImage(targetImages[0].id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Hapus foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* CASE C: Multiple Images Uploaded (Displayed Directly in this Card) */}
                {targetImages.length > 1 && (
                  <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                    {/* Thumbnails Scrollable Ribbon */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar p-1.5 bg-white dark:bg-[#111116] border border-stone-300 dark:border-stone-700/80 rounded-xl min-h-[95px]">
                      {targetImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className="relative group shrink-0 w-18 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-1 flex flex-col items-center"
                        >
                          <div className="w-16 h-16 rounded overflow-hidden bg-stone-950 border border-stone-200 dark:border-stone-800 relative">
                            {img.preview ? (
                              <img
                                src={img.preview}
                                alt={img.name}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                            <span className="absolute bottom-0.5 left-0.5 text-[8px] font-mono bg-black/75 text-white px-1 rounded">
                              #{idx + 1}
                            </span>
                          </div>
                          <span className="text-[9px] text-stone-500 dark:text-stone-400 truncate w-full text-center mt-0.5">
                            {img.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTargetImage(img.id)}
                            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                            title="Hapus gambar ini"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ))}

                      {/* Add More Button inside ribbon */}
                      <button
                        type="button"
                        onClick={() => targetImageInputRef.current?.click()}
                        className="shrink-0 w-18 h-20 rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500/70 text-stone-400 hover:text-amber-500 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer bg-stone-50/50 dark:bg-stone-900/30"
                        title="Tambah foto lainnya"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[9px] font-medium">Tambah</span>
                      </button>
                    </div>

                    {/* Bottom action for images */}
                    <div className="flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={() => targetImageInputRef.current?.click()}
                        className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                      >
                        + Tambah Foto Lainnya
                      </button>
                      <button
                        type="button"
                        onClick={handleClearTargetImages}
                        className="text-[11px] text-red-500 hover:text-red-400 hover:underline cursor-pointer"
                      >
                        Hapus Semua Foto
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 2: VIDEO REFERENSI GERAK (MOTION VIDEO) */}
              <div className="bg-stone-50/80 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-xl p-4 flex flex-col justify-between min-h-[190px]">
                {/* Card Top Label */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[11px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Video Referensi Gerak
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                    Wajib Motion (MP4)
                  </span>
                </div>

                {/* Hidden Video Input */}
                <input
                  ref={motionVideoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleMotionVideoSelected(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />

                {motionVideo ? (
                  <div className="relative rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111116] p-3 flex items-center gap-3.5 flex-1">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-stone-950 border border-stone-200 dark:border-stone-800 shrink-0 flex items-center justify-center">
                      {motionVideo.preview ? (
                        <video
                          src={motionVideo.preview}
                          className="w-full h-full object-cover"
                          playsInline
                          muted
                          autoPlay
                          loop
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block truncate">
                        {motionVideo.name}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                        ✓ Video gerakan aktif
                      </span>
                      <button
                        type="button"
                        onClick={() => motionVideoInputRef.current?.click()}
                        className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium cursor-pointer"
                      >
                        Ganti Video
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMotionVideo(null)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Hapus video"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => motionVideoInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleMotionVideoSelected(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-stone-300 dark:border-stone-700/80 hover:border-purple-500/70 rounded-xl p-5 text-center cursor-pointer transition-all bg-white dark:bg-[#111116] flex flex-col items-center justify-center flex-1"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mb-2">
                      <VideoIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Pilih Video Gerakan (MP4)
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Video referensi gerakan tubuh, tarian, atau ekspresi
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* DIRECT ACTION BUTTONS BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                {targetImages.length > 0 && motionVideo ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Siap diproses: {targetImages.length} video gerakan akan dibuat.
                  </span>
                ) : (
                  <span>
                    Lengkapi Target Gambar dan Video Gerakan di atas untuk memulai batch.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={isAddDisabled}
                  onClick={() => handleAddToQueue(false)}
                  className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Tambahkan ke Queue {targetImages.length > 0 ? `(${targetImages.length})` : ''}</span>
                </button>

                <button
                  type="button"
                  disabled={isAddDisabled}
                  onClick={() => handleAddToQueue(true)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-stone-950" />
                  <span>Tambah & Mulai Batch {targetImages.length > 0 ? `(${targetImages.length})` : ''}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. BATCH STATS & PROGRESS OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Queued */}
        <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Antre (Queued)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {queuedCount}
            </span>
            <span className="text-[10px] text-stone-400">Menunggu giliran</span>
          </div>
        </div>

        {/* Processing */}
        <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Sedang Diproses
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              {processingCount}
              {processingCount > 0 && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
            </span>
            <span className="text-[10px] text-stone-400">
              {processingCount > 0 ? `${processingCount} aktif` : 'Idle'}
            </span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Selesai (Completed)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {completedCount}
            </span>
            <span className="text-[10px] text-stone-400">
              {completionPercentage}% selesai
            </span>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            Gagal (Failed)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span
              className={`text-2xl font-bold font-mono ${
                failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-stone-700 dark:text-stone-300'
              }`}
            >
              {failedCount}
            </span>
            <span className="text-[10px] text-stone-400">
              {failedCount > 0 ? `${failedCount} butuh retry` : '0 error'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. ACTIVE QUEUE TABLE & CONTROLS */}
      <div className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-stone-800/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Table Filter & Search Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-900/80 p-1 rounded-xl border border-stone-200 dark:border-stone-800 text-xs overflow-x-auto">
            {(['all', 'processing', 'queued', 'completed', 'failed'] as StatusFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {tab === 'all'
                  ? `Semua (${totalJobs})`
                  : tab === 'processing'
                  ? `Diproses (${processingCount})`
                  : tab === 'queued'
                  ? `Antre (${queuedCount})`
                  : tab === 'completed'
                  ? `Selesai (${completedCount})`
                  : `Gagal (${failedCount})`}
              </button>
            ))}
          </div>

          {/* Search Box & Clear Tools */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Cari target / Task ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="px-2.5 py-1.5 bg-stone-100 dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 transition-colors whitespace-nowrap cursor-pointer"
                title="Hapus job yang sudah selesai dari antrean"
              >
                Hapus Selesai
              </button>
            )}

            {totalJobs > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 transition-colors cursor-pointer"
                title="Bersihkan Semua Antrean"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {filteredJobs.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
              <Film className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                {totalJobs === 0
                  ? 'Belum ada antrean batch'
                  : 'Tidak ada job yang sesuai dengan filter'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {totalJobs === 0
                  ? 'Pilih Target Gambar dan Video Gerakan pada form di atas, lalu klik "Tambah & Mulai Batch".'
                  : 'Coba ubah kata kunci pencarian atau tab status di atas.'}
              </p>
            </div>
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2.5 px-3 font-semibold w-12 text-center">#</th>
                  <th className="py-2.5 px-3 font-semibold">Target & Motion</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Akun</th>
                  <th className="py-2.5 px-3 font-semibold">Task ID</th>
                  <th className="py-2.5 px-3 font-semibold">Durasi</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800/60">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors group"
                  >
                    {/* # Order */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-stone-400">
                      {String(job.order).padStart(2, '0')}
                    </td>

                    {/* Target Image & Motion Video Badges */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {/* Target Thumbnail */}
                        <div
                          onClick={() => setSelectedJobForDetail(job)}
                          className="w-12 h-12 rounded-lg overflow-hidden bg-stone-950 border border-stone-200 dark:border-stone-800 relative shrink-0 cursor-pointer group/thumb flex items-center justify-center"
                        >
                          {job.mediaUrl ? (
                            <img
                              src={job.mediaUrl}
                              alt={job.mediaName || 'Media'}
                              className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-stone-600" />
                          )}
                          {job.resultUrl && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                              <Play className="w-4 h-4 fill-white" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="space-y-1 min-w-0">
                          <span
                            onClick={() => setSelectedJobForDetail(job)}
                            className="font-medium text-stone-900 dark:text-stone-100 hover:text-amber-500 truncate block max-w-xs cursor-pointer"
                          >
                            {job.mediaName || 'Target Image'}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {/* Motion Video Badge */}
                            <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                              <VideoIcon className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[120px]">
                                {job.motionVideoName || 'Motion.mp4'}
                              </span>
                            </span>
                            <span className="text-stone-400 font-mono">1080HD</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status & Progress */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {job.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          ● Completed
                        </span>
                      ) : job.status === 'processing' ? (
                        <div className="space-y-1 w-28">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse">
                            ● Processing ({job.progress || 25}%)
                          </span>
                          <div className="w-full h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${job.progress || 25}%` }}
                            />
                          </div>
                        </div>
                      ) : job.status === 'queued' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                          ● Queued
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                            ● Failed
                          </span>
                          {job.errorMessage && (
                            <p className="text-[10px] text-red-500 dark:text-red-400 truncate max-w-[140px]" title={job.errorMessage}>
                              {job.errorMessage}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Account Assigned */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-stone-600 dark:text-stone-300">
                      {job.account || 'Auto'}
                    </td>

                    {/* Task ID */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {job.taskId ? (
                        <div className="flex items-center gap-1.5 font-mono text-stone-500 dark:text-stone-400">
                          <span className="truncate max-w-[90px]" title={job.taskId}>
                            {job.taskId}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyTaskId(job.taskId!)}
                            className="p-1 hover:text-stone-900 dark:hover:text-stone-100 rounded cursor-pointer"
                            title="Salin Task ID"
                          >
                            {copiedTaskId === job.taskId ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-stone-400">--</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-stone-500 dark:text-stone-400">
                      {job.duration || '--:--'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Download if Completed */}
                        {job.resultUrl && (
                          <button
                            type="button"
                            onClick={() => handleDownloadSingle(job)}
                            className="p-1.5 text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                            title="Unduh Video"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}

                        {/* Re-run if Failed */}
                        {job.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRerunJob(job)}
                            className="p-1.5 text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                            title="Coba Lagi (Re-run)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateJob(job)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                          title="Duplikat Job"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* View Detail Modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedJobForDetail(job)}
                          className="p-1.5 text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                          title="Hapus dari Antrean"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. JOB DETAIL MODAL */}
      {selectedJobForDetail && (
        <BatchJobDetailModal
          job={selectedJobForDetail}
          onClose={() => setSelectedJobForDetail(null)}
          onRerun={handleRerunJob}
        />
      )}
    </div>
  );
};
