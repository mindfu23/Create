/**
 * Todo Storage Service
 * Handles todo storage using IndexedDB
 * Links todos to projects
 */

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  projectId: string;
  createdAt: number;
  completedAt?: number;
  isDeleted?: boolean;
}

export interface TodoStorageEntry {
  id: string;
  text: string;
  done: boolean;
  projectId: string;
  createdAt: number;
  completedAt?: number;
  isDeleted: boolean;
  syncStatus: 'synced' | 'pending' | 'conflict';
  updatedAt: number;
  checksum?: string;
}

const DB_NAME = 'create_todos_db';
const DB_VERSION = 1;
const TODOS_STORE = 'todos';
const METADATA_STORE = 'metadata';

// Default project that always exists
export const DEFAULT_PROJECT_ID = 'default';
export const DEFAULT_PROJECT_NAME = 'Default';

/**
 * Initialize IndexedDB for todos
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(TODOS_STORE)) {
        const store = db.createObjectStore(TODOS_STORE, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('done', 'done', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('completedAt', 'completedAt', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate checksum for sync
 */
async function generateChecksum(todo: Todo): Promise<string> {
  const content = JSON.stringify({
    text: todo.text,
    done: todo.done,
    projectId: todo.projectId,
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Save a todo
 */
export async function saveTodo(todo: Todo): Promise<TodoStorageEntry | null> {
  try {
    const db = await openDatabase();
    const checksum = await generateChecksum(todo);
    
    const entry: TodoStorageEntry = {
      id: todo.id || generateId(),
      text: todo.text,
      done: todo.done,
      projectId: todo.projectId || DEFAULT_PROJECT_ID,
      createdAt: todo.createdAt || Date.now(),
      completedAt: todo.completedAt,
      isDeleted: todo.isDeleted || false,
      syncStatus: 'pending',
      updatedAt: Date.now(),
      checksum,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TODOS_STORE], 'readwrite');
      const store = transaction.objectStore(TODOS_STORE);
      const request = store.put(entry);
      
      request.onsuccess = () => resolve(entry);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save todo:', error);
    return null;
  }
}

/**
 * Get all todos (excluding deleted)
 */
export async function getAllTodos(): Promise<TodoStorageEntry[]> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TODOS_STORE], 'readonly');
      const store = transaction.objectStore(TODOS_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const todos = request.result.filter((t: TodoStorageEntry) => !t.isDeleted);
        resolve(todos);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get todos:', error);
    return [];
  }
}

/**
 * Get todos by project
 */
export async function getTodosByProject(projectId: string): Promise<TodoStorageEntry[]> {
  const allTodos = await getAllTodos();
  return allTodos.filter(t => t.projectId === projectId);
}

/**
 * Get active todos (not done, not deleted)
 */
export async function getActiveTodos(): Promise<TodoStorageEntry[]> {
  const allTodos = await getAllTodos();
  return allTodos.filter(t => !t.done);
}

/**
 * Get completed todos (not deleted)
 */
export async function getCompletedTodos(): Promise<TodoStorageEntry[]> {
  const allTodos = await getAllTodos();
  return allTodos.filter(t => t.done);
}

/**
 * Get a single todo by ID
 */
export async function getTodo(id: string): Promise<TodoStorageEntry | null> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TODOS_STORE], 'readonly');
      const store = transaction.objectStore(TODOS_STORE);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get todo:', error);
    return null;
  }
}

/**
 * Toggle todo completion status
 */
export async function toggleTodo(id: string): Promise<TodoStorageEntry | null> {
  const todo = await getTodo(id);
  if (!todo) return null;
  
  const updated: Todo = {
    ...todo,
    done: !todo.done,
    completedAt: !todo.done ? Date.now() : undefined,
  };
  
  return saveTodo(updated);
}

/**
 * Delete a todo (soft delete)
 */
export async function deleteTodo(id: string): Promise<boolean> {
  const todo = await getTodo(id);
  if (!todo) return false;
  
  const updated: Todo = {
    ...todo,
    isDeleted: true,
  };
  
  const result = await saveTodo(updated);
  return result !== null;
}

/**
 * Permanently delete a todo
 */
export async function permanentlyDeleteTodo(id: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TODOS_STORE], 'readwrite');
      const store = transaction.objectStore(TODOS_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to permanently delete todo:', error);
    return false;
  }
}

/**
 * Permanently delete multiple todos
 */
export async function permanentlyDeleteTodos(ids: string[]): Promise<boolean> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TODOS_STORE], 'readwrite');
      const store = transaction.objectStore(TODOS_STORE);
      
      let remaining = ids.length;
      let success = true;
      
      ids.forEach(id => {
        const request = store.delete(id);
        request.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve(success);
        };
        request.onerror = () => {
          success = false;
          remaining--;
          if (remaining === 0) resolve(success);
        };
      });
      
      if (ids.length === 0) resolve(true);
    });
  } catch (error) {
    console.error('Failed to permanently delete todos:', error);
    return false;
  }
}

/**
 * Move completed todos to "archived" state
 * This marks them as ready for the Completed Tasks view
 */
export async function archiveCompletedTodos(): Promise<TodoStorageEntry[]> {
  const completed = await getCompletedTodos();
  return completed;
}

/**
 * Clear all completed todos (move to deleted)
 */
export async function clearCompletedTodos(): Promise<number> {
  const completed = await getCompletedTodos();
  let count = 0;
  
  for (const todo of completed) {
    const success = await deleteTodo(todo.id);
    if (success) count++;
  }
  
  return count;
}

/**
 * Create a new todo
 */
export async function createTodo(
  text: string, 
  projectId: string = DEFAULT_PROJECT_ID
): Promise<TodoStorageEntry | null> {
  const todo: Todo = {
    id: generateId(),
    text,
    done: false,
    projectId,
    createdAt: Date.now(),
  };
  
  return saveTodo(todo);
}

/**
 * Update todo text
 */
export async function updateTodoText(id: string, text: string): Promise<TodoStorageEntry | null> {
  const todo = await getTodo(id);
  if (!todo) return null;
  
  const updated: Todo = {
    ...todo,
    text,
  };
  
  return saveTodo(updated);
}

/**
 * Update todo project
 */
export async function updateTodoProject(id: string, projectId: string): Promise<TodoStorageEntry | null> {
  const todo = await getTodo(id);
  if (!todo) return null;
  
  const updated: Todo = {
    ...todo,
    projectId,
  };
  
  return saveTodo(updated);
}

/**
 * Get todos sorted: active first (newest first), then completed (most recently completed first)
 */
export async function getSortedTodos(): Promise<TodoStorageEntry[]> {
  const allTodos = await getAllTodos();
  
  const active = allTodos
    .filter(t => !t.done)
    .sort((a, b) => b.createdAt - a.createdAt);
  
  const completed = allTodos
    .filter(t => t.done)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  
  return [...active, ...completed];
}

/**
 * Get todos grouped by project
 */
export async function getTodosGroupedByProject(): Promise<Map<string, TodoStorageEntry[]>> {
  const allTodos = await getAllTodos();
  const grouped = new Map<string, TodoStorageEntry[]>();
  
  allTodos.forEach(todo => {
    const existing = grouped.get(todo.projectId) || [];
    existing.push(todo);
    grouped.set(todo.projectId, existing);
  });
  
  return grouped;
}
