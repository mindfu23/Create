/**
 * Sketchbook Toolbar Component
 * 
 * Drawing tools, color picker, brush sizes, and other controls.
 */

import React, { useState } from 'react';
import {
  Pen,
  Pencil,
  Eraser,
  Square,
  Lasso,
  Move,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Layers,
  Download,
  FolderOpen,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import type { DrawingTool, StrokeStyle, Viewport, PagePosition } from '@shared/sketchbook';
import { COLOR_PALETTE, BRUSH_SIZES, getPageLabel } from '@shared/sketchbook';

interface SketchToolbarProps {
  tool: DrawingTool;
  strokeStyle: StrokeStyle;
  viewport: Viewport;
  pagePosition: PagePosition;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onToolChange: (tool: DrawingTool) => void;
  onStyleChange: (style: Partial<StrokeStyle>) => void;
  onViewportChange: (viewport: Partial<Viewport>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onAddPage: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onNavigatePage: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onExport: () => void;
  onOpenLayers: () => void;
}

export function SketchToolbar({
  tool,
  strokeStyle,
  viewport,
  pagePosition,
  canUndo,
  canRedo,
  hasSelection,
  onToolChange,
  onStyleChange,
  onViewportChange,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onAddPage,
  onNavigatePage,
  onExport,
  onOpenLayers,
}: SketchToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushSize, setShowBrushSize] = useState(false);

  const tools: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen', icon: <Pen className="h-4 w-4" />, label: 'Pen' },
    { id: 'pencil', icon: <Pencil className="h-4 w-4" />, label: 'Pencil' },
    { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'Eraser' },
    { id: 'select-rect', icon: <Square className="h-4 w-4" />, label: 'Rectangle Select' },
    { id: 'select-lasso', icon: <Lasso className="h-4 w-4" />, label: 'Lasso Select' },
    { id: 'pan', icon: <Move className="h-4 w-4" />, label: 'Pan' },
  ];

  return (
    <div className="flex flex-col gap-2 p-2 bg-background border rounded-lg shadow-lg">
      {/* Drawing Tools */}
      <div className="flex gap-1">
        {tools.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange(t.id)}
            title={t.label}
          >
            {t.icon}
          </Button>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Color Picker */}
      <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="justify-start gap-2 px-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: strokeStyle.color }}
            />
            <span className="text-xs">Color</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="right">
          <div className="grid grid-cols-4 gap-1">
            {COLOR_PALETTE.map(color => (
              <button
                key={color}
                className={`w-8 h-8 rounded border-2 ${
                  strokeStyle.color === color ? 'border-primary' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onStyleChange({ color });
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
          <div className="mt-2">
            <input
              type="color"
              value={strokeStyle.color}
              onChange={(e) => onStyleChange({ color: e.target.value })}
              className="w-full h-8 cursor-pointer"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Brush Size */}
      <Popover open={showBrushSize} onOpenChange={setShowBrushSize}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="justify-start gap-2 px-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <div
                className="rounded-full bg-foreground"
                style={{
                  width: Math.min(strokeStyle.size, 24),
                  height: Math.min(strokeStyle.size, 24),
                }}
              />
            </div>
            <span className="text-xs">{strokeStyle.size}px</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-4" side="right">
          <div className="space-y-4">
            <Slider
              value={[strokeStyle.size]}
              onValueChange={([size]) => onStyleChange({ size })}
              min={1}
              max={64}
              step={1}
            />
            <div className="flex flex-wrap gap-1">
              {BRUSH_SIZES.map(size => (
                <Button
                  key={size}
                  variant={strokeStyle.size === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onStyleChange({ size })}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Opacity Slider */}
      <div className="px-2 py-1">
        <div className="text-xs mb-1">Opacity: {Math.round(strokeStyle.opacity * 100)}%</div>
        <Slider
          value={[strokeStyle.opacity * 100]}
          onValueChange={([val]) => onStyleChange({ opacity: val / 100 })}
          min={10}
          max={100}
          step={5}
        />
      </div>

      <div className="h-px bg-border" />

      {/* Undo/Redo */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* Zoom Controls */}
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomReset}
          className="px-2 text-xs"
          title="Reset Zoom"
        >
          {Math.round(viewport.scale * 100)}%
        </Button>
        <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* Page Navigation */}
      <div className="flex flex-col items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAddPage('up')}
          title="Add/Go Page Up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAddPage('left')}
            title="Add/Go Page Left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="w-12 h-8 flex items-center justify-center text-xs font-mono bg-muted rounded">
            {getPageLabel(pagePosition)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAddPage('right')}
            title="Add/Go Page Right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAddPage('down')}
          title="Add/Go Page Down"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* Selection Actions */}
      {hasSelection && (
        <>
          <div className="flex gap-1 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onCopy} title="Copy (Ctrl+C)">
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={onCut} title="Cut (Ctrl+X)">
              Cut
            </Button>
            <Button variant="ghost" size="sm" onClick={onPaste} title="Paste (Ctrl+V)">
              Paste
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
              Delete
            </Button>
          </div>
          <div className="h-px bg-border" />
        </>
      )}

      {/* Layers & Export */}
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={onOpenLayers} title="Layers">
          <Layers className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onExport} title="Export">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
