import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CanvasNodeType } from '../../types/canvas';
export type { CanvasNodeType };

export interface CanvasContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelectType: (type: CanvasNodeType) => void;
}

interface NodeOption {
  type: CanvasNodeType;
  label: string;
}

const PRIMARY_NODES: NodeOption[] = [
  { type: 'prompt', label: 'Prompt' },
  { type: 'aiWorker', label: 'AI Worker' },
  { type: 'storyboard', label: 'Storyboard Copilot' },
  { type: 'imageInput', label: 'Import File' },
  { type: 'anyLLM', label: 'Any LLM' },
  { type: 'imageModel', label: 'Model Gambar' },
  { type: 'geminiVideo', label: 'Gemini Omni Flash' },
  { type: 'vidsVideo', label: 'Vids Omni' },
  { type: 'videoStitcher', label: 'Video Stitcher (FFmpeg)' },
  { type: 'imageViewer', label: 'Viewer Output' },
];

const UTILITY_NODES: NodeOption[] = [
  { type: 'note', label: 'Sticky Note' },
];

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onSelectType,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Smart positioning inside viewport bounds
  const MENU_WIDTH = 165;
  const MENU_HEIGHT = 225;
  const padding = 16;

  let left = position.x;
  let top = position.y;

  if (typeof window !== 'undefined') {
    if (left + MENU_WIDTH > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - MENU_WIDTH - padding);
    }
    if (top + MENU_HEIGHT > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - MENU_HEIGHT - padding);
    }
  }

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-[165px] bg-white/95 dark:bg-[#15151c]/95 backdrop-blur-xl border border-stone-200/90 dark:border-white/10 rounded-xl shadow-2xl p-1.5 select-none animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 dark:ring-white/5"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-stone-100 dark:border-white/5 mb-1">
        <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
          Tambah Node
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">Esc</span>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Tutup menu"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Node Options */}
      <div className="space-y-0.5">
        <div className="px-2.5 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Node Utama
        </div>
        {PRIMARY_NODES.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => {
              onSelectType(item.type);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 active:bg-stone-200/60 dark:active:bg-white/15 transition-colors cursor-pointer select-none"
          >
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Utilities Section */}
      <div className="mt-1 pt-1 border-t border-stone-100 dark:border-white/5 space-y-0.5">
        <div className="px-2.5 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Lainnya
        </div>
        {UTILITY_NODES.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => {
              onSelectType(item.type);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 active:bg-stone-200/60 dark:active:bg-white/15 transition-colors cursor-pointer select-none"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};