"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import { MasterSceneGraph } from "../remotion/types/sceneGraph";
import { MainScene } from "../remotion/Composition";
import { RotateCcw, RefreshCw, Sparkles } from "lucide-react";

// Dynamic import with SSR disabled for client-only Remotion player
const Player = dynamic(
  () => import("@remotion/player").then((mod) => mod.Player),
  { ssr: false }
);

interface PreviewPlayerProps {
  sceneGraph: MasterSceneGraph;
  playerRefProp?: React.RefObject<any>;
  version?: number;
  onRefresh?: () => void;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  sceneGraph,
  playerRefProp,
  version = 0,
  onRefresh,
}) => {
  const localRef = useRef<any>(null);
  const activeRef = playerRefProp || localRef;

  // Tính toán an toàn tuyệt đối tổng số frame, không bao giờ để bị NaN
  const safeScenes = Array.isArray(sceneGraph?.scenes) ? sceneGraph.scenes : [];
  const calculatedTotal = safeScenes.reduce((acc, s) => {
    const start = Number(s?.startFrame) || 0;
    const dur = Number(s?.durationInFrames) || 120;
    return Math.max(acc, start + dur);
  }, 480);

  const rawTotal = Number(sceneGraph?.totalDurationInFrames) || calculatedTotal;
  const totalFrames = Math.max(60, isNaN(rawTotal) ? 480 : Math.round(rawTotal));

  const handleRewind = () => {
    if (activeRef.current) {
      activeRef.current.seekTo(0);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-[#232326] bg-[#121215] p-3 shadow-2xl">
      {/* 2K Preview Monitor Frame */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#09090B] border border-[#1E1E22] shadow-inner">
        <Player
          key={`remotion-player-${sceneGraph?.title || "preview"}-${totalFrames}-${version}`}
          ref={activeRef}
          component={MainScene}
          inputProps={{ sceneGraph }}
          durationInFrames={totalFrames}
          fps={60}
          compositionWidth={2560}
          compositionHeight={1440}
          style={{
            width: "100%",
            height: "100%",
          }}
          controls
          loop
          autoPlay={false}
        />
      </div>

      {/* Control Bar & Resolution Info */}
      <div className="mt-3 flex w-full items-center justify-between px-2 text-xs text-[#8E8E93]">
        <div className="flex items-center space-x-2">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-mono text-zinc-300">2560 x 1440 (2K QHD)</span>
          <span className="text-zinc-600">|</span>
          <span className="font-mono text-zinc-300">60.0 FPS</span>
          <span className="text-zinc-600">|</span>
          <span className="font-mono text-zinc-400">
            {totalFrames} frames ({(totalFrames / 60).toFixed(1)}s)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRewind}
            title="Quay về khung hình đầu tiên (Frame 0)"
            className="flex items-center space-x-1 rounded-lg border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Frame 0</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Làm mới lại toàn bộ tài nguyên đồ họa (Hot Reload Preview)"
              className="flex items-center space-x-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] text-blue-300 hover:text-white hover:bg-blue-600/30 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
              <span>Làm mới Preview</span>
            </button>
          )}

          <span className="text-[11px] text-zinc-500 hidden sm:inline">GPU Vector 2K</span>
        </div>
      </div>
    </div>
  );
};
