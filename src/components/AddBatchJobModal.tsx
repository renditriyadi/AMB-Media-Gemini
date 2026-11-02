import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Film,
  Loader2,
} from 'lucide-react';
import { BatchJobItem } from '../types';

interface AddBatchJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddJobs: (newJobs: Omit<BatchJobItem, 'id' | 'order' | 'status' | 'createdAt'>[]) => void;
}

interface StagedJob {
  id: string;
  imageFile?: File;
  imageUrl: string;
  imageDataUrl?: string;
  imageName: string;
  videoFile?: File;
  videoUrl?: string;
  videoName?: string;
  prompt: string;
}

export const AddBatchJobModal: React.FC<AddBatchJobModalProps> = ({
  isOpen,
  onClose,
  onAddJobs,
}) => {
  const [stagedJobs, setStagedJobs] = useState<StagedJob[]>([]);
  const [globalMotionVideo, setGlobalMotionVideo] = useState<{ url: string; name: string; file?: File } | null>(null);
  const [globalPrompt, setGlobalPrompt] = useState<string>('');
  const [useGlobalPrompt, setUseGlobalPrompt] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const motionVideoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const validImageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
    );

    if (validImageFiles.length === 0) {
      console.warn('[AddBatchModal ⚠️] Tidak ada file gambar yang valid.');
      setErrorMsg('Harap pilih file gambar (JPG, PNG, WebP).');
      return;
    }

    console.log(`[AddBatchModal 📥 Input Gambar] Memilih ${validImageFiles.length} file gambar:`, validImageFiles.map(f => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`));

    setIsProcessingUpload(true);
    setUploadProgressText(`Memproses ${validImageFiles.length} file gambar...`);
    setUploadProgressPercent(10);

    const newStaged: StagedJob[] = [];

    for (let i = 0; i < validImageFiles.length; i++) {
      const file = validImageFiles[i];
      setUploadProgressText(`Membaca gambar (${i + 1}/${validImageFiles.length}): ${file.name}...`);
      
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(URL.createObjectURL(file));
        reader.readAsDataURL(file);
      });

      const blobUrl = URL.createObjectURL(file);
      console.log(`[AddBatchModal 🖼️ File #${i + 1}/${validImageFiles.length}] Menyiapkan ${file.name}...`);

      newStaged.push({
        id: `staged_${Date.now()}_${idxOrRand()}_${i}`,
        imageFile: file,
        imageUrl: blobUrl,
        imageDataUrl: dataUrl,
        imageName: file.name,
        videoFile: globalMotionVideo?.file,
        videoUrl: globalMotionVideo?.url || '',
        videoName: globalMotionVideo?.name || '',
        prompt: useGlobalPrompt ? globalPrompt : '',
      });

      const percent = Math.min(95, Math.round(10 + ((i + 1) / validImageFiles.length) * 85));
      setUploadProgressPercent(percent);
    }

    setStagedJobs((prev) => [...prev, ...newStaged]);
    setUploadProgressPercent(100);
    setUploadProgressText(`Berhasil memuat ${newStaged.length} gambar ke antrean!`);
    console.log(`[AddBatchModal ✅ Berhasil] Total ${newStaged.length} gambar siap ditambahkan.`);

    setTimeout(() => {
      setIsProcessingUpload(false);
      setUploadProgressPercent(0);
      setUploadProgressText('');
    }, 400);
  };

  function idxOrRand() {
    return Math.random().toString(36).substring(2, 7);
  }

  const handleGlobalMotionVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
      setErrorMsg('File referensi gerak harus berupa video (MP4, WebM, MOV).');
      return;
    }
    console.log(`[AddBatchModal 🎬 Video Gerak Dipilih] ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    const blobUrl = URL.createObjectURL(file);
    const videoData = { url: blobUrl, name: file.name, file };
    setGlobalMotionVideo(videoData);

    // Apply to all currently staged jobs that don't have a specific video
    setStagedJobs((prev) =>
      prev.map((job) => ({
        ...job,
        videoFile: job.videoFile || file,
        videoUrl: job.videoUrl || videoData.url,
        videoName: job.videoName || videoData.name,
      }))
    );
  };

  const removeStagedJob = (id: string) => {
    setStagedJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const updateJobPrompt = (id: string, promptText: string) => {
    setStagedJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, prompt: promptText } : j))
    );
  };

  const handleIndividualVideoChange = (id: string, file: File) => {
    if (!file.type.startsWith('video/')) return;
    const blobUrl = URL.createObjectURL(file);
    setStagedJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, videoFile: file, videoUrl: blobUrl, videoName: file.name }
          : j
      )
    );
  };

  const handleSubmit = async () => {
    if (stagedJobs.length === 0) {
      setErrorMsg('Tambahkan minimal 1 gambar untuk membuat antrean Batch.');
      return;
    }

    console.log(`[AddBatchModal 🚀 Submit] Menambahkan ${stagedJobs.length} job ke antrean Batch utama.`);

    const processedJobs: Omit<BatchJobItem, 'id' | 'order' | 'status' | 'createdAt'>[] = [];

    for (const job of stagedJobs) {
      const finalVideoFile = job.videoFile || globalMotionVideo?.file;
      const finalVideoUrl = job.videoUrl || globalMotionVideo?.url || '';
      const finalVideoName = job.videoName || globalMotionVideo?.name || 'motion_reference.mp4';
      const finalPrompt = useGlobalPrompt ? globalPrompt : job.prompt;

      processedJobs.push({
        mediaUrl: job.imageUrl,
        mediaType: 'image',
        mediaName: job.imageName,
        imageFile: job.imageFile,
        imageDataUrl: job.imageDataUrl,
        motionVideoUrl: finalVideoUrl,
        motionVideoName: finalVideoName,
        motionVideoFile: finalVideoFile,
        prompt: finalPrompt,
        aspectRatio: '9:16 (Vertical)',
        model: 'Motion Control AmbMedia 1080HD',
      });
    }

    onAddJobs(processedJobs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#14141A] border border-stone-800 text-stone-100 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-[#171720]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-display text-base font-semibold text-stone-100">
                Add Jobs to Batch Queue
              </h3>
              <p className="text-xs text-stone-400">
                Unggah banyak gambar sekaligus dan tetapkan video gerakan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Dropzone for Input Images */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center justify-between">
              <span>1. Gambar Input ({stagedJobs.length} Dipilih)</span>
              <span className="text-stone-500 font-normal normal-case">Dapat memilih multiple foto sekaligus</span>
            </label>

            {/* Visual Upload Progress Bar */}
            {isProcessingUpload && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    {uploadProgressText}
                  </span>
                  <span className="font-mono">{uploadProgressPercent}%</span>
                </div>
                <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-1.5 transition-all duration-150 rounded-full"
                    style={{ width: `${uploadProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleImageFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-stone-700/80 bg-stone-900/40 hover:border-amber-500/50 hover:bg-stone-900/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageFiles(e.target.files)}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/25">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-200">
                    Klik untuk memilih atau drag & drop banyak foto di sini
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Mendukung JPG, PNG, WEBP hingga puluhan gambar sekaligus
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Motion Reference Video (Global) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center justify-between">
              <span>2. Video Referensi Gerak (Motion Video)</span>
              <span className="text-amber-400 font-normal normal-case text-[11px]">Wajib untuk Motion Control</span>
            </label>

            <div className="flex items-center gap-3 p-3 bg-stone-900/80 border border-stone-800 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-200 truncate">
                  {globalMotionVideo ? globalMotionVideo.name : 'Belum ada video gerakan global'}
                </p>
                <p className="text-[11px] text-stone-500">
                  {globalMotionVideo
                    ? 'Video ini akan dipakai sebagai gerakan acuan untuk semua gambar'
                    : 'Pilih 1 video gerakan yang akan diterapkan ke batch ini'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => motionVideoInputRef.current?.click()}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {globalMotionVideo ? 'Ganti Video' : 'Pilih Video'}
              </button>
              <input
                ref={motionVideoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleGlobalMotionVideoChange}
              />
            </div>
          </div>

          {/* Section 3: Global Prompt Setting (Optional) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                3. Pengaturan Prompt
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGlobalPrompt}
                  onChange={(e) => setUseGlobalPrompt(e.target.checked)}
                  className="rounded border-stone-700 text-amber-500 focus:ring-amber-500"
                />
                <span>Gunakan 1 prompt seragam untuk semua</span>
              </label>
            </div>

            {useGlobalPrompt ? (
              <textarea
                value={globalPrompt}
                onChange={(e) => setGlobalPrompt(e.target.value)}
                placeholder="Tulis deskripsi atau instruksi gerak untuk semua gambar..."
                rows={2}
                className="w-full bg-stone-900/90 border border-stone-700/80 rounded-lg p-3 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
              />
            ) : (
              <p className="text-xs text-stone-500 italic">
                Mode: Tanpa prompt / Prompt dapat diisi opsional pada masing-masing item di bawah.
              </p>
            )}
          </div>

          {/* Section 4: Staged Jobs Preview List */}
          {stagedJobs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Daftar Gambar Siap Masuk Queue ({stagedJobs.length})</span>
                <button
                  type="button"
                  onClick={() => setStagedJobs([])}
                  className="text-red-400 hover:underline cursor-pointer"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {stagedJobs.map((job, idx) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-2.5 bg-stone-900/60 border border-stone-800 rounded-lg hover:border-stone-700 transition-colors"
                  >
                    <span className="text-xs font-mono text-stone-500 w-5">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    {job.imageUrl ? (
                      <img
                        src={job.imageUrl}
                        alt={job.imageName}
                        className="w-10 h-10 rounded-md object-cover bg-stone-800 shrink-0 border border-stone-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-stone-800 shrink-0 border border-stone-700 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-stone-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-200 truncate">
                        {job.imageName}
                      </p>
                      {!useGlobalPrompt && (
                        <input
                          type="text"
                          value={job.prompt}
                          onChange={(e) => updateJobPrompt(job.id, e.target.value)}
                          placeholder="Prompt opsional..."
                          className="w-full bg-stone-950/70 border border-stone-800 rounded px-2 py-0.5 text-[11px] text-stone-300 mt-1 placeholder:text-stone-600 focus:outline-none focus:border-amber-500/50"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStagedJob(job.id)}
                      className="p-1.5 text-stone-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-800 bg-[#171720]">
          <span className="text-xs text-stone-400 font-mono">
            {stagedJobs.length} jobs siap ditambahkan
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={stagedJobs.length === 0}
              onClick={handleSubmit}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tambahkan ke Queue</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
