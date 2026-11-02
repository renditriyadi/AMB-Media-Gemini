import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  Sparkles,
  Copy,
  Layers,
  ArrowRight,
  Circle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
} from 'lucide-react';

export interface CanvasMarkupModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  sourceNodeTitle?: string;
  onSaveMarkup: (markupDataUrl: string, targetMode: 'overwrite' | 'newNode') => void;
  onToast?: (msg: string) => void;
  isChatMode?: boolean;
}

interface StrokePoint {
  x: number;
  y: number;
}

interface DrawStroke {
  points: StrokePoint[];
  color: string;
  size: number;
  tool: 'pen' | 'highlighter' | 'eraser' | 'arrow' | 'rect' | 'circle';
  alpha: number;
}

const PRESET_COLORS = [
  { name: 'Red Marker', hex: '#EF4444', label: 'Merah (Paling Jelas untuk AI)' },
  { name: 'Amber Pointer', hex: '#F59E0B', label: 'Kuning / Amber' },
  { name: 'Neon Green', hex: '#10B981', label: 'Hijau Neon' },
  { name: 'Cyan Blue', hex: '#06B6D4', label: 'Cyan / Biru' },
  { name: 'Purple Mask', hex: '#A855F7', label: 'Ungu Inpaint' },
  { name: 'Pure White', hex: '#FFFFFF', label: 'Putih Kontras' },
  { name: 'Solid Black', hex: '#000000', label: 'Hitam' },
];

const STROKE_SIZES = [
  { label: 'Halus', size: 3 },
  { label: 'Sedang', size: 8 },
  { label: 'Tebal', size: 18 },
  { label: 'Masking', size: 36 },
];

export const CanvasMarkupModal: React.FC<CanvasMarkupModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  sourceNodeTitle = 'Media Canvas',
  onSaveMarkup,
  onToast,
  isChatMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Tools: Drawing tools + Pan / Hand tool
  const [activeTool, setActiveTool] = useState<
    'arrow' | 'circle' | 'rect' | 'pen' | 'highlighter' | 'eraser' | 'pan'
  >('arrow');
  const [activeColor, setActiveColor] = useState<string>('#EF4444');
  const [activeSize, setActiveSize] = useState<number>(8);

  // Zoom & Pan Navigation State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // Synchronize state changes to refs
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<DrawStroke[]>([]);

  // Synchronous refs to prevent React state closure lag & stuttering during drawing
  const strokesRef = useRef<DrawStroke[]>([]);
  const redoStrokesRef = useRef<DrawStroke[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<DrawStroke | null>(null);
  const activeToolRef = useRef(activeTool);
  const activeColorRef = useRef(activeColor);
  const activeSizeRef = useRef(activeSize);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);
  useEffect(() => {
    activeSizeRef.current = activeSize;
  }, [activeSize]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  useEffect(() => {
    redoStrokesRef.current = redoStrokes;
  }, [redoStrokes]);

  const [imageLoaded, setImageLoaded] = useState(false);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 800,
  });

  const [baseDisplaySize, setBaseDisplaySize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 600,
  });

  // Calculate fitted base display size inside the viewport
  const updateDisplaySize = useCallback((natW: number, natH: number) => {
    if (!viewportRef.current) return;
    const containerW = viewportRef.current.clientWidth - 48;
    const containerH = viewportRef.current.clientHeight - 48;

    if (containerW <= 0 || containerH <= 0) return;

    const scale = Math.min(containerW / natW, containerH / natH, 1);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);

    setBaseDisplaySize({
      width: Math.max(dispW, 200),
      height: Math.max(dispH, 200),
    });
    setZoom(1);
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
  }, []);

  // Reset Zoom & Center
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
    if (onToast) onToast('Tampilan kanvas di-reset ke 100% (Fit)');
  }, [onToast]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(Math.round((prev + 0.25) * 100) / 100, 5);
      zoomRef.current = next;
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(Math.round((prev - 0.25) * 100) / 100, 0.25);
      zoomRef.current = next;
      return next;
    });
  }, []);

  // Single stroke rendering function on canvas 2D context
  const renderSingleStroke = (ctx: CanvasRenderingContext2D, st: DrawStroke) => {
    if (!st.points || st.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (st.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = st.size * 2;
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.stroke();
    } else if (st.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.size * 2.5;
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.stroke();
    } else if (st.tool === 'arrow') {
      const start = st.points[0];
      const end = st.points.length > 1 ? st.points[st.points.length - 1] : start;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = st.color;
      ctx.fillStyle = st.color;
      ctx.lineWidth = Math.max(st.size, 3);

      if (dist < 4) {
        ctx.beginPath();
        ctx.arc(start.x, start.y, st.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const angle = Math.atan2(dy, dx);
        const headLength = Math.max(st.size * 2.8, 16);

        // Subtle dark shadow line for clear contrast on any image background
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = Math.max(st.size, 3) + 3;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.restore();

        // Main Arrow Line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Arrow Head
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLength * Math.cos(angle - Math.PI / 6),
          end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          end.x - headLength * Math.cos(angle + Math.PI / 6),
          end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (st.tool === 'rect') {
      const start = st.points[0];
      const end = st.points.length > 1 ? st.points[st.points.length - 1] : start;
      const w = end.x - start.x;
      const h = end.y - start.y;

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = Math.max(st.size, 3);

      ctx.fillStyle = `${st.color}22`;
      ctx.fillRect(start.x, start.y, w, h);
      ctx.strokeRect(start.x, start.y, w, h);
    } else if (st.tool === 'circle') {
      const start = st.points[0];
      const end = st.points.length > 1 ? st.points[st.points.length - 1] : start;
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      const centerX = Math.min(start.x, end.x) + radiusX;
      const centerY = Math.min(start.y, end.y) + radiusY;

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = Math.max(st.size, 3);

      ctx.fillStyle = `${st.color}22`;
      ctx.beginPath();
      ctx.ellipse(
        centerX,
        centerY,
        Math.max(radiusX, 2),
        Math.max(radiusY, 2),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    } else {
      // Normal Pen / Marker
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.size;

      if (st.points.length === 1) {
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.arc(st.points[0].x, st.points[0].y, st.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(st.points[0].x, st.points[0].y);
        for (let i = 1; i < st.points.length; i++) {
          ctx.lineTo(st.points[i].x, st.points[i].y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Immediate redraw on canvas without triggering React state updates during drag
  const redrawCanvasImmediate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw image
    const img = imageObjRef.current;
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw historical strokes
    for (const stroke of strokesRef.current) {
      renderSingleStroke(ctx, stroke);
    }

    // 3. Draw active stroke currently being dragged
    if (currentStrokeRef.current) {
      renderSingleStroke(ctx, currentStrokeRef.current);
    }
  }, []);

  // Load target image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      const nw = img.naturalWidth || 800;
      const nh = img.naturalHeight || 800;
      setNaturalDimensions({ width: nw, height: nh });
      setImageLoaded(true);
      setStrokes([]);
      setRedoStrokes([]);
      strokesRef.current = [];
      redoStrokesRef.current = [];
      currentStrokeRef.current = null;
      isDrawingRef.current = false;

      setTimeout(() => {
        updateDisplaySize(nw, nh);
      }, 50);
    };
    img.onerror = () => {
      setImageLoaded(true);
      setNaturalDimensions({ width: 800, height: 800 });
      if (onToast) onToast('Gagal memuat format gambar asli, kanvas kosong disiapkan.');
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl, onToast, updateDisplaySize]);

  // Window resize handler
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      // Only adjust base dimensions on resize if still at default zoom
      if (zoomRef.current === 1) {
        updateDisplaySize(naturalDimensions.width, naturalDimensions.height);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, naturalDimensions, updateDisplaySize]);

  // Redraw whenever strokes change or image loads
  useEffect(() => {
    if (isOpen && imageLoaded) {
      redrawCanvasImmediate();
    }
  }, [isOpen, imageLoaded, strokes, redrawCanvasImmediate]);

  // Native Wheel Event inside Markup Modal: Cursor-Anchored Zoom In & Out
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!isOpen || !viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const viewportW = rect.width;
      const viewportH = rect.height;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const nextZoom = Math.min(Math.max(0.2, currentZoom * zoomFactor), 5.0);
      const zoomRatio = nextZoom / currentZoom;

      // Mathematical cursor-anchor zoom around center origin:
      const dx = mouseX - (viewportW / 2 + currentPan.x);
      const dy = mouseY - (viewportH / 2 + currentPan.y);

      const nextPanX = mouseX - viewportW / 2 - dx * zoomRatio;
      const nextPanY = mouseY - viewportH / 2 - dy * zoomRatio;

      const finalZoom = Math.round(nextZoom * 100) / 100;
      const finalPan = { x: Math.round(nextPanX), y: Math.round(nextPanY) };

      zoomRef.current = finalZoom;
      panRef.current = finalPan;
      setZoom(finalZoom);
      setPan(finalPan);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  // Spacebar quick-pan navigation listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        // Prevent default space behavior (such as triggering focused button clicks or scrolling)
        e.preventDefault();
        e.stopPropagation();

        // Blur any focused UI button so Space does NOT trigger onClick
        if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
          (document.activeElement as HTMLElement).blur();
        }

        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true;
          setIsSpacePressed(true);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [isOpen]);

  // Coordinate mapper from viewport event to Canvas coordinate (Precision mapped under zoom/pan)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  // Unified pointer panning handlers
  const startPanning = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panRef.current.x,
      initialPanY: panRef.current.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const updatePanning = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const deltaX = e.clientX - panStartRef.current.startX;
      const deltaY = e.clientY - panStartRef.current.startY;
      const newPan = {
        x: Math.round(panStartRef.current.initialPanX + deltaX),
        y: Math.round(panStartRef.current.initialPanY + deltaY),
      };
      panRef.current = newPan;
      setPan(newPan);
    }
  };

  const stopPanning = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = false;
      setIsPanning(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }
  };

  // Viewport Background Pointer Handlers
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isPanMode =
      activeTool === 'pan' || isSpacePressedRef.current || e.button === 1 || e.button === 0;

    if (isPanMode) {
      startPanning(e);
    }
  };

  // Canvas Drawing Pointer Handlers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const isPanMode =
      activeTool === 'pan' || isSpacePressedRef.current || e.button === 1 || e.buttons === 4;

    if (isPanMode) {
      startPanning(e);
      return;
    }

    // Normal Drawing
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    const coords = getCanvasCoords(e);
    if (!coords) return;

    isDrawingRef.current = true;
    currentStrokeRef.current = {
      points: [coords],
      color: activeColorRef.current,
      size: activeSizeRef.current,
      tool: activeToolRef.current as any,
      alpha: activeToolRef.current === 'highlighter' ? 0.45 : 1,
    };
    setRedoStrokes([]);
    redoStrokesRef.current = [];

    redrawCanvasImmediate();
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      updatePanning(e);
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const tool = currentStrokeRef.current.tool;
    if (tool === 'arrow' || tool === 'rect' || tool === 'circle') {
      currentStrokeRef.current.points = [currentStrokeRef.current.points[0], coords];
    } else {
      currentStrokeRef.current.points.push(coords);
    }

    redrawCanvasImmediate();
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      stopPanning(e);
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    isDrawingRef.current = false;

    const finishedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (finishedStroke && finishedStroke.points.length > 0) {
      if (
        finishedStroke.points.length === 1 &&
        (finishedStroke.tool === 'arrow' ||
          finishedStroke.tool === 'rect' ||
          finishedStroke.tool === 'circle')
      ) {
        finishedStroke.points.push({
          x: finishedStroke.points[0].x + 35,
          y: finishedStroke.points[0].y + 35,
        });
      }

      const updatedStrokes = [...strokesRef.current, finishedStroke];
      strokesRef.current = updatedStrokes;
      setStrokes(updatedStrokes);
    }

    redrawCanvasImmediate();
  };

  // Undo / Redo / Clear
  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    const last = strokesRef.current[strokesRef.current.length - 1];
    const newStrokes = strokesRef.current.slice(0, -1);
    const newRedo = [...redoStrokesRef.current, last];

    strokesRef.current = newStrokes;
    redoStrokesRef.current = newRedo;
    setStrokes(newStrokes);
    setRedoStrokes(newRedo);
    redrawCanvasImmediate();
  };

  const handleRedo = () => {
    if (redoStrokesRef.current.length === 0) return;
    const last = redoStrokesRef.current[redoStrokesRef.current.length - 1];
    const newRedo = redoStrokesRef.current.slice(0, -1);
    const newStrokes = [...strokesRef.current, last];

    strokesRef.current = newStrokes;
    redoStrokesRef.current = newRedo;
    setStrokes(newStrokes);
    setRedoStrokes(newRedo);
    redrawCanvasImmediate();
  };

  const handleClearAll = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = [];
    redoStrokesRef.current = [];
    currentStrokeRef.current = null;
    setStrokes([]);
    setRedoStrokes([]);
    redrawCanvasImmediate();
    if (onToast) onToast('Semua coretan visual dibersihkan!');
  };

  const handleSave = (targetMode: 'overwrite' | 'newNode') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    onSaveMarkup(dataUrl, targetMode);
    if (onToast) {
      if (isChatMode) {
        onToast('✅ Coretan visual berhasil dilampirkan ke obrolan chat!');
      } else {
        onToast(
          targetMode === 'newNode'
            ? '🎯 Node baru dengan coretan visual berhasil dibuat!'
            : '✅ Gambar node berhasil diperbarui dengan tanda visual!'
        );
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const isPanToolActive = activeTool === 'pan' || isSpacePressed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none canvas-markup-modal"
      onClick={onClose}
      onWheel={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-5xl h-[90vh] bg-[#141418] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#18181f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold shadow-xs">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                <span>Coretan & Penanda Visual (AI Visual Pointer)</span>
                {sourceNodeTitle && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium max-w-[180px] sm:max-w-[280px] truncate inline-block shrink-0 align-middle" title={sourceNodeTitle}>
                    {sourceNodeTitle}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-stone-400 font-light mt-0.5">
                Tarik panah merah, beri lingkaran, atau tandai area spesifik agar AI memahami bagian yang ingin diubah.
              </p>
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 bg-[#1a1a22] border-b border-white/10">
          {/* Tool Modes */}
          <div className="flex items-center gap-1 bg-[#121216] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('arrow');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'arrow'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Panah Penunjuk (Tarik garis panah langsung)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Panah</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('circle');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'circle'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Lingkaran / Oval Penanda"
            >
              <Circle className="w-3.5 h-3.5" />
              <span>Lingkaran</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('rect');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'rect'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Kotak Pembatas Area (Bounding Box)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kotak</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('pen');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Kuas Coret Bebas (Freehand Marker)"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Marker</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('highlighter');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'highlighter'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Highlighter Transparan"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Highlight</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('eraser');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'eraser'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Penghapus Coretan"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                setActiveTool('pan');
                e.currentTarget.blur();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTool === 'pan'
                  ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-white/5'
              }`}
              title="Alat Geser Layar (Pan / Hand tool - Tahan Spasi)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Geser</span>
            </button>
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-1.5 bg-[#121216] px-2.5 py-1.5 rounded-xl border border-white/10">
            <span className="text-[11px] text-stone-400 font-medium mr-1">Warna:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  setActiveColor(c.hex);
                  if (activeTool === 'eraser' || activeTool === 'pan') setActiveTool('arrow');
                  e.currentTarget.blur();
                }}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                  activeColor === c.hex && activeTool !== 'eraser' && activeTool !== 'pan'
                    ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-[#141418]'
                    : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              >
                {activeColor === c.hex && activeTool !== 'eraser' && activeTool !== 'pan' && (
                  <Check
                    className={`w-3 h-3 ${
                      c.hex === '#FFFFFF' ? 'text-black' : 'text-white'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Stroke Size */}
          <div className="flex items-center gap-1 bg-[#121216] px-2.5 py-1.5 rounded-xl border border-white/10">
            <span className="text-[11px] text-stone-400 font-medium mr-1">Tebal:</span>
            {STROKE_SIZES.map((s) => (
              <button
                key={s.size}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  setActiveSize(s.size);
                  e.currentTarget.blur();
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activeSize === s.size
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Zoom Navigation Controls */}
          <div className="flex items-center gap-1 bg-[#121216] px-2 py-1 rounded-xl border border-white/10">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleZoomOut();
                e.currentTarget.blur();
              }}
              disabled={zoom <= 0.25}
              className="p-1 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleResetZoom();
                e.currentTarget.blur();
              }}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
              title="Klik untuk Reset Zoom (100% Fit)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleZoomIn();
                e.currentTarget.blur();
              }}
              disabled={zoom >= 5}
              className="p-1 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleResetZoom();
                e.currentTarget.blur();
              }}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fit to Screen (100%)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Undo / Redo / Clear */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleUndo();
                e.currentTarget.blur();
              }}
              disabled={strokes.length === 0}
              className="p-1.5 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Undo Coretan (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleRedo();
                e.currentTarget.blur();
              }}
              disabled={redoStrokes.length === 0}
              className="p-1.5 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Redo Coretan (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                handleClearAll();
                e.currentTarget.blur();
              }}
              disabled={strokes.length === 0}
              className="p-1.5 rounded-xl text-stone-300 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Bersihkan Semua Coretan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Zoomable Viewport */}
        <div
          ref={viewportRef}
          className={`flex-1 w-full h-full min-h-0 bg-[#0d0d11] p-4 flex items-center justify-center overflow-hidden relative select-none canvas-checkerboard ${
            isPanning
              ? 'cursor-grabbing'
              : isPanToolActive
              ? 'cursor-grab'
              : 'cursor-default'
          }`}
          style={{ touchAction: 'none' }}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={updatePanning}
          onPointerUp={stopPanning}
          onPointerCancel={stopPanning}
        >
          {!imageLoaded && (
            <div className="flex items-center gap-2 text-stone-400 text-xs">
              <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Memuat media kanvas...</span>
            </div>
          )}

          {/* Zoomable & Pannable Transform Container */}
          <div
            className="relative flex items-center justify-center rounded-xl shadow-2xl overflow-hidden bg-stone-900"
            style={{
              width: baseDisplaySize.width,
              height: baseDisplaySize.height,
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
              transformOrigin: 'center center',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <canvas
              ref={canvasRef}
              width={naturalDimensions.width}
              height={naturalDimensions.height}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              className={`block select-none ${
                isPanToolActive
                  ? isPanning
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : 'cursor-crosshair'
              }`}
              style={{
                width: `${baseDisplaySize.width}px`,
                height: `${baseDisplaySize.height}px`,
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserDrag: 'none',
              }}
            />
          </div>

          {/* Quick Floating Zoom Status & Hint Indicator */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-[11px] text-stone-300 shadow-lg">
            <span className="font-mono text-amber-300 font-semibold">{Math.round(zoom * 100)}%</span>
            <span className="text-stone-500">|</span>
            <span className="text-stone-300">Scroll Mouse = Zoom</span>
            <span className="text-stone-500">•</span>
            <span className="text-stone-300">Tahan Spasi + Drag = Geser (Pan)</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#18181f]">
          <div className="text-xs text-stone-400">
            {strokes.length > 0 ? (
              <span className="text-amber-400 font-medium">
                {strokes.length} penanda visual aktif
              </span>
            ) : (
              <span>Tarik mouse untuk membuat panah, lingkaran, atau coretan pada gambar</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              tabIndex={-1}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Batal
            </button>

            {isChatMode ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => handleSave('overwrite')}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
                title="Gunakan hasil coretan ini di obrolan chat"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lampirkan ke Chat</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSave('newNode')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/15 text-stone-200 transition-all cursor-pointer active:scale-95"
                  title="Simpan sebagai node Image Input baru di sampingnya"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Simpan ke Node Baru</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSave('overwrite')}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
                  title="Perbarui gambar pada node saat ini"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Terapkan ke Node</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
