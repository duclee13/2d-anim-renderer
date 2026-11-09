import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGeminiWithRetry } from "../geminiRetry";
import { MicroSceneBeat } from "./splitIntoMicroBeats";
import { SceneGraphScene, PropItem, SceneKeyframe } from "../../remotion/types/sceneGraph";

const DIRECT_SCENE_SYSTEM_PROMPT = `You are an Expert Animation Scene Director directing a single animated micro-scene (3 to 7 seconds).
You are given the exact duration in frames (calculated from real voiceover audio), the spoken dialogue sentence, the required props, and the background preset.

MANDATORY DIRECTORIAL RULES:
1. SEMANTIC SLOTS (ZERO PIXEL GUESSING):
   - You MUST place characters and props using Semantic Slots only:
     * Floor: "floor.left", "floor.center", "floor.right", "floor.farLeft", "floor.farRight"
     * Desk/Tabletop: "surface.topLeft", "surface.topCenter", "surface.topRight", "desk.topLeft", "desk.topRight", "desk.seat"
     * Container: "container.inside" (for props inside a jar/box)
     * Screen close-ups: "screen.centerCloseUp", "screen.center"
2. STABLE CHARACTER STAGING (STABILITY BY DEFAULT - NO ERRATIC SLIDING):
   - By default, character stands or sits stably at their assigned slot (e.g. "floor.center", "floor.right", "desk.seat").
   - DO NOT make character walk, slide, or run across the screen unless the beat EXPLICITLY requires locomotion (e.g. "walking into the room", "running away").
   - Default keyframes: [] (stable staging). Most scenes should have empty keyframes array [].
3. CHARACTER VISIBILITY, FACING & POSES:
   - If the scene is a macro close-up of a prop or an abstract diagram ("screen.centerCloseUp" or "screen.center"): character "visible" MUST be false.
   - Poses: "standing", "sittingBehindDesk", "holdingObject", "pointing", "shrugging", "waving", "walking".
   - Only use "sittingBehindDesk" if the script explicitly mentions sitting or the slot is "desk.seat".
   - Facing: Character should face toward the primary prop of interest!
     * If prop is at "floor.left" and character is at "floor.right" or "floor.center": character "facing": "left".
     * If prop is at "floor.right" and character is at "floor.left": character "facing": "right".
4. CAMERA RIGGING:
   - For macro prop close-up: { "zoom": 1.15, "focusSlot": "screen.centerCloseUp" }
   - For diagram/infographic: { "zoom": 1.0, "focusSlot": "screen.center" }
   - For desk scene: { "zoom": 1.15, "focusSlot": "desk.seat" }
   - For wide scene: { "zoom": 1.0, "focusSlot": "floor.center" }
5. OUTPUT SCHEMA:
   Output ONLY a valid JSON object matching this schema:
{
  "character": {
    "slot": "floor.center",
    "visible": true,
    "facing": "right",
    "pose": "standing",
    "eyes": "neutral",
    "eyebrows": "neutral",
    "mouth": "smile"
  },
  "props": [
    {
      "id": "prop_id",
      "type": "kebab-case-type",
      "slot": "floor.left",
      "scale": 1.0,
      "properties": { "label": "Text if any", "parentContainerId": "container_id if inside" }
    }
  ],
  "camera": {
    "zoom": 1.0,
    "focusSlot": "floor.center"
  },
  "keyframes": []
}
Output ONLY raw JSON.`;

/**
 * Bước 3: Đạo diễn chi tiết 1 Micro-Scene trong 3-5 giây (1 Prompt / 1 Cảnh)
 */
export async function directMicroScene(
  beat: MicroSceneBeat,
  modelName: string = "gemini-3.1-flash-lite",
  apiKey?: string
): Promise<SceneGraphScene> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  let directedData: any = null;

  if (activeKey) {
    try {
      const genAI = new GoogleGenerativeAI(activeKey);
      const responseText = await executeGeminiWithRetry(
        async () => {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" },
            systemInstruction: DIRECT_SCENE_SYSTEM_PROMPT,
          });
          const prompt = `Direct this 3-5s micro-scene:
- Scene Title: ${beat.name}
- Total Duration: ${beat.durationInFrames} frames (${beat.audioDurationSeconds.toFixed(1)} seconds @ 60fps)
- Background Preset: ${beat.backgroundPreset}
- Spoken Dialogue: "${beat.dialogue}"
- Key Action Summary: ${beat.actionSummary}
- Required Props: ${JSON.stringify(beat.requiredProps)}
- Speech Bubble: ${beat.speechBubbleText ? `"${beat.speechBubbleText}"` : "None"}`;

          const res = await model.generateContent(prompt);
          let raw = res.response.text().trim();
          raw = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
          return raw;
        },
        { maxRetries: 2 }
      );

      directedData = JSON.parse(responseText);
    } catch (err: any) {
      console.warn(`[Pipeline Bước 3] Lỗi gọi AI đạo diễn cảnh ${beat.index + 1}:`, err.message);
    }
  }

  // Fallback định hướng thủ công an toàn nếu không gọi được AI
  if (!directedData || typeof directedData !== "object") {
    const isCloseUp = /cận cảnh|phóng cận|zoom|lọ/i.test(beat.actionSummary) && beat.requiredProps.includes("glass-jar");
    const isDiagram = /biểu đồ|đồng hồ|trao đổi chất|infographic|gauge/i.test(beat.actionSummary) || beat.requiredProps.includes("gauge-meter");
    const isSitting = /ngồi|bàn|desk/i.test(beat.actionSummary) || beat.requiredProps.includes("desk");
    const isWalking = /(?:bước đi từ|đi bộ từ|chạy từ)/i.test(beat.actionSummary);

    const hasLeftProp = beat.requiredProps.length > 0 && !isSitting && !isCloseUp && !isDiagram;

    directedData = {
      character: {
        slot: isSitting ? "desk.seat" : hasLeftProp ? "floor.right" : "floor.center",
        visible: !isCloseUp && !isDiagram,
        facing: hasLeftProp ? "left" : "right",
        pose: isSitting ? "sittingBehindDesk" : isWalking ? "walking" : "standing",
        eyes: "neutral",
        eyebrows: "neutral",
        mouth: "smile",
      },
      props: beat.requiredProps.map((p, pIdx) => ({
        id: `prop_${beat.index}_${pIdx}`,
        type: p,
        slot: isCloseUp ? "screen.centerCloseUp" : isDiagram ? "screen.center" : isSitting ? (p.includes("lamp") ? "desk.topLeft" : "floor.center") : "floor.left",
        scale: isCloseUp ? 1.7 : isDiagram ? 1.6 : isSitting ? (p.includes("lamp") ? 1.15 : 1.0) : 1.0,
      })),
      camera: {
        zoom: isCloseUp ? 1.15 : 1.0,
        focusSlot: isCloseUp ? "screen.centerCloseUp" : isDiagram ? "screen.center" : isSitting ? "desk.seat" : "floor.center",
      },
      keyframes: [],
    };
  }

  // Chuẩn hóa props
  const props: PropItem[] = Array.isArray(directedData.props)
    ? directedData.props.map((p: any, pIdx: number) => ({
        id: String(p.id || `prop_${beat.index}_${pIdx}`),
        type: String(p.type || p),
        slot: p.slot || "floor.center",
        x: Number(p.x) || 1280,
        y: Number(p.y) || 1120,
        scale: Number(p.scale) || 1.0,
        visible: p.visible !== false,
        properties: p.properties || {},
      }))
    : [];

  // Chuẩn hóa keyframes
  const keyframes: SceneKeyframe[] = Array.isArray(directedData.keyframes)
    ? directedData.keyframes.map((kf: any) => ({
        action: kf.action || "moveProp",
        target: kf.target || "character",
        frame: Number(kf.frame) || 0,
        params: kf.params || {},
      }))
    : [];

  // Tạo phụ đề chuẩn đồng bộ audio
  const subtitles = [
    {
      id: `sub_${beat.index}_0`,
      text: beat.dialogue,
      startFrame: 5,
      endFrame: Math.max(10, beat.durationInFrames - 5),
      words: beat.words,
    },
  ];

  // Tạo bong bóng thoại nếu có lời thoại trích dẫn
  const speechBubbles = beat.speechBubbleText
    ? [
        {
          id: `bubble_${beat.index}_0`,
          text: beat.speechBubbleText,
          position: { x: 1650, y: 340 },
          tailAnchor: { x: 60, y: 40 },
          startFrame: 10,
          endFrame: Math.max(15, beat.durationInFrames - 10),
        },
      ]
    : [];

  const scene: SceneGraphScene = {
    id: `scene_${beat.index + 1}`,
    name: beat.name,
    startFrame: 0, // Sẽ được gán nối tiếp ở bước assemble
    durationInFrames: beat.durationInFrames,
    background: {
      preset: beat.backgroundPreset,
    },
    camera: directedData.camera || { zoom: 1.0, x: 1280, y: 720 },
    character: directedData.character || {
      slot: "floor.center",
      visible: true,
      facing: "right",
      pose: "standing",
    },
    props,
    keyframes,
    subtitles,
    speechBubbles,
    environmentVfx: (beat.backgroundPreset === "gardenDay"
      ? ["cloudDrift", "sunbeams"]
      : ["cloudDrift"]) as any,
  };

  return scene;
}
