"use client";

import React, { useState, useEffect } from "react";
import { StudioHeader } from "../components/StudioHeader";
import { PreviewPlayer } from "../components/PreviewPlayer";
import { ScriptEditor } from "../components/ScriptEditor";
import { TimelineViewer } from "../components/TimelineViewer";
import { SettingsModal } from "../components/SettingsModal";
import { RenderModal } from "../components/RenderModal";
import { defaultMockSceneGraph } from "../remotion/Composition";
import { MasterSceneGraph, SceneGraphScene } from "../remotion/types/sceneGraph";

export default function StudioPage() {
  const [sceneGraph, setSceneGraph] = useState<MasterSceneGraph>(defaultMockSceneGraph);
  const [script, setScript] = useState<string>(
    `Cảnh 1: Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ thủy tinh trên sàn nhà. Tôi bảo 'Để sau!' rồi quên bẵng nó.\nCảnh 2: Phóng cận cảnh vào chiếc lọ thủy tinh, tôi dán nhãn đặt tên cho nó là 'Tám'.\nCảnh 3: Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp, nó tự hạ tốc độ trao đổi chất để sống sót.\nCảnh 4: Buổi tối bình thường, tôi ngồi sau bàn học làm việc dưới ánh đèn bàn ấm áp, bên ngoài cửa sổ là trăng sao.`
  );

  // Settings State (Loaded from localStorage)
  const [geminiKey, setGeminiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubOwner, setGithubOwner] = useState("duclee13");
  const [githubRepo, setGithubRepo] = useState("2d-anim-renderer");

  const [lastGeneratedScript, setLastGeneratedScript] = useState<string>(script);
  const isScriptOutOfSync = script.trim() !== lastGeneratedScript.trim();

  const [sceneVersion, setSceneVersion] = useState<number>(Date.now());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const playerRef = React.useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGeminiKey(localStorage.getItem("STICKMAN_GEMINI_KEY") || "");
      setGithubToken(localStorage.getItem("STICKMAN_GH_TOKEN") || "");
      setGithubOwner(localStorage.getItem("STICKMAN_GH_OWNER") || "duclee13");
      setGithubRepo(localStorage.getItem("STICKMAN_GH_REPO") || "2d-anim-renderer");
    }
  }, []);

  const handleSceneGraphGenerated = (newGraph: MasterSceneGraph) => {
    setSceneGraph(newGraph);
    setLastGeneratedScript(script);
    setSceneVersion(Date.now());
    setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.seekTo(0);
      }
    }, 100);
  };

  const handleRefreshPreview = () => {
    setSceneVersion(Date.now());
  };

  const handleSelectScene = (scene: SceneGraphScene) => {
    if (playerRef.current) {
      const targetFrame = Number(scene.startFrame) || 0;
      playerRef.current.seekTo(targetFrame);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0C]">
      {/* Studio Apple Header */}
      <StudioHeader
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRenderModal={() => setIsRenderModalOpen(true)}
        isReadyToRender={true}
      />

      {/* Main Studio Workspace Grid */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto grid max-w-[1780px] grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: 1080p 60FPS Live Preview Player (7 Cols) */}
          <div className="flex flex-col space-y-6 lg:col-span-7">
            <PreviewPlayer
              sceneGraph={sceneGraph}
              playerRefProp={playerRef}
              version={sceneVersion}
              onRefresh={handleRefreshPreview}
            />
            <TimelineViewer sceneGraph={sceneGraph} onSelectScene={handleSelectScene} />
          </div>

          {/* Right Column: AI Scriptwriting, TTS & Scene Parameters (5 Cols) */}
          <div className="flex flex-col space-y-6 lg:col-span-5">
            <ScriptEditor
              script={script}
              setScript={setScript}
              apiKey={geminiKey}
              isScriptOutOfSync={isScriptOutOfSync}
              onSceneGraphGenerated={handleSceneGraphGenerated}
            />

            {/* Architecture Explainer Card */}
            <div className="rounded-2xl border border-[#232326] bg-[#121215] p-5 text-xs text-zinc-400 shadow-lg">
              <h3 className="mb-2 text-sm font-semibold text-zinc-200">
                🎬 Cinema VFX & Physics Engine (Active)
              </h3>
              <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed text-zinc-400">
                <li>
                  <strong className="text-zinc-200">CameraRig 1080p:</strong> Zoom-in/zoom-out điện ảnh mượt mà kèm tự động bắt nét theo tiêu điểm <code className="text-blue-400">focusSlot</code>.
                </li>
                <li>
                  <strong className="text-zinc-200">Volumetric Falloff:</strong> Ánh đèn bàn đa tầng alpha <code className="text-amber-400">0.85 → 0.00</code> và tia nắng god rays chân thực, không viền cứng.
                </li>
                <li>
                  <strong className="text-zinc-200">Procedural Loops:</strong> Mây trôi <code className="text-cyan-400">cloudDrift</code>, gió lượn <code className="text-teal-400">windBreeze</code>, mưa <code className="text-blue-400">rainLoop</code> và cây rung rinh 60 FPS toán học.
                </li>
                <li>
                  <strong className="text-zinc-200">Z-Index 3 Lớp Bàn:</strong> Tự động giấu chân và hông phía sau mặt bàn gỗ khi nhân vật ngồi <code className="text-purple-400">sittingBehindDesk</code>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        githubToken={githubToken}
        setGithubToken={setGithubToken}
        githubOwner={githubOwner}
        setGithubOwner={setGithubOwner}
        githubRepo={githubRepo}
        setGithubRepo={setGithubRepo}
      />

      {/* Cloud Render Modal */}
      <RenderModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sceneGraph={sceneGraph}
        githubToken={githubToken}
        githubOwner={githubOwner}
        githubRepo={githubRepo}
        isScriptOutOfSync={isScriptOutOfSync}
        currentScript={script}
        geminiKey={geminiKey}
        onSceneGraphGenerated={handleSceneGraphGenerated}
      />
    </div>
  );
}
