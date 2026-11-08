"use client";

import React, { useState } from "react";
import { Sparkles, Mic, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleGenerateGemini = async () => {
    if (!script.trim()) {
      setErrorMessage("Vui lòng nhập nội dung kịch bản trước.");
      return;
    }

    setIsLoadingGemini(true);
    setErrorMessage(null);
    setStatusMessage("Gemini đang thiết kế Scene Graph 2K và tính toán tọa độ IK...");

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: script, apiKey }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể sinh Scene Graph");
      }

      onSceneGraphGenerated(data.sceneGraph);
      setStatusMessage(`Đã tạo Scene Graph thành công qua model ${data.modelUsed || "Gemini"}! Live Preview đã cập nhật.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi kết nối Gemini API");
    } finally {
      setIsLoadingGemini(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Kịch bản & Ý tưởng phân cảnh</h2>
        </div>
        <span className="text-[11px] text-zinc-500">Mô hình AI: Gemini 3.8 / 2.5 Flash</span>
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
        <div className="flex items-center space-x-2 rounded-lg bg-rose-950/40 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Notice khi kịch bản được thay đổi nhưng chưa bấm Sinh Scene Graph */}
      {isScriptOutOfSync && !statusMessage && !errorMessage && (
        <div className="flex items-center space-x-2 rounded-lg bg-amber-950/40 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 animate-pulse">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Kịch bản vừa được sửa đổi! Bấm <strong>&quot;Sinh Scene Graph&quot;</strong> bên dưới để cập nhật video.</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
        <button
          onClick={handleGenerateGemini}
          disabled={isLoadingGemini}
          className="flex w-full sm:w-auto flex-1 items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/10 transition-all hover:brightness-110 disabled:opacity-50"
        >
          {isLoadingGemini ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-blue-200" />
          )}
          <span>Sinh Scene Graph với Gemini</span>
        </button>

        <button
          onClick={handleGenerateEdgeTts}
          disabled={isLoadingTts}
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
