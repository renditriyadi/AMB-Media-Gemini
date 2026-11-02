import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, Image as ImageIcon, Video as VideoIcon, Camera, ImagePlus, Loader2, Download } from 'lucide-react';
import { AttachedMedia, ProviderAccount } from '../types';
import { safeFetchJson } from '../utils';

interface AddMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachMedia: (media: AttachedMedia) => void;
  activeProvider?: { id: 'kie' | 'roboneo' | 'galleri5' | 'runninghub' | 'weavy' | 'gemini'; name: string };
  weavyAccounts?: ProviderAccount[];
  roboneoAccounts?: ProviderAccount[];
  galleri5Accounts?: ProviderAccount[];
  kieAccounts?: ProviderAccount[];
  runninghubAccounts?: ProviderAccount[];
  mode?: 'video' | 'image';
  videoModel?: string;
  imageModel?: string;
  attachedMedia?: AttachedMedia[];
}

type ModalStep = 'select-type' | 'select-source' | 'tiktok';

export const AddMediaModal: React.FC<AddMediaModalProps> = ({
  isOpen,
  onClose,
  onAttachMedia,
  activeProvider = { id: 'weavy', name: 'Weavy' },
  weavyAccounts = [],
  roboneoAccounts = [],
  galleri5Accounts = [],
  kieAccounts = [],
  runninghubAccounts = [],
  mode = 'video',
  videoModel,
  imageModel,
  attachedMedia = [],
}) => {
  const isGemini = activeProvider.id === 'gemini';
  const isMiniMax = mode === 'video' && videoModel === 'MiniMax H3 Turbo Video';
  const isImageOnly = (mode === 'image' && !isGemini) || isMiniMax;

  // Track reference counts for Gemini
  const attachedImages = attachedMedia.filter(
    (m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i))
  );
  const attachedVideos = attachedMedia.filter(
    (m) => m.type === 'video' || m.name?.match(/\.(mp4|mov|webm)$/i)
  );
  const imageCount = attachedImages.length;
  const videoCount = attachedVideos.length;
  const isImageLimitReached = isGemini && imageCount >= 5;
  const isVideoLimitReached = isGemini && videoCount >= 1;

  const [step, setStep] = useState<ModalStep>('select-type');
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | 'tiktok'>('image');
  const [fileAccept, setFileAccept] = useState<string>(isImageOnly ? 'image/*' : 'image/*,video/*');

  useEffect(() => {
    setFileAccept(isImageOnly ? 'image/*' : 'image/*,video/*');
  }, [isImageOnly]);

  // TikTok import state
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [isImportingTikTok, setIsImportingTikTok] = useState(false);
  const [tiktokError, setTiktokError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const triggerFilePicker = (acceptType: string) => {
    const finalAccept = isImageOnly ? 'image/*' : acceptType;
    setFileAccept(finalAccept);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleSelectMediaType = (type: 'image' | 'video') => {
    if (isImageOnly && type !== 'image') return;

    if (isGemini) {
      if (type === 'image' && isImageLimitReached) {
        return;
      }
      if (type === 'video' && isVideoLimitReached) {
        return;
      }
    }

    setSelectedMediaType(type);
    if (type === 'image' || isImageOnly) {
      triggerFilePicker('image/*');
    } else {
      triggerFilePicker('video/*');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (rawFiles.length > 0) {
      let currentImgCount = imageCount;
      let currentVidCount = videoCount;
      let skippedCount = 0;

      rawFiles.forEach((file: File, index: number) => {
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 50) {
          alert(`Ukuran file ${file.name} (${fileSizeMB.toFixed(1)} MB) melebihi batas maksimal 50 MB. Silakan pilih file dengan ukuran di bawah 50 MB.`);
          return;
        }

        const isVideo = file.type.startsWith('video/');
        if (isImageOnly && isVideo) {
          alert(isMiniMax
            ? `File "${file.name}" adalah video. Model MiniMax H3 Turbo Video hanya mendukung file gambar. File video diabaikan.`
            : `File "${file.name}" adalah video. Hanya file gambar yang didukung saat ini.`
          );
          return;
        }

        // Gemini limit enforcement: Max 5 images, Max 1 video
        if (isGemini) {
          if (isVideo) {
            if (currentVidCount >= 1) {
              skippedCount++;
              return;
            }
            currentVidCount++;
          } else {
            if (currentImgCount >= 5) {
              skippedCount++;
              return;
            }
            currentImgCount++;
          }
        }

        const mediaType = isVideo ? 'video' : 'image';

        const objectUrl = URL.createObjectURL(file);
        const media: AttachedMedia = {
          id: `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
          type: mediaType,
          source: 'device',
          name: file.name,
          url: objectUrl,
          previewUrl: objectUrl,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          fileObject: file,
          isUploading: true,
          uploadProgress: 0,
        };

        if (isVideo) {
          const tempVid = document.createElement('video');
          tempVid.preload = 'metadata';
          tempVid.src = objectUrl;
          tempVid.onloadedmetadata = () => {
            if (tempVid.duration && !isNaN(tempVid.duration) && isFinite(tempVid.duration)) {
              media.durationSeconds = tempVid.duration;
            }
            onAttachMedia(media);
          };
          tempVid.onerror = () => {
            onAttachMedia(media);
          };
        } else {
          onAttachMedia(media);
        }
      });

      handleResetAndClose();
    }
    e.target.value = '';
  };

  const handleImportTikTok = async () => {
    if (!tiktokUrl.trim()) return;

    setIsImportingTikTok(true);
    setTiktokError('');

    try {
      // Find active token based on active provider
      let activeToken = '';
      if (activeProvider.id === 'runninghub') {
        const acc = runninghubAccounts.find((a) => a.isActive) || runninghubAccounts[0];
        activeToken = acc?.accessToken || acc?.refreshToken || acc?.idToken || acc?.email || '';
      } else if (activeProvider.id === 'roboneo') {
        const acc = roboneoAccounts.find((a) => a.isActive) || roboneoAccounts[0];
        activeToken = acc?.accessToken || acc?.refreshToken || '';
      } else if (activeProvider.id === 'galleri5') {
        const acc = galleri5Accounts.find((a) => a.isActive) || galleri5Accounts[0];
        activeToken = acc?.accessToken || acc?.refreshToken || '';
      } else if (activeProvider.id === 'kie') {
        const acc = kieAccounts.find((a) => a.isActive) || kieAccounts[0];
        activeToken = acc?.refreshToken || acc?.accessToken || '';
      } else {
        const acc = weavyAccounts.find((a) => a.isActive) || weavyAccounts[0];
        activeToken = acc?.refreshToken || acc?.accessToken || '';
      }

      const { ok, data } = await safeFetchJson('/api/tiktok-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktokUrl: tiktokUrl.trim(),
          providerId: activeProvider.id,
          accountToken: activeToken,
          allRefreshTokens: weavyAccounts.map((a) => a.refreshToken).filter(Boolean),
        }),
      });

      if (ok && data && data.success && data.url) {
        const media: AttachedMedia = {
          id: `media-${Date.now()}`,
          type: 'video',
          source: 'device',
          name: data.title ? `TikTok: ${data.title.slice(0, 32)}...` : 'TikTok Video',
          url: data.url,
          size: data.size || 'Video',
          fileObject: undefined,
          isUploading: false,
          uploadProgress: 100,
        };

        onAttachMedia(media);
        handleResetAndClose();
      } else {
        setTiktokError(data?.error || 'Gagal mengunduh video TikTok. Pastikan link publik & dapat diakses.');
      }
    } catch (err: any) {
      setTiktokError(err?.message || 'Terjadi kesalahan saat mengimpor video TikTok.');
    } finally {
      setIsImportingTikTok(false);
    }
  };

  const handleResetAndClose = () => {
    setStep('select-type');
    setTiktokUrl('');
    setTiktokError('');
    setIsImportingTikTok(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={handleResetAndClose} />

          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden z-10 border border-stone-200/80 dark:border-stone-800 transition-colors duration-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/80 dark:border-stone-800">
              {step !== 'select-type' ? (
                <button
                  onClick={() => setStep('select-type')}
                  disabled={isImportingTikTok}
                  className="flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>
                    {step === 'tiktok' ? 'Import TikTok Video' : `Add ${selectedMediaType === 'image' ? 'Image' : 'Video'}`}
                  </span>
                </button>
              ) : (
                <h3 className="font-serif-display text-base font-normal text-stone-900 dark:text-stone-100">
                  {isImageOnly ? 'Add Image' : 'Add Media'}
                </h3>
              )}

              <button
                onClick={handleResetAndClose}
                disabled={isImportingTikTok}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {step === 'select-type' ? (
                /* Step 1: Add Media Options */
                <div className="space-y-3 font-sans-body">
                  <button
                    onClick={() => handleSelectMediaType('image')}
                    className="w-full flex items-center justify-between p-4 bg-stone-50/80 dark:bg-stone-800/50 hover:bg-amber-50/60 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 hover:border-amber-200 dark:hover:border-amber-500/30 rounded-xl transition-all group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white dark:bg-stone-900 rounded-lg shadow-xs text-amber-600 dark:text-amber-400 border border-stone-100 dark:border-stone-800 group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-stone-900 dark:text-stone-100">Image</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 font-light">Upload an image</p>
                      </div>
                    </div>
                    <span className="text-stone-400 dark:text-stone-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-bold text-lg">›</span>
                  </button>

                  {!isImageOnly && (
                    <>
                      <button
                        onClick={() => handleSelectMediaType('video')}
                        className="w-full flex items-center justify-between p-4 bg-stone-50/80 dark:bg-stone-800/50 hover:bg-amber-50/60 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 hover:border-amber-200 dark:hover:border-amber-500/30 rounded-xl transition-all group text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white dark:bg-stone-900 rounded-lg shadow-xs text-amber-600 dark:text-amber-400 border border-stone-100 dark:border-stone-800 group-hover:scale-105 transition-transform">
                            <VideoIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-stone-900 dark:text-stone-100">Video</h4>
                            <p className="text-xs text-stone-500 dark:text-stone-400 font-light">Upload a video</p>
                          </div>
                        </div>
                        <span className="text-stone-400 dark:text-stone-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-bold text-lg">›</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedMediaType('tiktok');
                          setStep('tiktok');
                        }}
                        className="w-full flex items-center justify-between p-4 bg-stone-50/80 dark:bg-stone-800/50 hover:bg-amber-50/60 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 hover:border-amber-200 dark:hover:border-amber-500/30 rounded-xl transition-all group text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-stone-900 dark:bg-stone-950 rounded-lg shadow-xs text-white border border-stone-800 group-hover:scale-105 transition-transform flex items-center justify-center">
                            <img
                              src="https://www.tiktok.com/favicon.ico"
                              alt="TikTok"
                              className="w-5 h-5 object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                              <span>TikTok Video</span>
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20 uppercase tracking-wider">No Watermark</span>
                            </h4>
                            <p className="text-xs text-stone-500 dark:text-stone-400 font-light">Import & auto-upload from TikTok URL</p>
                          </div>
                        </div>
                        <span className="text-stone-400 dark:text-stone-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-bold text-lg">›</span>
                      </button>
                    </>
                  )}
                </div>
              ) : step === 'tiktok' ? (
                /* Step 3: TikTok Import Input */
                <div className="font-sans-body space-y-4">
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200/90 dark:border-stone-700/80 rounded-xl flex items-center gap-3">
                    <div className="p-2.5 bg-black rounded-lg shrink-0 border border-stone-800 shadow-xs">
                      <img
                        src="https://www.tiktok.com/favicon.ico"
                        alt="TikTok"
                        className="w-5 h-5 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">Video TikTok Tanpa Watermark</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug mt-0.5">
                        Otomatis di-download & di-upload ke <strong className="text-amber-600 dark:text-amber-400 font-semibold">{activeProvider?.name || 'Weavy'}</strong>.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                      Paste Link Video TikTok
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="url"
                        value={tiktokUrl}
                        onChange={(e) => {
                          setTiktokUrl(e.target.value);
                          setTiktokError('');
                        }}
                        placeholder="https://vt.tiktok.com/ZS4QqwaMk/"
                        disabled={isImportingTikTok}
                        className="w-full px-3.5 py-2.5 pr-20 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setTiktokUrl(text);
                              setTiktokError('');
                            }
                          } catch (e) {}
                        }}
                        disabled={isImportingTikTok}
                        className="absolute right-2 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Paste
                      </button>
                    </div>
                  </div>

                  {tiktokError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/80 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                      {tiktokError}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('select-type');
                        setTiktokError('');
                      }}
                      disabled={isImportingTikTok}
                      className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleImportTikTok}
                      disabled={!tiktokUrl.trim() || isImportingTikTok}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium text-xs rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isImportingTikTok ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>Mengimpor & Upload...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 shrink-0" />
                          <span>Import Video TikTok</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2: Source selection (Choose from Gallery / Take a Photo) */
                <div className="font-sans-body">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={() => triggerFilePicker(isImageOnly ? 'image/*' : (selectedMediaType === 'video' ? 'video/*' : 'image/*'))}
                      className="flex flex-col items-center justify-center p-6 bg-stone-50 dark:bg-stone-800/50 hover:bg-amber-50/80 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 hover:border-amber-300 rounded-xl transition-all text-center group cursor-pointer"
                    >
                      <div className="p-4 bg-white dark:bg-stone-900 rounded-lg shadow-xs text-stone-700 dark:text-stone-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:scale-110 transition-all mb-3 border border-stone-100 dark:border-stone-800">
                        <ImagePlus className="w-7 h-7" />
                      </div>
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">Choose from Gallery</span>
                    </button>

                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-6 bg-stone-50 dark:bg-stone-800/50 hover:bg-amber-50/80 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 hover:border-amber-300 rounded-xl transition-all text-center group cursor-pointer"
                    >
                      <div className="p-4 bg-white dark:bg-stone-900 rounded-lg shadow-xs text-stone-700 dark:text-stone-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:scale-110 transition-all mb-3 border border-stone-100 dark:border-stone-800">
                        <Camera className="w-7 h-7" />
                      </div>
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">Take a Photo</span>
                    </button>
                  </div>

                  <div className="p-3 bg-stone-50 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800 rounded-lg text-center">
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Supported formats: <span className="font-medium text-stone-700 dark:text-stone-300">{isImageOnly ? 'JPG, PNG, WEBP' : 'JPG, PNG, WEBP, MP4'}</span>
                    </p>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">Max size: 50MB</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

