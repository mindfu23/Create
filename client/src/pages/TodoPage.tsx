import { ArrowLeft, Plus, Check, Circle, Trash2, ChevronDown, Menu } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodoStorage } from "@/hooks/useTodoStorage";
import { useProjectStorage } from "@/hooks/useProjectStorage";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, TodoStorageEntry } from "@/lib/todoStorage";
import type { Project } from "@/lib/projectStorage";

type SortMode = 'tasks' | 'projects';

export const TodoPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user, isAuthenticated, requireAuth } = useAuth();
  
  // Parse URL params for return from project creation
  const urlParams = new URLSearchParams(searchString);
  const returnFromProject = urlParams.get('created');
  
  // Get userId from auth
  const userId = user?.id || null;

  // Todo storage hook
  const {
    todos,
    completedTodos,
    isLoading: todosLoading,
    addTodo,
    toggle,
    remove,
    updateText,
    changeProject,
    clearCompleted,
    refresh,
  } = useTodoStorage({ autoRefresh: true });

  // Project storage hook
  const { projects, isLoading: projectsLoading } = useProjectStorage({
    autoSync: false,
    userId: userId || undefined,
  });

  // Local state
  const [newTaskText, setNewTaskText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(DEFAULT_PROJECT_ID);
  const [sortMode, setSortMode] = useState<SortMode>('tasks');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Handle return from project creation
  useEffect(() => {
    if (returnFromProject) {
      setSelectedProjectId(returnFromProject);
      // Clear the URL param
      setLocation('/todo', { replace: true });
      toast({
        title: "Project Created",
        description: "You can now add tasks to your new project",
      });
    }
  }, [returnFromProject, setLocation, toast]);

  // Get all projects including default
  const allProjects: { id: string; name: string }[] = [
    { id: DEFAULT_PROJECT_ID, name: DEFAULT_PROJECT_NAME },
    ...projects.map(p => ({ id: p.id, name: p.name })),
  ];

  // Get project name by ID
  const getProjectName = (projectId: string): string => {
    if (projectId === DEFAULT_PROJECT_ID) return DEFAULT_PROJECT_NAME;
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  // Combine active and completed todos, sorted appropriately
  const allTodos = [...todos, ...completedTodos];
  
  // Sort todos based on mode
  const sortedTodos = sortMode === 'projects'
    ? [...allTodos].sort((a, b) => {
        // First by project name
        const projectA = getProjectName(a.projectId);
        const projectB = getProjectName(b.projectId);
        const projectCompare = projectA.localeCompare(projectB);
        if (projectCompare !== 0) return projectCompare;
        // Then by completion status
        if (a.done !== b.done) return a.done ? 1 : -1;
        // Then by creation date
        return b.createdAt - a.createdAt;
      })
    : allTodos; // Default sort: active first (newest), then completed

  // Handle add todo
  const handleAddTodo = async () => {
    // Require authentication to add todos
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!newTaskText.trim()) return;
    
    const result = await addTodo(newTaskText, selectedProjectId);
    if (result) {
      setNewTaskText("");
    }
  };

  // Handle toggle
  const handleToggle = async (id: string) => {
    // Require authentication to toggle todos
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    await toggle(id);
  };

  // Handle text edit
  const startEditing = (todo: TodoStorageEntry) => {
    setEditingTaskId(todo.id);
    setEditingText(todo.text);
    setTimeout(() => {
      const input = inputRefs.current.get(todo.id);
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  };

  const saveEdit = async (id: string) => {
    // Require authentication to edit todos
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (editingText.trim()) {
      await updateText(id, editingText);
    }
    setEditingTaskId(null);
    setEditingText("");
  };

  // Handle long press for project menu
  const handleProjectMouseDown = (todoId: string) => {
    const timer = setTimeout(() => {
      setProjectMenuOpen(todoId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleProjectMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleProjectClick = (todoId: string) => {
    // Short click also opens menu
    setProjectMenuOpen(todoId);
  };

  // Handle project change
  const handleChangeProject = async (todoId: string, newProjectId: string) => {
    // Require authentication to change project
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    await changeProject(todoId, newProjectId);
    setProjectMenuOpen(null);
  };

  // Handle new project from menu
  const handleNewProject = (todoId: string) => {
    // Store the todo ID to update after project creation
    localStorage.setItem('pending_todo_project_update', todoId);
    setLocation('/projects?createNew=true&returnTo=todo');
  };

  // Handle clear completed
  const handleClearCompleted = async () => {
    // Require authentication to clear completed
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    const count = await clearCompleted();
    if (count > 0) {
      toast({
        title: "Tasks Cleared",
        description: `${count} completed tasks moved to Completed Tasks`,
      });
    }
  };

  // Toggle sort mode
  const toggleSortMode = () => {
    setSortMode(prev => prev === 'tasks' ? 'projects' : 'tasks');
  };

  const isLoading = todosLoading || projectsLoading;

  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
        >
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-4xl text-center tracking-[0] leading-[normal]">
          To Do
        </h1>
        
        {/* Clear completed link */}
        {completedTodos.length > 0 && (
          <button
            onClick={handleClearCompleted}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-black text-sm underline hover:text-gray-700"
          >
            Clear completed
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
        {/* Progress */}
        <div className="text-white text-center">
          <p className="text-lg">
            {completedTodos.length} of {allTodos.length} completed
          </p>
        </div>

        {/* Add Todo with Project Selection */}
        <Card className="bg-white rounded-[15px] border-0">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add something to do..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTodo();
                }}
                className="flex-1 p-2 border rounded outline-none"
              />
              
              {/* Project selector dropdown */}
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="appearance-none bg-gray-100 border rounded px-3 py-2 pr-8 cursor-pointer"
                >
                  {allProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
              
              <Button
                onClick={handleAddTodo}
                className="bg-[#93b747] hover:bg-[#7a9a3a]"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two-Column Table */}
        <Card className="bg-white rounded-[15px] border-0 flex-1">
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="flex border-b bg-gray-50 rounded-t-[15px]">
              <button 
                onClick={() => setSortMode('tasks')}
                className={`flex-[3] px-4 py-3 text-left font-medium ${
                  sortMode === 'tasks' ? 'text-[#93b747] underline' : 'text-gray-600'
                } hover:text-[#93b747] transition-colors`}
              >
                Task
              </button>
              <button 
                onClick={() => setSortMode('projects')}
                className={`flex-1 px-4 py-3 text-left font-medium ${
                  sortMode === 'projects' ? 'text-[#93b747] underline' : 'text-gray-600'
                } hover:text-[#93b747] transition-colors`}
              >
                Projects
              </button>
            </div>

            {/* Task Rows */}
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : sortedTodos.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No tasks yet. Add one above!
              </div>
            ) : (
              <div className="divide-y">
                {sortedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center group ${todo.done ? 'bg-gray-50' : ''}`}
                  >
                    {/* Task Column */}
                    <div className="flex-[3] flex items-center gap-3 px-4 py-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggle(todo.id)}
                        className="flex-shrink-0"
                      >
                        {todo.done ? (
                          <Check className="w-6 h-6 text-[#93b747]" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-400 hover:text-[#93b747]" />
                        )}
                      </button>
                      
                      {/* Task text (editable) */}
                      {editingTaskId === todo.id ? (
                        <input
                          ref={(el) => {
                            if (el) inputRefs.current.set(todo.id, el);
                          }}
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => saveEdit(todo.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(todo.id);
                            if (e.key === 'Escape') {
                              setEditingTaskId(null);
                              setEditingText("");
                            }
                          }}
                          className="flex-1 p-1 border rounded outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => !todo.done && startEditing(todo)}
                          className={`flex-1 cursor-pointer ${
                            todo.done 
                              ? "line-through text-gray-400" 
                              : "text-black hover:text-[#93b747]"
                          }`}
                        >
                          {todo.text}
                        </span>
                      )}

                      {/* Delete button (on hover) */}
                      <button
                        onClick={() => remove(todo.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-5 h-5 text-red-500 hover:text-red-700" />
                      </button>
                    </div>

                    {/* Project Column */}
                    <div 
                      className="flex-1 px-4 py-3 relative"
                      onMouseDown={() => handleProjectMouseDown(todo.id)}
                      onMouseUp={handleProjectMouseUp}
                      onMouseLeave={handleProjectMouseUp}
                      onTouchStart={() => handleProjectMouseDown(todo.id)}
                      onTouchEnd={handleProjectMouseUp}
                    >
                      <button
                        onClick={() => handleProjectClick(todo.id)}
                        className="text-sm text-gray-600 hover:text-[#93b747] transition-colors text-left w-full truncate"
                      >
                        {getProjectName(todo.projectId)}
                      </button>

                      {/* Project dropdown menu */}
                      {projectMenuOpen === todo.id && (
                        <>
                          {/* Backdrop */}
                          <div 
                            className="fixed inset-0 z-10"
                            onClick={() => setProjectMenuOpen(null)}
                          />
                          
                          {/* Menu */}
                          <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[150px]">
                            {allProjects.map(project => (
                              <button
                                key={project.id}
                                onClick={() => handleChangeProject(todo.id, project.id)}
                                className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
                                  todo.projectId === project.id ? 'bg-gray-50 text-[#93b747]' : ''
                                }`}
                              >
                                {project.name}
                              </button>
                            ))}
                            <hr className="my-1" />
                            <button
                              onClick={() => handleNewProject(todo.id)}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-[#93b747] font-medium"
                            >
                              + New Project
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty row for new task (visual affordance) */}
                <div className="flex items-center text-gray-300">
                  <div className="flex-[3] flex items-center gap-3 px-4 py-3">
                    <Circle className="w-6 h-6" />
                    <span className="italic">Add a task...</span>
                  </div>
                  <div className="flex-1 px-4 py-3 text-sm">
                    {getProjectName(selectedProjectId)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
