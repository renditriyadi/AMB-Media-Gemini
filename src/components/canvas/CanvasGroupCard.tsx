import React, { useState, useRef, useEffect } from 'react';
import { CanvasGroup, CanvasNode, getNodeWidth } from '../../types/canvas';

interface CanvasGroupCardProps {
  group: CanvasGroup;
  nodes: CanvasNode[];
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onStartDrag: (e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => void;
  onUpdateTitle: (newTitle: string) => void;
}

// Fallback height estimator for instant render before DOM measurements take effect
function getNodeEstimatedHeight(node: CanvasNode): number {
  if (node.type === 'note') return 180;
  if (node.type === 'prompt') return 220;

  if (node.type === 'imageInput') {
    if (node.data?.imageUrl || node.data?.videoUrl) {
      if (node.data?.naturalWidth && node.data?.naturalHeight) {
        const imgHeight = Math.min(
          540,
          Math.round((340 * node.data.naturalHeight) / node.data.naturalWidth)
        );
        return 72 + imgHeight;
      }
      return 560;
    }
    return 260;
  }

  if (node.type === 'imageModel' || node.type === 'imageViewer') {
    const ratio = node.data?.aspectRatio || '1:1';
    let vpHeight = 340;
    if (node.data?.naturalWidth && node.data?.naturalHeight) {
      vpHeight = Math.round((340 * node.data.naturalHeight) / node.data.naturalWidth);
    } else if (ratio === '9:16') {
      vpHeight = 604;
    } else if (ratio === '3:4') {
      vpHeight = 453;
    } else if (ratio === '16:9') {
      vpHeight = 191;
    } else if (ratio === '4:3') {
      vpHeight = 255;
    }
    return 165 + vpHeight;
  }

  return 340;
}

export const CanvasGroupCard: React.FC<CanvasGroupCardProps> = ({
  group,
  nodes,
  isSelected,
  onSelect,
  onStartDrag,
  onUpdateTitle,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(group.title || 'Group');
  const inputRef = useRef<HTMLInputElement>(null);

  // Live DOM measurements of all member nodes
  const [measuredSizes, setMeasuredSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});

  useEffect(() => {
    setTitleValue(group.title || 'Group');
  }, [group.title]);

  useEffect(() => {
    if (isEditingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Live DOM observer to measure exact width and height of each node in the group
  useEffect(() => {
    const measureNodes = () => {
      const updates: Record<string, { width: number; height: number }> = {};
      let changed = false;

      group.nodeIds.forEach((nodeId) => {
        const el = document.getElementById(`canvas-node-${nodeId}`);
        if (el) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          if (w > 0 && h > 0) {
            updates[nodeId] = { width: w, height: h };
            const prev = measuredSizes[nodeId];
            if (!prev || prev.width !== w || prev.height !== h) {
              changed = true;
            }
          }
        }
      });

      if (changed) {
        setMeasuredSizes((prev) => ({ ...prev, ...updates }));
      }
    };

    // Initial measure
    measureNodes();

    // Set up ResizeObserver on each member node's DOM element
    const ro = new ResizeObserver(() => {
      measureNodes();
    });

    group.nodeIds.forEach((nodeId) => {
      const el = document.getElementById(`canvas-node-${nodeId}`);
      if (el) {
        ro.observe(el);
      }
    });

    // Interval fallback to handle late-loading images
    const timer = setInterval(measureNodes, 600);

    return () => {
      ro.disconnect();
      clearInterval(timer);
    };
  }, [group.nodeIds, measuredSizes]);

  const memberNodes = nodes.filter((n) => group.nodeIds.includes(n.id));
  if (memberNodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  memberNodes.forEach((node) => {
    const measured = measuredSizes[node.id];
    const w = measured?.width || getNodeWidth(node, node.data?.aspectRatio);
    const h = measured?.height || getNodeEstimatedHeight(node);

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  });

  // Generous, professional framing margins
  const padX = 32;
  const padTop = 50;
  const padBottom = 32;

  const bounds = {
    x: minX - padX,
    y: minY - padTop,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padTop + padBottom,
  };

  const handleFinishEditing = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue !== group.title) {
      onUpdateTitle(titleValue.trim());
    }
  };

  return (
    <div
      className={`canvas-light-skin absolute rounded-3xl transition-colors duration-150 select-none pointer-events-auto cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'border border-stone-400/60 dark:border-white/30 bg-stone-500/[0.03] dark:bg-white/[0.02] shadow-sm'
          : 'border border-white/15 bg-white/[0.02] dark:bg-white/[0.015] hover:border-white/25'
      }`}
      style={{
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        zIndex: 4,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      onPointerDown={(e) => {
        // Only start drag if not clicking an interactive child (like title input)
        const target = e.target as HTMLElement;
        if (target.tagName.toLowerCase() === 'input') return;
        e.stopPropagation();
        onStartDrag(e);
      }}
    >
      {/* Group Header Bar */}
      <div
        className="h-10 px-4 flex items-center justify-between border-b border-white/10 bg-stone-900/60 dark:bg-[#18181c]/80 rounded-t-3xl cursor-grab active:cursor-grabbing backdrop-blur-xs"
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartDrag(e);
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* Subtle status pip */}
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isSelected ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]' : 'bg-stone-500'
            }`}
          />

          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleFinishEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEditing();
                if (e.key === 'Escape') {
                  setTitleValue(group.title || 'Group');
                  setIsEditingTitle(false);
                }
              }}
              className="px-2 py-0.5 text-xs font-semibold bg-stone-800 text-white rounded-md border border-stone-600 outline-none w-40"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-xs font-semibold text-stone-200 tracking-tight cursor-text hover:text-white transition-colors"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              title="Double-click untuk ganti nama grup"
            >
              {group.title || 'Group'}
            </span>
          )}
        </div>

        <span className="text-[11px] font-medium text-stone-400">
          {memberNodes.length} node
        </span>
      </div>
    </div>
  );
};
