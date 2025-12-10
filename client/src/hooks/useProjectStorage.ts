/**
 * React Hook for Project Storage with Sync
 * Handles local storage + server sync (no encryption)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Project,
  Task,
  saveProject,
  getAllProjects,
  getProject,
  deleteProject,
  getUnsyncedProjects,
  markAsSynced,
  importProjects,
  getOrCreateDeviceId,
  clearAllProjects,
} from '@/lib/projectStorage';

interface UseProjectStorageOptions {
  autoSync?: boolean;
  syncInterval?: number;
  userId?: string;
}

interface SyncStatus {
  isSyncing: boolean;
  lastSync?: string;
  error?: string;
}

export function useProjectStorage(options: UseProjectStorageOptions = {}) {
  const { autoSync = true, syncInterval = 30000, userId } = options;

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isSyncing: false });
  const [error, setError] = useState<string | null>(null);

  // Initialize device ID
  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);
  }, []);

  // Load projects on mount
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedProjects = await getAllProjects();
      loadedProjects.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setProjects(loadedProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Create new project
  const createProject = useCallback(async (name: string, description: string): Promise<Project | null> => {
    try {
      const now = new Date().toISOString();
      const newProject: Project = {
        id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        progress: 0,
        tasks: [],
        createdAt: now,
        updatedAt: now,
      };

      await saveProject(newProject);
      await loadProjects();
      
      return newProject;
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project');
      return null;
    }
  }, [loadProjects]);

  // Update project
  const updateProject = useCallback(async (
    id: string, 
    updates: Partial<Pick<Project, 'name' | 'description' | 'tasks' | 'progress'>>
  ): Promise<Project | null> => {
    try {
      const existing = await getProject(id);
      if (!existing) {
        setError('Project not found');
        return null;
      }

      const updatedProject: Project = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await saveProject(updatedProject);
      await loadProjects();
      
      return updatedProject;
    } catch (err) {
      console.error('Failed to update project:', err);
      setError('Failed to update project');
      return null;
    }
  }, [loadProjects]);

  // Add task to project
  const addTask = useCallback(async (projectId: string, text: string): Promise<boolean> => {
    try {
      const project = await getProject(projectId);
      if (!project) return false;

      const newTask: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        done: false,
      };

      const updatedTasks = [...project.tasks, newTask];
      const doneCount = updatedTasks.filter(t => t.done).length;
      const progress = updatedTasks.length > 0 
        ? Math.round((doneCount / updatedTasks.length) * 100) 
        : 0;

      await updateProject(projectId, { tasks: updatedTasks, progress });
      return true;
    } catch (err) {
      console.error('Failed to add task:', err);
      return false;
    }
  }, [updateProject]);

  // Toggle task completion
  const toggleTask = useCallback(async (projectId: string, taskId: string): Promise<boolean> => {
    try {
      const project = await getProject(projectId);
      if (!project) return false;

      const updatedTasks = project.tasks.map(t => 
        t.id === taskId ? { ...t, done: !t.done } : t
      );
      const doneCount = updatedTasks.filter(t => t.done).length;
      const progress = updatedTasks.length > 0 
        ? Math.round((doneCount / updatedTasks.length) * 100) 
        : 0;

      await updateProject(projectId, { tasks: updatedTasks, progress });
      return true;
    } catch (err) {
      console.error('Failed to toggle task:', err);
      return false;
    }
  }, [updateProject]);

  // Delete task
  const deleteTask = useCallback(async (projectId: string, taskId: string): Promise<boolean> => {
    try {
      const project = await getProject(projectId);
      if (!project) return false;

      const updatedTasks = project.tasks.filter(t => t.id !== taskId);
      const doneCount = updatedTasks.filter(t => t.done).length;
      const progress = updatedTasks.length > 0 
        ? Math.round((doneCount / updatedTasks.length) * 100) 
        : 0;

      await updateProject(projectId, { tasks: updatedTasks, progress });
      return true;
    } catch (err) {
      console.error('Failed to delete task:', err);
      return false;
    }
  }, [updateProject]);

  // Delete project
  const removeProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteProject(id);
      await loadProjects();
      return true;
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project');
      return false;
    }
  }, [loadProjects]);

  // Sync with server
  const syncWithServer = useCallback(async (): Promise<{ success: boolean; pushed?: number; pulled?: number; conflicts?: number }> => {
    if (!deviceId || !userId) {
      return { success: false };
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      // Get unsynced local projects
      const unsyncedProjects = await getUnsyncedProjects();

      // Push to server
      if (unsyncedProjects.length > 0) {
        const pushResponse = await fetch('/api/project-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'push',
            userId,
            deviceId,
            projects: unsyncedProjects,
          }),
        });

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json();
          
          for (const project of unsyncedProjects) {
            const isConflict = pushResult.conflicts?.some((c: any) => c.id === project.id);
            if (!isConflict) {
              await markAsSynced(project.id);
            }
          }
        }
      }

      // Pull from server
      const pullResponse = await fetch('/api/project-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull',
          userId,
          deviceId,
          lastSyncTime: syncStatus.lastSync,
        }),
      });

      let pulled = 0;
      let conflicts = 0;

      if (pullResponse.ok) {
        const pullResult = await pullResponse.json();
        
        if (pullResult.projects && pullResult.projects.length > 0) {
          const importResult = await importProjects(pullResult.projects);
          pulled = importResult.imported;
          conflicts = importResult.conflicts;
        }
      }

      await loadProjects();

      const syncTime = new Date().toISOString();
      setSyncStatus({
        isSyncing: false,
        lastSync: syncTime,
      });

      return {
        success: true,
        pushed: unsyncedProjects.length,
        pulled,
        conflicts,
      };

    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Sync failed. Will retry.',
      }));
      return { success: false };
    }
  }, [deviceId, userId, syncStatus.lastSync, loadProjects]);

  // Auto-sync
  useEffect(() => {
    if (!autoSync || !userId) return;

    syncWithServer();

    const interval = setInterval(syncWithServer, syncInterval);
    
    return () => clearInterval(interval);
  }, [autoSync, userId, syncInterval, syncWithServer]);

  // Clear all data
  const resetStorage = useCallback(async () => {
    await clearAllProjects();
    setProjects([]);
  }, []);

  return {
    projects,
    isLoading,
    syncStatus,
    error,
    deviceId,

    createProject,
    updateProject,
    removeProject,
    addTask,
    toggleTask,
    deleteTask,
    syncWithServer,
    resetStorage,
    loadProjects,
  };
}
