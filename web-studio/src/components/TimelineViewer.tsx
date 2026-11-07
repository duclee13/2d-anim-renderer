"use client";

import React, { useState } from "react";
import { Layers, Code2, Film, Clock, User, ShieldCheck } from "lucide-react";
import { MasterSceneGraph, SceneGraphScene } from "../remotion/types/sceneGraph";

interface TimelineViewerProps {
  sceneGraph: MasterSceneGraph;
  onSelectScene?: (scene: SceneGraphScene) => void;
}

export const TimelineViewer: React.FC<TimelineViewerProps> = ({
  sceneGraph,
  onSelectScene,
}) => {
  const [showJsonRaw, setShowJsonRaw] = useState(false);

  return (
    <div className="flex flex-col space-y-4 rounded-2xl border border-[#232326] bg-[#121215] p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Phân đoạn Timeline & Scene Graph</h2>
        </div>
        <button
          onClick={() => setShowJsonRaw(!showJsonRaw)}
          className="flex items-center space-x-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white"
        >
          <Code2 className="h-3 w-3" />
          <span>{showJsonRaw ? "Ẩn JSON" : "Xem JSON Schema"}</span>
        </button>
      </div>

      {showJsonRaw ? (
        <pre className="max-h-72 overflow-y-auto rounded-xl border border-[#27272A] bg-[#0A0A0C] p-4 text-[11px] font-mono leading-relaxed text-emerald-400">
          {JSON.stringify(sceneGraph, null, 2)}
        </pre>
      ) : (
        <div className="flex flex-col space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {(sceneGraph?.scenes || []).map((scene, idx) => {
            const isSittingDesk = scene.character?.pose === "sittingBehindDesk";
            const isHolding = scene.character?.pose === "holdingObject";
            const startF = Number(scene.startFrame) || 0;
            const durF = Number(scene.durationInFrames) || 120;

            return (
              <div
                key={scene.id || `scene_${idx}`}
                onClick={() => onSelectScene?.(scene)}
                className="group flex flex-col space-y-2 rounded-xl border border-[#232326] bg-[#18181B]/60 p-3 transition-colors hover:border-blue-500/30 hover:bg-[#1E1E22] cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-400">
                      {idx + 1}
                    </span>
                    <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                      {scene.name || `Cảnh ${idx + 1}`}
                    </h4>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-zinc-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      <span>{startF} - {startF + durF} f</span>
                    </span>
                    <span className="rounded bg-[#27272A] px-1.5 py-0.5 text-zinc-300">
                      {(durF / 60).toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Badges for Pose & Physics Compliance */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded-md bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 text-blue-300">
                    Bg: {scene.background?.preset || "livingRoomDay"}
                  </span>

                  <span className="flex items-center space-x-1 rounded-md bg-zinc-800/80 px-2 py-0.5 text-zinc-300">
                    <User className="h-2.5 w-2.5 text-zinc-400" />
                    <span>Pose: {scene.character.pose}</span>
                  </span>

                  {/* Physics indicator */}
                  {isSittingDesk && (
                    <span className="flex items-center space-x-1 rounded-md bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 text-emerald-300">
                      <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                      <span>Z-Index Sitting Desk (Safe)</span>
                    </span>
                  )}

                  {isHolding && (
                    <span className="flex items-center space-x-1 rounded-md bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 text-purple-300">
                      <ShieldCheck className="h-2.5 w-2.5 text-purple-400" />
                      <span>IK Hand Snapping (Safe)</span>
                    </span>
                  )}
                </div>

                {/* Subtitle text line */}
                {scene.subtitles[0] && (
                  <p className="text-[11px] italic text-zinc-400">
                    "{scene.subtitles[0].text}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
