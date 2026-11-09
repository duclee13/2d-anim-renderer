import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in environment.");
  process.exit(1);
}

const secondScript = `Cảnh 1: Một chú mèo con nghịch ngợm bên cạnh chiếc hộp giấy đặt trên sàn phòng khách.
Cảnh 2: Phóng cận cảnh vào chiếc lọ thủy tinh đựng những đồng xu lấp lánh có dán nhãn 'Tiết Kiệm'.
Cảnh 3: Minh họa biểu đồ tăng trưởng tài chính với các chỉ số đang vươn lên mạnh mẽ.
Cảnh 4: Đêm muộn, người kỹ sư ngồi sau bàn học cặm cụi gõ máy tính dưới ánh đèn bàn vàng ấm.`;

async function main() {
  const genAI = new GoogleGenerativeAI(apiKey!);
  // Thử nghiệm chạy với gemini-3.1-flash-lite để kiểm chứng tính tổng quát của pipeline
  const modelName = "gemini-3.1-flash-lite";
  console.log(`\n======================================================`);
  console.log(`TESTING GENERALIZED BENCHMARK SCRIPT WITH ${modelName}`);
  console.log(`======================================================`);

  const SYSTEM_PROMPT = `
You are the Lead 2D Animation Director and Spatial Scene Graph Architect for a 2K 60FPS Stickman Explainer Video Engine.
Your job is to transform a story script into a precise, valid MasterSceneGraph JSON structure.

Strict Rules:
1. Target resolution: 2560x1440 at 60 FPS.
2. Contiguous Timeline & Audio Synchronization.
3. FULL SCENE FIDELITY: Generate EVERY scene described.
4. SEMANTIC SLOTS:
   - Floor slots: 'floor.farLeft', 'floor.left', 'floor.centerLeft', 'floor.center', 'floor.centerRight', 'floor.right', 'floor.farRight'
   - Desk slots: 'desk.seat', 'desk.topLeft', 'desk.topCenter', 'desk.topRight'
   - Close-up slots: 'screen.center', 'screen.centerCloseUp'
5. CHARACTER POSES & VISIBILITY:
   - When a scene focuses purely on a prop close-up or diagram: character MUST have 'visible: false'!
   - When character is sitting at desk / working / typing: pose MUST be 'sittingBehindDesk' with slot 'desk.seat'!
6. CONTAINMENT & OBJECT INTEGRITY:
   - When an object is inside a container, set container properties (e.g. label), do not spawn duplicate props!
7. SUBTITLES & SPOKEN NARRATION:
   - 'subtitles': text must ONLY be the spoken dialogue or spoken narration without camera/scene directions.
Output ONLY a valid JSON object matching the MasterSceneGraph schema. No markdown formatting.
`;

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: SYSTEM_PROMPT,
  });

  const startTime = Date.now();
  console.log(`Calling ${modelName}...`);
  const result = await model.generateContent(`Tạo Scene Graph JSON cho kịch bản sau:\n\n${secondScript}`);
  const text = result.response.text();
  const latency = Date.now() - startTime;
  console.log(`Model ${modelName} responded in ${latency}ms.`);

  const rawParsed = JSON.parse(text);
  fs.writeFileSync("test/benchmark_second_raw.json", JSON.stringify(rawParsed, null, 2));

  const sanitized = sanitizeSceneGraph(rawParsed, secondScript);
  fs.writeFileSync("test/benchmark_second_sanitized.json", JSON.stringify(sanitized, null, 2));

  console.log("\n--- SANITIZED SCENE GRAPH REPORT ---");
  for (let i = 0; i < sanitized.scenes.length; i++) {
    const scene = sanitized.scenes[i];
    console.log(`\nScene ${i + 1}: ${scene.name}`);
    console.log(`  Background: ${scene.background.preset}`);
    console.log(`  Camera zoom: ${scene.camera?.zoom}, focusSlot: ${scene.camera?.focusSlot}`);
    console.log(`  Character: visible=${scene.character.visible}, pose=${scene.character.pose}, slot=${scene.character.slot}`);
    console.log(`  Props (${scene.props.length}):`);
    for (const p of scene.props) {
      console.log(`    - [${p.type}] id=${p.id}, slot=${p.slot}, scale=${p.scale}, label=${p.properties?.label}`);
    }
    console.log(`  Subtitles: "${scene.subtitles?.[0]?.text}"`);
    console.log(`  Lighting: ${scene.lighting?.preset}`);
  }
}

main().catch(err => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
