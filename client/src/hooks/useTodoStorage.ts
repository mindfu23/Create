/**
 * useTodoStorage Hook
 * 
 * React hook for managing todos with IndexedDB storage.
 * Links todos to projects and handles sorting/filtering.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TodoStorageEntry,
  getAllTodos,
  getSortedTodos,
  createTodo,
  toggleTodo,
  deleteTodo,
  updateTodoText,
  updateTodoProject,
  getCompletedTodos,
  clearCompletedTodos,
  permanentlyDeleteTodo,
  permanentlyDeleteTodos,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
} from '@/lib/todoStorage';

export interface ProjectInfo {
  id: string;
  name: string;
}

interface UseTodoStorageOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTodoStorageReturn {
  // Data
  todos: TodoStorageEntry[];
  completedTodos: TodoStorageEntry[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addTodo: (text: string, projectId?: string) => Promise<TodoStorageEntry | null>;
  toggle: (id: string) => Promise<TodoStorageEntry | null>;
  remove: (id: string) => Promise<boolean>;
  updateText: (id: string, text: string) => Promise<TodoStorageEntry | null>;
  changeProject: (id: string, projectId: string) => Promise<TodoStorageEntry | null>;
  clearCompleted: () => Promise<number>;
  permanentDelete: (id: string) => Promise<boolean>;
  permanentDeleteMultiple: (ids: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
  
  // Project helpers
  getProjectsWithTodos: () => ProjectInfo[];
  getTodosByProject: (projectId: string) => TodoStorageEntry[];
}

// Default project always available
const DEFAULT_PROJECT: ProjectInfo = {
  id: DEFAULT_PROJECT_ID,
  name: DEFAULT_PROJECT_NAME,
};

export function useTodoStorage(options: UseTodoStorageOptions = {}): UseTodoStorageReturn {
  const { autoRefresh = true, refreshInterval = 5000 } = options;
  
  const [todos, setTodos] = useState<TodoStorageEntry[]>([]);
  const [completedTodos, setCompletedTodos] = useState<TodoStorageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const initialized = useRef(false);

  // Load todos from storage
  const loadTodos = useCallback(async () => {
    try {
      const sorted = await getSortedTodos();
      const active = sorted.filter(t => !t.done);
      const completed = sorted.filter(t => t.done);
      
      setTodos(active);
      setCompletedTodos(completed);
      setError(null);
    } catch (err) {
      console.error('Failed to load todos:', err);
      setError('Failed to load todos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize and auto-refresh
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    loadTodos();
  }, [loadTodos]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(loadTodos, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadTodos]);

  // Add a new todo
  const addTodo = useCallback(async (text: string, projectId: string = DEFAULT_PROJECT_ID): Promise<TodoStorageEntry | null> => {
    try {
      const newTodo = await createTodo(text, projectId);
      if (newTodo) {
        await loadTodos();
      }
      return newTodo;
    } catch (err) {
      console.error('Failed to add todo:', err);
      return null;
    }
  }, [loadTodos]);

  // Toggle todo completion
  const toggle = useCallback(async (id: string): Promise<TodoStorageEntry | null> => {
    try {
      const updated = await toggleTodo(id);
      if (updated) {
        await loadTodos();
      }
      return updated;
    } catch (err) {
      console.error('Failed to toggle todo:', err);
      return null;
    }
  }, [loadTodos]);

  // Remove (soft delete) a todo
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await deleteTodo(id);
      if (success) {
        await loadTodos();
      }
      return success;
    } catch (err) {
      console.error('Failed to remove todo:', err);
      return false;
    }
  }, [loadTodos]);

  // Update todo text
  const updateText = useCallback(async (id: string, text: string): Promise<TodoStorageEntry | null> => {
    try {
      const updated = await updateTodoText(id, text);
      if (updated) {
        await loadTodos();
      }
      return updated;
    } catch (err) {
      console.error('Failed to update todo text:', err);
      return null;
    }
  }, [loadTodos]);

  // Change todo's project
  const changeProject = useCallback(async (id: string, projectId: string): Promise<TodoStorageEntry | null> => {
    try {
      const updated = await updateTodoProject(id, projectId);
      if (updated) {
        await loadTodos();
      }
      return updated;
    } catch (err) {
      console.error('Failed to change todo project:', err);
      return null;
    }
  }, [loadTodos]);

  // Clear all completed todos
  const clearCompletedAction = useCallback(async (): Promise<number> => {
    try {
      const count = await clearCompletedTodos();
      await loadTodos();
      return count;
    } catch (err) {
      console.error('Failed to clear completed:', err);
      return 0;
    }
  }, [loadTodos]);

  // Permanently delete a single todo
  const permanentDelete = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await permanentlyDeleteTodo(id);
      if (success) {
        await loadTodos();
      }
      return success;
    } catch (err) {
      console.error('Failed to permanently delete:', err);
      return false;
    }
  }, [loadTodos]);

  // Permanently delete multiple todos
  const permanentDeleteMultiple = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const success = await permanentlyDeleteTodos(ids);
      if (success) {
        await loadTodos();
      }
      return success;
    } catch (err) {
      console.error('Failed to permanently delete multiple:', err);
      return false;
    }
  }, [loadTodos]);

  // Get list of projects that have todos
  const getProjectsWithTodos = useCallback((): ProjectInfo[] => {
    const projectIds = new Set<string>();
    
    // Always include default project
    projectIds.add(DEFAULT_PROJECT_ID);
    
    // Add projects from todos
    [...todos, ...completedTodos].forEach(todo => {
      projectIds.add(todo.projectId);
    });
    
    // Return project infos (we'll need to look up names from projectStorage)
    return Array.from(projectIds).map(id => ({
      id,
      name: id === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_NAME : id,
    }));
  }, [todos, completedTodos]);

  // Get todos for a specific project
  const getTodosByProject = useCallback((projectId: string): TodoStorageEntry[] => {
    return todos.filter(t => t.projectId === projectId);
  }, [todos]);

  return {
    todos,
    completedTodos,
    isLoading,
    error,
    addTodo,
    toggle,
    remove,
    updateText,
    changeProject,
    clearCompleted: clearCompletedAction,
    permanentDelete,
    permanentDeleteMultiple,
    refresh: loadTodos,
    getProjectsWithTodos,
    getTodosByProject,
  };
}
