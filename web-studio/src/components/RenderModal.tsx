"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  CloudLightning,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Clock,
  Cpu,
  Check,
  Key,
  Sparkles,
} from "lucide-react";
import { MasterSceneGraph } from "../remotion/types/sceneGraph";

interface ChunkStatus {
  name: string;
  status: string;
  conclusion: string | null;
}

interface JobsSummary {
  total: number;
  completed: number;
  inProgress: number;
  queued: number;
  totalChunks: number;
  completedChunks: number;
  inProgressChunks: number;
  isStitching: boolean;
  progressPercent: number;
  chunks: ChunkStatus[];
}

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  sceneGraph: MasterSceneGraph;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  isScriptOutOfSync?: boolean;
  currentScript?: string;
  geminiKey?: string;
  onSceneGraphGenerated?: (graph: MasterSceneGraph) => void;
}

export const RenderModal: React.FC<RenderModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  sceneGraph,
  githubToken,
  githubOwner,
  githubRepo,
  isScriptOutOfSync = false,
  currentScript = "",
  geminiKey = "",
  onSceneGraphGenerated,
}) => {
  const [chunkCount, setChunkCount] = useState(1);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isUpdatingScript, setIsUpdatingScript] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time Progress & ETA States
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [jobsData, setJobsData] = useState<JobsSummary | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const activeRunIdRef = useRef<number | null>(null);

  // Clear intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const totalFrames = sceneGraph.scenes.reduce((acc, s) => {
    const start = Number(s?.startFrame) || 0;
    const dur = Number(s?.durationInFrames) || 120;
    return Math.max(acc, start + dur);
  }, 360);

  // Format giây thành chuỗi thân thiện
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleStartRender = async () => {
    setIsDispatching(true);
    setIsRendering(true);
    setErrorMessage(null);
    setWorkflowStatus("Đang gửi lệnh Workflow Dispatch tới GitHub Actions...");
    setDownloadUrl(null);
    setProgressPercent(3);
    setElapsedSeconds(0);
    setEtaSeconds(45); // Benchmark ban đầu ~45-60s cho 15 máy ảo
    setJobsData(null);
    activeRunIdRef.current = null;

    const scriptId = `story_${Date.now()}`;
    const startTime = Date.now();
    startTimeRef.current = startTime;

    // Timer đếm giây chạy liên tục
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    try {
      // 1. Dispatch workflow
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
          sceneGraph,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể dispatch GitHub Actions");
      }

      setWorkflowStatus(`Đã gửi lệnh thành công! Đang chờ GitHub khởi tạo ${chunkCount} máy ảo Ubuntu (16GB RAM)...`);

      // 2. Start polling for run status every 3.5s
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/github-dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "status",
              githubToken,
              owner: githubOwner,
              repo: githubRepo,
              dispatchedAt: startTime,
              runId: activeRunIdRef.current,
              chunkCount,
            }),
          });
          const statusData = await statusRes.json();

          if (statusData.run) {
            if (statusData.run.id && !activeRunIdRef.current) {
              activeRunIdRef.current = statusData.run.id;
            }

            if (statusData.run.pendingCreation) {
              setWorkflowStatus(`Đang chờ GitHub Actions khởi tạo ${chunkCount} máy ảo Ubuntu (16GB RAM)...`);
              return;
            }

            setRunUrl(statusData.run.html_url);

            const summary: JobsSummary | undefined = statusData.run.jobsSummary;
            if (summary) {
              setJobsData(summary);
              const currentPercent = summary.progressPercent;
              setProgressPercent(currentPercent);

              // Tính toán ETA dựa trên thời gian thực tế đã trôi qua
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              if (currentPercent > 10 && currentPercent < 100) {
                const totalEstimated = Math.round((elapsed / currentPercent) * 100);
                const remaining = Math.max(3, totalEstimated - elapsed);
                setEtaSeconds(remaining);
              }

              if (summary.isStitching) {
                setWorkflowStatus("Ghép nối 15 chunks bằng FFmpeg và đóng gói video 2K...");
              } else if (summary.completedChunks > 0) {
                setWorkflowStatus(
                  `Đã hoàn thành ${summary.completedChunks}/${summary.totalChunks} chunks (${summary.inProgressChunks} máy ảo đang render)...`
                );
              }
            }

            // Hoàn tất thành công
            if (statusData.run.status === "completed") {
              if (statusData.run.conclusion === "success") {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                setProgressPercent(100);
                setEtaSeconds(0);
                setWorkflowStatus("Hoàn tất 100%! Đang lấy đường link tải video thành phẩm...");

                // Lấy bản phát hành release asset
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
                  setWorkflowStatus("Video 2K (2560x1440) @ 60 FPS đã sẵn sàng!");
                  setIsRendering(false);
                }
              } else {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                setErrorMessage(`Workflow kết thúc với trạng thái: ${statusData.run.conclusion}`);
                setIsRendering(false);
              }
            }
          }
        } catch (e) {
          // Bỏ qua lỗi tạm thời khi polling
        }
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khởi chạy Cloud Render");
      setIsRendering(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-[#27272A] bg-[#121215] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#232326]">
          <div className="flex items-center space-x-2">
            <CloudLightning className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Render 2K @ 60FPS (Distributed Cloud)</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col space-y-4 py-4 text-xs">
          {/* Cảnh báo Kịch bản chưa được cập nhật vào Scene Graph */}
          {isScriptOutOfSync && !isRendering && !downloadUrl && (
            <div className="flex flex-col space-y-2 rounded-xl bg-orange-950/50 p-3.5 border border-orange-500/40 text-orange-200">
              <div className="flex items-center space-x-2 font-medium">
                <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" />
                <span>Kịch bản nhập liệu vừa được sửa đổi nhưng chưa cập nhật vào Scene Graph!</span>
              </div>
              <p className="text-[11px] text-orange-300/80 leading-relaxed">
                Nếu render ngay bây giờ, video xuất ra sẽ là phân cảnh cũ trước đó. Hãy bấm nút bên dưới để tự động cập nhật phân cảnh từ kịch bản mới trước khi render:
              </p>
              <button
                type="button"
                disabled={isUpdatingScript}
                onClick={async () => {
                  setIsUpdatingScript(true);
                  try {
                    const res = await fetch("/api/gemini", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ prompt: currentScript, apiKey: geminiKey }),
                    });
                    const data = await res.json();
                    if (data.success && data.sceneGraph && onSceneGraphGenerated) {
                      onSceneGraphGenerated(data.sceneGraph);
                    }
                  } catch (e) {
                    console.error("Auto sync script error", e);
                  } finally {
                    setIsUpdatingScript(false);
                  }
                }}
                className="self-start mt-1 flex items-center space-x-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-500 transition-colors shadow-sm disabled:opacity-50"
              >
                {isUpdatingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                <span>{isUpdatingScript ? "Đang đồng bộ..." : "Cập nhật Scene Graph cho kịch bản mới ngay"}</span>
              </button>
            </div>
          )}

          {/* Spec summary box */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0E0E11] p-3 border border-[#232326]">
            <div>
              <span className="text-[10px] text-zinc-500">Độ phân giải</span>
              <p className="font-semibold text-white">2560 x 1440 (2K)</p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Khung hình</span>
              <p className="font-semibold text-white">60.0 FPS</p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Tổng Frames</span>
              <p className="font-semibold text-white">{totalFrames} frames</p>
            </div>
          </div>

          {/* Token Warning / Setup Helper */}
          {!githubToken && !isRendering && (
            <div className="flex flex-col space-y-2 rounded-xl bg-amber-950/40 p-3.5 border border-amber-500/30 text-amber-200">
              <div className="flex items-center space-x-2 font-medium">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Chưa có GitHub Token (PAT)</span>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Để kích hoạt cụm 10-15 máy ảo Ubuntu render video 2K trên GitHub Actions (miễn phí), hệ thống cần GitHub Token cá nhân của bạn có quyền <code>workflow</code> và <code>repo</code>.
              </p>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="self-start mt-1 flex items-center space-x-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                >
                  <Key className="h-3 w-3" />
                  <span>Mở Cấu hình API để điền Token</span>
                </button>
              )}
            </div>
          )}

          {/* Render Mode Selector */}
          {!isRendering && !downloadUrl && (
            <div className="flex flex-col space-y-3 rounded-xl bg-[#18181B] p-3.5 border border-[#27272A]">
              <span className="font-semibold text-zinc-200">Chế độ Render Đám mây</span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChunkCount(1)}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    chunkCount === 1
                      ? "bg-blue-600/20 border-blue-500 text-white shadow-sm"
                      : "bg-[#121215] border-[#27272A] text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>1 Máy Full (Khuyên dùng)</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    1 máy render toàn bộ từ đầu đến cuối. Ổn định 100%, không lo lỗi thiếu chunk hay ghép nối.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setChunkCount(3)}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    chunkCount > 1
                      ? "bg-purple-600/20 border-purple-500 text-white shadow-sm"
                      : "bg-[#121215] border-[#27272A] text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-purple-400">
                    <Cpu className="h-3.5 w-3.5" />
                    <span>Song song ({chunkCount > 1 ? chunkCount : 3} Máy)</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    Chia nhỏ render song song cho kịch bản rất dài ({">"} 3 phút).
                  </span>
                </button>
              </div>

              {chunkCount > 1 && (
                <div className="pt-2 border-t border-[#27272A]/60 flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Số lượng máy song song:</span>
                    <span className="font-bold text-purple-300">{chunkCount} Máy</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={chunkCount}
                    onChange={(e) => setChunkCount(Number(e.target.value))}
                    className="accent-purple-500"
                  />
                  <span className="text-[10px] text-zinc-500">
                    Mỗi máy render ~{Math.ceil(totalFrames / chunkCount)} frames.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TIẾN ĐỘ RENDER (% + THANH PROGRESS BAR + DỰ KIẾN THỜI GIAN CÒN LẠI)
             ========================================================================= */}
          {(isRendering || workflowStatus || downloadUrl) && (
            <div className="flex flex-col space-y-3 rounded-xl bg-[#18181B] p-4 border border-blue-500/30 shadow-inner">
              {/* Top row: Status title + Percentage */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-zinc-200">
                  {progressPercent === 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  )}
                  <span className="font-medium text-xs">
                    {progressPercent === 100 ? "Render hoàn tất 100%" : "Tiến độ Render đám mây"}
                  </span>
                </div>

                <div className="flex items-baseline space-x-1 font-mono">
                  <span className="text-xl font-black text-white">{progressPercent}</span>
                  <span className="text-xs font-semibold text-blue-400">%</span>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#0E0E11] border border-[#27272A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Subtext info: Status + ETA + Elapsed */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                <span className="truncate pr-2">{workflowStatus}</span>

                <div className="flex shrink-0 items-center space-x-3 text-zinc-400 font-mono">
                  {/* Thời gian đã trôi qua */}
                  <span title="Thời gian đã chạy">⏱️ {formatTime(elapsedSeconds)}</span>

                  {/* Thời gian dự kiến còn lại */}
                  {etaSeconds !== null && etaSeconds > 0 && progressPercent < 100 && (
                    <span className="rounded bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.5 text-blue-300">
                      Còn ~{formatTime(etaSeconds)}
                    </span>
                  )}
                </div>
              </div>

              {/* Live Server Matrix Cluster (15 Chunks Indicator) */}
              {jobsData && jobsData.chunks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#27272A]">
                  <div className="flex items-center justify-between pb-1.5 text-[10px] text-zinc-400">
                    <span className="flex items-center space-x-1">
                      <Cpu className="h-3 w-3 text-blue-400" />
                      <span>Trạng thái 15 máy ảo Ubuntu:</span>
                    </span>
                    <span>
                      {jobsData.completedChunks}/{jobsData.totalChunks} máy đã xong
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {jobsData.chunks.map((chk, i) => {
                      const isDone = chk.status === "completed" && chk.conclusion === "success";
                      const isRunning = chk.status === "in_progress";
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded px-2 py-1 text-[10px] font-mono border transition-all ${
                            isDone
                              ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                              : isRunning
                              ? "bg-blue-950/50 border-blue-500/40 text-blue-300 animate-pulse"
                              : "bg-[#0E0E11] border-[#27272A] text-zinc-500"
                          }`}
                        >
                          <span>{chk.name}</span>
                          {isDone ? (
                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                          ) : isRunning ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                          ) : (
                            <span className="text-[9px]">chờ</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GitHub Actions Link */}
              {runUrl && (
                <div className="pt-1">
                  <a
                    href={runUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    <span>Xem trực tiếp logs 15 máy ảo trên GitHub Actions</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="flex flex-col space-y-2 rounded-xl bg-rose-950/40 p-3 border border-rose-500/30 text-rose-300">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
              {onOpenSettings && errorMessage.includes("GitHub Personal Access Token") && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="self-start mt-1 flex items-center space-x-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors border border-rose-500/30"
                >
                  <Key className="h-3 w-3" />
                  <span>Bấm vào đây để mở Cấu hình API</span>
                </button>
              )}
            </div>
          )}

          {/* Download ready button */}
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-500 animate-bounce"
            >
              <Download className="h-4 w-4" />
              <span>Tải Video Thành Phẩm 2K @ 60FPS (.MP4)</span>
            </a>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#232326]">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Đóng
          </button>

          {!downloadUrl && (
            <button
              onClick={handleStartRender}
              disabled={isDispatching || isRendering}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {isDispatching || isRendering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudLightning className="h-4 w-4" />
              )}
              <span>{isRendering ? "Đang xử lý..." : "Kích hoạt Render Đám mây"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
