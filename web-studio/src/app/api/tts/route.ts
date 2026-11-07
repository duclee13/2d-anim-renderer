import { NextRequest, NextResponse } from "next/server";
import { synthesizeEdgeTts } from "@/lib/edgeTtsClient";

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "vi-VN-HoaiMyNeural", rate = "+0%" } = await req.json();

    if (!text || text.trim() === "") {
      return NextResponse.json({ error: "Nội dung văn bản không được để trống" }, { status: 400 });
    }

    const ttsResult = await synthesizeEdgeTts(text, voice, rate);

    return NextResponse.json({
      success: true,
      audioBase64: ttsResult.audioBase64,
      durationMs: ttsResult.durationMs,
      words: ttsResult.words,
    });
  } catch (error: any) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi tổng hợp giọng đọc Edge-TTS" },
      { status: 500 }
    );
  }
}
