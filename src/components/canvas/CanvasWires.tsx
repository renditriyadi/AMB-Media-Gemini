import React from 'react';
import { CanvasEdge, CanvasNode, getPortCoordinate } from '../../types/canvas';

// Exact data type colors extracted directly from Weavy design system
export const WEAVY_PORT_COLORS = {
  text: '#F1A0FA', // DataType_Text: Soft Pink / Magenta
  image: '#6EDDB3', // DataType_Image: Mint Green
  video: '#EF9092', // DataType_Video: Coral / Salmon
  audio: '#4452F2', // DataType_Audio: Electric Blue
  mask: '#C1DD6E', // DataType_Mask: Lime Green
  lora: '#BB68FF', // DataType_Lora: Vivid Purple
  seed: '#E77E3E', // DataType_Seed: Amber Orange
  any: '#FEFFF1', // DataType_Any: Off-white
};

export const resolvePortColor = (
  node?: CanvasNode,
  portId?: string,
  isInput: boolean = false
): string => {
  if (!node) return WEAVY_PORT_COLORS.image;

  // 1. If portId has hints
  const pId = (portId || '').toLowerCase();
  if (pId.includes('prompt') || pId.includes('text')) return WEAVY_PORT_COLORS.text;
  if (pId.includes('video')) return WEAVY_PORT_COLORS.video;
  if (pId.includes('audio')) return WEAVY_PORT_COLORS.audio;
  if (pId.includes('mask')) return WEAVY_PORT_COLORS.mask;
  if (pId.includes('image') || pId.includes('file') || pId.includes('result')) {
    return WEAVY_PORT_COLORS.image;
  }

  // 2. Check node's input/output ports definition
  if (isInput && node.inputs) {
    const port = node.inputs.find((p) => p.id === portId);
    if (port) {
      if (port.type === 'text') return WEAVY_PORT_COLORS.text;
      if (port.type === 'video') return WEAVY_PORT_COLORS.video;
      if (port.type === 'image') return WEAVY_PORT_COLORS.image;
    }
  } else if (!isInput && node.outputs) {
    const port = node.outputs.find((p) => p.id === portId);
    if (port) {
      if (port.type === 'text') return WEAVY_PORT_COLORS.text;
      if (port.type === 'video') return WEAVY_PORT_COLORS.video;
      if (port.type === 'image') return WEAVY_PORT_COLORS.image;
    }
  }

  // 3. Fallback by node type
  if (node.type === 'prompt') return WEAVY_PORT_COLORS.text;
  if (node.type === 'imageInput') return WEAVY_PORT_COLORS.image;
  if (node.type === 'imageModel') return WEAVY_PORT_COLORS.image;
  if (node.type === 'imageViewer') return WEAVY_PORT_COLORS.image;
  if (node.type === 'geminiVideo') return WEAVY_PORT_COLORS.video;
  if (node.type === 'videoStitcher') return WEAVY_PORT_COLORS.video;

  return WEAVY_PORT_COLORS.image;
};

interface CanvasWiresProps {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  connectingWire: {
    sourceNodeId: string;
    sourceOutputId?: string;
    sourcePortId?: string;
    isInput?: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null;
  isGenerating?: boolean;
  executingNodeId?: string | null;
  executingNodeIds?: string[];
}

export const CanvasWires: React.FC<CanvasWiresProps> = ({
  edges,
  nodes,
  selectedEdgeId,
  onSelectEdge,
  onDeleteEdge,
  connectingWire,
  isGenerating = false,
  executingNodeId = null,
  executingNodeIds = [],
}) => {
  // Weavy standard bezier curvature calculation with horizontal tangents
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const curvature = Math.max(dx * 0.45, 48);
    const cp1x = x1 + curvature;
    const cp1y = y1;
    const cp2x = x2 - curvature;
    const cp2y = y2;
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible w-full h-full"
      style={{ zIndex: 5 }}
    >
      <defs>
        {/* Render linear gradients for each connected edge from source port color to target port color */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
          const targetNode = nodes.find((n) => n.id === edge.targetNodeId);
          const sourceColor = resolvePortColor(sourceNode, edge.sourceOutputId, false);
          const targetColor = resolvePortColor(targetNode, edge.targetInputId, true);

          return (
            <linearGradient
              key={`grad-${edge.id}`}
              id={`weavy-wire-grad-${edge.id}`}
              gradientUnits="userSpaceOnUse"
              x1={sourceNode?.position.x || 0}
              y1={sourceNode?.position.y || 0}
              x2={targetNode?.position.x || 100}
              y2={targetNode?.position.y || 100}
            >
              <stop offset="0%" stopColor={sourceColor} />
              <stop offset="100%" stopColor={targetColor} />
            </linearGradient>
          );
        })}
      </defs>

      {/* Render all existing edges */}
      {edges.map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
        const targetNode = nodes.find((n) => n.id === edge.targetNodeId);
        if (!sourceNode || !targetNode) return null;

        const start = getPortCoordinate(
          sourceNode,
          edge.sourceOutputId,
          false,
          sourceNode.data?.aspectRatio
        );
        const end = getPortCoordinate(
          targetNode,
          edge.targetInputId,
          true,
          sourceNode.data?.aspectRatio
        );

        if (!start || !end) return null;

        const pathData = getBezierPath(start.x, start.y, end.x, end.y);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        const sourceColor = resolvePortColor(sourceNode, edge.sourceOutputId, false);
        const targetColor = resolvePortColor(targetNode, edge.targetInputId, true);
        const isConnectedToExecuting =
          isGenerating &&
          ((executingNodeIds && (executingNodeIds.includes(sourceNode.id) || executingNodeIds.includes(targetNode.id))) ||
           sourceNode.id === executingNodeId ||
           targetNode.id === executingNodeId);
        const isSelected = selectedEdgeId === edge.id;

        return (
          <g
            key={edge.id}
            className="group pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Invisible wider hit-box for smooth hover/click interaction */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth="26"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
              title="Pilih kabel"
            />

            {isSelected && (
              <path
                d={pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth="6"
                strokeOpacity="0.45"
                strokeLinecap="round"
                pointerEvents="none"
              />
            )}

            {/* Weavy 2px base cable line with gradient and smooth hover effect */}
            <path
              d={pathData}
              fill="none"
              stroke={`url(#weavy-wire-grad-${edge.id})`}
              strokeWidth={isSelected ? 3 : 2}
              strokeOpacity={isSelected ? 1 : 0.75}
              strokeLinecap="round"
              className={`weavy-edge-path transition-all duration-150 ${
                isConnectedToExecuting ? 'stroke-[3] opacity-100 canvas-wire-flow' : ''
              }`}
              style={
                isConnectedToExecuting
                  ? { strokeDasharray: '6 4' }
                  : undefined
              }
              pointerEvents="none"
            />

            {/* Subtle start & end connection terminal dots matching Weavy */}
            <circle cx={start.x} cy={start.y} r="2" fill={sourceColor} opacity="0.9" />
            <circle cx={end.x} cy={end.y} r="2" fill={targetColor} opacity="0.9" />

            {/* Minimal Weavy-style disconnect badge on hover */}
            <g
              transform={`translate(${midX - 9}, ${midY - 9})`}
              className="pointer-events-auto cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEdge(edge.id);
              }}
              title="Putus sambungan kabel (Weavy wire)"
            >
              <circle
                cx="9"
                cy="9"
                r="8.5"
                fill="#18181c"
                stroke="#f43f5e"
                strokeWidth="1.2"
                className="shadow-md hover:scale-110 active:scale-95 transition-transform"
              />
              <text
                x="9"
                y="12"
                textAnchor="middle"
                fill="#f43f5e"
                fontSize="9"
                fontWeight="bold"
                className="select-none pointer-events-none"
              >
                ✕
              </text>
            </g>
          </g>
        );
      })}

      {/* Wire currently being dragged by user to create a new connection */}
      {connectingWire && (() => {
        const sourceNode = nodes.find((n) => n.id === connectingWire.sourceNodeId);
        const wireColor = resolvePortColor(
          sourceNode,
          connectingWire.sourcePortId || connectingWire.sourceOutputId,
          connectingWire.isInput || false
        );

        const isInput = connectingWire.isInput;
        const startX = connectingWire.startX;
        const startY = connectingWire.startY;
        const curX = connectingWire.currentX;
        const curY = connectingWire.currentY;

        const pathData = isInput
          ? `M ${startX} ${startY} C ${
              startX - Math.max(Math.abs(curX - startX) * 0.45, 48)
            } ${startY}, ${
              curX + Math.max(Math.abs(curX - startX) * 0.45, 48)
            } ${curY}, ${curX} ${curY}`
          : getBezierPath(startX, startY, curX, curY);

        return (
          <g>
            {/* Live dragging wire matching Weavy dashed curve with 2px stroke */}
            <path
              d={pathData}
              fill="none"
              stroke={wireColor}
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeOpacity="0.88"
              strokeLinecap="round"
            />
            {/* Start terminal dot */}
            <circle cx={startX} cy={startY} r="3.5" fill={wireColor} />
            {/* End dragging target glow & center dot */}
            <circle
              cx={curX}
              cy={curY}
              r="6.5"
              fill={wireColor}
              fillOpacity="0.22"
            />
            <circle cx={curX} cy={curY} r="3" fill={wireColor} />
          </g>
        );
      })()}
    </svg>
  );
};