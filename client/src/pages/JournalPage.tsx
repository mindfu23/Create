import { ArrowLeft, Plus, Save } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
}

export const JournalPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      id: "1",
      title: "My First Idea",
      content: "Today I thought about creating something amazing...",
      date: new Date().toLocaleDateString(),
    },
  ]);
  const [isWriting, setIsWriting] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", content: "" });

  const handleSave = () => {
    if (newEntry.title && newEntry.content) {
      setEntries([
        {
          id: Date.now().toString(),
          title: newEntry.title,
          content: newEntry.content,
          date: new Date().toLocaleDateString(),
        },
        ...entries,
      ]);
      setNewEntry({ title: "", content: "" });
      setIsWriting(false);
    }
  };

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
          Journal
        </h1>
        <button
          onClick={() => setIsWriting(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2"
        >
          <Plus className="w-6 h-6 text-black" />
        </button>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4">
        {isWriting ? (
          <Card className="bg-white rounded-[15px] border-0">
            <CardContent className="p-4">
              <input
                type="text"
                placeholder="Title your idea..."
                value={newEntry.title}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, title: e.target.value })
                }
                className="w-full text-xl font-bold mb-2 p-2 border-b border-gray-200 outline-none"
              />
              <textarea
                placeholder="Write your thoughts..."
                value={newEntry.content}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, content: e.target.value })
                }
                className="w-full h-32 p-2 outline-none resize-none"
              />
              <div className="flex gap-2 justify-end mt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsWriting(false);
                    setNewEntry({ title: "", content: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-[#93b747] hover:bg-[#7a9a3a]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {entries.length === 0 && !isWriting ? (
          <div className="flex flex-col items-center justify-center flex-1 text-white">
            <p className="text-lg mb-4">No journal entries yet</p>
            <Button
              onClick={() => setIsWriting(true)}
              className="bg-[#93b747] hover:bg-[#7a9a3a]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Write your first idea
            </Button>
          </div>
        ) : (
          entries.map((entry) => (
            <Card
              key={entry.id}
              className="bg-white rounded-[15px] border-0 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-black">{entry.title}</h3>
                  <span className="text-sm text-gray-500">{entry.date}</span>
                </div>
                <p className="text-gray-600 mt-2 line-clamp-2">{entry.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};
