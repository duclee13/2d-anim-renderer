import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { MasterSceneGraph } from "@/remotion/types/sceneGraph";
import { sampleScriptSceneGraph } from "@/remotion/data/sampleScript";

const SYSTEM_PROMPT = `
You are the Lead 2D Animation Director and Spatial Scene Graph Architect for a 2K 60FPS Stickman Explainer Video Engine.
Your job is to transform a story script into a precise, valid MasterSceneGraph JSON structure.

Strict Rules:
1. Target resolution: 2560x1440 at 60 FPS.
2. durationInFrames MUST be an integer number of frames (e.g. 120 for 2 seconds at 60fps).
3. startFrame MUST be an integer frame offset (0, 120, 240...).
4. Character Poses: 'standing', 'sittingBehindDesk', 'holdingObject', 'walking', 'pointing', 'shrugging'.
5. Facial Expressions:
   - eyes: 'neutral' | 'wide' | 'surprised' | 'happy' | 'closed' | 'curious'
   - eyebrows: 'neutral' | 'raised' | 'inquisitive' | 'worried' | 'furrowed'
   - mouth: 'smile' | 'circleOpen' | 'line' | 'talking' | 'gasp'
6. Anti-Clash & Physics Rules:
   - If the character is sitting behind a desk, pose MUST be 'sittingBehindDesk'. Never use 'standing' behind a desk.
   - If holding an object (e.g. glassJar), character pose MUST be 'holdingObject' with holdingTarget set to prop grip points.
   - Z-Index layering must assign props to 'midgroundBackLayer' or 'midgroundFrontLayer'.
7. Dynamic Asset Bank Awareness:
   - Standard built-in props: 'glassJar', 'spider', 'sofa', 'desk', 'deskLamp', 'gaugeMeter', 'pottedPlant'.
8. Output ONLY a valid JSON object matching the MasterSceneGraph schema. No markdown formatting.
`;

/**
 * Tự động gọi Google ModelService (ListModels) để lấy chính xác danh sách các model
 * đang hoạt động thực tế trên API Key của người dùng (tránh lỗi 404/400).
 */
async function fetchAccountModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (!res.ok) {
      console.warn("[Gemini API] Không thể truy vấn ListModels:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    if (!data.models || !Array.isArray(data.models)) return [];

    // Chỉ lấy các model hỗ trợ generateContent VÀ loại bỏ các model chuyên dụng không nhận systemInstruction
    const supported = data.models
      .filter((m: any) => {
        const name = m.name.toLowerCase();
        const canGenerate = m.supportedGenerationMethods?.includes("generateContent");
        const isNotTts = !name.includes("-tts");
        const isNotEmbedding = !name.includes("embedding");
        const isNotImage = !name.includes("imagen");
        return canGenerate && isNotTts && isNotEmbedding && isNotImage;
      })
      .map((m: any) => m.name.replace(/^models\//, ""));

    // Sắp xếp ưu tiên các model Flash đời mới nhất trước
    const score = (name: string): number => {
      // Ưu tiên cao nhất các model Flash đời 3.x
      if (name === "gemini-3.8-flash") return 1000;
      if (name.includes("3.1-flash")) return 950;
      if (name.includes("3.") && name.includes("flash")) return 900;
      if (name.includes("2.5-flash")) return 850;
      if (name.includes("2.0-flash")) return 800;
      if (name.includes("flash")) return 700;
      if (name.includes("3.")) return 600;
      if (name.includes("2.5")) return 500;
      return 100;
    };

    supported.sort((a: string, b: string) => score(b) - score(a));
    console.log("[Gemini API] Danh sách model text khả dụng đã lọc:", supported);
    return supported;
  } catch (err: any) {
    console.warn("[Gemini API] Lỗi mạng khi gọi ListModels:", err.message);
    return [];
  }
}

/**
 * Chuẩn hóa và làm sạch 100% dữ liệu SceneGraph từ LLM
 * Đảm bảo các thuộc tính như durationInFrames, startFrame luôn là số nguyên (tránh lỗi NaN trong Remotion Player).
 */
function sanitizeSceneGraph(raw: any): MasterSceneGraph {
  const scenesRaw = Array.isArray(raw?.scenes) ? raw.scenes : [];
  let currentStart = 0;

  const cleanScenes = scenesRaw.map((s: any, idx: number) => {
    const dur = Math.max(30, Math.round(Number(s?.durationInFrames || s?.duration || 120)));
    const start =
      s?.startFrame !== undefined && !isNaN(Number(s.startFrame))
        ? Math.round(Number(s.startFrame))
        : currentStart;

    currentStart = start + dur;

    return {
      id: String(s?.id || `scene_${idx + 1}`),
      name: String(s?.name || `Cảnh ${idx + 1}`),
      startFrame: start,
      durationInFrames: dur,
      background: {
        preset: s?.background?.preset || "livingRoomDay",
      },
      camera: {
        x: Number(s?.camera?.x) || 1280,
        y: Number(s?.camera?.y) || 720,
        zoom: Number(s?.camera?.zoom) || 1.0,
      },
      character: {
        x: s?.character?.x !== undefined ? Number(s.character.x) : 1560,
        y: s?.character?.y !== undefined ? Number(s.character.y) : 1040,
        scale: Number(s?.character?.scale) || 1.0,
        facing: s?.character?.facing === "right" ? ("right" as const) : ("left" as const),
        pose: s?.character?.pose || "standing",
        eyes: s?.character?.eyes || "neutral",
        eyebrows: s?.character?.eyebrows || "neutral",
        mouth: s?.character?.mouth || "smile",
        pupilGaze: s?.character?.pupilGaze || { x: 0, y: 0 },
      },
      props: Array.isArray(s?.props)
        ? s.props.map((p: any, pIdx: number) => ({
            id: String(p?.id || `prop_${idx}_${pIdx}`),
            type: String(p?.type || "glassJar"),
            layer: p?.layer === "midgroundBackLayer" ? ("midgroundBackLayer" as const) : ("midgroundFrontLayer" as const),
            x: Number(p?.x) || 1280,
            y: Number(p?.y) || 970,
            scale: Number(p?.scale) || 1.0,
            rotation: Number(p?.rotation) || 0,
            properties: p?.properties || {},
          }))
        : [],
      subtitles: Array.isArray(s?.subtitles)
        ? s.subtitles.map((sub: any, subIdx: number) => ({
            id: String(sub?.id || `sub_${idx}_${subIdx}`),
            text: String(sub?.text || ""),
            startFrame: sub?.startFrame !== undefined ? Number(sub.startFrame) : start + 10,
            endFrame: sub?.endFrame !== undefined ? Number(sub.endFrame) : start + dur - 10,
            words: Array.isArray(sub?.words) ? sub.words : [],
          }))
        : [],
      speechBubbles: Array.isArray(s?.speechBubbles) ? s.speechBubbles : [],
      keyframes: Array.isArray(s?.keyframes) ? s.keyframes : [],
      lines: Array.isArray(s?.lines) ? s.lines : [],
    };
  });

  const totalFrames = cleanScenes.reduce(
    (acc: number, s: any) => Math.max(acc, s.startFrame + s.durationInFrames),
    360
  );

  return {
    version: "3.0.0",
    title: String(raw?.title || "Stickman 2D Explainer Video"),
    width: 2560,
    height: 1440,
    fps: 60,
    totalDurationInFrames: Math.round(totalFrames),
    scenes: cleanScenes.length > 0 ? cleanScenes : sampleScriptSceneGraph.scenes,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json(
        { error: "Vui lòng nhập Google Gemini API Key trong phần Cài đặt." },
        { status: 400 }
      );
    }

    // 1. Tự động lấy danh sách model thực tế từ chính API Key của người dùng
    let candidateModels = await fetchAccountModels(activeApiKey);

    if (candidateModels.length === 0) {
      candidateModels = [
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash",
      ];
    }

    const genAI = new GoogleGenerativeAI(activeApiKey);
    let responseText = "";
    let successfulModel = "";
    let lastError: any = null;

    // 2. Thử tuần tự các model khả dụng
    for (const modelName of candidateModels) {
      try {
        console.log(`[Gemini API] Đang kết nối tới model: ${modelName}...`);
        const model = genAI.getGenerativeModel(
          {
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
            },
            systemInstruction: SYSTEM_PROMPT,
          },
          { timeout: 35000 }
        );

        const result = await model.generateContent(
          `Tạo Scene Graph JSON cho kịch bản sau:\n\n${prompt}`
        );

        responseText = result.response.text();
        if (responseText) {
          successfulModel = modelName;
          console.log(`[Gemini API] ✅ Thành công với model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Model ${modelName} thất bại:`, err.message);

        // Nếu API key sai hoàn toàn
        if (
          err.message?.includes("API_KEY_INVALID") ||
          err.message?.includes("API key not valid")
        ) {
          throw new Error("Google Gemini API Key không hợp lệ. Vui lòng kiểm tra lại key trong mục Cài đặt.");
        }

        continue;
      }
    }

    if (!responseText) {
      throw (
        lastError ||
        new Error("Tất cả các model Gemini đang quá tải. Vui lòng thử lại sau giây lát.")
      );
    }

    // 3. Làm sạch chuỗi trước khi parse JSON
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
    const rawParsed = JSON.parse(cleanText);

    // 4. Chuẩn hóa schema, tính toán lại frame an toàn 100% không bao giờ có NaN
    const parsedGraph = sanitizeSceneGraph(rawParsed);

    // 5. ĐẢM BẢO TẤT CẢ PROPS CÓ FILE SVG TRONG 0MS
    const assetsDir = path.join(process.cwd(), "public", "assets", "props");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const existingAssets = fs.readdirSync(assetsDir);

    const generatedAssets: string[] = [];

    for (const scene of parsedGraph.scenes) {
      for (const prop of scene.props) {
        const normalizedId = prop.type.replace(/([A-Z])/g, "-$1").toLowerCase();
        const fileName = `${normalizedId}.svg`;

        const isStandardBuiltin = [
          "glass-jar.svg",
          "desk-front.svg",
          "desk-back.svg",
          "desk.svg",
          "desk-lamp.svg",
          "sofa.svg",
          "spider.svg",
          "gauge-meter.svg",
          "potted-plant.svg",
        ].includes(fileName);

        if (!existingAssets.includes(fileName) && !isStandardBuiltin) {
          const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -140 240 280" width="240" height="280">
            <rect x="-80" y="-80" width="160" height="160" rx="24" fill="#F1F5F9" stroke="#141414" stroke-width="8" />
            <circle cx="0" cy="0" r="40" fill="#E2E8F0" stroke="#141414" stroke-width="6" />
            <text x="0" y="8" text-anchor="middle" font-size="20" font-weight="900" fill="#141414" font-family="sans-serif">${normalizedId}</text>
          </svg>`;
          try {
            fs.writeFileSync(path.join(assetsDir, fileName), placeholderSvg, "utf8");
            generatedAssets.push(normalizedId);
          } catch (writeErr) {
            console.warn(`[AssetWriter] Không thể tạo placeholder cho ${fileName}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      modelUsed: successfulModel,
      sceneGraph: parsedGraph,
      autoGeneratedAssets: generatedAssets,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi gọi Gemini API" },
      { status: 500 }
    );
  }
}
