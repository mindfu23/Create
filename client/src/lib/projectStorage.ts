/**
 * Local Storage Service for Projects
 * Handles storage on device using IndexedDB
 * Works on web, iOS (Capacitor), and Android (Capacitor)
 * NOTE: Projects are NOT encrypted (unlike Journal)
 */

export interface Task {
  id: string;
  text: string;
  done: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  isDeleted?: boolean;
}

const DB_NAME = 'create_projects_db';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const METADATA_STORE = 'metadata';

/**
 * Initialize IndexedDB for projects
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('syncedAt', 'syncedAt', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get or create device ID
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    
    const getRequest = store.get('deviceId');
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        resolve(getRequest.result.value);
      } else {
        const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        store.put({ key: 'deviceId', value: deviceId });
        resolve(deviceId);
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Save project to local storage
 */
export async function saveProject(project: Project): Promise<Project> {
  const db = await openDatabase();
  
  const projectToSave: Project = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const request = store.put(projectToSave);
    
    request.onsuccess = () => resolve(projectToSave);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all projects
 */
export async function getAllProjects(): Promise<Project[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const request = store.getAll();
    
    request.onsuccess = () => {
      const projects = request.result.filter((p: Project) => !p.isDeleted);
      resolve(projects);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get single project by ID
 */
export async function getProject(id: string): Promise<Project | null> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (!request.result || request.result.isDeleted) {
        resolve(null);
      } else {
        resolve(request.result);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Soft delete project
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const project = getRequest.result;
        project.isDeleted = true;
        project.updatedAt = new Date().toISOString();
        
        const putRequest = store.put(project);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Get projects that need syncing
 */
export async function getUnsyncedProjects(): Promise<Project[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const request = store.getAll();
    
    request.onsuccess = () => {
      const projects = request.result.filter((project: Project) => {
        if (!project.syncedAt) return true;
        return new Date(project.updatedAt) > new Date(project.syncedAt);
      });
      
      resolve(projects);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark project as synced
 */
export async function markAsSynced(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const project = getRequest.result;
        project.syncedAt = new Date().toISOString();
        
        const putRequest = store.put(project);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Handle conflict by creating a conflicted copy
 */
export async function createConflictedCopy(
  conflictingProject: Project
): Promise<Project> {
  const db = await openDatabase();
  
  const conflictedProject: Project = {
    ...conflictingProject,
    id: `${conflictingProject.id}_conflicted_copy_${Date.now()}`,
    name: `${conflictingProject.name}_conflicted_copy`,
    updatedAt: new Date().toISOString(),
    syncedAt: undefined,
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    
    const request = store.put(conflictedProject);
    
    request.onsuccess = () => resolve(conflictedProject);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import projects from server (for sync)
 */
export async function importProjects(
  serverProjects: Project[]
): Promise<{ imported: number; conflicts: number }> {
  const db = await openDatabase();
  let imported = 0;
  let conflicts = 0;
  
  for (const serverProject of serverProjects) {
    const localProject = await new Promise<Project | null>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.get(serverProject.id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    
    if (!localProject) {
      // No local version, just import
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.put({
          ...serverProject,
          syncedAt: new Date().toISOString(),
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      imported++;
    } else {
      // Check for conflicts by comparing updatedAt
      const localUpdated = new Date(localProject.updatedAt);
      const serverUpdated = new Date(serverProject.updatedAt);
      
      if (serverUpdated > localUpdated) {
        // Server is newer - create conflicted copy of local, import server
        await createConflictedCopy(localProject);
        
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
          const store = transaction.objectStore(PROJECTS_STORE);
          const request = store.put({
            ...serverProject,
            syncedAt: new Date().toISOString(),
          });
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        conflicts++;
      } else if (localUpdated > serverUpdated) {
        // Local is newer - keep local, will be pushed on next sync
        conflicts++;
      }
      // If same timestamp, assume identical
    }
  }
  
  return { imported, conflicts };
}

/**
 * Clear all local project data
 */
export async function clearAllProjects(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROJECTS_STORE, METADATA_STORE], 'readwrite');
    
    transaction.objectStore(PROJECTS_STORE).clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
