/**
 * Sketchbook Types
 * 
 * Type definitions for the Sketchbook drawing feature.
 */

// Tool types
export type DrawingTool = 'pen' | 'pencil' | 'eraser' | 'select-rect' | 'select-lasso' | 'pan';

// Stroke style
export interface StrokeStyle {
  color: string;
  size: number;
  opacity: number;
  thinning: number;      // 0-1, how much pressure affects thickness
  smoothing: number;     // 0-1, how smooth the stroke is
  streamline: number;    // 0-1, how much to streamline the stroke
}

// A single point in a stroke
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

// A complete stroke (one drawing gesture)
export interface Stroke {
  id: string;
  points: StrokePoint[];
  style: StrokeStyle;
  tool: 'pen' | 'pencil' | 'eraser';
  timestamp: number;
}

// Selection area
export interface Selection {
  type: 'rect' | 'lasso';
  // For rect: [x, y, width, height]
  // For lasso: array of points forming closed polygon
  bounds: number[];
  points?: StrokePoint[]; // For lasso selection
}

// Layer in the sketchbook
export interface SketchLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  strokes: Stroke[];
  order: number; // z-index, higher = on top
}

// Page position in the infinite canvas
// Page 0,0 is the starting page
// Negative y = pages above (numbered -1, -2, etc.)
// Positive y = pages below (numbered 1, 2, etc.)
// Negative x = pages left (labeled a(l), b(l), etc.)
// Positive x = pages right (labeled a(r), b(r), etc.)
export interface PagePosition {
  x: number; // -26 to 26 (a-z left/right)
  y: number; // any integer, negative = up, positive = down
}

// Get page label from position
export function getPageLabel(pos: PagePosition): string {
  let label = '';
  
  // Handle horizontal position
  if (pos.x !== 0) {
    const letterIndex = Math.abs(pos.x) - 1;
    const letter = String.fromCharCode(97 + (letterIndex % 26)); // a-z
    const suffix = pos.x < 0 ? '(l)' : '(r)';
    label = letter + suffix;
  }
  
  // Handle vertical position
  const pageNum = pos.y === 0 ? '1' : (pos.y < 0 ? String(1 + Math.abs(pos.y)) : String(1 + pos.y));
  
  if (label) {
    return `${pageNum}${label}`;
  }
  return pageNum;
}

// A single page in the sketchbook
export interface SketchPage {
  id: string;
  position: PagePosition;
  layers: SketchLayer[];
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

// The complete sketchbook
export interface Sketchbook {
  id: string;
  name: string;
  pages: SketchPage[];
  currentPageId: string;
  currentLayerId: string;
  defaultPageSize: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

// Undo/Redo action types
export type SketchAction = 
  | { type: 'add-stroke'; pageId: string; layerId: string; stroke: Stroke }
  | { type: 'remove-stroke'; pageId: string; layerId: string; strokeId: string; stroke: Stroke }
  | { type: 'add-layer'; pageId: string; layer: SketchLayer }
  | { type: 'remove-layer'; pageId: string; layer: SketchLayer }
  | { type: 'reorder-layer'; pageId: string; layerId: string; oldOrder: number; newOrder: number }
  | { type: 'toggle-layer-visibility'; pageId: string; layerId: string }
  | { type: 'clear-selection'; pageId: string; layerId: string; strokes: Stroke[] }
  | { type: 'paste-strokes'; pageId: string; layerId: string; strokes: Stroke[] }
  | { type: 'move-selection'; pageId: string; layerId: string; strokeIds: string[]; dx: number; dy: number };

// History state for undo/redo
export interface SketchHistory {
  past: SketchAction[];
  future: SketchAction[];
  maxSize: number; // Default 11, can be increased
}

// Viewport state (for pan/zoom)
export interface Viewport {
  x: number;
  y: number;
  scale: number;
  minScale: number;
  maxScale: number;
}

// Clipboard for copy/paste
export interface SketchClipboard {
  strokes: Stroke[];
  sourcePageId: string;
  sourceLayerId: string;
}

// Tool presets
export const TOOL_PRESETS: Record<string, Partial<StrokeStyle>> = {
  pen: {
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  },
  pencil: {
    thinning: 0.7,
    smoothing: 0.3,
    streamline: 0.3,
    opacity: 0.8,
  },
  eraser: {
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
  },
};

// Default colors palette
export const COLOR_PALETTE = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#FF8000', // Orange
  '#FFFF00', // Yellow
  '#80FF00', // Lime
  '#00FF00', // Green
  '#00FF80', // Mint
  '#00FFFF', // Cyan
  '#0080FF', // Sky Blue
  '#0000FF', // Blue
  '#8000FF', // Purple
  '#FF00FF', // Magenta
  '#FF0080', // Pink
  '#808080', // Gray
  '#C0C0C0', // Silver
];

// Default brush sizes
export const BRUSH_SIZES = [2, 4, 8, 16, 24, 32, 48, 64];

// Create a new empty layer
export function createLayer(order: number, name?: string): SketchLayer {
  return {
    id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || `Layer ${order + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    strokes: [],
    order,
  };
}

// Create a new empty page
export function createPage(position: PagePosition, size: { width: number; height: number }): SketchPage {
  const now = new Date().toISOString();
  const layer = createLayer(0, 'Background');
  
  return {
    id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    position,
    layers: [layer],
    width: size.width,
    height: size.height,
    createdAt: now,
    updatedAt: now,
  };
}

// Create a new sketchbook
export function createSketchbook(name: string): Sketchbook {
  const now = new Date().toISOString();
  const defaultSize = { width: 1920, height: 1080 };
  const firstPage = createPage({ x: 0, y: 0 }, defaultSize);
  
  return {
    id: `sketchbook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    pages: [firstPage],
    currentPageId: firstPage.id,
    currentLayerId: firstPage.layers[0].id,
    defaultPageSize: defaultSize,
    createdAt: now,
    updatedAt: now,
  };
}

// Generate a stroke ID
export function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
