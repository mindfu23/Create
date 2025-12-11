/**
 * Sketchbook Canvas Component
 * 
 * The main drawing canvas using Konva.js and perfect-freehand for smooth strokes.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Group } from 'react-konva';
import { getStroke } from 'perfect-freehand';
import type Konva from 'konva';
import type {
  Stroke,
  StrokePoint,
  StrokeStyle,
  DrawingTool,
  SketchLayer,
  Viewport,
  Selection,
} from '@shared/sketchbook';
import { TOOL_PRESETS, generateStrokeId } from '@shared/sketchbook';

// Convert perfect-freehand output to SVG path data
function getSvgPathFromStroke(points: number[][], closed = true): string {
  const len = points.length;
  if (len < 4) return '';

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${((b[0] + c[0]) / 2).toFixed(2)},${((b[1] + c[1]) / 2).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${((a[0] + b[0]) / 2).toFixed(2)},${((a[1] + b[1]) / 2).toFixed(2)} `;
  }

  if (closed) {
    result += 'Z';
  }

  return result;
}

// Convert stroke points to Konva line points
function strokeToLinePoints(stroke: Stroke): number[] {
  const strokePoints = stroke.points.map(p => [p.x, p.y, p.pressure]);
  
  const outlinePoints = getStroke(strokePoints, {
    size: stroke.style.size,
    thinning: stroke.style.thinning,
    smoothing: stroke.style.smoothing,
    streamline: stroke.style.streamline,
    simulatePressure: false,
  });

  // Flatten for Konva Line (which uses flat array)
  return outlinePoints.flat();
}

interface SketchCanvasProps {
  width: number;
  height: number;
  layers: SketchLayer[];
  currentLayerId: string;
  tool: DrawingTool;
  strokeStyle: StrokeStyle;
  viewport: Viewport;
  selection: Selection | null;
  selectedStrokeIds: string[];
  onStrokeComplete: (stroke: Stroke) => void;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: Selection | null) => void;
  onStrokeSelect: (strokeIds: string[]) => void;
  onSelectionMove: (dx: number, dy: number) => void;
}

export function SketchCanvas({
  width,
  height,
  layers,
  currentLayerId,
  tool,
  strokeStyle,
  viewport,
  selection,
  selectedStrokeIds,
  onStrokeComplete,
  onViewportChange,
  onSelectionChange,
  onStrokeSelect,
  onSelectionMove,
}: SketchCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<StrokePoint[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Get the current layer
  const currentLayer = layers.find(l => l.id === currentLayerId);

  // Handle pointer down
  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Transform position based on viewport
    const transformedPos = {
      x: (pos.x - viewport.x) / viewport.scale,
      y: (pos.y - viewport.y) / viewport.scale,
    };

    // Pan tool
    if (tool === 'pan' || e.evt.button === 1) { // Middle mouse button
      setIsPanning(true);
      setPanStart({ x: pos.x, y: pos.y });
      return;
    }

    // Selection tools
    if (tool === 'select-rect') {
      setSelectionStart(transformedPos);
      setSelectionRect({ x: transformedPos.x, y: transformedPos.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'select-lasso') {
      setSelectionStart(transformedPos);
      setLassoPoints([{ x: transformedPos.x, y: transformedPos.y, pressure: 1 }]);
      return;
    }

    // If we have selection and click inside it, start dragging
    if (selectedStrokeIds.length > 0 && selectionRect) {
      if (
        transformedPos.x >= selectionRect.x &&
        transformedPos.x <= selectionRect.x + selectionRect.width &&
        transformedPos.y >= selectionRect.y &&
        transformedPos.y <= selectionRect.y + selectionRect.height
      ) {
        setDragStart(transformedPos);
        return;
      }
    }

    // Drawing tools
    if (tool === 'pen' || tool === 'pencil' || tool === 'eraser') {
      if (currentLayer?.locked) return;
      
      setIsDrawing(true);
      setCurrentPoints([{
        x: transformedPos.x,
        y: transformedPos.y,
        pressure: e.evt.pressure || 0.5,
      }]);
    }
  }, [tool, viewport, currentLayer, selectedStrokeIds, selectionRect]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Handle panning
    if (isPanning && panStart) {
      const dx = pos.x - panStart.x;
      const dy = pos.y - panStart.y;
      onViewportChange({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
      setPanStart({ x: pos.x, y: pos.y });
      return;
    }

    const transformedPos = {
      x: (pos.x - viewport.x) / viewport.scale,
      y: (pos.y - viewport.y) / viewport.scale,
    };

    // Handle selection drag
    if (dragStart && selectedStrokeIds.length > 0) {
      const dx = transformedPos.x - dragStart.x;
      const dy = transformedPos.y - dragStart.y;
      onSelectionMove(dx, dy);
      setDragStart(transformedPos);
      
      // Update selection rect position
      if (selectionRect) {
        setSelectionRect({
          ...selectionRect,
          x: selectionRect.x + dx,
          y: selectionRect.y + dy,
        });
      }
      return;
    }

    // Handle rect selection
    if (tool === 'select-rect' && selectionStart) {
      setSelectionRect({
        x: Math.min(selectionStart.x, transformedPos.x),
        y: Math.min(selectionStart.y, transformedPos.y),
        width: Math.abs(transformedPos.x - selectionStart.x),
        height: Math.abs(transformedPos.y - selectionStart.y),
      });
      return;
    }

    // Handle lasso selection
    if (tool === 'select-lasso' && selectionStart) {
      setLassoPoints(prev => [...prev, { x: transformedPos.x, y: transformedPos.y, pressure: 1 }]);
      return;
    }

    // Handle drawing
    if (!isDrawing) return;

    setCurrentPoints(prev => [...prev, {
      x: transformedPos.x,
      y: transformedPos.y,
      pressure: e.evt.pressure || 0.5,
    }]);
  }, [isDrawing, isPanning, panStart, viewport, tool, selectionStart, dragStart, selectedStrokeIds, selectionRect, onViewportChange, onSelectionMove]);

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    // End panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // End dragging
    if (dragStart) {
      setDragStart(null);
      return;
    }

    // End rect selection
    if (tool === 'select-rect' && selectionRect && currentLayer) {
      // Find strokes within selection
      const selectedIds: string[] = [];
      
      for (const stroke of currentLayer.strokes) {
        // Check if any point of the stroke is within the selection rect
        for (const point of stroke.points) {
          if (
            point.x >= selectionRect.x &&
            point.x <= selectionRect.x + selectionRect.width &&
            point.y >= selectionRect.y &&
            point.y <= selectionRect.y + selectionRect.height
          ) {
            selectedIds.push(stroke.id);
            break;
          }
        }
      }

      onStrokeSelect(selectedIds);
      onSelectionChange({
        type: 'rect',
        bounds: [selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height],
      });
      
      setSelectionStart(null);
      if (selectedIds.length === 0) {
        setSelectionRect(null);
      }
      return;
    }

    // End lasso selection
    if (tool === 'select-lasso' && lassoPoints.length > 2 && currentLayer) {
      // Find strokes within lasso polygon
      const selectedIds: string[] = [];
      
      for (const stroke of currentLayer.strokes) {
        for (const point of stroke.points) {
          if (isPointInPolygon(point, lassoPoints)) {
            selectedIds.push(stroke.id);
            break;
          }
        }
      }

      // Calculate bounding rect for the lasso
      const minX = Math.min(...lassoPoints.map(p => p.x));
      const maxX = Math.max(...lassoPoints.map(p => p.x));
      const minY = Math.min(...lassoPoints.map(p => p.y));
      const maxY = Math.max(...lassoPoints.map(p => p.y));

      onStrokeSelect(selectedIds);
      onSelectionChange({
        type: 'lasso',
        bounds: [minX, minY, maxX - minX, maxY - minY],
        points: lassoPoints,
      });
      
      setSelectionStart(null);
      setLassoPoints([]);
      if (selectedIds.length > 0) {
        setSelectionRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
      }
      return;
    }

    // End drawing
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    const toolType = tool as 'pen' | 'pencil' | 'eraser';
    const preset = TOOL_PRESETS[toolType] || {};

    const stroke: Stroke = {
      id: generateStrokeId(),
      points: currentPoints,
      style: {
        ...strokeStyle,
        ...preset,
      },
      tool: toolType,
      timestamp: Date.now(),
    };

    onStrokeComplete(stroke);
    setIsDrawing(false);
    setCurrentPoints([]);
  }, [
    isPanning,
    dragStart,
    tool,
    selectionRect,
    lassoPoints,
    isDrawing,
    currentPoints,
    strokeStyle,
    currentLayer,
    onStrokeComplete,
    onStrokeSelect,
    onSelectionChange,
  ]);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const oldScale = viewport.scale;
    const newScale = e.evt.deltaY < 0 
      ? Math.min(oldScale * scaleBy, viewport.maxScale)
      : Math.max(oldScale / scaleBy, viewport.minScale);

    // Zoom towards pointer position
    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };

    onViewportChange({
      ...viewport,
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [viewport, onViewportChange]);

  // Clear selection when tool changes
  useEffect(() => {
    if (tool !== 'select-rect' && tool !== 'select-lasso') {
      setSelectionRect(null);
      setLassoPoints([]);
      onStrokeSelect([]);
      onSelectionChange(null);
    }
  }, [tool, onStrokeSelect, onSelectionChange]);

  // Render a single stroke
  const renderStroke = (stroke: Stroke, opacity: number = 1) => {
    const points = strokeToLinePoints(stroke);
    if (points.length < 4) return null;

    const isSelected = selectedStrokeIds.includes(stroke.id);
    const isEraser = stroke.tool === 'eraser';

    return (
      <Line
        key={stroke.id}
        points={points}
        fill={isEraser ? '#FFFFFF' : stroke.style.color}
        opacity={stroke.style.opacity * opacity}
        closed
        globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'}
        stroke={isSelected ? '#0066FF' : undefined}
        strokeWidth={isSelected ? 2 / viewport.scale : 0}
      />
    );
  };

  // Render current drawing stroke
  const renderCurrentStroke = () => {
    if (!isDrawing || currentPoints.length < 2) return null;

    const toolType = tool as 'pen' | 'pencil' | 'eraser';
    const preset = TOOL_PRESETS[toolType] || {};
    
    const tempStroke: Stroke = {
      id: 'temp',
      points: currentPoints,
      style: {
        ...strokeStyle,
        ...preset,
      },
      tool: toolType,
      timestamp: Date.now(),
    };

    return renderStroke(tempStroke);
  };

  // Sort layers by order
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{ 
        cursor: tool === 'pan' ? 'grab' : 
                tool === 'select-rect' || tool === 'select-lasso' ? 'crosshair' : 
                'default',
        touchAction: 'none',
      }}
    >
      {/* Background */}
      <Layer>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#FFFFFF"
        />
      </Layer>

      {/* Drawing layers */}
      <Layer
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
      >
        {sortedLayers.map(layer => {
          if (!layer.visible) return null;

          return (
            <Group key={layer.id} opacity={layer.opacity}>
              {layer.strokes.map(stroke => renderStroke(stroke, layer.opacity))}
            </Group>
          );
        })}

        {/* Current drawing stroke */}
        {renderCurrentStroke()}

        {/* Selection rectangle */}
        {selectionRect && (
          <Rect
            x={selectionRect.x}
            y={selectionRect.y}
            width={selectionRect.width}
            height={selectionRect.height}
            stroke="#0066FF"
            strokeWidth={2 / viewport.scale}
            dash={[5 / viewport.scale, 5 / viewport.scale]}
            fill="rgba(0, 102, 255, 0.1)"
          />
        )}

        {/* Lasso selection line */}
        {lassoPoints.length > 1 && (
          <Line
            points={lassoPoints.flatMap(p => [p.x, p.y])}
            stroke="#0066FF"
            strokeWidth={2 / viewport.scale}
            dash={[5 / viewport.scale, 5 / viewport.scale]}
            closed={false}
          />
        )}
      </Layer>
    </Stage>
  );
}

// Point in polygon test for lasso selection
function isPointInPolygon(point: StrokePoint, polygon: StrokePoint[]): boolean {
  let inside = false;
  const x = point.x;
  const y = point.y;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}
