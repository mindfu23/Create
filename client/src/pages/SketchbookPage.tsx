/**
 * Sketchbook Page
 * 
 * Main drawing interface with tools, layers, and infinite canvas.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Save, FolderOpen, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSketchbookStorage } from '@/hooks/useSketchbookStorage';
import { SketchCanvas } from '@/components/sketchbook/SketchCanvas';
import { SketchToolbar } from '@/components/sketchbook/SketchToolbar';
import { LayersPanel } from '@/components/sketchbook/LayersPanel';
import { exportPage, type ExportFormat } from '@/lib/sketchbook/exportPsd';
import type {
  DrawingTool,
  StrokeStyle,
  Viewport,
  Selection,
  Sketchbook,
} from '@shared/sketchbook';
import { getPageLabel } from '@shared/sketchbook';

export function SketchbookPage(): JSX.Element {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Storage hook
  const {
    sketchbook,
    currentPage,
    currentLayer,
    isLoading,
    isSaving,
    canUndo,
    canRedo,
    clipboard,
    createNew,
    load,
    loadAll,
    save,
    addPage,
    goToPage,
    navigatePage,
    addLayer,
    removeLayer,
    selectLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    renameLayer,
    addStroke,
    removeStroke,
    copySelection,
    cutSelection,
    paste,
    deleteSelection,
    moveSelection,
    undo,
    redo,
  } = useSketchbookStorage();

  // Local state
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>({
    color: '#000000',
    size: 8,
    opacity: 1,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.1,
    maxScale: 5,
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Dialogs
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [newSketchbookName, setNewSketchbookName] = useState('Untitled Sketchbook');
  const [savedSketchbooks, setSavedSketchbooks] = useState<Sketchbook[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportFilename, setExportFilename] = useState('');

  // Resize observer for canvas size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setCanvasSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Create new sketchbook on first load if none exists
  useEffect(() => {
    if (!sketchbook && !isLoading) {
      setShowNewDialog(true);
    }
  }, [sketchbook, isLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'c':
            e.preventDefault();
            if (selectedStrokeIds.length > 0) {
              copySelection(selectedStrokeIds);
              toast({ title: 'Copied', description: `${selectedStrokeIds.length} stroke(s) copied` });
            }
            break;
          case 'x':
            e.preventDefault();
            if (selectedStrokeIds.length > 0) {
              cutSelection(selectedStrokeIds);
              toast({ title: 'Cut', description: `${selectedStrokeIds.length} stroke(s) cut` });
            }
            break;
          case 'v':
            e.preventDefault();
            if (clipboard) {
              paste();
              toast({ title: 'Pasted', description: 'Strokes pasted' });
            }
            break;
          case 's':
            e.preventDefault();
            save();
            toast({ title: 'Saved', description: 'Sketchbook saved' });
            break;
        }
      } else {
        // Tool shortcuts
        switch (e.key) {
          case 'p':
            setTool('pen');
            break;
          case 'e':
            setTool('eraser');
            break;
          case 'v':
            setTool('select-rect');
            break;
          case 'l':
            setTool('select-lasso');
            break;
          case ' ':
            setTool('pan');
            break;
          case 'Delete':
          case 'Backspace':
            if (selectedStrokeIds.length > 0) {
              deleteSelection(selectedStrokeIds);
              setSelectedStrokeIds([]);
              setSelection(null);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo, redo, copySelection, cutSelection, paste, deleteSelection,
    selectedStrokeIds, clipboard, save, toast
  ]);

  // Handle creating new sketchbook
  const handleCreateNew = async () => {
    if (!newSketchbookName.trim()) {
      toast({ title: 'Error', description: 'Please enter a name', variant: 'destructive' });
      return;
    }

    await createNew(newSketchbookName);
    setShowNewDialog(false);
    setNewSketchbookName('Untitled Sketchbook');
    toast({ title: 'Created', description: 'New sketchbook created' });
  };

  // Handle opening sketchbook picker
  const handleOpenPicker = async () => {
    const all = await loadAll();
    setSavedSketchbooks(all);
    setShowOpenDialog(true);
  };

  // Handle opening a sketchbook
  const handleOpenSketchbook = async (id: string) => {
    await load(id);
    setShowOpenDialog(false);
    toast({ title: 'Opened', description: 'Sketchbook loaded' });
  };

  // Handle export
  const handleExport = async () => {
    if (!currentPage) return;

    const filename = exportFilename.trim() || 
      `${sketchbook?.name || 'sketchbook'}_page_${getPageLabel(currentPage.position)}`;

    try {
      await exportPage(currentPage, { format: exportFormat, filename });
      toast({ title: 'Exported', description: `Saved as ${filename}.${exportFormat}` });
      setShowExportDialog(false);
    } catch (error) {
      toast({ title: 'Export Failed', description: 'Could not export the page', variant: 'destructive' });
    }
  };

  // Open export dialog
  const handleOpenExport = () => {
    if (currentPage) {
      setExportFilename(`${sketchbook?.name || 'sketchbook'}_page_${getPageLabel(currentPage.position)}`);
      setShowExportDialog(true);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setViewport((prev: Viewport) => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, prev.maxScale),
    }));
  };

  const handleZoomOut = () => {
    setViewport((prev: Viewport) => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, prev.minScale),
    }));
  };

  const handleZoomReset = () => {
    setViewport((prev: Viewport) => ({
      ...prev,
      scale: 1,
      x: 0,
      y: 0,
    }));
  };

  // Handle layer opacity change
  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    // This would need to be added to the storage hook
    // For now, we'll just update visually through re-render
  };

  // Handle copy/cut/paste for toolbar
  const handleCopy = () => {
    if (selectedStrokeIds.length > 0) {
      copySelection(selectedStrokeIds);
      toast({ title: 'Copied', description: `${selectedStrokeIds.length} stroke(s) copied` });
    }
  };

  const handleCut = () => {
    if (selectedStrokeIds.length > 0) {
      cutSelection(selectedStrokeIds);
      setSelectedStrokeIds([]);
      setSelection(null);
      toast({ title: 'Cut', description: `${selectedStrokeIds.length} stroke(s) cut` });
    }
  };

  const handlePaste = () => {
    if (clipboard) {
      paste();
      toast({ title: 'Pasted', description: 'Strokes pasted' });
    }
  };

  const handleDelete = () => {
    if (selectedStrokeIds.length > 0) {
      deleteSelection(selectedStrokeIds);
      setSelectedStrokeIds([]);
      setSelection(null);
      toast({ title: 'Deleted', description: `${selectedStrokeIds.length} stroke(s) deleted` });
    }
  };

  // Handle selection move
  const handleSelectionMove = (dx: number, dy: number) => {
    if (selectedStrokeIds.length > 0) {
      moveSelection(selectedStrokeIds, dx, dy);
    }
  };

  return (
    <div className="bg-black w-full min-w-[375px] h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="w-full h-[60px] bg-[#f3c053] flex items-center px-4 gap-4 flex-shrink-0">
        <button onClick={() => setLocation('/')} className="p-1">
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-2xl flex-1 truncate">
          {sketchbook?.name || 'Sketchbook'}
        </h1>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenPicker}
            title="Open Sketchbook"
          >
            <FolderOpen className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNewDialog(true)}
            title="New Sketchbook"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={save}
            disabled={isSaving}
            title="Save"
          >
            <Save className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        {currentPage && (
          <div className="p-2 bg-gray-900 flex-shrink-0">
            <SketchToolbar
              tool={tool}
              strokeStyle={strokeStyle}
              viewport={viewport}
              pagePosition={currentPage.position}
              canUndo={canUndo}
              canRedo={canRedo}
              hasSelection={selectedStrokeIds.length > 0}
              onToolChange={setTool}
              onStyleChange={(style: Partial<StrokeStyle>) => setStrokeStyle((prev: StrokeStyle) => ({ ...prev, ...style }))}
              onViewportChange={(vp: Partial<Viewport>) => setViewport((prev: Viewport) => ({ ...prev, ...vp }))}
              onUndo={undo}
              onRedo={redo}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomReset={handleZoomReset}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onDelete={handleDelete}
              onAddPage={addPage}
              onNavigatePage={navigatePage}
              onExport={handleOpenExport}
              onOpenLayers={() => setLayersPanelOpen(true)}
            />
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 bg-gray-800 overflow-hidden relative">
          {currentPage && currentLayer ? (
            <>
              <SketchCanvas
                width={canvasSize.width}
                height={canvasSize.height}
                layers={currentPage.layers}
                currentLayerId={currentLayer.id}
                tool={tool}
                strokeStyle={strokeStyle}
                viewport={viewport}
                selection={selection}
                selectedStrokeIds={selectedStrokeIds}
                onStrokeComplete={addStroke}
                onViewportChange={setViewport}
                onSelectionChange={setSelection}
                onStrokeSelect={setSelectedStrokeIds}
                onSelectionMove={handleSelectionMove}
              />
              {/* Page Navigation */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-1">
                {/* Up arrow */}
                <button
                  onClick={() => addPage('up')}
                  className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                  title="Add/Go to page above"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                
                {/* Middle row: Left, Page Number, Right */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addPage('left')}
                    className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                    title="Add/Go to page left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                    Page {getPageLabel(currentPage.position)}
                    {sketchbook && sketchbook.pages.length > 1 && (
                      <span className="text-gray-400 ml-2">
                        ({sketchbook.pages.findIndex(p => p.id === currentPage.id) + 1} of {sketchbook.pages.length})
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => addPage('right')}
                    className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                    title="Add/Go to page right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Down arrow */}
                <button
                  onClick={() => addPage('down')}
                  className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                  title="Add/Go to page below"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {isLoading ? 'Loading...' : 'No sketchbook open'}
            </div>
          )}
        </div>
      </div>

      {/* Layers Panel */}
      {currentPage && (
        <LayersPanel
          isOpen={layersPanelOpen}
          onClose={() => setLayersPanelOpen(false)}
          layers={currentPage.layers}
          currentLayerId={sketchbook?.currentLayerId || ''}
          onSelectLayer={selectLayer}
          onAddLayer={addLayer}
          onRemoveLayer={removeLayer}
          onToggleVisibility={toggleLayerVisibility}
          onToggleLock={toggleLayerLock}
          onReorderLayer={reorderLayer}
          onRenameLayer={renameLayer}
          onOpacityChange={handleLayerOpacityChange}
        />
      )}

      {/* New Sketchbook Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sketchbook</DialogTitle>
            <DialogDescription>
              Create a new sketchbook to start drawing
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={newSketchbookName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSketchbookName(e.target.value)}
              placeholder="My Sketchbook"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNew}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Sketchbook Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open Sketchbook</DialogTitle>
            <DialogDescription>
              Select a sketchbook to open
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-60 overflow-auto">
            {savedSketchbooks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No saved sketchbooks found
              </p>
            ) : (
              <div className="space-y-2">
                {savedSketchbooks.map((sb) => (
                  <button
                    key={sb.id}
                    onClick={() => handleOpenSketchbook(sb.id)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">{sb.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {sb.pages.length} page(s) · Last edited {new Date(sb.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Page</DialogTitle>
            <DialogDescription>
              Export the current page as an image file
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="format">Format</Label>
              <Select value={exportFormat} onValueChange={(v: string) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG (Flattened)</SelectItem>
                  <SelectItem value="svg">SVG (Vector)</SelectItem>
                  <SelectItem value="psd">PSD (With Layers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filename">Filename</Label>
              <Input
                id="filename"
                value={exportFilename}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFilename(e.target.value)}
                placeholder="my-drawing"
                className="mt-2"
              />
            </div>
            {exportFormat === 'psd' && (
              <p className="text-sm text-muted-foreground">
                PSD export preserves all layers and can be opened in Photoshop, GIMP, or other graphics software.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
