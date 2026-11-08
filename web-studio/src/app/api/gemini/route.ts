import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import {
  MasterSceneGraph,
  SceneGraphScene,
  EnvironmentVfxType,
  BackgroundPreset,
} from "@/remotion/types/sceneGraph";
import { generateVectorAsset } from "@/lib/vectorAssetGenerator";
import { normalizePropAssetId } from "@/remotion/utils/propResolver";
import { sanitizeSceneGraph } from "@/remotion/utils/sceneGraphSanitizer";
import { executeGeminiWithRetry, isRetryableGeminiError } from "@/lib/geminiRetry";

// 2K 60FPS Explainer Video Director Prompt
const SYSTEM_PROMPT = `
You are the Lead 2D Animation Director and Spatial Scene Graph Architect for a 2K 60FPS Stickman Explainer Video Engine.
Your job is to transform a story script into a precise, valid MasterSceneGraph JSON structure.

Strict Rules:
1. Target resolution: 2560x1440 at 60 FPS.
2. Contiguous Timeline & Audio Synchronization (CRITICAL):
   - Each scene's duration MUST match spoken dialogue duration: word count / 2.8 words/sec * 60 FPS + 30 frames transition padding.
   - Example: 10 words ≈ 210 frames + 30 = 240 frames (4s).
   - startFrame MUST be strictly contiguous: Scene 1 starts at 0, Scene 2 starts at Scene 1 end, etc.
   - NEVER add trailing frozen silence at the end of the video! Total duration = sum of scene durations.
3. FULL SCENE FIDELITY: You MUST generate EVERY scene described or implied in the user's prompt. If the user provides 4 scenes (Cảnh 1 -> Cảnh 4), output EXACTLY 4 scenes in the 'scenes' array. NEVER truncate, omit, or merge them!
4. SEMANTIC SLOTS (PREFER OVER RAW PIXELS):
   - Characters and props should use the 'slot' property so the engine resolves 100% exact coordinates:
     * Floor slots (baseline y = 1120): 'floor.farLeft', 'floor.left', 'floor.centerLeft', 'floor.center', 'floor.centerRight', 'floor.right', 'floor.farRight'
     * Desk slots: 'desk.seat' (character sitting at desk), 'desk.topLeft' (desk lamp), 'desk.topCenter' (laptop), 'desk.topRight' (glass jar / coffee cup)
     * Close-up slots: 'screen.center', 'screen.centerCloseUp'
     * Living room slots: 'sofa.seat', 'sofa.left', 'sofa.right'
5. CINEMATIC CAMERA ENGINE (CameraRig):
   - For dramatic close-ups or reveals, configure 'camera':
     * Close-up / Macro: 'camera: { zoom: 1.15, focusSlot: "screen.centerCloseUp" }' (DO NOT exceed 1.25 to prevent cutting off props)
     * Desk/Prop Focus: 'camera: { zoom: 1.15, focusSlot: "desk.seat" }'
     * Normal Shot: 'camera: { zoom: 1.0, x: 1280, y: 720 }'
6. PROCEDURAL ENVIRONMENT VFX & VOLUMETRIC LIGHTING:
   - 'environmentVfx': Array of visual effects to run automatically at 60 FPS:
     * 'rainLoop': Angled rain streaks with parallax and surface ripples.
     * 'cloudDrift': Cartoon clouds drifting across the sky.
     * 'windBreeze': Soft curving wind trails blowing across the scene.
     * 'foliageSway': Outdoor bushes and trees swaying gently in the wind (ONLY for outdoor scenes like gardenDay, NEVER for indoor rooms).
     * 'sunbeams': God rays streaming down from the morning sun.
   - 'lighting':
     * 'warmNightLamp': Cozy evening desk scene with multi-stop volumetric light falloff cone and tabletop glow.
     * 'sunbeams': Bright morning garden with sun rays.
     * 'moonlight': Cool night atmosphere.
     * 'neutral': Clean lighting for infographics.
7. PROP ANIMATIONS & SHADERS:
   - 'propAnimations':
     * 'rotateNeedle': Animate gauge needle smoothly (e.g. { targetId: "gauge_meter", type: "rotateNeedle", fromDeg: -70, toDeg: 35 }).
     * 'scaleBounce': Elastic pop-in when appearing.
     * 'squashStretch': Impact squash when landing.
   - Prop Alpha & Custom Pivots:
     * 'pivotPoint': 'bottomCenter' | 'center' | 'topCenter' | 'topLeft' | 'custom'
     * 'alphaConfig': { fadeInFrames: 20, pulseAlpha: true }
8. 2K Viewport Scale & Origin Standards:
   - Realistic Proportions:
     * Floor props like glassJar: scale MUST be 0.35 - 0.40 (~160px tall, NEVER 1.0 or huge like an oil drum!).
     * Desk props (deskLamp, glassJar, laptop, coffeeCup): scale MUST be 0.30 - 0.38 (desk surface at y = 760).
     * Close-up props: scale MUST be 1.6 - 1.8 (anchorPoint: 'center', pivotPoint: 'center' at slot 'screen.centerCloseUp').
     * Background furniture (sofa, desk): scale 1.0.
   - Origin Bottom-Center for floor/desk props (y is bottom touching floor or desk).
   - Origin Center for screen close-up props (y is center, anchorPoint: 'center').
9. CHARACTER POSES & VISIBILITY (CRITICAL):
   - When a scene focuses purely on a prop close-up or diagram (e.g. Cảnh 2 cận cảnh lọ, Cảnh 3 biểu đồ): character MUST have 'visible: false'! NEVER place a character in front of or blocking close-up props/diagrams!
   - When character is sitting at desk / working / studying: pose MUST be 'sittingBehindDesk' with slot 'desk.seat'!
   - When character is walking: pose MUST be 'walking'!
   - Standard poses: 'standing', 'sittingBehindDesk', 'holdingObject', 'walking', 'pointing', 'shrugging'.
10. CONTAINMENT & OBJECT INTEGRITY:
   - When an object/creature is inside a container (e.g. spider inside jar, fish in bowl): set 'properties: { hasSpiderInside: true, label: "Tám" }' on the container prop. NEVER add a duplicate freestanding spider prop outside the jar!
11. Dynamic Asset Bank:
   - Standard built-in props: 'glassJar', 'spider', 'sofa', 'desk', 'deskLamp', 'gaugeMeter', 'pottedPlant', 'bush', 'chair', 'table', 'tv', 'pizza', 'apple', 'guitar', 'cat', 'tree', 'balloon', 'trophy', 'star', 'heart', 'whiteboard', 'laptop', 'coffeeCup', 'phone', 'book', 'clock', 'car'.
   - Background presets (SELECT STRICTLY BY THEME):
     * 'gardenDay': For outdoor nature, meadow, grass, park, field, sky, clouds, sunshine.
     * 'classroom': For schools, teaching, blackboard, education, lectures.
     * 'office': For offices, companies, workplaces, corporate discussions.
     * 'cityStreet': For urban roads, streets, sidewalks, cars, towns.
     * 'beachSunny': For beaches, tropical sea, coast, sand, palm trees.
     * 'nightSky': For starry night sky, galaxy, astronomy, moon gazing.
     * 'livingRoomDay': For daytime indoor scenes, living room, study room.
     * 'livingRoomNight': For nighttime cozy indoor scenes.
     * 'infographicStripes': For abstract metrics and presentations.
12. SUBTITLES & SPOKEN NARRATION (CRITICAL):
   - Every scene MUST include a 'subtitles' array with ONLY the spoken narration sentence from the user's script:
     'subtitles': [{ 'id': 'sub_1_0', 'text': 'Câu thoại/thuyết minh của cảnh này', 'startFrame': 5, 'endFrame': 210 }]
   - NEVER include visual direction / camera notes (such as "Phóng cận cảnh vào...", "Minh họa biểu đồ...", "Cảnh 1:") in the 'subtitles' text! Only spoken dialogue.
13. Output ONLY a valid JSON object matching the MasterSceneGraph schema. No markdown formatting.
`;

function getStandardPropFileName(type: string): string {
  return normalizePropAssetId(type);
}

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

    const score = (name: string): number => {
      // Ưu tiên model 3.8-flash cao nhất trước khi kiểm tra flash chung
      if (name.includes("3.8-flash") || name === "gemini-3.8-flash") return 1050;
      if (name.includes("3.1-flash-lite")) return 1000;
      if (name.includes("2.5-flash")) return 950;
      if (name.includes("2.0-flash")) return 900;
      if (name.includes("flash-lite")) return 850;
      if (name.includes("flash")) return 800;
      if (name.includes("3.")) return 600;
      if (name.includes("2.5")) return 500;
      return 100;
    };

    supported.sort((a: string, b: string) => score(b) - score(a));
    return supported;
  } catch (err: any) {
    console.warn("[Gemini API] Lỗi mạng khi gọi ListModels:", err.message);
    return [];
  }
}

/**
 * Bộ tạo Scene Graph từ Kịch bản theo thuật toán suy luận (Procedural Fallback Engine)
 * Phân tích trực tiếp câu chữ tiếng Việt của người dùng để dựng cảnh, phụ đề, đạo cụ và nhân vật
 * khi chưa có Gemini API Key hoặc khi mạng bị gián đoạn.
 */
function generateProceduralSceneGraph(prompt: string): MasterSceneGraph {
  const cleanPrompt = (prompt || "").trim();
  const lines = cleanPrompt
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let rawScenes: Array<{ name: string; text: string }> = [];

  for (const line of lines) {
    const match = line.match(/^(?:Cảnh|Scene)\s*(\d+)[\s:.-]*(.*)$/i);
    if (match) {
      rawScenes.push({
        name: `Cảnh ${match[1]}`,
        text: match[2]?.trim() || line,
      });
    } else if (rawScenes.length > 0) {
      rawScenes[rawScenes.length - 1].text += ` ${line}`;
    } else {
      rawScenes.push({
        name: `Cảnh ${rawScenes.length + 1}`,
        text: line,
      });
    }
  }

  if (rawScenes.length === 0) {
    rawScenes = [{ name: "Cảnh 1", text: cleanPrompt || "Buổi sáng bình thường." }];
  }

  let currentStart = 0;
  const scenes: SceneGraphScene[] = rawScenes.map((s, idx) => {
    const text = s.text;
    const lower = text.toLowerCase();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const dur = Math.max(90, Math.round((wordCount / 2.8) * 60) + 30);
    const start = currentStart;
    currentStart = start + dur;

    // Phân tích bối cảnh Background
    let preset: BackgroundPreset = "livingRoomDay";
    if (/lớp học|trường học|giảng đường|bài giảng|thầy|cô giáo|bảng đen|classroom|school/i.test(lower)) {
      preset = "classroom";
    } else if (/văn phòng|công ty|công sở|họp|doanh nghiệp|office|workplace/i.test(lower)) {
      preset = "office";
    } else if (/đường phố|phố xá|vỉa hè|thành phố|đô thị|street|city/i.test(lower)) {
      preset = "cityStreet";
    } else if (/bãi biển|biển|bờ cát|sóng biển|mùa hè|cây dừa|beach|sea/i.test(lower)) {
      preset = "beachSunny";
    } else if (/bầu trời đêm|ngắm sao|đêm đầy sao|vũ trụ|dải ngân hà|night sky|starry/i.test(lower)) {
      preset = "nightSky";
    } else if (/vườn|ngoài trời|cỏ|sân|đồng cỏ|thảo nguyên|thiên nhiên|bầu trời|garden|park|bush|hoa/i.test(lower)) {
      preset = "gardenDay";
    } else if (/tối|đêm|khuya|trăng|night|moon/i.test(lower)) {
      preset = "livingRoomNight";
    } else if (/biểu đồ|đo|chỉ số|infographic|đồng hồ đo|trao đổi/i.test(lower)) {
      preset = "infographicStripes";
    }

    // Phân tích tư thế nhân vật Pose
    let pose: "standing" | "sittingBehindDesk" | "holdingObject" | "walking" | "pointing" = "standing";
    if (/ngồi|sit|sitting/i.test(lower) || (/bàn|desk/i.test(lower) && /ngồi/i.test(lower))) {
      pose = "sittingBehindDesk";
    } else if (/cầm|bê|mang|giữ|xách|nâng|holding|carry/i.test(lower)) {
      pose = "holdingObject";
    } else if (/đi|bước|chạy|ra vườn|dạo|walk|run|stroll/i.test(lower)) {
      pose = "walking";
    }

    // Tự động nhận diện đạo cụ từ kịch bản người dùng
    const detectedProps: any[] = [];

    if (/mèo|cat/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_cat`,
        type: "cat",
        slot: "sofa.seat",
        layer: "midgroundFrontLayer",
        x: 1850,
        y: 1040,
        scale: 0.85,
      });
    }

    if (/nhện|spider|tám/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_spider`,
        type: "spider",
        slot: "screen.centerCloseUp",
        layer: "midgroundFrontLayer",
        x: 1280,
        y: 720,
        scale: 0.9,
      });
    }

    if (/lọ|hũ|thủy tinh|jar/i.test(lower)) {
      const isCloseUp = /cận cảnh|phóng cận|zoom/i.test(lower);
      detectedProps.push({
        id: `prop_${idx}_jar`,
        type: "glass-jar",
        slot: isCloseUp ? "screen.centerCloseUp" : pose === "sittingBehindDesk" ? "desk.topRight" : "floor.left",
        layer: "midgroundFrontLayer",
        x: isCloseUp ? 1280 : 850,
        y: isCloseUp ? 720 : 1120,
        scale: isCloseUp ? 1.7 : pose === "sittingBehindDesk" ? 0.35 : 0.38,
        properties: {
          hasSpiderInside: /nhện|spider|tám/i.test(lower),
        },
      });
    }

    if (/sofa|ghế dài/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_sofa`,
        type: "sofa",
        layer: "midgroundBackLayer",
        x: 1850,
        y: 1120,
        scale: 1.0,
      });
    }

    if (/bàn|desk/i.test(lower) && pose !== "sittingBehindDesk") {
      detectedProps.push({
        id: `prop_${idx}_desk`,
        type: "desk",
        layer: "midgroundBackLayer",
        x: 1280,
        y: 1120,
        scale: 1.0,
      });
    }

    if (/bụi cây|bụi|bush/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_bush`,
        type: "bush",
        slot: "floor.farLeft",
        layer: "midgroundBackLayer",
        x: 450,
        y: 1120,
        scale: 1.0,
      });
    }

    if (/cây xanh|cây to|tree/i.test(lower) || (preset === "gardenDay" && detectedProps.length === 0)) {
      detectedProps.push({
        id: `prop_${idx}_tree`,
        type: "tree",
        slot: "floor.farLeft",
        layer: "midgroundBackLayer",
        x: 450,
        y: 1120,
        scale: 1.0,
      });
    }

    if (/cây cảnh|chậu|plant|hoa/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_plant`,
        type: "potted-plant",
        slot: "floor.left",
        layer: "midgroundBackLayer",
        x: 580,
        y: 1120,
        scale: 0.85,
      });
    }

    if (/laptop|máy tính|computer/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_laptop`,
        type: "laptop",
        slot: "desk.topCenter",
        layer: "midgroundFrontLayer",
        x: 1280,
        y: 760,
        scale: 0.65,
      });
    }

    if (/cà phê|cốc|coffee/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_coffee`,
        type: "coffee-cup",
        slot: "desk.topRight",
        layer: "midgroundFrontLayer",
        x: 1450,
        y: 760,
        scale: 0.5,
      });
    }

    // Camera
    const isCloseUp = /cận cảnh|phóng cận|zoom/i.test(lower);
    const camera = isCloseUp
      ? { zoomFrom: 1.0, zoomTo: 2.1, focusSlot: "screen.centerCloseUp" }
      : { zoom: 1.0, x: 1280, y: 720 };

    // Subtitles chuẩn xác câu của người dùng
    const subtitles = [
      {
        id: `sub_${idx}_0`,
        text: text,
        startFrame: start + 5,
        endFrame: start + dur - 5,
      },
    ];

    // Speech bubble nếu có ngoặc kép
    const quoteMatch = text.match(/['"“](.+?)['"”]/);
    const speechBubbles = quoteMatch
      ? [
          {
            id: `bubble_${idx}_0`,
            text: quoteMatch[1],
            position: { x: 1620, y: 340 },
            tailAnchor: { x: 60, y: 40 },
            startFrame: start + 15,
            endFrame: start + dur - 10,
          },
        ]
      : [];

    return {
      id: `scene_${idx + 1}`,
      name: s.name,
      startFrame: start,
      durationInFrames: dur,
      background: { preset },
      camera,
      character: {
        slot: pose === "sittingBehindDesk" ? "desk.seat" : "floor.center",
        visible: true,
        x: 1280,
        y: 1120,
        scale: 1.0,
        facing: "right" as const,
        pose,
        eyes: "neutral" as const,
        eyebrows: "neutral" as const,
        mouth: "smile" as const,
      },
      props: detectedProps,
      subtitles,
      speechBubbles,
      environmentVfx: (preset === "gardenDay"
        ? ["cloudDrift", "sunbeams"]
        : ["cloudDrift"]) as EnvironmentVfxType[],
    };
  });

  return {
    version: "3.1.0",
    title: rawScenes[0]?.name || "Stickman 2D Explainer Video",
    width: 2560,
    height: 1440,
    fps: 60,
    totalDurationInFrames: Math.max(60, currentStart),
    scenes,
  };
}

export type GenerationStatus = "ready" | "draft_fallback" | "failed";

export interface GenerationMetadata {
  requestedModel: string;
  resolvedModel: string;
  provider: "google-gemini" | "procedural-fallback";
  status: GenerationStatus;
  latencyMs: number;
  fallbackReason?: string;
  autoGeneratedAssets?: string[];
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestedModel = "gemini-3.1-flash-lite";

  try {
    const body = await req.json();
    const prompt = body.prompt;
    const apiKey = body.apiKey;
    const forceProcedural = Boolean(body.forceProcedural);

    if (forceProcedural) {
      console.log("[Gemini API] Kích hoạt Procedural Engine theo yêu cầu của người dùng...");
      const proceduralGraph = generateProceduralSceneGraph(prompt);
      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        status: "ready",
        metadata: {
          requestedModel: "procedural-engine",
          resolvedModel: "procedural-engine",
          provider: "procedural-fallback",
          status: "ready",
          latencyMs,
        },
        modelUsed: "Procedural Script Engine (Chạy nội bộ siêu tốc)",
        sceneGraph: proceduralGraph,
      });
    }

    if (body.model && typeof body.model === "string") {
      requestedModel = body.model;
    }

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      console.log("[Gemini API] Chưa có API Key -> Kích hoạt Procedural Engine cho kịch bản của người dùng...");
      const proceduralGraph = generateProceduralSceneGraph(prompt);
      const latencyMs = Date.now() - startTime;
      const metadata: GenerationMetadata = {
        requestedModel,
        resolvedModel: "procedural-script-engine",
        provider: "procedural-fallback",
        status: "draft_fallback",
        latencyMs,
        fallbackReason: "Missing Gemini API Key. Generated draft procedural scene graph.",
      };
      return NextResponse.json({
        success: true,
        status: "draft_fallback",
        metadata,
        modelUsed: "Procedural Script Engine (Chưa nhập Gemini Key)",
        sceneGraph: proceduralGraph,
      });
    }

    let candidateModels = await fetchAccountModels(activeApiKey);
    if (candidateModels.length === 0) {
      candidateModels = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
      ];
    }

    // Giữ nguyên 100% model người dùng đã chọn (ví dụ: gemini-3.1-flash-lite hoặc gemini-3.8-flash)
    const activeModelName = requestedModel || "gemini-3.1-flash-lite";
    const genAI = new GoogleGenerativeAI(activeApiKey);
    let responseText = "";

    try {
      console.log(`[Gemini API] Bắt đầu gọi model: ${activeModelName} với cơ chế retry tối đa 3 lần...`);

      responseText = await executeGeminiWithRetry(
        async (attempt) => {
          console.log(`[Gemini API] Đang kết nối tới ${activeModelName} (Lần gọi ${attempt}/4)...`);
          const model = genAI.getGenerativeModel(
            {
              model: activeModelName,
              generationConfig: {
                responseMimeType: "application/json",
              },
              systemInstruction: SYSTEM_PROMPT,
            },
            { timeout: 25000 }
          );

          const result = await model.generateContent(
            `Tạo Scene Graph JSON cho kịch bản sau:\n\n${prompt}`
          );

          const text = result.response.text();
          if (!text) {
            throw new Error(`Model ${activeModelName} trả về phản hồi rỗng.`);
          }
          return text;
        },
        {
          maxRetries: 3,
          onRetry: (attempt, maxRetries, delayMs, err) => {
            console.warn(
              `[Gemini API] Lần gọi ${attempt} thất bại (${err.message}). Đang chờ ${(delayMs / 1000).toFixed(1)}s để thử lại lần ${attempt}/${maxRetries}...`
            );
          },
        }
      );
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const is503OrOverload = isRetryableGeminiError(err);
      const isKeyInvalid =
        err.message?.includes("API_KEY_INVALID") ||
        err.message?.includes("API key not valid") ||
        err.status === 400 ||
        err.status === 401 ||
        err.status === 403;

      console.error(`[Gemini API] Gọi model ${activeModelName} thất bại hoàn toàn:`, err.message);

      if (isKeyInvalid) {
        return NextResponse.json(
          {
            success: false,
            status: "failed",
            metadata: {
              requestedModel: activeModelName,
              resolvedModel: "none",
              provider: "google-gemini",
              status: "failed",
              latencyMs,
              fallbackReason: "Gemini API Key không hợp lệ hoặc thiếu quyền truy cập.",
            },
            error: "Gemini API Key không hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra lại trong mục Cài đặt.",
          },
          { status: 400 }
        );
      }

      // Khi thất bại sau 3 lần retry: Giữ nguyên kịch bản và kết quả trước đó, báo lỗi rõ ràng, KHÔNG trả fallback giả làm thành công
      return NextResponse.json(
        {
          success: false,
          status: "failed",
          is503: is503OrOverload,
          retriesExhausted: true,
          metadata: {
            requestedModel: activeModelName,
            resolvedModel: "none",
            provider: "google-gemini",
            status: "failed",
            latencyMs,
            fallbackReason: `Model ${activeModelName} gặp lỗi sau 3 lần thử lại: ${err.message}`,
          },
          error: is503OrOverload
            ? `Model ${activeModelName} hiện đang quá tải (503 Service Unavailable). Hãy chọn model 'gemini-3.1-flash-lite' (siêu nhanh < 1s, rất ổn định) ở menu phía trên hoặc bấm 'Tạo nhanh bằng Procedural' để tiếp tục làm việc tức thì!`
            : `Không thể kết nối tới Gemini API (${activeModelName}): ${err.message}. Kịch bản và dữ liệu trước đó của bạn được giữ nguyên.`,
          canSwitchToFastModel: is503OrOverload && activeModelName !== "gemini-3.1-flash-lite",
        },
        { status: is503OrOverload ? 503 : 500 }
      );
    }

    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
    const rawParsed = JSON.parse(cleanText);

    // Sử dụng Sanitizer phân biệt Action & Bảo toàn 100% dữ liệu
    const parsedGraph = sanitizeSceneGraph(rawParsed, prompt);

    const assetsDir = path.join(process.cwd(), "public", "assets", "props");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const generatedAssets: string[] = [];

    for (const scene of parsedGraph.scenes) {
      for (const prop of scene.props) {
        const canonicalId = getStandardPropFileName(prop.type);
        const fileName = `${canonicalId}.svg`;

        if (!fs.existsSync(path.join(assetsDir, fileName))) {
          try {
            console.log(`[AssetGenerator] Đang tự động vẽ vector hoạt họa cho đạo cụ: '${canonicalId}'...`);
            await generateVectorAsset(prop.type, canonicalId, "gemini", activeApiKey);
            generatedAssets.push(canonicalId);
          } catch (genErr: any) {
            console.warn(`[AssetGenerator] Lỗi khi tạo asset cho ${canonicalId}:`, genErr.message);
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const metadata: GenerationMetadata = {
      requestedModel,
      resolvedModel: activeModelName,
      provider: "google-gemini",
      status: "ready",
      latencyMs,
      autoGeneratedAssets: generatedAssets,
    };

    return NextResponse.json({
      success: true,
      status: "ready",
      metadata,
      modelUsed: activeModelName,
      sceneGraph: parsedGraph,
      autoGeneratedAssets: generatedAssets,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const latencyMs = Date.now() - startTime;
    const metadata: GenerationMetadata = {
      requestedModel,
      resolvedModel: "none",
      provider: "google-gemini",
      status: "failed",
      latencyMs,
      fallbackReason: error.message || "Unhandled server error",
    };
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        metadata,
        error: error.message || "Lỗi khi gọi Gemini API",
      },
      { status: 500 }
    );
  }
}
