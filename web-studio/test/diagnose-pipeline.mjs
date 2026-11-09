import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in environment.");
  process.exit(1);
}

const userScript = `Cảnh 1: Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ thủy tinh trên sàn nhà. Tôi bảo 'Để sau!' rồi quên bẵng nó.
Cảnh 2: Phóng cận cảnh vào chiếc lọ thủy tinh, tôi dán nhãn đặt tên cho nó là 'Tám'.
Cảnh 3: Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp, nó tự hạ tốc độ trao đổi chất để sống sót.
Cảnh 4: Buổi tối bình thường, tôi ngồi sau bàn học làm việc dưới ánh đèn bàn ấm áp, bên ngoài cửa sổ là trăng sao.`;

async function main() {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-3.8-flash";
  console.log(`Calling Gemini with exact requested model: ${modelName}...`);

  const SYSTEM_PROMPT = `
You are the Lead 2D Animation Director and Spatial Scene Graph Architect for a 2K 60FPS Stickman Explainer Video Engine.
Your job is to transform a story script into a precise, valid MasterSceneGraph JSON structure.

Strict Rules:
1. Target resolution: 2560x1440 at 60 FPS.
2. Contiguous Timeline & Audio Synchronization:
   - Each scene's duration MUST match spoken dialogue duration: word count / 2.8 words/sec * 60 FPS + 30 frames transition padding.
   - startFrame MUST be strictly contiguous.
3. FULL SCENE FIDELITY: Generate EVERY scene described.
4. SEMANTIC SLOTS:
   - Floor slots: 'floor.farLeft', 'floor.left', 'floor.centerLeft', 'floor.center', 'floor.centerRight', 'floor.right', 'floor.farRight'
   - Desk slots: 'desk.seat', 'desk.topLeft', 'desk.topCenter', 'desk.topRight'
   - Close-up slots: 'screen.center', 'screen.centerCloseUp'
5. Characters and props:
   - When a scene has NO character (e.g. close-up of prop, diagram, object focus): character MUST have 'visible: false'!
   - When a prop is inside a container (e.g. spider inside jar): specify inside 'properties: { hasSpiderInside: true }' or set parent container, DO NOT spawn a duplicate free-floating prop outside the container!
6. Subtitles:
   - DO NOT include camera direction / visual notes like "Phóng cận cảnh", "Cảnh 1:", "Minh họa..." in 'subtitles' or narration!
   - 'subtitles' text must ONLY be the spoken dialogue or spoken narration.
Output ONLY a valid JSON object matching the MasterSceneGraph schema. No markdown formatting.
`;

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: SYSTEM_PROMPT,
  });

  const startTime = Date.now();
  const result = await model.generateContent(`Tạo Scene Graph JSON cho kịch bản sau:\n\n${userScript}`);
  const text = result.response.text();
  const latency = Date.now() - startTime;
  console.log(`Model ${modelName} responded in ${latency}ms.`);

  const rawParsed = JSON.parse(text);
  fs.writeFileSync("test/raw_gemini_output.json", JSON.stringify(rawParsed, null, 2));
  console.log("Saved test/raw_gemini_output.json");

  const sanitized = sanitizeSceneGraph(rawParsed, userScript);
  fs.writeFileSync("test/sanitized_output.json", JSON.stringify(sanitized, null, 2));
  console.log("Saved test/sanitized_output.json");
}

main().catch(err => {
  console.error("Error in diagnose:", err);
  process.exit(1);
});
