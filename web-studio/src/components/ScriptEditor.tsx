"use client";

import React, { useState, useRef } from "react";
import { Sparkles, Mic, FileText, Check, AlertCircle, Loader2, X } from "lucide-react";
import { MasterSceneGraph } from "../remotion/types/sceneGraph";

interface ScriptEditorProps {
  script: string;
  setScript: (s: string) => void;
  apiKey: string;
  isScriptOutOfSync?: boolean;
  onSceneGraphGenerated: (graph: MasterSceneGraph) => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  script,
  setScript,
  apiKey,
  isScriptOutOfSync = false,
  onSceneGraphGenerated,
}) => {
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [isLoadingTts, setIsLoadingTts] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.1-flash-lite");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<number | null>(null);
  const [pipelinePercent, setPipelinePercent] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const samplePrompts = [
    {
      title: "Chuyện con nhện Tám (Full 4 cảnh 1.1 -> 1.5)",
      content: `Cảnh 1: Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ thủy tinh trên sàn nhà. Tôi bảo 'Để sau!' rồi quên bẵng nó.
Cảnh 2: Phóng cận cảnh vào chiếc lọ thủy tinh, tôi dán nhãn đặt tên cho nó là 'Tám'.
Cảnh 3: Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp, nó tự hạ tốc độ trao đổi chất để sống sót.
Cảnh 4: Buổi tối bình thường, tôi ngồi sau bàn học làm việc dưới ánh đèn bàn ấm áp, bên ngoài cửa sổ là trăng sao.`,
    },
    {
      title: "Mang lọ ra vườn (Cầm nắm chuẩn Anchor Point)",
      content: `Buổi sáng trời nắng đẹp, mây trôi nhẹ. Tôi dùng hai tay cầm chắc chiếc lọ thủy tinh có con nhện Tám mang ra vườn cỏ xanh bên cạnh bụi cây.`,
    },
  ];

  const handleCancelGemini = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoadingGemini(false);
    setPipelineStep(null);
    setPipelinePercent(0);
    setStatusMessage("Đã hủy yêu cầu tạo Scene Graph. Kịch bản và phân cảnh trước đó được giữ nguyên.");
  };

  const handleGenerateProcedural = async () => {
    if (!script.trim()) {
      setErrorMessage("Vui lòng nhập nội dung kịch bản trước.");
      return;
    }
    setIsLoadingGemini(true);
    setPipelineStep(null);
    setPipelinePercent(0);
    setErrorMessage(null);
    setStatusMessage("Đang sinh Scene Graph qua Procedural Script Engine (không phụ thuộc mạng/AI)...");
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: script, forceProcedural: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể sinh Scene Graph");
      }
      onSceneGraphGenerated(data.sceneGraph);
      setStatusMessage("Đã tạo Scene Graph thành công qua Procedural Engine! Live Preview đã cập nhật.");
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi tạo Procedural Scene Graph");
    } finally {
      setIsLoadingGemini(false);
    }
  };

  const handleGenerateGemini = async (modelOverride?: string) => {
    if (!script.trim()) {
      setErrorMessage("Vui lòng nhập nội dung kịch bản trước.");
      return;
    }

    const activeModel = typeof modelOverride === "string" && modelOverride ? modelOverride : selectedModel;
    setIsLoadingGemini(true);
    setPipelineStep(1);
    setPipelinePercent(5);
    setErrorMessage(null);
    setStatusMessage(`Đang khởi động Multi-Prompt Pipeline (Model: ${activeModel})...`);

    abortControllerRef.current = new AbortController();

    try {
      // 1. Thử gọi qua endpoint Streaming SSE /api/pipeline/generate
      const res = await fetch("/api/pipeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: script, apiKey, model: activeModel }),
        signal: abortControllerRef.current.signal,
      });

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                try {
                  const event = JSON.parse(trimmed.slice(6));
                  if (event.type === "progress") {
                    setPipelineStep(event.step);
                    setPipelinePercent(event.percent);
                    setStatusMessage(`[Bước ${event.step}/4] ${event.message}`);
                  } else if (event.type === "complete") {
                    setPipelinePercent(100);
                    onSceneGraphGenerated(event.result.sceneGraph);
                    setStatusMessage(`Đã tạo Scene Graph thành công qua model ${activeModel}! Live Preview đã cập nhật.`);
                  } else if (event.type === "error") {
                    throw new Error(event.error);
                  }
                } catch (pe: any) {
                  if (pe.message && !pe.message.includes("JSON")) throw pe;
                }
              }
            }
          }
        }
      } else {
        // Fallback: nếu server trả về JSON thông thường
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể sinh Scene Graph");
        }
        onSceneGraphGenerated(data.sceneGraph);
        setStatusMessage(`Đã tạo Scene Graph thành công! Live Preview đã cập nhật.`);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatusMessage("Đã hủy yêu cầu. Kịch bản và dữ liệu hiện tại được giữ nguyên.");
      } else {
        setErrorMessage(err.message || "Lỗi kết nối Gemini API. Kịch bản và dữ liệu trước đó được giữ nguyên.");
      }
    } finally {
      setIsLoadingGemini(false);
      setPipelineStep(null);
      abortControllerRef.current = null;
    }
  };

  const handleGenerateEdgeTts = async () => {
    if (!script.trim()) {
      setErrorMessage("Vui lòng nhập kịch bản trước khi tạo giọng đọc.");
      return;
    }

    setIsLoadingTts(true);
    setErrorMessage(null);
    setStatusMessage("Edge-TTS đang tổng hợp giọng Hoài My & bóc tách metadata timestamp...");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script,
          voice: "vi-VN-HoaiMyNeural",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Lỗi tổng hợp giọng đọc");
      }

      setStatusMessage(`Tạo giọng đọc thành công! (${(data.durationMs / 1000).toFixed(1)}s, ${data.words.length} từ).`);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi kết nối Edge-TTS");
    } finally {
      setIsLoadingTts(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 rounded-2xl border border-[#232326] bg-[#121215] p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Kịch bản & Ý tưởng phân cảnh</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-zinc-400">Mô hình AI:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoadingGemini}
            className="rounded-lg border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-xs text-blue-300 font-medium focus:border-blue-500 focus:outline-none"
          >
            <option value="gemini-3.1-flash-lite">⚡ gemini-3.1-flash-lite (Siêu nhanh &lt; 1s, Rất ổn định)</option>
            <option value="gemini-3.5-flash">🚀 gemini-3.5-flash (Chuẩn Google)</option>
            <option value="gemini-3.8-flash">🧪 gemini-3.8-flash (Có thể quá tải khi cao điểm)</option>
          </select>
        </div>
      </div>

      {/* Preset script chips */}
      <div className="flex flex-wrap gap-2">
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => setScript(p.content)}
            className="rounded-full border border-[#27272A] bg-[#18181B] px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-blue-500/40 hover:text-white"
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Nhập kịch bản phân đoạn của bạn ở đây... (ví dụ: Tôi phát hiện con nhện trong lọ, sau đó đặt tên cho nó là Tám...)"
        rows={6}
        className="w-full resize-none rounded-xl border border-[#27272A] bg-[#0E0E11] p-3 text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Status or Error notice */}
      {statusMessage && (
        <div className="flex items-center space-x-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex flex-col space-y-2 rounded-lg bg-rose-950/40 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedModel !== "gemini-3.1-flash-lite" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedModel("gemini-3.1-flash-lite");
                  setErrorMessage(null);
                  handleGenerateGemini("gemini-3.1-flash-lite");
                }}
                className="rounded-md bg-blue-600/80 hover:bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
              >
                ⚡ Chuyển sang gemini-3.1-flash-lite &amp; Thử lại ngay
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerateProcedural}
              className="rounded-md bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors"
            >
              🛠️ Sinh nhanh bằng Procedural Engine (Không cần AI)
            </button>
          </div>
        </div>
      )}

      {/* Notice khi kịch bản được thay đổi nhưng chưa bấm Sinh Scene Graph */}
      {isScriptOutOfSync && !statusMessage && !errorMessage && !isLoadingGemini && (
        <div className="flex items-center space-x-2 rounded-lg bg-amber-950/40 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 animate-pulse">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Kịch bản vừa được sửa đổi! Bấm <strong>&quot;Sinh Scene Graph&quot;</strong> bên dưới để cập nhật video.</span>
        </div>
      )}

      {/* Multi-Prompt Pipeline Stepper Progress */}
      {isLoadingGemini && (
        <div className="flex flex-col space-y-2.5 rounded-xl border border-blue-500/30 bg-blue-950/20 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-300">
              {pipelineStep ? `Bước ${pipelineStep}/4: ` : "Đang xử lý: "}
              {pipelineStep === 1 && "Phân rã nhịp 3-5s & Edge-TTS"}
              {pipelineStep === 2 && "Thiết kế SVG 400x400 từng Object"}
              {pipelineStep === 3 && "Đạo diễn chi tiết Micro-Scenes"}
              {pipelineStep === 4 && "Khóa hình học & Ghép nối Master Graph"}
              {!pipelineStep && "Khởi động quy trình..."}
            </span>
            <span className="font-bold text-blue-400">{pipelinePercent}%</span>
          </div>

          {/* Progress Track */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-950/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${Math.max(5, pipelinePercent)}%` }}
            />
          </div>

          {/* 4 Step Pills */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] text-center">
            <div className={`rounded py-1 px-1 font-medium ${(pipelineStep || 1) >= 1 ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "bg-zinc-800/40 text-zinc-500"}`}>
              1. Cắt nhịp 3-5s
            </div>
            <div className={`rounded py-1 px-1 font-medium ${(pipelineStep || 1) >= 2 ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "bg-zinc-800/40 text-zinc-500"}`}>
              2. Vẽ SVG 400x400
            </div>
            <div className={`rounded py-1 px-1 font-medium ${(pipelineStep || 1) >= 3 ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "bg-zinc-800/40 text-zinc-500"}`}>
              3. Đạo diễn cảnh
            </div>
            <div className={`rounded py-1 px-1 font-medium ${(pipelineStep || 1) >= 4 ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "bg-zinc-800/40 text-zinc-500"}`}>
              4. Ghép 1080p
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
        <button
          onClick={() => handleGenerateGemini()}
          disabled={isLoadingGemini}
          className="flex w-full sm:w-auto flex-1 items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/10 transition-all hover:brightness-110 disabled:opacity-50"
        >
          {isLoadingGemini ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-blue-200" />
          )}
          <span>{isLoadingGemini ? `Đang tạo qua Pipeline (${pipelinePercent}%)...` : "Sinh Scene Graph với Gemini"}</span>
        </button>

        {isLoadingGemini && (
          <button
            type="button"
            onClick={handleCancelGemini}
            className="flex items-center space-x-1.5 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/80 transition-colors shadow-sm"
          >
            <X className="h-4 w-4 text-rose-400" />
            <span>Hủy</span>
          </button>
        )}

        <button
          onClick={handleGenerateEdgeTts}
          disabled={isLoadingTts || isLoadingGemini}
          className="flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-[#222226] hover:text-white disabled:opacity-50"
        >
          {isLoadingTts ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4 text-amber-400" />
          )}
          <span>Tạo Giọng đọc Edge-TTS</span>
        </button>
      </div>
    </div>
  );
};
