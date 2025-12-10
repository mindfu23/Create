import { ArrowLeft, Plus, Check, Circle, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export const TodoPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [todos, setTodos] = useState<TodoItem[]>([
    { id: "1", text: "Groceries", done: false },
    { id: "2", text: "Grants to fill out", done: false },
    { id: "3", text: "Website details", done: false },
    { id: "4", text: "Before next photo shoot", done: false },
  ]);
  const [newTodo, setNewTodo] = useState("");

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const addTodo = () => {
    if (newTodo.trim()) {
      setTodos([
        ...todos,
        { id: Date.now().toString(), text: newTodo, done: false },
      ]);
      setNewTodo("");
    }
  };

  const completedCount = todos.filter((t) => t.done).length;

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
          To Do
        </h1>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
        {/* Progress */}
        <div className="text-white text-center">
          <p className="text-lg">
            {completedCount} of {todos.length} completed
          </p>
        </div>

        {/* Add Todo */}
        <Card className="bg-white rounded-[15px] border-0">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add something to do..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTodo();
                }}
                className="flex-1 p-2 border rounded outline-none"
              />
              <Button
                onClick={addTodo}
                className="bg-[#93b747] hover:bg-[#7a9a3a]"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Todo List */}
        <Card className="bg-white rounded-[15px] border-0">
          <CardContent className="p-4">
            {todos.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Nothing to do! Add a task above.
              </p>
            ) : (
              todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 py-3 border-b last:border-0 group"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="flex-shrink-0"
                  >
                    {todo.done ? (
                      <Check className="w-6 h-6 text-[#93b747]" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${
                      todo.done ? "line-through text-gray-400" : "text-black"
                    }`}
                  >
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Clear Completed */}
        {completedCount > 0 && (
          <Button
            variant="outline"
            onClick={() => setTodos(todos.filter((t) => !t.done))}
            className="self-center text-white border-white hover:bg-white hover:text-black"
          >
            Clear {completedCount} completed
          </Button>
        )}
      </main>
    </div>
  );
};
