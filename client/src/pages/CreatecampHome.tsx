import { MenuIcon, X, Pencil } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

interface Section {
  label: string;
  path: string;
  image: string;
  imageAlt: string;
  imageClass: string;
  containerClass: string;
  fallbackIcon?: boolean;
}

const sections: Section[] = [
  {
    label: "Journal",
    path: "/journal",
    image:
      "/figmaAssets/light-bulb-png-transparent-light-bulb-images-927547-1.png",
    imageAlt: "Light bulb png",
    imageClass: "w-[134px] h-[210px]",
    containerClass: "",
  },
  {
    label: "Projects",
    path: "/projects",
    image: "/figmaAssets/bullseye-586412-1.png",
    imageAlt: "Bullseye",
    imageClass: "w-[136px] h-[136px]",
    containerClass: "",
  },
  {
    label: "Sketchbook",
    path: "/sketchbook",
    image: "",
    imageAlt: "Sketchbook",
    imageClass: "w-[120px] h-[120px]",
    containerClass: "",
    fallbackIcon: true,
  },
  {
    label: "To Do",
    path: "/todo",
    image: "/figmaAssets/screen-shot-2021-04-27-at-11-49-1.png",
    imageAlt: "To Do list",
    imageClass: "w-[181px] h-[127px]",
    containerClass: "",
  },
];

const menuItems = [
  { label: "Home", path: "/" },
  { label: "Journal", path: "/journal" },
  { label: "Projects", path: "/projects" },
  { label: "Sketchbook", path: "/sketchbook" },
  { label: "To Do", path: "/todo" },
  { label: "Completed Tasks", path: "/completed-tasks" },
  { label: "Share", path: "/share" },
  { label: "Account", path: "/account" },
  { label: "Settings", path: "/settings" },
];

const todoItems = [
  "Groceries",
  "Grants to fill out",
  "Wesbite details",
  "Before next photo",
  "shoot",
];

export const CreatecampHome = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative w-64 bg-[#f3c053] h-full shadow-xl">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-4 top-4"
            >
              <X className="w-6 h-6 text-black" />
            </button>
            <nav className="pt-16 px-6">
              <h2 className="[font-family:'Dangrek',Helvetica] text-black text-2xl mb-6">Menu</h2>
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    setLocation(item.path);
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left py-3 px-4 text-black text-lg hover:bg-[#e5b347] rounded-lg transition-colors [font-family:'Dangrek',Helvetica]"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
        <button
          onClick={() => setMenuOpen(true)}
          className="absolute left-[14px] top-1/2 -translate-y-1/2"
        >
          <MenuIcon className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-4xl text-center tracking-[0] leading-[normal]">
          Create!
        </h1>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-[14px]">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 justify-items-center">
          {sections.map((section, index) => (
            <div key={index} className="flex flex-col items-center">
              <button
                onClick={() => setLocation(section.path)}
                className="[font-family:'Dangrek',Helvetica] font-normal text-[#93b747] text-2xl tracking-[0] leading-[normal] mb-4 hover:text-[#a8cc52] transition-colors cursor-pointer"
              >
                {section.label}
              </button>
              <Card 
                onClick={() => setLocation(section.path)}
                className="w-[259px] h-[299px] bg-white rounded-[15px] border-0 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
              >
                <CardContent className="p-0 flex items-center justify-center h-full">
                  {section.fallbackIcon ? (
                    <Pencil className="w-24 h-24 text-gray-600" />
                  ) : (
                    <img
                      className={`${section.imageClass} object-contain`}
                      alt={section.imageAlt}
                      src={section.image}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-center pb-8">
          <button
            onClick={() => setLocation("/share")}
            className="[font-family:'Dangrek',Helvetica] font-normal text-[#93b747] text-2xl tracking-[0] leading-[normal] mb-4 hover:text-[#a8cc52] transition-colors cursor-pointer"
          >
            Share
          </button>
          <button
            onClick={() => setLocation("/share")}
            className="hover:scale-110 transition-transform"
          >
            <img
              className="w-[79px] h-[58px]"
              alt="Group"
              src="/figmaAssets/group-12.png"
            />
          </button>
        </section>
      </main>
    </div>
  );
};
