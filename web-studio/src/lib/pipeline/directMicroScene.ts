import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGeminiWithRetry } from "../geminiRetry";
import { MicroSceneBeat } from "./splitIntoMicroBeats";
import { SceneGraphScene, PropItem, SceneKeyframe } from "../../remotion/types/sceneGraph";

const DIRECT_SCENE_SYSTEM_PROMPT = `You are an Expert Animation Scene Director directing a single 3-to-5 second animated micro-scene.
You are given the exact duration in frames (calculated from real voiceover audio), the dialogue sentence, the required props, and the background preset.

MANDATORY DIRECTORIAL RULES:
1. SEMANTIC SLOTS (ZERO PIXEL GUESSING):
   - You MUST place characters and props using Semantic Slots only:
     * Floor: "floor.left", "floor.center", "floor.right", "floor.farLeft", "floor.farRight"
     * Desk/Tabletop: "surface.topLeft", "surface.topCenter", "surface.topRight", "desk.topLeft", "desk.topRight", "desk.seat"
     * Container: "container.inside" (for props inside a jar/box)
     * Screen close-ups: "screen.centerCloseUp", "screen.center"
2. 3 KEYFRAME STATES FOR THE 3-5 SECOND TIMELINE:
   Divide the scene's durationInFrames into 3 clear animation phases:
   - Phase 1 (0% to 25% duration): Anticipation / Entrance (e.g. character walks into view, or turns toward prop).
   - Phase 2 (25% to 75% duration): Main Action / Hold with micro-motion (e.g. gesture, hold, pointing, talk).
   - Phase 3 (75% to 100% duration): Reaction / Settle (e.g. settle into final pose, satisfied expression).
3. CHARACTER VISIBILITY & POSES:
   - If the scene is a macro close-up of a prop or an abstract diagram ("screen.centerCloseUp" or "screen.center"): character "visible" MUST be false.
   - Poses: "standing", "walking", "sittingBehindDesk", "holdingObject", "pointing", "shrugging".
   - Only use "sittingBehindDesk" if the script explicitly mentions sitting or the slot is "desk.seat".
4. OUTPUT SCHEMA:
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
  "keyframes": [
    {
      "action": "moveCharacter",
      "target": "character",
      "frame": 0,
      "params": { "fromSlot": "floor.farLeft", "toSlot": "floor.center" }
    }
  ]
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
    const isWalking = /bước|đi|walk|chạy/i.test(beat.actionSummary);
    const isSitting = /ngồi|bàn/i.test(beat.actionSummary);

    directedData = {
      character: {
        slot: isSitting ? "desk.seat" : isWalking ? "floor.center" : "floor.center",
        visible: !isCloseUp,
        facing: "right",
        pose: isSitting ? "sittingBehindDesk" : isWalking ? "walking" : "standing",
        eyes: "neutral",
        eyebrows: "neutral",
        mouth: "smile",
      },
      props: beat.requiredProps.map((p, pIdx) => ({
        id: `prop_${beat.index}_${pIdx}`,
        type: p,
        slot: isCloseUp ? "screen.centerCloseUp" : isSitting ? "desk.topLeft" : "floor.left",
        scale: isCloseUp ? 1.7 : isSitting ? 0.38 : 1.0,
      })),
      camera: {
        zoom: isCloseUp ? 1.15 : 1.0,
        focusSlot: isCloseUp ? "screen.centerCloseUp" : "floor.center",
      },
      keyframes: isWalking
        ? [
            {
              action: "moveCharacter",
              target: "character",
              frame: 0,
              params: { fromX: 600, toX: 1850 },
            },
          ]
        : [],
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
