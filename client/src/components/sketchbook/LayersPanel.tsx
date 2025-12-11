/**
 * Layers Panel Component
 * 
 * Manage layers: add, remove, reorder, toggle visibility, rename.
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SketchLayer } from '@shared/sketchbook';

interface LayersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layers: SketchLayer[];
  currentLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: (name?: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onReorderLayer: (layerId: string, newOrder: number) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

export function LayersPanel({
  isOpen,
  onClose,
  layers,
  currentLayerId,
  onSelectLayer,
  onAddLayer,
  onRemoveLayer,
  onToggleVisibility,
  onToggleLock,
  onReorderLayer,
  onRenameLayer,
  onOpacityChange,
}: LayersPanelProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);

  // Sort layers by order (highest first for display)
  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  const handleStartEdit = (layer: SketchLayer) => {
    setEditingLayerId(layer.id);
    setEditName(layer.name);
  };

  const handleSaveEdit = () => {
    if (editingLayerId && editName.trim()) {
      onRenameLayer(editingLayerId, editName.trim());
    }
    setEditingLayerId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingLayerId(null);
    setEditName('');
  };

  const handleMoveUp = (layer: SketchLayer) => {
    const maxOrder = Math.max(...layers.map(l => l.order));
    if (layer.order < maxOrder) {
      onReorderLayer(layer.id, layer.order + 1);
    }
  };

  const handleMoveDown = (layer: SketchLayer) => {
    if (layer.order > 0) {
      onReorderLayer(layer.id, layer.order - 1);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Layers
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddLayer()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Layer
            </Button>
          </SheetTitle>
          <SheetDescription>
            Manage your drawing layers
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {sortedLayers.map((layer) => {
            const isSelected = layer.id === currentLayerId;
            const isEditing = editingLayerId === layer.id;
            const isExpanded = expandedLayerId === layer.id;

            return (
              <div
                key={layer.id}
                className={`border rounded-lg p-2 ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                {/* Layer header */}
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  {/* Visibility toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onToggleVisibility(layer.id)}
                  >
                    {layer.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Lock toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onToggleLock(layer.id)}
                  >
                    {layer.locked ? (
                      <Lock className="h-3 w-3 text-orange-500" />
                    ) : (
                      <Unlock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Layer name */}
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-6 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleSaveEdit}
                      >
                        <Check className="h-3 w-3 text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="flex-1 text-left text-sm truncate hover:underline"
                      onClick={() => onSelectLayer(layer.id)}
                      onDoubleClick={() => handleStartEdit(layer)}
                    >
                      {layer.name}
                    </button>
                  )}

                  {/* Reorder buttons */}
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => handleMoveUp(layer)}
                      disabled={layer.order === Math.max(...layers.map(l => l.order))}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => handleMoveDown(layer)}
                      disabled={layer.order === 0}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemoveLayer(layer.id)}
                    disabled={layers.length <= 1}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>

                {/* Expanded options */}
                {isSelected && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Opacity:</span>
                      <Slider
                        value={[layer.opacity * 100]}
                        onValueChange={([val]) => onOpacityChange(layer.id, val / 100)}
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-xs w-8">{Math.round(layer.opacity * 100)}%</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {layer.strokes.length} stroke{layer.strokes.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {layers.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No layers yet. Click "Add Layer" to create one.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
