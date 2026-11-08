import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { MasterSceneGraph, SceneGraphScene, EnvironmentVfxType } from "@/remotion/types/sceneGraph";
import { sampleScriptSceneGraph } from "@/remotion/data/sampleScript";
import { generateVectorAsset } from "@/lib/vectorAssetGenerator";
import { normalizePropAssetId } from "@/remotion/utils/propResolver";

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
   - In close-up shots, DO NOT use scale from 0 to prevent white flash. Use pop or direct transition.
9. Character Poses: 'standing', 'sittingBehindDesk', 'holdingObject', 'walking', 'pointing', 'shrugging'.
10. ACTION & MOTION RULES (NEVER LEAVE CHARACTER STATIC):
   - When holding or carrying ("cầm", "giữ", "bê", "mang", "xách"): pose MUST be 'holdingObject'.
   - When moving or walking ("mang ra", "bước", "đi", "chạy"): add 'moveCharacter' keyframe in 'keyframes'.
11. Dynamic Asset Bank:
   - Standard built-in props: 'glassJar', 'spider', 'sofa', 'desk', 'deskLamp', 'gaugeMeter', 'pottedPlant', 'bush', 'chair', 'table', 'tv', 'pizza', 'apple', 'guitar', 'cat', 'tree', 'balloon', 'trophy', 'star', 'heart', 'whiteboard', 'laptop', 'coffeeCup', 'phone', 'book', 'clock'.
   - Background presets: 'livingRoomDay', 'livingRoomNight', 'gardenDay', 'infographicStripes'.
12. SUBTITLES & SPOKEN NARRATION (CRITICAL):
   - Every scene MUST include a 'subtitles' array with the exact narration sentence from the user's script:
     'subtitles': [{ 'id': 'sub_1_0', 'text': 'Câu thoại/thuyết minh của cảnh này', 'startFrame': 5, 'endFrame': 210 }]
   - NEVER leave 'subtitles' empty!
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
      if (name.includes("3.1-flash-lite")) return 1000;
      if (name.includes("2.5-flash")) return 950;
      if (name.includes("2.0-flash")) return 900;
      if (name.includes("flash-lite")) return 850;
      if (name.includes("flash")) return 800;
      if (name === "gemini-3.8-flash") return 500;
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
function sanitizeSceneGraph(raw: any, userPrompt?: string): MasterSceneGraph {
  const scenesRaw = Array.isArray(raw?.scenes) ? raw.scenes : [];
  let currentStart = 0;

  const promptSceneTexts: string[] = [];
  if (userPrompt) {
    const lines = userPrompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(?:cảnh|scene)\s*\d+[:.-]?\s*(.*)$/i);
      if (match && match[1].trim()) {
        promptSceneTexts.push(match[1].trim());
      } else if (line.length > 5 && !line.startsWith("#")) {
        promptSceneTexts.push(line);
      }
    }
  }

  const cleanScenes = scenesRaw.map((s: any, idx: number) => {
    const existingSubs = Array.isArray(s?.subtitles)
      ? s.subtitles.filter((sub: any) => sub?.text && String(sub.text).trim().length > 0)
      : [];

    const fallbackText =
      existingSubs.length > 0
        ? existingSubs.map((sub: any) => sub.text).join(" ")
        : promptSceneTexts[idx] ||
          (s?.name && !/^cảnh\s*\d+$/i.test(s.name) ? s.name : "") ||
          s?.description ||
          "";

    const subTexts = fallbackText;
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
        ? s.props.map((p: any, pIdx: number) => {
            const rawPropType = String(p?.type || p?.id || "prop");
            const canonicalType = getStandardPropFileName(rawPropType);
            let propScale = Number(p?.scale) || 1.0;
            const isScreenSlot = Boolean(p?.slot && String(p.slot).startsWith("screen."));

            // Tự động chuẩn hóa tỷ lệ scale thực tế đạt 280px - 320px ở cảnh toàn (chuẩn 2K)
            if (canonicalType === "glass-jar") {
              if (isScreenSlot) {
                if (propScale > 1.8) propScale = 1.7;
              } else if (p?.slot === "desk.topRight" || p?.slot === "desk.topLeft") {
                propScale = 0.68; // ~285px trên mặt bàn
              } else {
                propScale = 0.72; // ~302px trên sàn nhà (gấp 2.2x trước đây)
              }
            }

            const sceneCombinedText = `${s?.name || ""} ${subTexts}`.toLowerCase();
            const hasSpider =
              canonicalType === "glass-jar" &&
              (/nhện|spider|tám/i.test(sceneCombinedText) || p?.properties?.hasSpiderInside === true);

            return {
              id: String(p?.id || `prop_${idx}_${pIdx}`),
              type: canonicalType,
              slot: p?.slot || undefined,
              layer: p?.layer === "midgroundBackLayer" ? ("midgroundBackLayer" as const) : ("midgroundFrontLayer" as const),
              x: Number(p?.x) || 1280,
              y: Number(p?.y) || 1120,
              scale: propScale,
              scaleX: p?.scaleX !== undefined ? Number(p.scaleX) : 1,
              scaleY: p?.scaleY !== undefined ? Number(p.scaleY) : 1,
              rotation: Number(p?.rotation) || 0,
              opacity: p?.opacity !== undefined ? Number(p.opacity) : 1,
              alphaConfig: p?.alphaConfig || undefined,
              anchorPoint: p?.anchorPoint || (isScreenSlot ? ("center" as const) : undefined),
              pivotPoint: p?.pivotPoint || (isScreenSlot ? ("center" as const) : undefined),
              pivotX: p?.pivotX !== undefined ? Number(p.pivotX) : undefined,
              pivotY: p?.pivotY !== undefined ? Number(p.pivotY) : undefined,
              properties: {
                hasSpiderInside: hasSpider ? true : undefined,
                ...p?.properties,
              },
              entrance: p?.entrance || undefined,
            };
          })
        : [],
      subtitles:
        existingSubs.length > 0
          ? existingSubs.map((sub: any, subIdx: number) => ({
              id: String(sub?.id || `sub_${idx}_${subIdx}`),
              text: String(sub?.text || ""),
              startFrame: sub?.startFrame !== undefined ? Number(sub.startFrame) : start + 5,
              endFrame: sub?.endFrame !== undefined ? Number(sub.endFrame) : start + dur - 5,
              words: Array.isArray(sub?.words) ? sub.words : [],
            }))
          : fallbackText
          ? [
              {
                id: `sub_${idx}_0`,
                text: fallbackText,
                startFrame: start + 5,
                endFrame: start + dur - 5,
                words: [],
              },
            ]
          : [],
      speechBubbles: Array.isArray(s?.speechBubbles) && s.speechBubbles.length > 0
        ? s.speechBubbles.map((b: any, bIdx: number) => {
            let bubbleText = String(b?.text || "");
            const quoteMatch = subTexts.match(/['"“](.+?)['"”]/);
            if (quoteMatch && quoteMatch[1] && (/ơ kìa/i.test(bubbleText) || !bubbleText.trim())) {
              bubbleText = quoteMatch[1];
            }
            return {
              id: String(b?.id || `bubble_${idx}_${bIdx}`),
              text: bubbleText,
              hasMusicNote: Boolean(b?.hasMusicNote),
              position: b?.position || { x: 1620, y: 340 },
              tailAnchor: b?.tailAnchor || { x: 60, y: 40 },
              startFrame: b?.startFrame !== undefined ? Number(b.startFrame) : start + 15,
              endFrame: b?.endFrame !== undefined ? Number(b.endFrame) : start + dur - 10,
            };
          })
        : (() => {
            const quoteMatch = subTexts.match(/['"“](.+?)['"”]/);
            if (quoteMatch && quoteMatch[1]) {
              return [
                {
                  id: `bubble_${idx}_0`,
                  text: quoteMatch[1],
                  hasMusicNote: false,
                  position: { x: 1620, y: 340 },
                  tailAnchor: { x: 60, y: 40 },
                  startFrame: start + 20,
                  endFrame: start + dur - 10,
                },
              ];
            }
            return [];
          })(),
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

/**
 * Bộ tạo Scene Graph từ Kịch bản theo thuật toán suy luận (Procedural Fallback Engine)
 * Phân tích trực tiếp câu chữ tiếng Việt của người dùng để dựng cảnh, phụ đề, đạo cụ và nhân vật
 * khi chưa có Gemini API Key hoặc khi mạng bị gián đoạn. Không bao giờ để rơi về kịch bản nhện cũ!
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
    let preset: "livingRoomDay" | "livingRoomNight" | "gardenDay" | "infographicStripes" = "livingRoomDay";
    if (/vườn|ngoài trời|cỏ|sân|garden|park|bush|hoa/i.test(lower)) {
      preset = "gardenDay";
    } else if (/tối|đêm|khuya|trăng|night|moon|bàn học|làm việc/i.test(lower)) {
      preset = "livingRoomNight";
    } else if (/biểu đồ|đo|chỉ số|infographic|đồng hồ đo|trao đổi/i.test(lower)) {
      preset = "infographicStripes";
    }

    // Phân tích tư thế nhân vật Pose
    let pose: "standing" | "sittingBehindDesk" | "holdingObject" | "walking" | "pointing" = "standing";
    if (/ngồi|bàn học|làm việc|desk/i.test(lower)) {
      pose = "sittingBehindDesk";
    } else if (/cầm|bê|mang|giữ|xách|nâng|holding|carry/i.test(lower)) {
      pose = "holdingObject";
    } else if (/đi|bước|chạy|ra vườn|walk|run/i.test(lower)) {
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
        scale: isCloseUp ? 1.7 : 0.72,
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

    if (/bụi cây|bụi|bush/i.test(lower) || (preset === "gardenDay" && detectedProps.length === 0)) {
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

    if (/pizza/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_pizza`,
        type: "pizza",
        slot: "floor.center",
        layer: "midgroundFrontLayer",
        x: 1280,
        y: 1120,
        scale: 0.85,
      });
    }

    if (/táo|apple/i.test(lower)) {
      detectedProps.push({
        id: `prop_${idx}_apple`,
        type: "apple",
        slot: "floor.center",
        layer: "midgroundFrontLayer",
        x: 1280,
        y: 1120,
        scale: 0.85,
      });
    }

    if (/laptop|máy tính/i.test(lower)) {
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

export async function POST(req: NextRequest) {
  try {
    const { prompt, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      // Khi người dùng chưa nhập key, tự động dùng Procedural Script Engine để chuyển kịch bản của họ thành cảnh hoạt họa thật!
      console.log("[Gemini API] Chưa có API Key -> Kích hoạt Procedural Engine cho kịch bản của người dùng...");
      const proceduralGraph = generateProceduralSceneGraph(prompt);
      return NextResponse.json({
        success: true,
        modelUsed: "Procedural Script Engine (Chưa nhập Gemini Key)",
        sceneGraph: proceduralGraph,
      });
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
          { timeout: 15000 }
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
          console.warn("[Gemini API] Key không hợp lệ -> Dùng Procedural Engine cho kịch bản.");
          const proceduralGraph = generateProceduralSceneGraph(prompt);
          return NextResponse.json({
            success: true,
            modelUsed: "Procedural Script Engine (Key không hợp lệ)",
            sceneGraph: proceduralGraph,
          });
        }

        continue;
      }
    }

    if (!responseText) {
      console.warn("[Gemini API] Gemini quá tải -> Dùng Procedural Engine tạo Scene Graph từ kịch bản.");
      const proceduralGraph = generateProceduralSceneGraph(prompt);
      return NextResponse.json({
        success: true,
        modelUsed: "Procedural Script Engine (Fallback do Gemini quá tải)",
        sceneGraph: proceduralGraph,
      });
    }

    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
    const rawParsed = JSON.parse(cleanText);
    console.log("[Gemini API] RAW GENERATED BY GEMINI:\n", JSON.stringify(rawParsed, null, 2));

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
