import React from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Film,
  RotateCcw,
  Image as ImageIcon,
  Video as VideoIcon,
} from 'lucide-react';
import { BatchJobItem } from '../types';

interface BatchJobDetailModalProps {
  job: BatchJobItem | null;
  onClose: () => void;
  onRerun?: (job: BatchJobItem) => void;
}

export const BatchJobDetailModal: React.FC<BatchJobDetailModalProps> = ({
  job,
  onClose,
  onRerun,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!job) return null;

  const handleCopyTaskId = () => {
    if (!job.taskId) return;
    navigator.clipboard.writeText(job.taskId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!job.resultUrl) return;
    const a = document.createElement('a');
    a.href = job.resultUrl;
    a.download = `AMB_Batch_Job_${String(job.order).padStart(2, '0')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#14141A] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#171720]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
              #{String(job.order).padStart(2, '0')}
            </span>
            <div>
              <h3 className="font-serif-display text-base font-semibold text-stone-900 dark:text-stone-100">
                Detail Batch Job
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {job.model || 'Motion Control AmbMedia 1080HD'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Result or Preview */}
          <div className="relative aspect-9/16 max-h-[280px] mx-auto rounded-xl overflow-hidden bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-center shadow-inner">
            {job.resultUrl ? (
              <video
                src={job.resultUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {job.mediaUrl ? (
                  <img
                    src={job.mediaUrl}
                    alt="Job Preview"
                    className="w-full h-full object-contain filter brightness-90"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-stone-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-2">
                    <Film className="w-5 h-5 animate-pulse" />
                  </div>
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    {job.status === 'processing'
                      ? `Sedang Merender... (${job.progress || 25}%)`
                      : job.status === 'queued'
                      ? 'Menunggu Giliran Akun...'
                      : job.status === 'failed'
                      ? 'Gagal Diproses'
                      : 'Preview Target'}
                  </span>
                  {job.errorMessage && (
                    <p className="text-[11px] text-red-400 mt-1 max-w-xs">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2 Media Slots: Target Image & Motion Video */}
          <div className="grid grid-cols-2 gap-3">
            {/* Slot 1: Target Image */}
            <div className="bg-stone-50 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" /> Target Image
              </span>
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-950 flex items-center justify-center">
                {job.mediaUrl ? (
                  <img src={job.mediaUrl} alt="Target" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-stone-600" />
                )}
              </div>
              <span className="text-[11px] text-stone-700 dark:text-stone-300 truncate w-full mt-2 font-mono">
                {job.mediaName || 'target.jpg'}
              </span>
            </div>

            {/* Slot 2: Motion Video */}
            <div className="bg-stone-50 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <VideoIcon className="w-3.5 h-3.5 text-purple-500" /> Video Referensi Gerak
              </span>
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-950 flex items-center justify-center">
                {job.motionVideoUrl ? (
                  <video src={job.motionVideoUrl} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-6 h-6 text-stone-500" />
                )}
              </div>
              <span className="text-[11px] text-stone-700 dark:text-stone-300 truncate w-full mt-2 font-mono">
                {job.motionVideoName || 'motion_reference.mp4'}
              </span>
            </div>
          </div>

          {/* Info Grid */}
          <div className="bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800/90 rounded-xl p-3.5 space-y-2 text-xs">
            {/* Status */}
            <div className="flex items-center justify-between py-1 border-b border-stone-200 dark:border-stone-800">
              <span className="text-stone-500 dark:text-stone-400">Status</span>
              <span
                className={`font-semibold capitalize px-2 py-0.5 rounded text-[11px] ${
                  job.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : job.status === 'processing'
                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse'
                    : job.status === 'queued'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                }`}
              >
                ● {job.status}
              </span>
            </div>

            {/* Account */}
            <div className="flex items-center justify-between py-1 border-b border-stone-200 dark:border-stone-800">
              <span className="text-stone-500 dark:text-stone-400">Akun RunningHub</span>
              <span className="font-mono text-stone-800 dark:text-stone-200 font-medium">
                {job.account || 'Auto Assign'}
              </span>
            </div>

            {/* Task ID */}
            {job.taskId && (
              <div className="flex items-center justify-between py-1 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 dark:text-stone-400">Task ID</span>
                <div className="flex items-center gap-1.5 font-mono text-amber-600 dark:text-amber-400">
                  <span>{job.taskId}</span>
                  <button
                    type="button"
                    onClick={handleCopyTaskId}
                    className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 rounded cursor-pointer"
                    title="Salin Task ID"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Duration */}
            <div className="flex items-center justify-between py-1">
              <span className="text-stone-500 dark:text-stone-400">Durasi Pengerjaan</span>
              <span className="font-mono text-stone-800 dark:text-stone-200">{job.duration || '--:--'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#171720]">
          {job.status === 'failed' && onRerun ? (
            <button
              type="button"
              onClick={() => {
                onRerun(job);
                onClose();
              }}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba Lagi (Re-run)</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
            {job.resultUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Video</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
