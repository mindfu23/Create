/**
 * PSD Export Utility
 * 
 * Export sketchbook pages as PSD files with layer support using ag-psd.
 */

import { writePsd, Psd, Layer } from 'ag-psd';
import type { SketchPage, SketchLayer, Stroke } from '@shared/sketchbook';
import { getStroke } from 'perfect-freehand';

// Create an offscreen canvas for rendering
function createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  // Fallback for older browsers
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Render a single stroke to a canvas context
function renderStroke(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  stroke: Stroke
) {
  const strokePoints = stroke.points.map(p => [p.x, p.y, p.pressure]);
  
  const outlinePoints = getStroke(strokePoints, {
    size: stroke.style.size,
    thinning: stroke.style.thinning,
    smoothing: stroke.style.smoothing,
    streamline: stroke.style.streamline,
    simulatePressure: false,
  });

  if (outlinePoints.length < 3) return;

  ctx.beginPath();
  ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
  
  for (let i = 1; i < outlinePoints.length; i++) {
    ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
  }
  
  ctx.closePath();
  
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#FFFFFF';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = stroke.style.color;
  }
  
  ctx.globalAlpha = stroke.style.opacity;
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Render a layer to an ImageData
function renderLayerToImageData(
  layer: SketchLayer,
  width: number,
  height: number
): ImageData | null {
  if (layer.strokes.length === 0) {
    return null;
  }

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Clear with transparent
  ctx.clearRect(0, 0, width, height);

  // Render all strokes
  for (const stroke of layer.strokes) {
    renderStroke(ctx as CanvasRenderingContext2D, stroke);
  }

  return ctx.getImageData(0, 0, width, height);
}

// Export a page to PSD format
export async function exportPageToPsd(page: SketchPage): Promise<Blob> {
  const { width, height, layers } = page;

  // Sort layers by order
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  // Build PSD structure
  const psd: Psd = {
    width,
    height,
    channels: 4, // RGBA
    bitsPerChannel: 8,
    colorMode: 3, // RGB
    children: [],
  };

  // Add layers
  for (const layer of sortedLayers) {
    const imageData = renderLayerToImageData(layer, width, height);
    
    const psdLayer: Layer = {
      name: layer.name,
      opacity: Math.round(layer.opacity * 255),
      hidden: !layer.visible,
      blendMode: 'normal',
    };

    if (imageData) {
      psdLayer.canvas = imageDataToCanvas(imageData);
    }

    psd.children!.push(psdLayer);
  }

  // Generate PSD file
  const arrayBuffer = writePsd(psd);
  return new Blob([arrayBuffer], { type: 'image/vnd.adobe.photoshop' });
}

// Convert ImageData to HTMLCanvasElement (required by ag-psd)
function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}

// Export page as PNG (flattened)
export async function exportPageToPng(page: SketchPage): Promise<Blob> {
  const { width, height, layers } = page;

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Fill with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Sort and render layers
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  for (const layer of sortedLayers) {
    if (!layer.visible) continue;

    ctx.globalAlpha = layer.opacity;
    
    for (const stroke of layer.strokes) {
      renderStroke(ctx as CanvasRenderingContext2D, stroke);
    }
    
    ctx.globalAlpha = 1;
  }

  // Convert to blob
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  } else {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        'image/png'
      );
    });
  }
}

// Export page as SVG
export function exportPageToSvg(page: SketchPage): string {
  const { width, height, layers } = page;
  
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  for (const layer of sortedLayers) {
    if (!layer.visible) continue;
    
    svg += `<g id="${layer.id}" opacity="${layer.opacity}">`;
    
    for (const stroke of layer.strokes) {
      const strokePoints = stroke.points.map(p => [p.x, p.y, p.pressure]);
      
      const outlinePoints = getStroke(strokePoints, {
        size: stroke.style.size,
        thinning: stroke.style.thinning,
        smoothing: stroke.style.smoothing,
        streamline: stroke.style.streamline,
        simulatePressure: false,
      });

      if (outlinePoints.length < 3) continue;

      const pathData = getSvgPathFromPoints(outlinePoints);
      
      svg += `<path d="${pathData}" fill="${stroke.style.color}" opacity="${stroke.style.opacity}"/>`;
    }
    
    svg += '</g>';
  }

  svg += '</svg>';
  return svg;
}

// Convert points to SVG path data
function getSvgPathFromPoints(points: number[][]): string {
  if (points.length < 3) return '';

  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`;
  }
  
  d += ' Z';
  return d;
}

// Trigger download of a blob
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download SVG string
export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}

// Export dialog options
export type ExportFormat = 'psd' | 'png' | 'svg';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
}

// Main export function
export async function exportPage(
  page: SketchPage,
  options: ExportOptions
): Promise<void> {
  const { format, filename } = options;
  
  switch (format) {
    case 'psd': {
      const blob = await exportPageToPsd(page);
      downloadBlob(blob, `${filename}.psd`);
      break;
    }
    case 'png': {
      const blob = await exportPageToPng(page);
      downloadBlob(blob, `${filename}.png`);
      break;
    }
    case 'svg': {
      const svg = exportPageToSvg(page);
      downloadSvg(svg, `${filename}.svg`);
      break;
    }
  }
}
