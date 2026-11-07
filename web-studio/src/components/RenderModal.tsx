"use client";

import React, { useState } from "react";
import { X, CloudLightning, Loader2, CheckCircle2, AlertCircle, Download, ExternalLink } from "lucide-react";
import { MasterSceneGraph } from "../remotion/types/sceneGraph";

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneGraph: MasterSceneGraph;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
}

export const RenderModal: React.FC<RenderModalProps> = ({
  isOpen,
  onClose,
  sceneGraph,
  githubToken,
  githubOwner,
  githubRepo,
}) => {
  const [chunkCount, setChunkCount] = useState(10);
  const [isDispatching, setIsDispatching] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalFrames = sceneGraph.scenes.reduce(
    (acc, s) => Math.max(acc, s.startFrame + s.durationInFrames),
    360
  );

  const handleStartRender = async () => {
    setIsDispatching(true);
    setErrorMessage(null);
    setWorkflowStatus("Đang gửi tín hiệu Workflow Dispatch tới GitHub Actions...");
    setDownloadUrl(null);

    try {
      // 1. Dispatch workflow
      const scriptId = `story_${Date.now()}`;
      const res = await fetch("/api/github-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispatch",
          githubToken,
          owner: githubOwner,
          repo: githubRepo,
          scriptId,
          totalFrames,
          chunkCount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể dispatch GitHub Actions");
      }

      setWorkflowStatus("Đã kích hoạt workflow thành công! Đang khởi động 10-15 máy ảo song song...");

      // Start polling for run status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/github-dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "status",
              githubToken,
              owner: githubOwner,
              repo: githubRepo,
            }),
          });
          const statusData = await statusRes.json();

          if (statusData.run) {
            setRunUrl(statusData.run.html_url);
            if (statusData.run.status === "in_progress") {
              setWorkflowStatus(`Đang render song song trên ${chunkCount} máy ảo Ubuntu (16GB RAM/máy)...`);
            } else if (statusData.run.status === "completed") {
              if (statusData.run.conclusion === "success") {
                clearInterval(pollInterval);
                setWorkflowStatus("Hoàn tất render & ghép FFmpeg! Đang lấy link tải...");

                // Fetch release asset
                const releaseRes = await fetch("/api/github-dispatch", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "get-release",
                    githubToken,
                    owner: githubOwner,
                    repo: githubRepo,
                    scriptId,
                  }),
                });
                const releaseData = await releaseRes.json();
                if (releaseData.downloadUrl) {
                  setDownloadUrl(releaseData.downloadUrl);
                  setWorkflowStatus("Video 2K @ 60FPS đã sẵn sàng để tải về!");
                }
              } else {
                clearInterval(pollInterval);
                setErrorMessage(`Workflow kết thúc với trạng thái: ${statusData.run.conclusion}`);
              }
            }
          }
        } catch (e) {
          // Continue polling
        }
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khởi chạy Cloud Render");
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-[#27272A] bg-[#121215] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#232326]">
          <div className="flex items-center space-x-2">
            <CloudLightning className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Render 2K @ 60FPS (Distributed Cloud)</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col space-y-4 py-4 text-xs">
          {/* Spec summary box */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0E0E11] p-3 border border-[#232326]">
            <div>
              <span className="text-[10px] text-zinc-500">Độ phân giải</span>
              <p className="font-semibold text-white">2560 x 1440 (2K)</p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Khung hình</span>
              <p className="font-semibold text-white">60 FPS</p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Tổng Frames</span>
              <p className="font-semibold text-white">{totalFrames} frames</p>
            </div>
          </div>

          {/* Chunk slider */}
          <div className="flex flex-col space-y-2 rounded-xl bg-[#18181B] p-3 border border-[#27272A]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-200">Số lượng máy ảo chạy song song (Chunks)</span>
              <span className="rounded bg-blue-500/20 px-2 py-0.5 font-bold text-blue-400">{chunkCount} Chunks</span>
            </div>
            <input
              type="range"
              min={4}
              max={15}
              value={chunkCount}
              onChange={(e) => setChunkCount(Number(e.target.value))}
              className="accent-blue-500"
            />
            <span className="text-[10px] text-zinc-400">
              Mỗi máy ảo Ubuntu 16GB RAM render ~{Math.ceil(totalFrames / chunkCount)} frames. Pipe thẳng FFmpeg siêu tốc.
            </span>
          </div>

          {/* Progress / Status feedback */}
          {workflowStatus && (
            <div className="flex flex-col space-y-2 rounded-xl bg-[#18181B] p-3 border border-blue-500/30">
              <div className="flex items-center space-x-2 text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span className="font-medium">{workflowStatus}</span>
              </div>
              {runUrl && (
                <a
                  href={runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-[11px] text-blue-400 underline hover:text-blue-300"
                >
                  <span>Xem tiến độ trên GitHub Actions</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-950/40 p-3 border border-rose-500/30 text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Download ready button */}
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" />
              <span>Tải Video Thành Phẩm 2K @ 60FPS (.MP4)</span>
            </a>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#232326]">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Đóng
          </button>

          {!downloadUrl && (
            <button
              onClick={handleStartRender}
              disabled={isDispatching}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
            >
              {isDispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudLightning className="h-4 w-4" />}
              <span>Kích hoạt Render Đám mây</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
