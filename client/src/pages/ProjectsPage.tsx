import { ArrowLeft, Plus, Check, Circle, Trash2, RefreshCw, Cloud, CloudOff, Save, ListTodo } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjectStorage } from "@/hooks/useProjectStorage";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Project } from "@/lib/projectStorage";

export const ProjectsPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user, isAuthenticated, requireAuth } = useAuth();
  
  // Parse URL params for special navigation
  const urlParams = new URLSearchParams(searchString);
  const createNewParam = urlParams.get('createNew');
  const returnTo = urlParams.get('returnTo');
  
  // Get userId from auth context
  const userId = user?.id || null;

  // Storage hook
  const {
    projects,
    isLoading,
    syncStatus,
    error,
    createProject,
    updateProject,
    removeProject,
    addTask,
    toggleTask,
    deleteTask,
    syncWithServer,
  } = useProjectStorage({ autoSync: true, syncInterval: 30000, userId: userId || undefined });

  // Local state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [newTaskText, setNewTaskText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  
  // Auto-open create form if createNew param is present
  useEffect(() => {
    if (createNewParam === 'true' && !isLoading) {
      setIsCreating(true);
      // Clear the URL param
      setLocation('/projects', { replace: true });
    }
  }, [createNewParam, isLoading, setLocation]);

  // Update selected project when projects change
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id);
      if (updated) {
        setSelectedProject(updated);
      }
    }
  }, [projects, selectedProject?.id]);

  // Handle create project
  const handleCreateProject = async () => {
    // Require authentication to save
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!newProject.name) {
      toast({
        title: "Name Required",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    const result = await createProject(newProject.name, newProject.description);
    if (result) {
      toast({
        title: "Project Created",
        description: "Your project has been saved",
      });
      setNewProject({ name: "", description: "" });
      setIsCreating(false);
      
      // Check if we need to return to todo page
      const pendingTodoUpdate = localStorage.getItem('pending_todo_project_update');
      if (pendingTodoUpdate || returnTo === 'todo') {
        // Return to todo page with the new project ID
        localStorage.removeItem('pending_todo_project_update');
        setLocation(`/todo?created=${result.id}`);
      } else {
        setSelectedProject(result);
      }
    }
  };

  // Handle update project
  const handleUpdateProject = async () => {
    // Require authentication to update
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!selectedProject || !editForm.name) return;

    const result = await updateProject(selectedProject.id, {
      name: editForm.name,
      description: editForm.description,
    });

    if (result) {
      toast({
        title: "Project Updated",
        description: "Changes have been saved",
      });
      setIsEditing(false);
    }
  };

  // Handle delete project
  const handleDeleteProject = async (id: string) => {
    // Require authentication to delete
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    const success = await removeProject(id);
    if (success) {
      toast({
        title: "Project Deleted",
        description: "Project has been removed",
      });
      setSelectedProject(null);
    }
  };

  // Handle add task
  const handleAddTask = async () => {
    // Require authentication to add tasks
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!selectedProject || !newTaskText.trim()) return;

    const success = await addTask(selectedProject.id, newTaskText);
    if (success) {
      setNewTaskText("");
    }
  };

  // Handle toggle task
  const handleToggleTask = async (taskId: string) => {
    // Require authentication to toggle tasks
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!selectedProject) return;
    await toggleTask(selectedProject.id, taskId);
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    // Require authentication to delete tasks
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!selectedProject) return;
    await deleteTask(selectedProject.id, taskId);
  };

  // Handle manual sync
  const handleSync = async () => {
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    const result = await syncWithServer();
    if (result.success) {
      toast({
        title: "Synced",
        description: `Pushed: ${result.pushed}, Pulled: ${result.pulled}${result.conflicts ? `, Conflicts: ${result.conflicts}` : ''}`,
      });
    } else {
      toast({
        title: "Sync Failed",
        description: "Could not sync with server",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col items-center justify-center">
        <RefreshCw className="w-12 h-12 text-[#93b747] animate-spin" />
        <p className="text-white mt-4">Loading projects...</p>
      </div>
    );
  }

  // Project detail view
  if (selectedProject) {
    return (
      <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
        <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
          <button
            onClick={() => {
              setSelectedProject(null);
              setIsEditing(false);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2"
          >
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-2xl text-center tracking-[0] leading-[normal] px-12 truncate">
            {selectedProject.name}
          </h1>
          <button
            onClick={() => handleDeleteProject(selectedProject.id)}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <Trash2 className="w-5 h-5 text-black" />
          </button>
        </header>

        <main className="flex-1 flex flex-col px-4 pt-6 gap-4 pb-20">
          {/* Conflict warning */}
          {selectedProject.id.includes('_conflicted_copy') && (
            <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg text-sm">
              ⚠️ This is a conflicted copy. Review and merge with the original.
            </div>
          )}

          {/* Progress Bar */}
          <div className="bg-gray-800 rounded-full h-4 overflow-hidden">
            <div
              className="bg-[#93b747] h-full transition-all duration-300"
              style={{ width: `${selectedProject.progress}%` }}
            />
          </div>
          <p className="text-white text-center">{selectedProject.progress}% Complete</p>

          {/* Project Details */}
          <Card className="bg-white rounded-[15px] border-0">
            <CardContent className="p-4">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full text-xl font-bold mb-2 p-2 border-b border-gray-200 outline-none"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full h-20 p-2 outline-none resize-none"
                    placeholder="Project description..."
                  />
                  <div className="flex gap-2 justify-end mt-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateProject} className="bg-[#93b747] hover:bg-[#7a9a3a]">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{selectedProject.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditForm({
                          name: selectedProject.name,
                          description: selectedProject.description,
                        });
                        setIsEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                  {selectedProject.description && (
                    <p className="text-gray-600 mt-2">{selectedProject.description}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card className="bg-white rounded-[15px] border-0">
            <CardContent className="p-4">
              <h3 className="font-bold mb-4">Tasks</h3>
              {selectedProject.tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No tasks yet. Add one below!</p>
              ) : (
                selectedProject.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-2 group"
                  >
                    <button onClick={() => handleToggleTask(task.id)}>
                      {task.done ? (
                        <Check className="w-5 h-5 text-[#93b747]" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <span className={`flex-1 ${task.done ? "line-through text-gray-400" : ""}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="Add a task..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddTask();
                    }
                  }}
                  className="flex-1 p-2 border rounded outline-none"
                />
                <Button
                  onClick={handleAddTask}
                  className="bg-[#93b747] hover:bg-[#7a9a3a]"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Last updated */}
          <p className="text-gray-500 text-sm text-center">
            Last updated: {new Date(selectedProject.updatedAt).toLocaleString()}
          </p>

          {/* Create a task button */}
          <Button
            onClick={() => setLocation(`/todo?created=${selectedProject.id}`)}
            variant="outline"
            className="w-full text-white border-white hover:bg-white hover:text-black"
          >
            <ListTodo className="w-4 h-4 mr-2" />
            Create a Task for this Project
          </Button>
        </main>
      </div>
    );
  }

  // Project list view
  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
        >
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-4xl text-center tracking-[0] leading-[normal]">
          Projects
        </h1>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncStatus.isSyncing}
            className="p-1"
            title="Sync with cloud"
          >
            {syncStatus.isSyncing ? (
              <RefreshCw className="w-5 h-5 text-black animate-spin" />
            ) : userId && syncStatus.lastSync ? (
              <Cloud className="w-5 h-5 text-black" />
            ) : (
              <CloudOff className="w-5 h-5 text-black" />
            )}
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1"
          >
            <Plus className="w-6 h-6 text-black" />
          </button>
        </div>
      </header>

      {/* Sync status bar */}
      {syncStatus.error && (
        <div className="bg-red-500 text-white text-sm px-4 py-2 text-center">
          {syncStatus.error}
        </div>
      )}

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
        {/* Error display */}
        {error && (
          <div className="bg-red-100 text-red-800 p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Create project form */}
        {isCreating && (
          <Card className="bg-white rounded-[15px] border-0">
            <CardContent className="p-4">
              <input
                type="text"
                placeholder="Project name..."
                value={newProject.name}
                onChange={(e) =>
                  setNewProject({ ...newProject, name: e.target.value })
                }
                className="w-full text-xl font-bold mb-2 p-2 border-b border-gray-200 outline-none"
              />
              <textarea
                placeholder="What will you create?"
                value={newProject.description}
                onChange={(e) =>
                  setNewProject({ ...newProject, description: e.target.value })
                }
                className="w-full h-20 p-2 outline-none resize-none"
              />
              <div className="flex gap-2 justify-end mt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewProject({ name: "", description: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProject}
                  className="bg-[#93b747] hover:bg-[#7a9a3a]"
                >
                  Create Project
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {projects.length === 0 && !isCreating && (
          <div className="flex flex-col items-center justify-center flex-1 text-white">
            <p className="text-lg mb-4">No projects yet</p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-[#93b747] hover:bg-[#7a9a3a]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start a project
            </Button>
          </div>
        )}

        {/* Project list */}
        {projects.map((project) => (
          <Card
            key={project.id}
            onClick={() => setSelectedProject(project)}
            className={`bg-white rounded-[15px] border-0 cursor-pointer hover:shadow-lg transition-shadow ${
              project.id.includes('_conflicted_copy') ? 'border-2 border-yellow-400' : ''
            }`}
          >
            <CardContent className="p-4">
              {project.id.includes('_conflicted_copy') && (
                <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mb-2 inline-block">
                  ⚠️ Conflicted Copy
                </div>
              )}
              <h3 className="text-lg font-bold text-black">{project.name}</h3>
              <p className="text-gray-600 mt-1">{project.description}</p>
              <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#93b747] h-full transition-all duration-300"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-sm text-gray-500">
                  {project.progress}% complete
                </p>
                <p className="text-sm text-gray-500">
                  {project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
};
