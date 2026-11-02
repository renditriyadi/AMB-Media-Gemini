import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  ExternalLink,
  Video as VideoIcon,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import { ChatAttachment } from '../../types';
import { downloadMediaFile } from '../../utils';

interface EmbeddedVideoPlayerProps {
  attachment: ChatAttachment;
  videoIndex?: number;
  isUser?: boolean;
  onUseInPrompt?: (videoUrl: string) => void;
  onAnalyzePrompt?: (tag: string) => void;
}

export const EmbeddedVideoPlayer: React.FC<EmbeddedVideoPlayerProps> = ({
  attachment,
  videoIndex,
  isUser = false,
  onUseInPrompt,
  onAnalyzePrompt,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [useProxy, setUseProxy] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(Boolean(attachment.fallbackNote && !attachment.playbackUrl && !attachment.url));
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Compute effective video playback source
  const rawSrc = attachment.playbackUrl || attachment.url || '';
  const effectiveSrc = rawSrc && rawSrc.trim()
    ? useProxy
      ? `/api/proxy-video?url=${encodeURIComponent(rawSrc)}`
      : rawSrc
    : '';
  const coverSrc = attachment.coverUrl || '';
  const displayTitle = attachment.title || attachment.name || 'Video Terlampir';
  const tagLabel = videoIndex ? `Video #${videoIndex} (@vid${videoIndex})` : 'Video Asli';

  useEffect(() => {
    setUseProxy(false);
    setHasError(Boolean(attachment.fallbackNote && !attachment.playbackUrl && !attachment.url));
  }, [attachment.playbackUrl, attachment.url]);

  const handleDownloadVideo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const cleanTitle = (attachment.title || attachment.name || 'video')
        .replace(/\.mp4$/i, '')
        .trim();
      const success = await downloadMediaFile(rawSrc || effectiveSrc, cleanTitle, 'video');
      if (success) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2500);
      }
    } catch (err) {
      console.warn('[EmbeddedVideoPlayer] Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Format seconds into mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((err) => {
        console.warn('[EmbeddedVideoPlayer] Play interrupted:', err);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuteState = !isMuted;
    videoRef.current.muted = newMuteState;
    setIsMuted(newMuteState);
    if (!newMuteState && volume === 0) {
      setVolume(0.8);
      videoRef.current.volume = 0.8;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch((err) => {
        console.warn('[EmbeddedVideoPlayer] Fullscreen request failed:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Handle retry if error
  const handleRetryVideo = () => {
    setHasError(false);
    setIsLoaded(false);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  // Check if effectiveSrc is a YouTube link
  const ytMatch = effectiveSrc.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  const youtubeVideoId = ytMatch ? ytMatch[1] : null;

  if (youtubeVideoId) {
    return (
      <div
        ref={containerRef}
        className="chat-keep-dark w-full max-w-[360px] sm:max-w-[420px] rounded-2xl overflow-hidden border border-amber-500/30 bg-stone-900 shadow-xl my-2"
      >
        <div className="relative aspect-[16/9] w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0`}
            title={displayTitle}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-2.5 bg-stone-900/90 border-t border-white/10 flex items-center justify-between text-xs text-stone-200">
          <span className="truncate font-medium">{displayTitle}</span>
          <a
            href={effectiveSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-semibold text-[11px]"
          >
            <span>Buka YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // If there's an explicit fallback note and no valid direct playable url, or if video errored out
  if (hasError || (!effectiveSrc && coverSrc)) {
    return (
      <div
        ref={containerRef}
        className="chat-keep-dark w-full max-w-[340px] rounded-2xl overflow-hidden border border-amber-500/30 bg-stone-900/90 dark:bg-stone-950/90 shadow-xl my-2 text-stone-200"
      >
        {/* Cover / Thumbnail Preview */}
        <div className="relative aspect-[9/16] max-h-[380px] w-full bg-black flex items-center justify-center overflow-hidden">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={displayTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-stone-400">
              <VideoIcon className="w-10 h-10 text-amber-400/60 animate-pulse" />
              <span className="text-xs font-mono">Video Thumbnail</span>
            </div>
          )}

          {/* Tag badge */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono text-amber-300 border border-amber-500/40 font-bold shadow">
              {tagLabel}
            </span>
          </div>

          {/* Author or Duration pill */}
          {attachment.duration && (
            <div className="absolute top-2.5 right-2.5 z-10">
              <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-stone-300 border border-white/10">
                {typeof attachment.duration === 'number' ? `${attachment.duration}s` : attachment.duration}
              </span>
            </div>
          )}
        </div>

        {/* Fallback Explanation Notice */}
        <div className="p-3 bg-amber-950/40 border-t border-amber-500/30 space-y-2">
          <div className="flex items-start gap-2 text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed font-medium">
              {attachment.fallbackNote ||
                'Video asli tidak dapat diputar langsung karena pembatasan platform, berikut cover/thumbnail sebagai gambaran visual.'}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 gap-2">
            {attachment.sourceUrl && (
              <a
                href={attachment.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium border border-amber-500/40 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Link Sumber</span>
              </a>
            )}

            {effectiveSrc && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors"
                  title="Unduh file video (.mp4)"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : downloadSuccess ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Unduh MP4</span>
                </button>
                <button
                  type="button"
                  onClick={handleRetryVideo}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 text-xs font-medium transition-colors"
                  title="Coba Muat Ulang Video"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Coba Ulang</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && !isScrubbing && setShowControls(false)}
      className={`group relative w-full max-w-[340px] sm:max-w-[360px] rounded-2xl overflow-hidden border border-stone-300/80 dark:border-white/15 bg-black shadow-2xl my-2 select-none transition-all ${
        isFullscreen ? 'max-w-none w-screen h-screen rounded-none' : ''
      }`}
    >
      {/* Top Media Bar */}
      <div className="absolute top-2.5 inset-x-2.5 z-30 flex items-center justify-between pointer-events-none transition-opacity duration-300">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono text-amber-300 border border-amber-500/40 font-bold shadow flex items-center gap-1">
            <VideoIcon className="w-3 h-3 text-amber-400" />
            {tagLabel}
          </span>
          {attachment.author && (
            <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-stone-200 border border-white/15 font-medium truncate max-w-[120px]">
              @{attachment.author}
            </span>
          )}
          {onAnalyzePrompt && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAnalyzePrompt(tagLabel);
              }}
              className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/40 backdrop-blur-md text-[10px] text-amber-300 border border-amber-500/40 font-semibold shadow flex items-center gap-1 transition-all active:scale-95"
              title={`Ekstrak prompt video penuh dari ${tagLabel}`}
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              <span>Ekstrak Prompt</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Tap to Unmute Badge when muted & playing */}
          {isMuted && isPlaying && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="px-2 py-0.5 rounded-md bg-amber-500/90 text-black text-[10px] font-bold flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 transition-transform"
              title="Aktifkan Suara"
            >
              <VolumeX className="w-3 h-3" />
              <span>Bunyikan</span>
            </button>
          )}

          {/* Direct Download Button */}
          <button
            type="button"
            onClick={handleDownloadVideo}
            disabled={isDownloading}
            className={`p-1 rounded-md bg-black/60 hover:bg-black/80 text-white/90 border border-white/15 transition-transform active:scale-95 cursor-pointer shadow flex items-center justify-center ${
              isDownloading ? 'opacity-75 cursor-wait' : ''
            }`}
            title={downloadSuccess ? 'Berhasil Diunduh!' : 'Unduh File Video Asli (.mp4)'}
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : downloadSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        className="relative aspect-[9/16] max-h-[460px] w-full bg-stone-950 flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={effectiveSrc}
          poster={coverSrc || undefined}
          playsInline
          muted={isMuted}
          referrerPolicy="no-referrer"
          preload="metadata"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              setIsLoaded(true);
            }
          }}
          onTimeUpdate={() => {
            if (videoRef.current && !isScrubbing) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            if (!useProxy && rawSrc && rawSrc.startsWith('http')) {
              console.warn('[EmbeddedVideoPlayer] Direct playback error, switching to /api/proxy-video fallback...', rawSrc);
              setUseProxy(true);
            } else {
              console.warn('[EmbeddedVideoPlayer] Playback error on source:', effectiveSrc, e);
              setHasError(true);
            }
          }}
          className="w-full h-full object-contain bg-black"
        />

        {/* Center Play/Pause Overlay Button */}
        {(!isPlaying || showControls) && (
          <div
            className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl transition-transform transform group-hover:scale-110 active:scale-95">
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-white text-white" />
              ) : (
                <Play className="w-6 h-6 fill-white text-white translate-x-0.5" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Controls Overlay Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-8 pb-2.5 px-3 space-y-1.5 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Timeline Scrubber */}
        <div className="relative flex items-center w-full group/scrub">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => setIsScrubbing(false)}
            onTouchStart={() => setIsScrubbing(true)}
            onTouchEnd={() => setIsScrubbing(false)}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-2 transition-all"
          />
        </div>

        {/* Control Buttons & Timestamps */}
        <div className="flex items-center justify-between text-white text-xs pt-0.5">
          {/* Left Controls: Play/Pause, Volume, Timer */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 rounded-md hover:bg-white/10 text-stone-200 hover:text-white transition-colors"
              title={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded-md hover:bg-white/10 text-stone-200 hover:text-white transition-colors"
                title={isMuted ? 'Bunyikan' : 'Bisukan'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-amber-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-12 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400 hidden group-hover/vol:inline-block"
              />
            </div>

            {/* Time Indicator */}
            <span className="text-[11px] font-mono text-stone-300 pl-0.5 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: External link & Fullscreen */}
          <div className="flex items-center gap-1">
            {onUseInPrompt && (
              <button
                type="button"
                onClick={() => onUseInPrompt(effectiveSrc)}
                className="p-1 rounded-md hover:bg-white/10 text-amber-400 hover:text-amber-300 transition-colors"
                title="Gunakan referensi video di chat"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}

            {attachment.sourceUrl && (
              <a
                href={attachment.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-md hover:bg-white/10 text-stone-300 hover:text-white transition-colors"
                title="Buka Halaman Sumber Asli"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 rounded-md hover:bg-white/10 text-stone-200 hover:text-white transition-colors"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};