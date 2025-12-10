import { ArrowLeft, Trash2, Check, Square, CheckSquare } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodoStorage } from "@/hooks/useTodoStorage";
import { useProjectStorage } from "@/hooks/useProjectStorage";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, TodoStorageEntry } from "@/lib/todoStorage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const CompletedTasksPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Get userId from localStorage
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const storedUserId = localStorage.getItem('create_user_id');
    if (storedUserId) setUserId(storedUserId);
  }, []);

  // Todo storage hook
  const {
    completedTodos,
    isLoading: todosLoading,
    permanentDelete,
    permanentDeleteMultiple,
    refresh,
  } = useTodoStorage({ autoRefresh: true });

  // Project storage hook
  const { projects, isLoading: projectsLoading } = useProjectStorage({
    autoSync: false,
    userId: userId || undefined,
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Get project name by ID
  const getProjectName = (projectId: string): string => {
    if (projectId === DEFAULT_PROJECT_ID) return DEFAULT_PROJECT_NAME;
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(completedTodos.map(t => t.id)));
      setSelectAll(true);
    }
  };

  // Handle individual selection
  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setSelectAll(newSelected.size === completedTodos.length);
  };

  // Handle delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    const success = await permanentDeleteMultiple(Array.from(selectedIds));
    if (success) {
      toast({
        title: "Tasks Deleted",
        description: `${selectedIds.size} task(s) permanently deleted`,
      });
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      toast({
        title: "Error",
        description: "Failed to delete some tasks",
        variant: "destructive",
      });
    }
  };

  // Handle delete single
  const handleDeleteSingle = async (id: string) => {
    const success = await permanentDelete(id);
    if (success) {
      toast({
        title: "Task Deleted",
        description: "Task permanently deleted",
      });
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    }
  };

  // Handle delete all
  const handleDeleteAll = async () => {
    if (completedTodos.length === 0) return;
    
    const allIds = completedTodos.map(t => t.id);
    const success = await permanentDeleteMultiple(allIds);
    if (success) {
      toast({
        title: "All Tasks Deleted",
        description: `${allIds.length} task(s) permanently deleted`,
      });
      setSelectedIds(new Set());
      setSelectAll(false);
    }
  };

  const isLoading = todosLoading || projectsLoading;
  const hasSelection = selectedIds.size > 0;

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
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-3xl text-center tracking-[0] leading-[normal]">
          Completed Tasks
        </h1>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
        {/* Info */}
        <div className="text-white text-center">
          <p className="text-lg">
            {completedTodos.length} completed task{completedTodos.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Action Bar */}
        <Card className="bg-white rounded-[15px] border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-gray-600 hover:text-[#93b747]"
                >
                  {selectAll ? (
                    <CheckSquare className="w-5 h-5 text-[#93b747]" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  <span className="text-sm">Select All</span>
                </button>
                
                {hasSelection && (
                  <span className="text-sm text-gray-500">
                    ({selectedIds.size} selected)
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {/* Delete Selected Button */}
                {hasSelection && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedIds.size} Task(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the selected tasks. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelected}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Delete All Button */}
                {completedTodos.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-red-500 border-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Completed Tasks?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all {completedTodos.length} completed tasks. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAll} className="bg-red-500 hover:bg-red-600">
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        <Card className="bg-white rounded-[15px] border-0 flex-1">
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="flex border-b bg-gray-50 rounded-t-[15px]">
              <div className="w-12 px-4 py-3"></div>
              <div className="flex-[3] px-4 py-3 text-left font-medium text-gray-600">
                Task
              </div>
              <div className="flex-1 px-4 py-3 text-left font-medium text-gray-600">
                Project
              </div>
              <div className="w-12 px-4 py-3"></div>
            </div>

            {/* Tasks */}
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : completedTodos.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No completed tasks yet.
                <br />
                <button
                  onClick={() => setLocation('/todo')}
                  className="text-[#93b747] underline mt-2"
                >
                  Go to To Do list
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {completedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center ${selectedIds.has(todo.id) ? 'bg-blue-50' : ''}`}
                  >
                    {/* Selection checkbox */}
                    <div className="w-12 px-4 py-3">
                      <button onClick={() => handleSelect(todo.id)}>
                        {selectedIds.has(todo.id) ? (
                          <CheckSquare className="w-5 h-5 text-[#93b747]" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400 hover:text-[#93b747]" />
                        )}
                      </button>
                    </div>

                    {/* Task text */}
                    <div className="flex-[3] px-4 py-3">
                      <span className="line-through text-gray-400">
                        {todo.text}
                      </span>
                      {todo.completedAt && (
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(todo.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Project */}
                    <div className="flex-1 px-4 py-3 text-sm text-gray-500">
                      {getProjectName(todo.projectId)}
                    </div>

                    {/* Delete button */}
                    <div className="w-12 px-4 py-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this task. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSingle(todo.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back to To Do link */}
        <div className="text-center pb-4">
          <button
            onClick={() => setLocation('/todo')}
            className="text-[#93b747] underline"
          >
            ← Back to To Do
          </button>
        </div>
      </main>
    </div>
  );
};
