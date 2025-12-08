import { MenuIcon } from "lucide-react";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  {
    label: "Journal",
    image:
      "/figmaAssets/light-bulb-png-transparent-light-bulb-images-927547-1.png",
    imageAlt: "Light bulb png",
    imageClass: "w-[134px] h-[210px]",
    containerClass: "mt-9 ml-5",
  },
  {
    label: "Projects",
    image: "/figmaAssets/bullseye-586412-1.png",
    imageAlt: "Bullseye",
    imageClass: "w-[136px] h-[136px]",
    containerClass: "mt-[81px] ml-[13px]",
  },
];

const todoItems = [
  "Groceries",
  "Grants to fill out",
  "Wesbite details",
  "Before next photo",
  "shoot",
];

export const CreatecampHome = (): JSX.Element => {
  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
        <MenuIcon className="absolute left-[14px] top-[45px] w-6 h-6 text-black" />
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-4xl text-center tracking-[0] leading-[normal]">
          Create!
        </h1>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-[14px]">
        <section className="grid grid-cols-2 gap-4 mb-8">
          {sections.map((section, index) => (
            <div key={index} className="flex flex-col items-center">
              <h2 className="[font-family:'Dangrek',Helvetica] font-normal text-[#93b747] text-2xl tracking-[0] leading-[normal] mb-4">
                {section.label}
              </h2>
              <Card className="w-full h-[299px] bg-white rounded-[15px] border-0">
                <CardContent className="p-0 flex items-center justify-center h-full">
                  <img
                    className={`${section.imageClass} object-cover ${section.containerClass}`}
                    alt={section.imageAlt}
                    src={section.image}
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-center mb-8">
          <h2 className="[font-family:'Dangrek',Helvetica] font-normal text-[#93b747] text-2xl tracking-[0] leading-[normal] mb-4">
            To Do
          </h2>
          <Card className="w-[259px] h-40 bg-white rounded-[15px] border-0">
            <CardContent className="p-4 flex items-center justify-center h-full">
              <img
                className="w-[181px] h-[127px] object-cover"
                alt="Screen shot"
                src="/figmaAssets/screen-shot-2021-04-27-at-11-49-1.png"
              />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col items-center pb-8">
          <h2 className="[font-family:'Dangrek',Helvetica] font-normal text-[#93b747] text-2xl tracking-[0] leading-[normal] mb-4">
            Share
          </h2>
          <img
            className="w-[79px] h-[58px]"
            alt="Group"
            src="/figmaAssets/group-12.png"
          />
        </section>
      </main>
    </div>
  );
};
