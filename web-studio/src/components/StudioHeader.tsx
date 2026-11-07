"use client";

import React from "react";
import { Sparkles, Sliders, CloudLightning, Film, CheckCircle2 } from "lucide-react";

interface StudioHeaderProps {
  onOpenSettings: () => void;
  onOpenRenderModal: () => void;
  isReadyToRender: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  onOpenSettings,
  onOpenRenderModal,
  isReadyToRender,
}) => {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#232326] bg-[#0E0E11]/80 px-6 backdrop-blur-md">
      {/* Brand & Project Status */}
      <div className="flex items-center space-x-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20">
          <Film className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-semibold tracking-tight text-white">Stickman 2D Studio</h1>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
              2K QHD @ 60FPS
            </span>
          </div>
          <p className="text-[11px] text-[#8E8E93]">Cloud Distributed Animation Engine</p>
        </div>
      </div>

      {/* Cloud & RAM Badge */}
      <div className="hidden md:flex items-center space-x-3 text-xs text-[#A1A1AA]">
        <div className="flex items-center space-x-1.5 rounded-full bg-[#18181B] px-3 py-1 border border-[#27272A]">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-zinc-300">0MB Local RAM Footprint</span>
        </div>
        <span className="text-zinc-600">•</span>
        <span className="text-[11px] text-zinc-400">10-15x GitHub Parallel Matrix</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenSettings}
          className="flex items-center space-x-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-[#222226] hover:text-white"
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Cấu hình API</span>
        </button>

        <button
          onClick={onOpenRenderModal}
          className="flex items-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:brightness-110 active:scale-95"
        >
          <CloudLightning className="h-4 w-4" />
          <span>Render 2K @ 60FPS</span>
        </button>
      </div>
    </header>
  );
};
