import React, { useState, useRef, useEffect } from 'react';
import { Play, Sparkles, Film, AlertCircle, Loader2 } from 'lucide-react';
import { GenerationItem } from '../types';

interface MediaThumbnailProps {
  item: GenerationItem;
  className?: string;
  showPlayIcon?: boolean;
  hoverPlay?: boolean;
  onClick?: () => void;
}

// Utility to check if a URL points to an actual image (not video)
export function isRealImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  if (clean === '' || clean.startsWith('api/')) return false;

  // If it is a data URL or blob, check mime type
  if (clean.startsWith('data:image/') || clean.startsWith('blob:')) return true;
  if (clean.startsWith('data:video/')) return false;

  // Check known video extensions
  const videoExtensions = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv', '.ogv'];
  for (const ext of videoExtensions) {
    if (clean.endsWith(ext) || clean.includes(`${ext}?`)) {
      return false;
    }
  }

  // Check known image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif'];
  for (const ext of imageExtensions) {
    if (clean.endsWith(ext) || clean.includes(`${ext}?`)) {
      return true;
    }
  }

  // If it's a remote URL from known image CDNs or without video ext
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return true;
  }

  return false;
}

// Extract best available image URL from GenerationItem
export function getBestThumbnailImage(item: GenerationItem): string | null {
  if (!item) return null;

  // 1. Check item.thumbnailUrl if it's actually an image
  if (item.thumbnailUrl && isRealImageUrl(item.thumbnailUrl)) {
    return item.thumbnailUrl;
  }

  // 2. Check attachedMedia image
  if (Array.isArray(item.attachedMedia) && item.attachedMedia.length > 0) {
    const attachedImg = item.attachedMedia.find(
      (m) => m && (m.type === 'image' || isRealImageUrl(m.previewUrl) || isRealImageUrl(m.url))
    );
    if (attachedImg) {
      if (attachedImg.previewUrl && isRealImageUrl(attachedImg.previewUrl)) {
        return attachedImg.previewUrl;
      }
      if (attachedImg.url && isRealImageUrl(attachedImg.url)) {
        return attachedImg.url;
      }
    }

    // Check first attached media if not video
    const firstMedia = item.attachedMedia[0];
    if (firstMedia) {
      if (firstMedia.previewUrl && isRealImageUrl(firstMedia.previewUrl)) return firstMedia.previewUrl;
      if (firstMedia.url && isRealImageUrl(firstMedia.url)) return firstMedia.url;
    }
  }

  return null;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  item,
  className = 'w-full h-full',
  showPlayIcon = true,
  hoverPlay = true,
  onClick,
}) => {
  const isVideo = item.mode === 'video';
  const isQueued = item.status === 'queued';
  const isProcessing = item.status === 'processing';
  const isFailed = item.status === 'failed';

  const [imageError, setImageError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [useVideoProxy, setUseVideoProxy] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const bestImage = getBestThumbnailImage(item);
  const videoUrl = item.mediaUrl || (item.thumbnailUrl && !isRealImageUrl(item.thumbnailUrl) ? item.thumbnailUrl : '');

  // Reset errors when media changes
  useEffect(() => {
    setImageError(false);
    setVideoLoaded(false);
    setUseVideoProxy(false);
  }, [item.id, item.mediaUrl, item.thumbnailUrl]);

  // Handle hover-to-play preview for video
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (hoverPlay && isVideo && videoRef.current && videoUrl) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay on hover blocked or interrupted, ignore
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverPlay && isVideo && videoRef.current) {
      videoRef.current.pause();
      try {
        // Reset to initial preview timestamp
        videoRef.current.currentTime = 0.1;
      } catch (e) {}
    }
  };

  const handleVideoLoadedData = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    setVideoLoaded(true);
    // Seeking to 0.1s ensures Chrome/Safari decodes & renders the first vibrant frame instead of 0.000s black frame
    if (!isHovered && vid.currentTime < 0.05) {
      try {
        vid.currentTime = 0.1;
      } catch (err) {}
    }
  };

  const handleVideoError = () => {
    if (!useVideoProxy && videoUrl) {
      console.log(`[MediaThumbnail] Direct video preview failed for item ${item.id}, trying video proxy...`);
      setUseVideoProxy(true);
    }
  };

  // Determine final video source with timestamp anchor for frame decoding
  const effectiveVideoSrc = videoUrl && videoUrl.trim()
    ? useVideoProxy
      ? `/api/proxy-video?url=${encodeURIComponent(videoUrl)}#t=0.1`
      : videoUrl.includes('#t=')
      ? videoUrl
      : `${videoUrl}#t=0.1`
    : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden bg-stone-900 flex items-center justify-center select-none ${className}`}
    >
      {/* 1. Dedicated Image Thumbnail (if available and not failed) */}
      {Boolean(bestImage && bestImage.trim()) && !imageError ? (
        <img
          src={bestImage!}
          alt={item.title || 'Thumbnail'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => {
            console.log(`[MediaThumbnail] Image load failed for item ${item.id}, falling back to video/placeholder`);
            setImageError(true);
          }}
        />
      ) : isVideo && effectiveVideoSrc ? (
        /* 2. Video Element with Smart 0.1s Frame Seeking & Proxy Fallback */
        <video
          ref={videoRef}
          src={effectiveVideoSrc}
          preload="auto"
          muted
          playsInline
          loop
          referrerPolicy="no-referrer"
          onLoadedData={handleVideoLoadedData}
          onLoadedMetadata={handleVideoLoadedData}
          onError={handleVideoError}
          className="w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-105"
        />
      ) : Boolean(item.mediaUrl && item.mediaUrl.trim()) && !isVideo ? (
        /* 3. Image Generation Output */
        <img
          src={item.mediaUrl!}
          alt={item.title || 'Generated Image'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImageError(true)}
        />
      ) : (
        /* 4. Placeholder when no media exists or while loading */
        <div className="w-full h-full bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 flex flex-col items-center justify-center p-2 text-center">
          {isQueued || isProcessing ? (
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          ) : isFailed ? (
            <AlertCircle className="w-5 h-5 text-rose-500" />
          ) : (
            <Film className="w-5 h-5 text-stone-600" />
          )}
        </div>
      )}

      {/* Play Overlay for completed videos */}
      {showPlayIcon && isVideo && videoUrl && !isProcessing && !isQueued && (
        <div
          className={`absolute inset-0 bg-black/25 flex items-center justify-center transition-opacity duration-200 ${
            isHovered && hoverPlay ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-xs flex items-center justify-center text-stone-900 dark:text-stone-100 shadow-xs">
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Queued State Overlay */}
      {isQueued && (
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center pointer-events-none z-10">
          <Loader2 className="w-5 h-5 text-amber-300 animate-spin mb-1" />
          <span className="text-[9px] font-bold text-white tracking-wider uppercase drop-shadow-sm">In Queue</span>
        </div>
      )}

      {/* Processing State Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center pointer-events-none z-10">
          <Sparkles className="w-5 h-5 text-amber-300 animate-spin mb-1" />
          <span className="text-[9px] font-bold text-white tracking-wider uppercase drop-shadow-sm">Generating</span>
          {item.progress !== undefined && item.progress > 0 && (
            <span className="text-[10px] font-mono font-bold text-amber-300 mt-0.5">{item.progress}%</span>
          )}
        </div>
      )}
    </div>
  );
};
