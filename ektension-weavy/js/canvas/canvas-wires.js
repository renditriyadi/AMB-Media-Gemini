// canvas-wires.js - SVG Bezier Connection Layer & Interactive Port Wiring (100% Pola Project Utama)

export function getPortCoordinate(node, portId, isOutput = false, nodeWidth = 300) {
  const x = node.position.x + (isOutput ? nodeWidth : 0);
  
  // Approximate vertical port offset based on node type
  let yOffset = 70;
  if (node.type === 'prompt') {
    yOffset = 80;
  } else if (node.type === 'imageModel') {
    if (portId === 'input-prompt') yOffset = 80;
    else if (portId === 'input-image' || portId === 'input-image-1') yOffset = 120;
    else yOffset = 90;
  } else if (node.type === 'imageViewer') {
    yOffset = 90;
  } else if (node.type === 'imageInput') {
    yOffset = 80;
  } else if (node.type === 'promptEnhancer' || node.type === 'anyLLM') {
    yOffset = 85;
  }

  return { x, y: node.position.y + yOffset };
}

export function makeBezierPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const curvature = Math.max(40, dx * 0.45);
  const cx1 = x1 + curvature;
  const cy1 = y1;
  const cx2 = x2 - curvature;
  const cy2 = y2;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

export function renderCanvasWires({
  svgEl,
  nodes = [],
  edges = [],
  activeDragWire = null,
  isExecuting = false,
  onDeleteEdge = () => {},
}) {
  if (!svgEl) return;

  const nodeMap = new Map();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const pathsHtml = edges
    .map((edge) => {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);
      if (!sourceNode || !targetNode) return '';

      const p1 = getPortCoordinate(sourceNode, edge.sourceOutputId, true);
      const p2 = getPortCoordinate(targetNode, edge.targetInputId, false);
      const d = makeBezierPath(p1.x, p1.y, p2.x, p2.y);
      const color = edge.color || '#3b82f6';
      const executingClass = isExecuting ? 'wire-pulse' : '';

      return `
        <g class="canvas-wire-group" data-edge-id="${edge.id}">
          <!-- Transparent thick hitbox for easy clicking -->
          <path d="${d}" fill="none" stroke="transparent" stroke-width="18" class="wire-hitbox" style="cursor: pointer;" />
          <!-- Glow background line -->
          <path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-opacity="0.25" class="wire-glow" />
          <!-- Main sharp wire -->
          <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" class="wire-main ${executingClass}" />
        </g>
      `;
    })
    .join('');

  // Dragging wire in progress
  let tempWireHtml = '';
  if (activeDragWire) {
    const { startX, startY, currentX, currentY, color = '#10b981' } = activeDragWire;
    const d = makeBezierPath(startX, startY, currentX, currentY);
    tempWireHtml = `
      <g class="canvas-wire-temp">
        <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="6,4" class="wire-dragging" />
        <circle cx="${currentX}" cy="${currentY}" r="4" fill="${color}" />
      </g>
    `;
  }

  svgEl.innerHTML = `
    <defs>
      <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    ${pathsHtml}
    ${tempWireHtml}
  `;

  // Attach delete handlers on wire click
  svgEl.querySelectorAll('.canvas-wire-group').forEach((group) => {
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      const edgeId = group.getAttribute('data-edge-id');
      if (edgeId && typeof onDeleteEdge === 'function') {
        onDeleteEdge(edgeId);
      }
    });
  });
}
