import { NextRequest, NextResponse } from "next/server";
import { runMultiPromptPipeline } from "@/lib/pipeline/pipelineOrchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.prompt || "").trim();
    const apiKey = body.apiKey || process.env.GEMINI_API_KEY;
    const model = body.model || "gemini-3.1-flash-lite";
    const voice = body.voice || "vi-VN-HoaiMyNeural";

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập kịch bản trước khi tạo video." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Vui lòng nhập Gemini API Key trong mục Cài đặt trước khi chạy Multi-Prompt Pipeline.",
        },
        { status: 400 }
      );
    }

    // Thiết lập HTTP Streaming Response (Server-Sent Events) để thông báo tiến độ từng bước cho UI
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const result = await runMultiPromptPipeline({
            rawScript: prompt,
            modelName: model,
            apiKey,
            voice,
            onProgress: (step, message, percent) => {
              sendEvent({
                type: "progress",
                step,
                message,
                percent,
              });
            },
          });

          sendEvent({
            type: "complete",
            result,
          });
          controller.close();
        } catch (err: any) {
          console.error("[Pipeline Error]", err);
          sendEvent({
            type: "error",
            error: err.message || "Lỗi xử lý trong Multi-Prompt Pipeline",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[Pipeline Route Exception]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}
