/**
 * Sketchbook Storage Hook
 * 
 * Manages sketchbook persistence in IndexedDB and provides undo/redo functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Sketchbook,
  SketchPage,
  SketchLayer,
  Stroke,
  SketchAction,
  SketchHistory,
  PagePosition,
  SketchClipboard,
} from '@shared/sketchbook';
import {
  createSketchbook,
  createPage,
  createLayer,
} from '@shared/sketchbook';

// IndexedDB database name and store
const DB_NAME = 'createcamp_sketchbook';
const DB_VERSION = 1;
const STORE_NAME = 'sketchbooks';

// Open IndexedDB connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save sketchbook to IndexedDB
async function saveSketchbook(sketchbook: Sketchbook): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      ...sketchbook,
      updatedAt: new Date().toISOString(),
    });
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Load sketchbook from IndexedDB
async function loadSketchbook(id: string): Promise<Sketchbook | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// Load all sketchbooks
async function loadAllSketchbooks(): Promise<Sketchbook[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

// Delete sketchbook from IndexedDB
async function deleteSketchbookFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

interface UseSketchbookStorageOptions {
  sketchbookId?: string;
  autoSave?: boolean;
  maxHistorySize?: number;
}

interface UseSketchbookStorageReturn {
  // State
  sketchbook: Sketchbook | null;
  currentPage: SketchPage | null;
  currentLayer: SketchLayer | null;
  isLoading: boolean;
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  clipboard: SketchClipboard | null;
  
  // Sketchbook operations
  createNew: (name: string) => Promise<Sketchbook>;
  load: (id: string) => Promise<void>;
  loadAll: () => Promise<Sketchbook[]>;
  save: () => Promise<void>;
  deleteSketchbook: (id: string) => Promise<void>;
  
  // Page operations
  addPage: (direction: 'up' | 'down' | 'left' | 'right') => void;
  goToPage: (pageId: string) => void;
  navigatePage: (direction: 'up' | 'down' | 'left' | 'right') => void;
  
  // Layer operations
  addLayer: (name?: string) => void;
  removeLayer: (layerId: string) => void;
  selectLayer: (layerId: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  reorderLayer: (layerId: string, newOrder: number) => void;
  renameLayer: (layerId: string, name: string) => void;
  
  // Stroke operations
  addStroke: (stroke: Stroke) => void;
  removeStroke: (strokeId: string) => void;
  
  // Selection operations
  copySelection: (strokeIds: string[]) => void;
  cutSelection: (strokeIds: string[]) => void;
  paste: () => void;
  deleteSelection: (strokeIds: string[]) => void;
  moveSelection: (strokeIds: string[], dx: number, dy: number) => void;
  
  // History operations
  undo: () => void;
  redo: () => void;
}

export function useSketchbookStorage(
  options: UseSketchbookStorageOptions = {}
): UseSketchbookStorageReturn {
  const { autoSave = true, maxHistorySize = 11 } = options;
  
  const [sketchbook, setSketchbook] = useState<Sketchbook | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clipboard, setClipboard] = useState<SketchClipboard | null>(null);
  
  // History for undo/redo
  const historyRef = useRef<SketchHistory>({
    past: [],
    future: [],
    maxSize: maxHistorySize,
  });
  
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  
  // Get current page
  const currentPage = sketchbook?.pages.find(p => p.id === sketchbook.currentPageId) || null;
  
  // Get current layer
  const currentLayer = currentPage?.layers.find(l => l.id === sketchbook?.currentLayerId) || null;
  
  // Update history state
  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }, []);
  
  // Push action to history
  const pushToHistory = useCallback((action: SketchAction) => {
    const history = historyRef.current;
    history.past.push(action);
    history.future = []; // Clear redo stack
    
    // Trim history if too large
    if (history.past.length > history.maxSize) {
      history.past.shift();
    }
    
    updateHistoryState();
  }, [updateHistoryState]);
  
  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !sketchbook) return;
    
    const timeout = setTimeout(() => {
      saveSketchbook(sketchbook);
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [sketchbook, autoSave]);
  
  // Create new sketchbook
  const createNew = useCallback(async (name: string): Promise<Sketchbook> => {
    const newSketchbook = createSketchbook(name);
    await saveSketchbook(newSketchbook);
    setSketchbook(newSketchbook);
    historyRef.current = { past: [], future: [], maxSize: maxHistorySize };
    updateHistoryState();
    return newSketchbook;
  }, [maxHistorySize, updateHistoryState]);
  
  // Load sketchbook
  const load = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const loaded = await loadSketchbook(id);
      if (loaded) {
        setSketchbook(loaded);
        historyRef.current = { past: [], future: [], maxSize: maxHistorySize };
        updateHistoryState();
      }
    } finally {
      setIsLoading(false);
    }
  }, [maxHistorySize, updateHistoryState]);
  
  // Load all sketchbooks
  const loadAll = useCallback(async (): Promise<Sketchbook[]> => {
    return loadAllSketchbooks();
  }, []);
  
  // Save sketchbook
  const save = useCallback(async (): Promise<void> => {
    if (!sketchbook) return;
    setIsSaving(true);
    try {
      await saveSketchbook(sketchbook);
    } finally {
      setIsSaving(false);
    }
  }, [sketchbook]);
  
  // Delete sketchbook
  const deleteSketchbook = useCallback(async (id: string): Promise<void> => {
    await deleteSketchbookFromDB(id);
    if (sketchbook?.id === id) {
      setSketchbook(null);
    }
  }, [sketchbook]);
  
  // Add page in direction
  const addPage = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!sketchbook || !currentPage) return;
    
    const newPosition: PagePosition = { ...currentPage.position };
    switch (direction) {
      case 'up': newPosition.y -= 1; break;
      case 'down': newPosition.y += 1; break;
      case 'left': newPosition.x -= 1; break;
      case 'right': newPosition.x += 1; break;
    }
    
    // Check if page already exists at position
    const existing = sketchbook.pages.find(
      p => p.position.x === newPosition.x && p.position.y === newPosition.y
    );
    
    if (existing) {
      // Navigate to existing page
      setSketchbook(prev => prev ? {
        ...prev,
        currentPageId: existing.id,
        currentLayerId: existing.layers[0]?.id || prev.currentLayerId,
      } : null);
    } else {
      // Create new page
      const newPage = createPage(newPosition, sketchbook.defaultPageSize);
      setSketchbook(prev => prev ? {
        ...prev,
        pages: [...prev.pages, newPage],
        currentPageId: newPage.id,
        currentLayerId: newPage.layers[0].id,
      } : null);
    }
  }, [sketchbook, currentPage]);
  
  // Go to specific page
  const goToPage = useCallback((pageId: string) => {
    if (!sketchbook) return;
    const page = sketchbook.pages.find(p => p.id === pageId);
    if (page) {
      setSketchbook(prev => prev ? {
        ...prev,
        currentPageId: pageId,
        currentLayerId: page.layers[0]?.id || prev.currentLayerId,
      } : null);
    }
  }, [sketchbook]);
  
  // Navigate to adjacent page
  const navigatePage = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!sketchbook || !currentPage) return;
    
    const targetPosition: PagePosition = { ...currentPage.position };
    switch (direction) {
      case 'up': targetPosition.y -= 1; break;
      case 'down': targetPosition.y += 1; break;
      case 'left': targetPosition.x -= 1; break;
      case 'right': targetPosition.x += 1; break;
    }
    
    const targetPage = sketchbook.pages.find(
      p => p.position.x === targetPosition.x && p.position.y === targetPosition.y
    );
    
    if (targetPage) {
      goToPage(targetPage.id);
    }
  }, [sketchbook, currentPage, goToPage]);
  
  // Add layer
  const addLayer = useCallback((name?: string) => {
    if (!sketchbook || !currentPage) return;
    
    const maxOrder = Math.max(...currentPage.layers.map(l => l.order), -1);
    const newLayer = createLayer(maxOrder + 1, name);
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? { ...p, layers: [...p.layers, newLayer] }
            : p
        ),
        currentLayerId: newLayer.id,
      };
    });
    
    pushToHistory({ type: 'add-layer', pageId: currentPage.id, layer: newLayer });
  }, [sketchbook, currentPage, pushToHistory]);
  
  // Remove layer
  const removeLayer = useCallback((layerId: string) => {
    if (!sketchbook || !currentPage) return;
    if (currentPage.layers.length <= 1) return; // Keep at least one layer
    
    const layer = currentPage.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      const newLayers = currentPage.layers.filter(l => l.id !== layerId);
      const newCurrentLayerId = prev.currentLayerId === layerId
        ? newLayers[0]?.id || prev.currentLayerId
        : prev.currentLayerId;
      
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? { ...p, layers: newLayers }
            : p
        ),
        currentLayerId: newCurrentLayerId,
      };
    });
    
    pushToHistory({ type: 'remove-layer', pageId: currentPage.id, layer });
  }, [sketchbook, currentPage, pushToHistory]);
  
  // Select layer
  const selectLayer = useCallback((layerId: string) => {
    if (!sketchbook) return;
    setSketchbook(prev => prev ? { ...prev, currentLayerId: layerId } : null);
  }, [sketchbook]);
  
  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layerId: string) => {
    if (!sketchbook || !currentPage) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === layerId ? { ...l, visible: !l.visible } : l
                ),
              }
            : p
        ),
      };
    });
    
    pushToHistory({ type: 'toggle-layer-visibility', pageId: currentPage.id, layerId });
  }, [sketchbook, currentPage, pushToHistory]);
  
  // Toggle layer lock
  const toggleLayerLock = useCallback((layerId: string) => {
    if (!sketchbook || !currentPage) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === layerId ? { ...l, locked: !l.locked } : l
                ),
              }
            : p
        ),
      };
    });
  }, [sketchbook, currentPage]);
  
  // Reorder layer
  const reorderLayer = useCallback((layerId: string, newOrder: number) => {
    if (!sketchbook || !currentPage) return;
    
    const layer = currentPage.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const oldOrder = layer.order;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l => {
                  if (l.id === layerId) {
                    return { ...l, order: newOrder };
                  }
                  // Shift other layers
                  if (oldOrder < newOrder && l.order > oldOrder && l.order <= newOrder) {
                    return { ...l, order: l.order - 1 };
                  }
                  if (oldOrder > newOrder && l.order < oldOrder && l.order >= newOrder) {
                    return { ...l, order: l.order + 1 };
                  }
                  return l;
                }),
              }
            : p
        ),
      };
    });
    
    pushToHistory({ type: 'reorder-layer', pageId: currentPage.id, layerId, oldOrder, newOrder });
  }, [sketchbook, currentPage, pushToHistory]);
  
  // Rename layer
  const renameLayer = useCallback((layerId: string, name: string) => {
    if (!sketchbook || !currentPage) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === layerId ? { ...l, name } : l
                ),
              }
            : p
        ),
      };
    });
  }, [sketchbook, currentPage]);
  
  // Add stroke
  const addStroke = useCallback((stroke: Stroke) => {
    if (!sketchbook || !currentPage || !currentLayer) return;
    if (currentLayer.locked) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === currentLayer.id
                    ? { ...l, strokes: [...l.strokes, stroke] }
                    : l
                ),
              }
            : p
        ),
      };
    });
    
    pushToHistory({
      type: 'add-stroke',
      pageId: currentPage.id,
      layerId: currentLayer.id,
      stroke,
    });
  }, [sketchbook, currentPage, currentLayer, pushToHistory]);
  
  // Remove stroke
  const removeStroke = useCallback((strokeId: string) => {
    if (!sketchbook || !currentPage || !currentLayer) return;
    
    const stroke = currentLayer.strokes.find(s => s.id === strokeId);
    if (!stroke) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === currentLayer.id
                    ? { ...l, strokes: l.strokes.filter(s => s.id !== strokeId) }
                    : l
                ),
              }
            : p
        ),
      };
    });
    
    pushToHistory({
      type: 'remove-stroke',
      pageId: currentPage.id,
      layerId: currentLayer.id,
      strokeId,
      stroke,
    });
  }, [sketchbook, currentPage, currentLayer, pushToHistory]);
  
  // Copy selection
  const copySelection = useCallback((strokeIds: string[]) => {
    if (!currentPage || !currentLayer) return;
    
    const strokes = currentLayer.strokes.filter(s => strokeIds.includes(s.id));
    if (strokes.length === 0) return;
    
    setClipboard({
      strokes: JSON.parse(JSON.stringify(strokes)), // Deep copy
      sourcePageId: currentPage.id,
      sourceLayerId: currentLayer.id,
    });
  }, [currentPage, currentLayer]);
  
  // Cut selection
  const cutSelection = useCallback((strokeIds: string[]) => {
    copySelection(strokeIds);
    deleteSelection(strokeIds);
  }, [copySelection]);
  
  // Paste
  const paste = useCallback(() => {
    if (!clipboard || !sketchbook || !currentPage || !currentLayer) return;
    if (currentLayer.locked) return;
    
    // Generate new IDs for pasted strokes
    const newStrokes = clipboard.strokes.map(s => ({
      ...s,
      id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      // Offset slightly so paste is visible
      points: s.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 })),
    }));
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === currentLayer.id
                    ? { ...l, strokes: [...l.strokes, ...newStrokes] }
                    : l
                ),
              }
            : p
        ),
      };
    });
    
    pushToHistory({
      type: 'paste-strokes',
      pageId: currentPage.id,
      layerId: currentLayer.id,
      strokes: newStrokes,
    });
  }, [clipboard, sketchbook, currentPage, currentLayer, pushToHistory]);
  
  // Delete selection
  const deleteSelection = useCallback((strokeIds: string[]) => {
    if (!sketchbook || !currentPage || !currentLayer) return;
    if (currentLayer.locked) return;
    
    const deletedStrokes = currentLayer.strokes.filter(s => strokeIds.includes(s.id));
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === currentLayer.id
                    ? { ...l, strokes: l.strokes.filter(s => !strokeIds.includes(s.id)) }
                    : l
                ),
              }
            : p
        ),
      };
    });
    
    pushToHistory({
      type: 'clear-selection',
      pageId: currentPage.id,
      layerId: currentLayer.id,
      strokes: deletedStrokes,
    });
  }, [sketchbook, currentPage, currentLayer, pushToHistory]);
  
  // Move selection
  const moveSelection = useCallback((strokeIds: string[], dx: number, dy: number) => {
    if (!sketchbook || !currentPage || !currentLayer) return;
    if (currentLayer.locked) return;
    
    setSketchbook(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPage.id
            ? {
                ...p,
                layers: p.layers.map(l =>
                  l.id === currentLayer.id
                    ? {
                        ...l,
                        strokes: l.strokes.map(s =>
                          strokeIds.includes(s.id)
                            ? {
                                ...s,
                                points: s.points.map(pt => ({
                                  ...pt,
                                  x: pt.x + dx,
                                  y: pt.y + dy,
                                })),
                              }
                            : s
                        ),
                      }
                    : l
                ),
              }
            : p
        ),
      };
    });
    
    pushToHistory({
      type: 'move-selection',
      pageId: currentPage.id,
      layerId: currentLayer.id,
      strokeIds,
      dx,
      dy,
    });
  }, [sketchbook, currentPage, currentLayer, pushToHistory]);
  
  // Undo
  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.past.length === 0 || !sketchbook) return;
    
    const action = history.past.pop()!;
    history.future.push(action);
    
    // Apply inverse of action
    setSketchbook(prev => {
      if (!prev) return null;
      
      switch (action.type) {
        case 'add-stroke':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? { ...l, strokes: l.strokes.filter(s => s.id !== action.stroke.id) }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'remove-stroke':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? { ...l, strokes: [...l.strokes, action.stroke] }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'add-layer':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? { ...p, layers: p.layers.filter(l => l.id !== action.layer.id) }
                : p
            ),
          };
        
        case 'remove-layer':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? { ...p, layers: [...p.layers, action.layer] }
                : p
            ),
          };
        
        case 'toggle-layer-visibility':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId ? { ...l, visible: !l.visible } : l
                    ),
                  }
                : p
            ),
          };
        
        case 'clear-selection':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? { ...l, strokes: [...l.strokes, ...action.strokes] }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'paste-strokes':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? {
                            ...l,
                            strokes: l.strokes.filter(
                              s => !action.strokes.some(ps => ps.id === s.id)
                            ),
                          }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'move-selection':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? {
                            ...l,
                            strokes: l.strokes.map(s =>
                              action.strokeIds.includes(s.id)
                                ? {
                                    ...s,
                                    points: s.points.map(pt => ({
                                      ...pt,
                                      x: pt.x - action.dx,
                                      y: pt.y - action.dy,
                                    })),
                                  }
                                : s
                            ),
                          }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        default:
          return prev;
      }
    });
    
    updateHistoryState();
  }, [sketchbook, updateHistoryState]);
  
  // Redo
  const redo = useCallback(() => {
    const history = historyRef.current;
    if (history.future.length === 0 || !sketchbook) return;
    
    const action = history.future.pop()!;
    history.past.push(action);
    
    // Reapply action
    setSketchbook(prev => {
      if (!prev) return null;
      
      switch (action.type) {
        case 'add-stroke':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? { ...l, strokes: [...l.strokes, action.stroke] }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'remove-stroke':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? { ...l, strokes: l.strokes.filter(s => s.id !== action.strokeId) }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'add-layer':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? { ...p, layers: [...p.layers, action.layer] }
                : p
            ),
          };
        
        case 'remove-layer':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? { ...p, layers: p.layers.filter(l => l.id !== action.layer.id) }
                : p
            ),
          };
        
        case 'toggle-layer-visibility':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId ? { ...l, visible: !l.visible } : l
                    ),
                  }
                : p
            ),
          };
        
        case 'clear-selection':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? {
                            ...l,
                            strokes: l.strokes.filter(
                              s => !action.strokes.some(ds => ds.id === s.id)
                            ),
                          }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'paste-strokes':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? { ...l, strokes: [...l.strokes, ...action.strokes] }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        case 'move-selection':
          return {
            ...prev,
            pages: prev.pages.map(p =>
              p.id === action.pageId
                ? {
                    ...p,
                    layers: p.layers.map(l =>
                      l.id === action.layerId
                        ? {
                            ...l,
                            strokes: l.strokes.map(s =>
                              action.strokeIds.includes(s.id)
                                ? {
                                    ...s,
                                    points: s.points.map(pt => ({
                                      ...pt,
                                      x: pt.x + action.dx,
                                      y: pt.y + action.dy,
                                    })),
                                  }
                                : s
                            ),
                          }
                        : l
                    ),
                  }
                : p
            ),
          };
        
        default:
          return prev;
      }
    });
    
    updateHistoryState();
  }, [sketchbook, updateHistoryState]);
  
  return {
    sketchbook,
    currentPage,
    currentLayer,
    isLoading,
    isSaving,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    clipboard,
    
    createNew,
    load,
    loadAll,
    save,
    deleteSketchbook,
    
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
  };
}
