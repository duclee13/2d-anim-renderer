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
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const playerRef = React.useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGeminiKey(localStorage.getItem("STICKMAN_GEMINI_KEY") || "");
      setGithubToken(localStorage.getItem("STICKMAN_GH_TOKEN") || "");
      setGithubOwner(localStorage.getItem("STICKMAN_GH_OWNER") || "");
      setGithubRepo(localStorage.getItem("STICKMAN_GH_REPO") || "");
    }
  }, []);

  const handleSceneGraphGenerated = (newGraph: MasterSceneGraph) => {
    setSceneGraph(newGraph);
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
          {/* Left Column: 2K 60FPS Live Preview Player (7 Cols) */}
          <div className="flex flex-col space-y-6 lg:col-span-7">
            <PreviewPlayer sceneGraph={sceneGraph} playerRefProp={playerRef} />
            <TimelineViewer sceneGraph={sceneGraph} onSelectScene={handleSelectScene} />
          </div>

          {/* Right Column: AI Scriptwriting, TTS & Scene Parameters (5 Cols) */}
          <div className="flex flex-col space-y-6 lg:col-span-5">
            <ScriptEditor
              script={script}
              setScript={setScript}
              apiKey={geminiKey}
              onSceneGraphGenerated={handleSceneGraphGenerated}
            />

            {/* Architecture Explainer Card */}
            <div className="rounded-2xl border border-[#232326] bg-[#121215] p-5 text-xs text-zinc-400 shadow-lg">
              <h3 className="mb-2 text-sm font-semibold text-zinc-200">
                🛡️ Cơ chế Chống Lỗi Đồ Họa Tự Động (Physics Rules Active)
              </h3>
              <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed text-zinc-400">
                <li>
                  <strong className="text-zinc-200">Z-Index 6 Lớp:</strong> Tự động đẩy mặt bàn và chân trước của bàn ra phía trước ngực và chân nhân vật khi ở trạng thái <code className="text-blue-400">sittingBehindDesk</code>.
                </li>
                <li>
                  <strong className="text-zinc-200">2-Bone IK Snapping:</strong> Khi cầm đồ vật, hai bàn tay tự động khóa cứng vào <code className="text-blue-400">target.leftGrip</code> và <code className="text-blue-400">target.rightGrip</code>, không bao giờ bị tay lơ lửng.
                </li>
                <li>
                  <strong className="text-zinc-200">Subtitle Be Vietnam Pro:</strong> Nét viền kép 12px đen và đổ bóng mềm đảm bảo rõ nét 100% trên mọi nền màu.
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
        sceneGraph={sceneGraph}
        githubToken={githubToken}
        githubOwner={githubOwner}
        githubRepo={githubRepo}
      />
    </div>
  );
}
