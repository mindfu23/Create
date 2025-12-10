import { ArrowLeft, Copy, Share2, Twitter, Facebook, Mail } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const SharePage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const shareUrl = window.location.origin;
  const shareText = "Check out Create! - An app to help you bring your creative ideas to life!";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Create!",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      copyToClipboard();
    }
  };

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  };

  const shareEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent("Check out Create!")}&body=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`;
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
          Share
        </h1>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-6 gap-6 items-center">
        <p className="text-white text-center text-lg">
          Share Create! with friends and family
        </p>

        {/* Native Share Button */}
        <Button
          onClick={shareNative}
          className="bg-[#93b747] hover:bg-[#7a9a3a] w-full max-w-xs h-14 text-lg"
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share App
        </Button>

        {/* Social Share Options */}
        <Card className="bg-white rounded-[15px] border-0 w-full max-w-xs">
          <CardContent className="p-4">
            <h3 className="font-bold mb-4 text-center">Or share via</h3>
            <div className="flex justify-center gap-4">
              <button
                onClick={shareTwitter}
                className="p-3 rounded-full bg-[#1DA1F2] text-white hover:opacity-80 transition-opacity"
              >
                <Twitter className="w-6 h-6" />
              </button>
              <button
                onClick={shareFacebook}
                className="p-3 rounded-full bg-[#4267B2] text-white hover:opacity-80 transition-opacity"
              >
                <Facebook className="w-6 h-6" />
              </button>
              <button
                onClick={shareEmail}
                className="p-3 rounded-full bg-gray-600 text-white hover:opacity-80 transition-opacity"
              >
                <Mail className="w-6 h-6" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Copy Link */}
        <Card className="bg-white rounded-[15px] border-0 w-full max-w-xs">
          <CardContent className="p-4">
            <h3 className="font-bold mb-2">Copy Link</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 p-2 bg-gray-100 rounded text-sm"
              />
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="icon"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
