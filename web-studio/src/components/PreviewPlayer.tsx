"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import { MasterSceneGraph } from "../remotion/types/sceneGraph";
import { MainScene, defaultMockSceneGraph } from "../remotion/Composition";
import { Play, Pause, RotateCcw, Maximize2 } from "lucide-react";

// Dynamic import with SSR disabled for client-only Remotion player
const Player = dynamic(
  () => import("@remotion/player").then((mod) => mod.Player),
  { ssr: false }
);

interface PreviewPlayerProps {
  sceneGraph: MasterSceneGraph;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({ sceneGraph }) => {
  const playerRef = useRef<any>(null);

  // Tính toán an toàn tuyệt đối tổng số frame, không bao giờ để bị NaN
  const safeScenes = Array.isArray(sceneGraph?.scenes) ? sceneGraph.scenes : [];
  const calculatedTotal = safeScenes.reduce((acc, s) => {
    const start = Number(s?.startFrame) || 0;
    const dur = Number(s?.durationInFrames) || 120;
    return Math.max(acc, start + dur);
  }, 360);

  const rawTotal = Number(sceneGraph?.totalDurationInFrames) || calculatedTotal;
  const totalFrames = Math.max(60, isNaN(rawTotal) ? 360 : Math.round(rawTotal));

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-[#232326] bg-[#121215] p-3 shadow-2xl">
      {/* 2K Preview Monitor Frame */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#09090B] border border-[#1E1E22] shadow-inner">
        <Player
          ref={playerRef}
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
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span className="font-mono text-zinc-300">2560 x 1440 (2K QHD)</span>
          <span className="text-zinc-600">|</span>
          <span className="font-mono text-zinc-300">60.0 FPS</span>
          <span className="text-zinc-600">|</span>
          <span className="font-mono text-zinc-400">
            {totalFrames} frames ({(totalFrames / 60).toFixed(1)}s)
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
          <span>Vector GPU Accelerated</span>
        </div>
      </div>
    </div>
  );
};
