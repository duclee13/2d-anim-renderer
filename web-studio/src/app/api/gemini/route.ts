import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { MasterSceneGraph } from "@/remotion/types/sceneGraph";
import { sampleScriptSceneGraph } from "@/remotion/data/sampleScript";
import { generateVectorAsset } from "@/lib/vectorAssetGenerator";

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
     * Smooth Zoom: 'camera: { zoomFrom: 1.0, zoomTo: 2.15, focusSlot: "screen.centerCloseUp" }'
     * Desk/Prop Focus: 'camera: { zoomFrom: 1.0, zoomTo: 1.4, focusSlot: "desk.seat" }'
     * Normal Shot: 'camera: { zoom: 1.0, x: 1280, y: 720 }'
6. PROCEDURAL ENVIRONMENT VFX & VOLUMETRIC LIGHTING:
   - 'environmentVfx': Array of visual effects to run automatically at 60 FPS:
     * 'rainLoop': Angled rain streaks with parallax and surface ripples (for sad/thoughtful or stormy scenes).
     * 'cloudDrift': Cartoon clouds drifting across the sky.
     * 'windBreeze': Soft curving wind trails blowing across the scene.
     * 'foliageSway': Plants and foliage swaying naturally in the room/garden.
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
8. 2K Viewport Scale Standards (Origin = Bottom-Center):
   - Stickman standing baseline: y = 1120. Total height ~750px-850px.
   - GlassJar: Full shot scale = 1.0 (slot: 'floor.left'). Close-up shot scale = 2.15 (slot: 'screen.centerCloseUp', height ~900px).
   - In close-up shots, DO NOT use scale from 0 to prevent white flash. Use pop or direct transition.
9. Character Poses: 'standing', 'sittingBehindDesk', 'holdingObject', 'walking', 'pointing', 'shrugging'.
10. ACTION & MOTION RULES (NEVER LEAVE CHARACTER STATIC):
   - When holding or carrying ("cầm", "giữ", "bê", "mang", "xách"): pose MUST be 'holdingObject'.
   - When moving or walking ("mang ra", "bước", "đi", "chạy"): add 'moveCharacter' keyframe in 'keyframes'.
11. Dynamic Asset Bank:
   - Standard built-in props: 'glassJar', 'spider', 'sofa', 'desk', 'deskLamp', 'gaugeMeter', 'pottedPlant', 'chair', 'table', 'tv', 'pizza', 'apple', 'guitar', 'cat', 'tree', 'balloon', 'trophy', 'star', 'heart', 'whiteboard', 'laptop', 'coffeeCup', 'phone', 'book', 'clock'.
   - Background presets: 'livingRoomDay', 'livingRoomNight', 'gardenDay', 'infographicStripes'.
12. Output ONLY a valid JSON object matching the MasterSceneGraph schema. No markdown formatting.
`;

function getStandardPropFileName(type: string): string {
  const normalized = type
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");

  const aliasMap: Record<string, string> = {
    glassjar: "glass-jar",
    desklamp: "desk-lamp",
    gaugemeter: "gauge-meter",
    pottedplant: "potted-plant",
    deskback: "desk-back",
    deskfront: "desk-front",
    alarmclock: "alarm-clock",
    coffeecup: "coffee-cup",
    teacup: "coffee-cup",
    cup: "coffee-cup",
    plant: "potted-plant",
    lamp: "desk-lamp",
    meter: "gauge-meter",
    jar: "glass-jar",
    whiteboard: "whiteboard",
    television: "tv",
    smarttv: "tv",
    screen: "tv",
    mobilephone: "phone",
    cellphone: "phone",
    smartphone: "phone",
    diningtable: "table",
    deskchair: "chair",
    armchair: "chair",
    petcat: "cat",
    kitten: "cat",
    bush: "potted-plant",
  };

  return aliasMap[normalized] || aliasMap[type.toLowerCase()] || normalized;
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
    return supported;
  } catch (err: any) {
    console.warn("[Gemini API] Lỗi mạng khi gọi ListModels:", err.message);
    return [];
  }
}

/**
 * Chuẩn hóa và làm sạch 100% dữ liệu SceneGraph từ LLM
 * Đảm bảo timeline liên tục, thời lượng đồng bộ audio và tích hợp đầy đủ VFX.
 */
function sanitizeSceneGraph(raw: any): MasterSceneGraph {
  const scenesRaw = Array.isArray(raw?.scenes) ? raw.scenes : [];
  let currentStart = 0;

  const cleanScenes = scenesRaw.map((s: any, idx: number) => {
    const subTexts = Array.isArray(s?.subtitles)
      ? s.subtitles.map((sub: any) => sub?.text || "").join(" ")
      : "";
    const wordCount = subTexts.trim() ? subTexts.trim().split(/\s+/).length : 0;
    const estDialogueFrames = wordCount > 0 ? Math.round((wordCount / 2.8) * 60) + 30 : 120;

    let dur = Math.max(60, Math.round(Number(s?.durationInFrames || s?.duration || estDialogueFrames)));
    if (wordCount > 0 && dur > estDialogueFrames + 60) {
      dur = estDialogueFrames + 30;
    }

    const start = currentStart;
    currentStart = start + dur;

    let characterPose = s?.character?.pose || "standing";
    const sceneCombinedText = `${s?.name || ""} ${subTexts}`.toLowerCase();

    if (/cầm|bê|mang|xách|giữ|nâng|holding|carry/i.test(sceneCombinedText) && characterPose === "standing") {
      characterPose = "holdingObject";
    }

    let finalKeyframes = Array.isArray(s?.keyframes) ? s.keyframes : [];
    if (finalKeyframes.length === 0 && /mang ra|bước|đi bộ|chạy|di chuyển|walk|ra vườn/i.test(sceneCombinedText)) {
      finalKeyframes = [
        {
          action: "moveCharacter",
          target: "character",
          frame: 0,
          params: {
            fromX: 680,
            toX: 1680,
          },
        },
      ];
    }

    let charSlot = s?.character?.slot;
    if (!charSlot) {
      if (characterPose === "sittingBehindDesk") {
        charSlot = "desk.seat";
      } else if (s?.character?.x !== undefined) {
        charSlot = undefined;
      } else {
        charSlot = "floor.center";
      }
    }

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
        zoomFrom: s?.camera?.zoomFrom !== undefined ? Number(s.camera.zoomFrom) : undefined,
        zoomTo: s?.camera?.zoomTo !== undefined ? Number(s.camera.zoomTo) : undefined,
        focusSlot: s?.camera?.focusSlot || undefined,
        focusTarget: s?.camera?.focusTarget || undefined,
      },
      character: {
        slot: charSlot,
        x: s?.character?.x !== undefined ? Number(s.character.x) : 1280,
        y: s?.character?.y !== undefined ? Number(s.character.y) : 1120,
        scale: Number(s?.character?.scale) || 1.0,
        facing: s?.character?.facing === "left" ? ("left" as const) : ("right" as const),
        pose: characterPose,
        eyes: s?.character?.eyes || "neutral",
        eyebrows: s?.character?.eyebrows || "neutral",
        mouth: s?.character?.mouth || "smile",
        pupilGaze: s?.character?.pupilGaze || { x: 0, y: 0 },
      },
      props: Array.isArray(s?.props)
        ? s.props.map((p: any, pIdx: number) => ({
            id: String(p?.id || `prop_${idx}_${pIdx}`),
            type: String(p?.type || "glassJar"),
            slot: p?.slot || undefined,
            layer: p?.layer === "midgroundBackLayer" ? ("midgroundBackLayer" as const) : ("midgroundFrontLayer" as const),
            x: Number(p?.x) || 1280,
            y: Number(p?.y) || 1120,
            scale: Number(p?.scale) || 1.0,
            scaleX: p?.scaleX !== undefined ? Number(p.scaleX) : 1,
            scaleY: p?.scaleY !== undefined ? Number(p.scaleY) : 1,
            rotation: Number(p?.rotation) || 0,
            opacity: p?.opacity !== undefined ? Number(p.opacity) : 1,
            alphaConfig: p?.alphaConfig || undefined,
            pivotPoint: p?.pivotPoint || undefined,
            pivotX: p?.pivotX !== undefined ? Number(p.pivotX) : undefined,
            pivotY: p?.pivotY !== undefined ? Number(p.pivotY) : undefined,
            properties: p?.properties || {},
            entrance: p?.entrance || undefined,
          }))
        : [],
      subtitles: Array.isArray(s?.subtitles)
        ? s.subtitles.map((sub: any, subIdx: number) => ({
            id: String(sub?.id || `sub_${idx}_${subIdx}`),
            text: String(sub?.text || ""),
            startFrame: sub?.startFrame !== undefined ? Number(sub.startFrame) : start + 5,
            endFrame: sub?.endFrame !== undefined ? Number(sub.endFrame) : start + dur - 5,
            words: Array.isArray(sub?.words) ? sub.words : [],
          }))
        : [],
      speechBubbles: Array.isArray(s?.speechBubbles) ? s.speechBubbles : [],
      keyframes: finalKeyframes,
      lines: Array.isArray(s?.lines) ? s.lines : [],
      environmentVfx: Array.isArray(s?.environmentVfx) ? s.environmentVfx : undefined,
      lighting: s?.lighting || undefined,
      propAnimations: Array.isArray(s?.propAnimations) ? s.propAnimations : undefined,
    };
  });

  const totalFrames = cleanScenes.reduce(
    (acc: number, s: any) => acc + s.durationInFrames,
    0
  );

  return {
    version: "3.1.0",
    title: String(raw?.title || "Stickman 2D Explainer Video"),
    width: 2560,
    height: 1440,
    fps: 60,
    totalDurationInFrames: Math.max(120, Math.round(totalFrames)),
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

    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
    const rawParsed = JSON.parse(cleanText);

    const parsedGraph = sanitizeSceneGraph(rawParsed);

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
