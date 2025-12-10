import { ArrowLeft, Plus, Check, Circle } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  tasks: { id: string; text: string; done: boolean }[];
}

export const ProjectsPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<Project[]>([
    {
      id: "1",
      name: "My First Project",
      description: "A creative project to get started",
      progress: 25,
      tasks: [
        { id: "1", text: "Brainstorm ideas", done: true },
        { id: "2", text: "Create outline", done: false },
        { id: "3", text: "Build prototype", done: false },
        { id: "4", text: "Share with friends", done: false },
      ],
    },
  ]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });

  const handleCreateProject = () => {
    if (newProject.name) {
      const project: Project = {
        id: Date.now().toString(),
        name: newProject.name,
        description: newProject.description,
        progress: 0,
        tasks: [],
      };
      setProjects([project, ...projects]);
      setNewProject({ name: "", description: "" });
      setIsCreating(false);
      setSelectedProject(project);
    }
  };

  const toggleTask = (projectId: string, taskId: string) => {
    setProjects(
      projects.map((p) => {
        if (p.id === projectId) {
          const updatedTasks = p.tasks.map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          );
          const doneCount = updatedTasks.filter((t) => t.done).length;
          const progress =
            updatedTasks.length > 0
              ? Math.round((doneCount / updatedTasks.length) * 100)
              : 0;
          return { ...p, tasks: updatedTasks, progress };
        }
        return p;
      })
    );
    if (selectedProject?.id === projectId) {
      setSelectedProject((prev) => {
        if (!prev) return null;
        const updatedTasks = prev.tasks.map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        );
        const doneCount = updatedTasks.filter((t) => t.done).length;
        const progress =
          updatedTasks.length > 0
            ? Math.round((doneCount / updatedTasks.length) * 100)
            : 0;
        return { ...prev, tasks: updatedTasks, progress };
      });
    }
  };

  const addTask = (projectId: string, text: string) => {
    if (!text.trim()) return;
    const newTask = { id: Date.now().toString(), text, done: false };
    setProjects(
      projects.map((p) => {
        if (p.id === projectId) {
          const updatedTasks = [...p.tasks, newTask];
          const doneCount = updatedTasks.filter((t) => t.done).length;
          const progress =
            updatedTasks.length > 0
              ? Math.round((doneCount / updatedTasks.length) * 100)
              : 0;
          return { ...p, tasks: updatedTasks, progress };
        }
        return p;
      })
    );
    if (selectedProject?.id === projectId) {
      setSelectedProject((prev) => {
        if (!prev) return null;
        const updatedTasks = [...prev.tasks, newTask];
        const doneCount = updatedTasks.filter((t) => t.done).length;
        const progress =
          updatedTasks.length > 0
            ? Math.round((doneCount / updatedTasks.length) * 100)
            : 0;
        return { ...prev, tasks: updatedTasks, progress };
      });
    }
  };

  const [newTaskText, setNewTaskText] = useState("");

  if (selectedProject) {
    return (
      <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
        <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
          <button
            onClick={() => setSelectedProject(null)}
            className="absolute left-4 top-1/2 -translate-y-1/2"
          >
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-2xl text-center tracking-[0] leading-[normal] px-12 truncate">
            {selectedProject.name}
          </h1>
        </header>

        <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
          {/* Progress Bar */}
          <div className="bg-gray-800 rounded-full h-4 overflow-hidden">
            <div
              className="bg-[#93b747] h-full transition-all duration-300"
              style={{ width: `${selectedProject.progress}%` }}
            />
          </div>
          <p className="text-white text-center">{selectedProject.progress}% Complete</p>

          {/* Tasks */}
          <Card className="bg-white rounded-[15px] border-0">
            <CardContent className="p-4">
              <h3 className="font-bold mb-4">Tasks</h3>
              {selectedProject.tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(selectedProject.id, task.id)}
                  className="flex items-center gap-3 py-2 cursor-pointer hover:bg-gray-50 rounded px-2"
                >
                  {task.done ? (
                    <Check className="w-5 h-5 text-[#93b747]" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className={task.done ? "line-through text-gray-400" : ""}>
                    {task.text}
                  </span>
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="Add a task..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addTask(selectedProject.id, newTaskText);
                      setNewTaskText("");
                    }
                  }}
                  className="flex-1 p-2 border rounded outline-none"
                />
                <Button
                  onClick={() => {
                    addTask(selectedProject.id, newTaskText);
                    setNewTaskText("");
                  }}
                  className="bg-[#93b747] hover:bg-[#7a9a3a]"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
        <button
          onClick={() => setIsCreating(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2"
        >
          <Plus className="w-6 h-6 text-black" />
        </button>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
        {isCreating ? (
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
        ) : null}

        {projects.length === 0 && !isCreating ? (
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
        ) : (
          projects.map((project) => (
            <Card
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="bg-white rounded-[15px] border-0 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-4">
                <h3 className="text-lg font-bold text-black">{project.name}</h3>
                <p className="text-gray-600 mt-1">{project.description}</p>
                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#93b747] h-full transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {project.progress}% complete
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};
