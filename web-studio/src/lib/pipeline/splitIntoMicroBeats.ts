import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGeminiWithRetry } from "../geminiRetry";
import { synthesizeEdgeTts } from "../edgeTtsClient";
import { SubtitleWord, BackgroundPreset } from "../../remotion/types/sceneGraph";

export interface MicroSceneBeat {
  index: number;
  name: string;
  dialogue: string;
  actionSummary: string;
  requiredProps: string[];
  backgroundPreset: BackgroundPreset;
  speechBubbleText?: string;
  // Audio metadata from Edge-TTS
  audioDurationSeconds: number;
  durationInFrames: number;
  words?: SubtitleWord[];
  audioBase64?: string;
}

const SPLIT_BEATS_SYSTEM_PROMPT = `You are a Master Animation Director specializing in 2D vector animation.
Your task is to take a raw user script and break it down into a sequence of tightly-paced Micro-Scenes.

STRICT RULES:
1. PACE: Every Micro-Scene represents EXACTLY ONE short spoken beat (3 to 5 seconds long).
2. SINGLE ACTION FOCUS: Each beat focuses on ONE clear primary action or emotion (e.g. discovering an object, showing a diagram, sitting at desk, walking across screen).
3. REQUIRED PROPS: Extract a clean array of specific physical props needed in this beat (e.g. ["glass-jar", "spider"], ["desk", "desk-lamp"], ["car"]). Use kebab-case.
4. BACKGROUND PRESET: Choose strictly from the 9 supported presets:
   - "gardenDay" (outdoor nature, meadow, grass, park, field, sky)
   - "classroom" (school, teacher, students, blackboard, lecture)
   - "office" (workplace, office desk, corporate, meeting)
   - "cityStreet" (urban road, sidewalk, traffic, cars, buildings)
   - "beachSunny" (tropical beach, sand, ocean, palm tree)
   - "nightSky" (starry night, galaxy, moon gazing, astronomy)
   - "livingRoomDay" (daytime indoor living room, home)
   - "livingRoomNight" (cozy nighttime room, bedside lamp)
   - "infographicStripes" (abstract data, meters, charts, presentation)
5. CLEAN SPOKEN DIALOGUE:
   - The 'dialogue' field MUST contain ONLY the spoken narration sentence (no directorial notes like "Cảnh 1:", "Phóng cận cảnh...").
   - If there is a quote in quotation marks (e.g. 'Để sau!' or "Tám"), extract it into 'speechBubbleText'.
6. FORMAT: Output MUST be a valid JSON object matching this schema:
{
  "beats": [
    {
      "name": "Short scene title",
      "dialogue": "Exact single sentence to be spoken by narrator",
      "actionSummary": "Brief description of the 1 key action",
      "requiredProps": ["prop-id-1", "prop-id-2"],
      "backgroundPreset": "gardenDay",
      "speechBubbleText": "Quoted speech if any, or null"
    }
  ]
}
Output ONLY raw JSON.`;

/**
 * Bước 1: Chia kịch bản thô thành các Micro-Scene Beats 3-5 giây
 * và tự động đo thời lượng âm thanh chính xác bằng Edge-TTS.
 */
export async function splitIntoMicroBeats(
  rawScript: string,
  modelName: string = "gemini-3.1-flash-lite",
  apiKey?: string,
  voice: string = "vi-VN-HoaiMyNeural"
): Promise<MicroSceneBeat[]> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error("Cần Gemini API Key để thực hiện Bước 1 (splitIntoMicroBeats).");
  }

  const genAI = new GoogleGenerativeAI(activeKey);

  console.log(`[Pipeline Bước 1] Đang cắt nhịp kịch bản 3-5s qua model ${modelName}...`);

  const responseText = await executeGeminiWithRetry(
    async () => {
      const model = genAI.getGenerativeModel(
        {
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
          systemInstruction: SPLIT_BEATS_SYSTEM_PROMPT,
        },
        { timeout: 25000 }
      );
      const res = await model.generateContent(
        `Hãy phân rã kịch bản sau thành các Micro-Scenes 3-5s:\n\n${rawScript}`
      );
      const text = res.response.text();
      if (!text) throw new Error("Phản hồi cắt nhịp rỗng từ Gemini.");
      return text;
    },
    { maxRetries: 3 }
  );

  let cleanJson = responseText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
  const parsed = JSON.parse(cleanJson);
  const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : [];

  if (rawBeats.length === 0) {
    throw new Error("Không thể trích xuất Micro-Scenes từ kịch bản.");
  }

  // Ngay sau Bước 1: Gọi Edge-TTS cho từng câu thoại để khóa cứng thời lượng âm thanh thực tế
  console.log(`[Pipeline Bước 1] Đang tổng hợp Edge-TTS cho ${rawBeats.length} Micro-Scenes...`);

  const microBeats: MicroSceneBeat[] = [];

  for (let i = 0; i < rawBeats.length; i++) {
    const b = rawBeats[i];
    const dialogueText = String(b.dialogue || rawScript).trim();

    let audioDurationSeconds = 3.5;
    let words: SubtitleWord[] = [];
    let audioBase64: string | undefined = undefined;

    try {
      const ttsRes = await synthesizeEdgeTts(dialogueText, voice);
      audioDurationSeconds = Math.max(1.5, ttsRes.durationMs / 1000);
      words = ttsRes.words;
      audioBase64 = ttsRes.audioBase64;
    } catch (ttsErr: any) {
      console.warn(`[Pipeline Bước 1] Edge-TTS cảnh ${i + 1} fallback đo từ:`, ttsErr.message);
      const wordCount = dialogueText.split(/\s+/).length;
      audioDurationSeconds = Math.max(2.5, wordCount / 2.8);
    }

    // Quy tắc cứng: scene.durationInFrames = Math.ceil(audioDurationSeconds * 60) + 18 (0.3s nghỉ)
    const durationInFrames = Math.ceil(audioDurationSeconds * 60) + 18;

    microBeats.push({
      index: i,
      name: b.name || `Cảnh ${i + 1}`,
      dialogue: dialogueText,
      actionSummary: b.actionSummary || "",
      requiredProps: Array.isArray(b.requiredProps) ? b.requiredProps : [],
      backgroundPreset: b.backgroundPreset || "livingRoomDay",
      speechBubbleText: b.speechBubbleText || undefined,
      audioDurationSeconds,
      durationInFrames,
      words,
      audioBase64,
    });
  }

  return microBeats;
}
