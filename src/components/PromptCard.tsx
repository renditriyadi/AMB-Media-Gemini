import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  AtSign,
  UploadCloud,
  Eye,
} from 'lucide-react';
import { GenerationSettings, AttachedMedia } from '../types';
import { resolveActiveProvider } from '../lib/provider';

export type WireframeGenState = 'idle' | 'processing' | 'completed' | 'failed';

export interface TaggedMedia extends AttachedMedia {
  tag: string;
}

const getActiveProviderDetails = (
  settings: GenerationSettings,
  activeProviderProp?: { id: string; name: string }
) => {
  return resolveActiveProvider(settings, undefined, activeProviderProp?.id);
};

interface PromptCardProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  settings: GenerationSettings;
  activeProvider?: { id: 'kie' | 'roboneo' | 'galleri5' | 'weavy' | 'runninghub' | 'gemini' | 'flow'; name: string };
  attachedMedia: AttachedMedia[];
  onRemoveMedia: (id: string) => void;
  onRetryMediaUpload?: (id: string) => void;
  onAttachMedia?: (media: AttachedMedia) => void;
  onOpenAddMedia: () => void;
  onOpenSettings: () => void;
  onGenerate: () => void;
  genState: WireframeGenState;
  isSubmittingTask?: boolean;
  taskId?: string;
  timerString?: string;
  generationProgress?: number;
  onResetOrRetry?: () => void;
  onSimulateState?: (state: WireframeGenState) => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onPromptChange,
  settings,
  activeProvider,
  attachedMedia,
  onRemoveMedia,
  onRetryMediaUpload,
  onAttachMedia,
  onOpenAddMedia,
  onOpenSettings,
  onGenerate,
  genState,
  isSubmittingTask = false,
  taskId = 'task_8f3a7d2e6c1b',
  timerString = '00:32',
  generationProgress = 25,
  onResetOrRetry,
  onSimulateState,
}) => {
  const isVideo = settings.mode === 'video';
  const activeProviderDetails = useMemo(
    () => getActiveProviderDetails(settings, activeProvider),
    [settings, activeProvider]
  );
  const isKlingMotion = isVideo && (settings.videoModel === 'Motion Control' || (settings.videoModel as string).includes('Motion Control') || settings.videoModel === 'Kling 3.0 Pro Motion Control' || settings.videoModel === 'Kling 2.6 Motion Control' || settings.videoModel === 'Kling 2.6 Motion Control Standar' || settings.videoModel === 'Galleri5 Video Studio');
  const isMiniMax = isVideo && settings.videoModel === 'MiniMax H3 Turbo Video';
  const isGemini = activeProviderDetails.id === 'gemini';

  const imageCount = attachedMedia.filter((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)) || m.url?.match(/\.(jpg|jpeg|png|webp|gif)/i)).length;
  const videoCount = attachedMedia.filter((m) => m.type === 'video' || m.name?.match(/\.(mp4|mov|webm)$/i) || m.url?.match(/\.(mp4|mov|webm)/i)).length;
  const hasImage = imageCount > 0;
  const hasVideo = videoCount > 0;

  const isAnyMediaUploading = attachedMedia.some((m) => m.isUploading);
  const isAnyMediaError = attachedMedia.some((m) => !!m.uploadError);

  const isImageUnavailable = !isVideo && settings.imageModel === '-';

  const isGenerateDisabled = isImageUnavailable
    ? true
    : isKlingMotion
    ? (isAnyMediaUploading || isAnyMediaError)
    : isMiniMax
    ? ((!hasImage && !prompt.trim()) || isAnyMediaUploading || isAnyMediaError)
    : (isGemini && (hasImage || hasVideo))
    ? (isAnyMediaUploading || isAnyMediaError)
    : (!prompt.trim() || isAnyMediaUploading || isAnyMediaError);

  const uploadingMedia = attachedMedia.filter((m) => m.isUploading);
  const avgUploadProgress =
    uploadingMedia.length > 0
      ? Math.round(
          uploadingMedia.reduce((acc, m) => acc + (m.uploadProgress || 0), 0) /
            uploadingMedia.length
        )
      : 0;

  // Compute tag names for attached media (@image1, @image2, @video1, etc)
  const taggedMediaList = useMemo<TaggedMedia[]>(() => {
    let imgCount = 0;
    let vidCount = 0;
    let fileCount = 0;
    return attachedMedia.map((m) => {
      let tag = '';
      if (m.type === 'video') {
        vidCount++;
        tag = `@video${vidCount}`;
      } else if (m.type === 'image') {
        imgCount++;
        tag = `@image${imgCount}`;
      } else {
        fileCount++;
        tag = `@file${fileCount}`;
      }
      return { ...m, tag };
    });
  }, [attachedMedia]);

  // Hover media preview state
  const [hoveredMediaId, setHoveredMediaId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Mention popup state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const lastPasteTimestampRef = useRef<number>(0);

  // Process files from Paste or Drag & Drop
  const processIncomingFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0 || !onAttachMedia) return;

    const fileArray = Array.from(files);
    let curImgCount = imageCount;
    let curVidCount = videoCount;
    let skippedCount = 0;

    fileArray.forEach((file, index) => {
      const isVideoFile = file.type.startsWith('video/');
      const isImageFile = file.type.startsWith('image/');

      if (!isImageFile && !isVideoFile) {
        return;
      }

      if (isMiniMax && isVideoFile) {
        alert(`Model MiniMax H3 Turbo Video hanya mendukung file gambar. File video "${file.name || 'clipboard'}" diabaikan.`);
        return;
      }

      if (isGemini) {
        if (isVideoFile) {
          if (curVidCount >= 1) {
            skippedCount++;
            return;
          }
          curVidCount++;
        } else {
          if (curImgCount >= 5) {
            skippedCount++;
            return;
          }
          curImgCount++;
        }
      }

      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        alert(`Ukuran file ${file.name || 'clipboard'} (${fileSizeMB.toFixed(1)} MB) melebihi batas maksimal 50 MB.`);
        return;
      }

      const mediaType = isVideoFile ? 'video' : 'image';
      const ext = isVideoFile ? 'mp4' : (file.type.split('/')[1] || 'png');
      const timeTag = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      const fallbackName = `Pasted_${mediaType === 'video' ? 'Video' : 'Image'}_${timeTag}.${ext}`;
      const finalName = (!file.name || file.name === 'image.png' || file.name === 'blob') ? fallbackName : file.name;

      const objectUrl = URL.createObjectURL(file);
      const newMedia: AttachedMedia = {
        id: `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        type: mediaType,
        source: 'device',
        name: finalName,
        url: objectUrl,
        previewUrl: objectUrl,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        fileObject: file,
        isUploading: true,
        uploadProgress: 0,
      };

      if (isVideoFile) {
        const tempVid = document.createElement('video');
        tempVid.preload = 'metadata';
        tempVid.src = objectUrl;
        tempVid.onloadedmetadata = () => {
          if (tempVid.duration && !isNaN(tempVid.duration) && isFinite(tempVid.duration)) {
            newMedia.durationSeconds = tempVid.duration;
          }
          onAttachMedia(newMedia);
        };
        tempVid.onerror = () => {
          onAttachMedia(newMedia);
        };
      } else {
        onAttachMedia(newMedia);
      }
    });
  };

  // Clipboard Paste Handler (Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    // Prevent double firing when event bubbles
    e.stopPropagation();

    // Debounce to prevent duplicate triggers within 400ms
    const now = Date.now();
    if (now - lastPasteTimestampRef.current < 400) {
      return;
    }

    const mediaFiles: File[] = [];
    const seenSignatures = new Set<string>();

    // 1. Check clipboard items
    if (clipboard.items && clipboard.items.length > 0) {
      for (let i = 0; i < clipboard.items.length; i++) {
        const item = clipboard.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
            const sig = `${file.name}_${file.size}_${file.type}`;
            if (!seenSignatures.has(sig)) {
              seenSignatures.add(sig);
              mediaFiles.push(file);
            }
          }
        }
      }
    }

    // 2. Fallback to clipboard files only if items had no files
    if (mediaFiles.length === 0 && clipboard.files && clipboard.files.length > 0) {
      for (let i = 0; i < clipboard.files.length; i++) {
        const file = clipboard.files[i];
        if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
          const sig = `${file.name}_${file.size}_${file.type}`;
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            mediaFiles.push(file);
          }
        }
      }
    }

    if (mediaFiles.length > 0) {
      e.preventDefault();
      lastPasteTimestampRef.current = now;
      processIncomingFiles(mediaFiles);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  // Filter tags matching current mentionQuery
  const filteredTags = useMemo(() => {
    if (!mentionQuery) return taggedMediaList;
    const q = mentionQuery.toLowerCase();
    return taggedMediaList.filter(
      (item) => item.tag.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    );
  }, [taggedMediaList, mentionQuery]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowMentionPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateMentionState = (text: string, cursorIndex: number | null) => {
    if (cursorIndex === null) {
      setShowMentionPopup(false);
      return;
    }

    const textBeforeCursor = text.slice(0, cursorIndex);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there are no whitespace characters between '@' and cursor
      if (!/\s/.test(textAfterAt)) {
        setMentionStartIndex(lastAtIndex);
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentionPopup(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowMentionPopup(false);
  };

  const insertTag = (tagToInsert: string) => {
    if (mentionStartIndex < 0) return;
    const text = prompt;
    const cursor = textareaRef.current?.selectionStart ?? text.length;

    const beforeAt = text.slice(0, mentionStartIndex);
    const afterCursor = text.slice(cursor);

    const newPrompt = `${beforeAt}${tagToInsert} ${afterCursor}`;
    onPromptChange(newPrompt);
    setShowMentionPopup(false);

    // Re-focus and set cursor position after inserted tag
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionStartIndex + tagToInsert.length + 1;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onPromptChange(newValue);
    updateMentionState(newValue, e.target.selectionStart);
  };

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    updateMentionState(target.value, target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';

    if (isCtrlEnter) {
      e.preventDefault();
      setShowMentionPopup(false);
      if (!isGenerateDisabled && genState === 'idle' && !isSubmittingTask) {
        onGenerate();
      }
      return;
    }

    if (showMentionPopup) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredTags.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filteredTags.length);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredTags.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + filteredTags.length) % filteredTags.length);
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredTags.length > 0 && filteredTags[selectedIndex]) {
          e.preventDefault();
          insertTag(filteredTags[selectedIndex].tag);
        } else if (attachedMedia.length === 0) {
          setShowMentionPopup(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopup(false);
      }
    }
  };

  return (
    <div
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative bg-[#FAF9F6] dark:bg-[#141418] rounded-xl border ${
        isDraggingOver
          ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5'
          : 'border-stone-300 dark:border-white/10'
      } p-5 transition-all duration-200 space-y-3 dark:hover:border-white/15`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-amber-500/10 dark:bg-amber-500/15 backdrop-blur-[1px] rounded-xl border-2 border-dashed border-amber-500 flex flex-col items-center justify-center z-40 pointer-events-none transition-all">
          <UploadCloud className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            Lepaskan gambar atau video di sini
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
            File akan otomatis dilampirkan & diunggah
          </p>
        </div>
      )}

      {/* Label */}
      <div className="flex items-center justify-between pb-1">
        <label htmlFor="prompt-textarea" className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider font-sans-body flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Prompt</span>
        </label>
        {isGemini && isVideo && (hasImage || hasVideo) && (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-in fade-in">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>Gemini Image to Video</span>
          </span>
        )}
      </div>

      {/* Attached media previews with interactive Hover Pratinjau */}
      {taggedMediaList.length > 0 && (
        <div className="space-y-1.5 p-2 bg-stone-50 dark:bg-[#1B1B22] rounded-lg border border-stone-200/80 dark:border-white/8">
          {isVideo && settings.videoModel === 'SeeDance 2.5' && (
            <div className="flex items-center justify-between text-[11px] font-medium text-amber-700 dark:text-amber-400 px-1 pt-0.5">
              <span>Gambar Referensi</span>
              <span className="font-mono bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded-md">
                {taggedMediaList.filter((m) => m.type === 'image').length} / 5 Max
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {taggedMediaList.map((media) => {
              const isHovered = hoveredMediaId === media.id;
              const displayUrl =
                media.previewUrl ||
                (media.url &&
                (media.url.startsWith('http://') ||
                  media.url.startsWith('https://') ||
                  media.url.startsWith('/') ||
                  media.url.startsWith('blob:') ||
                  media.url.startsWith('data:'))
                  ? media.url
                  : '') ||
                (media.fileObject ? URL.createObjectURL(media.fileObject) : '');

              return (
                <div
                  key={media.id}
                  onMouseEnter={() => setHoveredMediaId(media.id)}
                  onMouseLeave={() => setHoveredMediaId(null)}
                  className={`relative group flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-md border text-xs transition-all ${
                    media.isUploading
                      ? 'bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-700/50'
                      : media.uploadError
                      ? 'bg-rose-50/60 dark:bg-rose-500/10 border-rose-200 dark:border-rose-700/50'
                      : 'bg-white dark:bg-[#141418] border-stone-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/60'
                  }`}
                >
                  {/* Floating Clean Hover Pratinjau (Muncul ke bawah, murni gambar/video tanpa bungkus teks) */}
                  {isHovered && displayUrl && (
                    <div className="absolute top-full mt-2 left-0 z-50 pointer-events-none rounded-xl overflow-hidden shadow-2xl border border-stone-300 dark:border-white/20 bg-black/90 animate-in fade-in zoom-in-95 duration-150">
                      {media.type === 'video' ? (
                        <video
                          src={displayUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-auto h-auto max-w-[260px] sm:max-w-[300px] max-h-60 object-contain rounded-xl block"
                        />
                      ) : (
                        <img
                          src={displayUrl}
                          alt={media.name}
                          referrerPolicy="no-referrer"
                          className="w-auto h-auto max-w-[260px] sm:max-w-[300px] max-h-60 object-contain rounded-xl block"
                        />
                      )}
                    </div>
                  )}

                  {media.isUploading ? (
                    <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
                  ) : media.uploadError ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : media.type === 'image' ? (
                    displayUrl ? (
                      <div className="relative cursor-pointer w-6 h-6 shrink-0 rounded overflow-hidden border border-stone-200 dark:border-white/10 group-hover:ring-2 group-hover:ring-amber-500/50 transition-all bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                        <img
                          src={displayUrl}
                          alt={media.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-img-icon') as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                        <ImageIcon className="fallback-img-icon w-3.5 h-3.5 text-amber-600 dark:text-amber-400 hidden" />
                      </div>
                    ) : (
                      <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )
                  ) : media.type === 'video' ? (
                    displayUrl ? (
                      <div className="w-6 h-6 rounded bg-stone-900 flex items-center justify-center text-white shrink-0 group-hover:ring-2 group-hover:ring-amber-500/50 transition-all cursor-pointer">
                        <VideoIcon className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                    ) : (
                      <VideoIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )
                  ) : (
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}

                  <span className="font-medium text-stone-700 dark:text-stone-200 max-w-[120px] truncate" title={media.name}>
                    {media.name}
                  </span>

                  {media.isUploading && (
                    <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-md">
                      {media.uploadProgress || 0}%
                    </span>
                  )}

                  {media.uploadError && onRetryMediaUpload && (
                    <button
                      type="button"
                      onClick={() => onRetryMediaUpload(media.id)}
                      className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                      title={media.uploadError}
                    >
                      Ulangi
                    </button>
                  )}

                  {!media.isUploading && !media.uploadError && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveMedia(media.id)}
                    className="p-1 text-stone-400 hover:text-rose-500 rounded-md transition-colors ml-0.5 cursor-pointer"
                    title="Hapus media"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Textarea Input with Mention Popup */}
      <div className="relative">
        {/* Tag Mention Popup */}
        {showMentionPopup && (
          <div
            ref={popupRef}
            className="absolute bottom-full mb-2 left-0 z-30 w-72 max-w-full bg-white dark:bg-[#18181F] border border-stone-200 dark:border-white/15 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-150"
          >
            <div className="px-3 py-1.5 bg-stone-50 dark:bg-[#20202A] border-b border-stone-100 dark:border-white/10 flex items-center justify-between text-[11px] font-semibold text-stone-600 dark:text-stone-300">
              <span className="flex items-center gap-1">
                <AtSign className="w-3 h-3 text-amber-500" />
                <span>Pilih Tag Media</span>
              </span>
              <span className="text-[10px] font-mono text-stone-400">↑↓ Enter</span>
            </div>

            {filteredTags.length > 0 ? (
              <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
                {filteredTags.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => insertTag(item.tag)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 font-medium'
                          : 'hover:bg-stone-100 dark:hover:bg-white/5 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {item.url && item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-7 h-7 rounded object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                        />
                      ) : item.type === 'video' ? (
                        <div className="w-7 h-7 rounded bg-stone-900 flex items-center justify-center text-amber-400 shrink-0">
                          <VideoIcon className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{item.tag}</span>
                          <span className="text-[10px] text-stone-400 font-mono">({item.type})</span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{item.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-stone-500 dark:text-stone-400 space-y-1">
                <p className="font-medium text-stone-700 dark:text-stone-300">
                  {attachedMedia.length === 0 ? 'Belum Ada Media Diunggah' : 'Tidak Ada Tag Cocok'}
                </p>
                <p className="text-[11px] text-stone-400">
                  {attachedMedia.length === 0
                    ? 'Unggah foto atau video via tombol (+), Drag & Drop, atau Paste (Ctrl+V) untuk menggunakan tag @image1, @video1, dll.'
                    : `Cari tag seperti ${taggedMediaList[0]?.tag || '@image1'}`}
                </p>
              </div>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          id="prompt-textarea"
          rows={4}
          value={prompt}
          onChange={handleTextareaChange}
          onSelect={handleTextareaSelect}
          onClick={handleTextareaSelect}
          onKeyDown={handleKeyDown}
          placeholder={
            isVideo
              ? (isGemini
                  ? (hasImage || hasVideo
                      ? 'Deskripsikan aksi gerakan / animasi video ini (opsional, kosongkan untuk auto-animasi sinematik)...'
                      : 'Tulis prompt video Gemini (bisa lampirkan hingga 5 foto referensi & 1 video referensi via tombol + / paste)...')
                  : settings.videoModel === 'MiniMax H3 Turbo Video'
                  ? 'Describe the video you want to generate (Text-to-Video atau lampirkan foto untuk Image-to-Video)...'
                  : 'Describe the video you want to generate (Bisa paste gambar/video langsung)...')
              : (settings.imageModel === 'ChatGPT Images 2.0 Edit' || settings.imageModel === 'GPT Image 2.5' || settings.imageModel === 'Nano Banana Pro' || (settings.imageModel as string) === 'Nano Banana 2' || settings.imageModel === 'GPT Image 2 (Image-to-Image)' || settings.imageModel === 'Seedream 4.0 Edit')
              ? 'Tulis instruksi edit gambar & paste (Ctrl+V) atau unggah gambar via tombol +...'
              : 'Describe the image you want to generate...'
          }
          disabled={isSubmittingTask}
          className="w-full text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none font-sans-body leading-relaxed"
        />
      </div>

      {/* Wireframe Interactive Buttons Row */}
      <div className="pt-3 border-t border-stone-200/80 dark:border-white/10 space-y-2">
        <div className="flex items-center gap-2">
          {/* Plus Button */}
          <button
            type="button"
            onClick={onOpenAddMedia}
            disabled={isSubmittingTask}
            className="p-3 bg-stone-100 dark:bg-[#1C1C24] hover:bg-stone-200 dark:hover:bg-[#252530] text-stone-700 dark:text-stone-200 rounded-lg border border-stone-200/80 dark:border-white/10 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Tambah Media"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            disabled={isSubmittingTask}
            className="flex items-center gap-2 px-3.5 py-3 bg-stone-100 dark:bg-[#1C1C24] hover:bg-stone-200 dark:hover:bg-[#252530] text-stone-700 dark:text-stone-200 font-medium text-xs rounded-lg border border-stone-200/80 dark:border-white/10 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            <span>Settings</span>
          </button>

          {/* Main Action Button */}
          {isSubmittingTask ? (
            <button
              type="button"
              disabled
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 dark:bg-amber-500 text-white dark:text-stone-950 font-bold text-xs rounded-lg animate-pulse cursor-not-allowed opacity-95"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mendaftarkan Task...</span>
            </button>
          ) : genState === 'idle' && isAnyMediaUploading ? (
            <button
              type="button"
              disabled
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600/90 dark:bg-amber-500/90 text-white dark:text-stone-950 font-bold text-xs rounded-lg cursor-not-allowed opacity-90 animate-pulse"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mengunggah Media ({avgUploadProgress}%)...</span>
            </button>
          ) : genState === 'idle' && isAnyMediaError ? (
            <button
              type="button"
              disabled
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 text-white font-semibold text-xs rounded-lg cursor-not-allowed"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Gagal Mengunggah Media</span>
            </button>
          ) : genState === 'idle' ? (
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerateDisabled}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-stone-950 font-bold text-xs rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{isImageUnavailable ? 'Model Tidak Tersedia (-)' : isVideo ? 'Generate Video' : 'Generate Image'}</span>
            </button>
          ) : genState === 'processing' ? (
            <button
              type="button"
              disabled
              className="flex-1 flex items-center justify-between px-4 py-3 bg-amber-600 dark:bg-amber-500 text-white dark:text-stone-950 font-bold text-xs rounded-lg animate-pulse"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </div>
              <span className="font-mono text-amber-100 dark:text-stone-900 font-bold">{timerString}</span>
            </button>
          ) : genState === 'completed' ? (
            <button
              type="button"
              onClick={onResetOrRetry}
              className="flex-1 flex items-center justify-between px-4 py-3 bg-stone-100 dark:bg-[#1C1C24] text-stone-900 dark:text-stone-100 border border-stone-200/80 dark:border-white/10 font-semibold text-xs rounded-lg hover:bg-stone-200 dark:hover:bg-[#252530] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Selesai</span>
              </div>
              <span className="font-mono text-stone-600 dark:text-stone-400">{timerString}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onResetOrRetry}
              className="flex-1 flex items-center justify-between px-4 py-3 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-semibold text-xs rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Failed</span>
              </div>
              <span className="font-mono text-rose-800 dark:text-rose-300">{timerString}</span>
            </button>
          )}
        </div>

        {/* Active Provider footer */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 font-mono pt-1.5 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active Provider Indicator - Direct icon & text without wrapping box */}
            <div
              className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300 text-[11px] font-sans font-medium"
              title={`Active Provider: ${activeProviderDetails.name}`}
            >
              {activeProviderDetails.id === 'weavy' ? (
                <>
                  <img
                    src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg"
                    alt="Weavy"
                    className="w-3.5 h-3.5 object-contain shrink-0 dark:hidden"
                    referrerPolicy="no-referrer"
                  />
                  <img
                    src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
                    alt="Weavy"
                    className="w-3.5 h-3.5 object-contain shrink-0 hidden dark:block"
                    referrerPolicy="no-referrer"
                  />
                </>
              ) : activeProviderDetails.id === 'galleri5' ? (
                <>
                  <img
                    src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
                    alt="Galleri5"
                    className="w-3.5 h-3.5 object-contain shrink-0 dark:hidden"
                    referrerPolicy="no-referrer"
                  />
                  <img
                    src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
                    alt="Galleri5"
                    className="w-3.5 h-3.5 object-contain shrink-0 hidden dark:block"
                    referrerPolicy="no-referrer"
                  />
                </>
              ) : activeProviderDetails.logoUrl ? (
                <img
                  src={activeProviderDetails.logoUrl}
                  alt={activeProviderDetails.name}
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span>{activeProviderDetails.name}</span>
            </div>

            {/* Active Model Indicator */}
            {(isVideo ? settings.videoModel : settings.imageModel) && (isVideo ? settings.videoModel : settings.imageModel) !== '-' && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-sans text-stone-500 dark:text-stone-400 flex-wrap">
                <span className="text-stone-300 dark:text-stone-600">/</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {isVideo && settings.videoModel === 'Google Vids Omni' ? 'Vids Omni' : isVideo ? settings.videoModel : settings.imageModel}
                </span>
                {(isVideo && (settings.videoModel === 'MiniMax H3 Turbo Video' || settings.videoModel === 'Google Veo 2 / Gemini Video' || settings.videoModel === 'Gemini Omni Flash Video (10s)' || activeProviderDetails.id === 'gemini')) && (
                  <div className="inline-flex items-center gap-1 ml-1 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-sans font-medium">
                      {hasImage ? 'Image-to-Video' : 'Text-to-Video'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {settings.videoAspectRatio.split(' ')[0]}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {settings.videoDuration}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {settings.videoResolution}
                    </span>
                  </div>
                )}
              </div>
            )}
            {isVideo && activeProviderDetails.id === 'vids' && (
              <div className="inline-flex flex-wrap items-center gap-x-2 text-[10px] font-mono text-stone-500 dark:text-stone-400">
                <span>{settings.videoAspectRatio.split(' ')[0]}</span>
                <span>{Number.parseInt(settings.videoDuration, 10) || 10} seconds</span>
                <span>{settings.videoResolution}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
