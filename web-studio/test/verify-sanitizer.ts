import fs from "fs";
import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer";

const rawGemini = JSON.parse(fs.readFileSync("test/raw_gemini_output.json", "utf-8"));
const userScript = `Cảnh 1: Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ thủy tinh trên sàn nhà. Tôi bảo 'Để sau!' rồi quên bẵng nó.
Cảnh 2: Phóng cận cảnh vào chiếc lọ thủy tinh, tôi dán nhãn đặt tên cho nó là 'Tám'.
Cảnh 3: Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp, nó tự hạ tốc độ trao đổi chất để sống sót.
Cảnh 4: Buổi tối bình thường, tôi ngồi sau bàn học làm việc dưới ánh đèn bàn ấm áp, bên ngoài cửa sổ là trăng sao.`;

console.log("--- RUNNING SANITIZER ON ACTUAL GEMINI OUTPUT ---");
const sanitized = sanitizeSceneGraph(rawGemini, userScript);

fs.writeFileSync("test/sanitized_output_v2.json", JSON.stringify(sanitized, null, 2));

console.log("Total scenes:", sanitized.scenes.length);

for (let i = 0; i < sanitized.scenes.length; i++) {
  const scene = sanitized.scenes[i];
  console.log(`\n=== SCENE ${i + 1}: ${scene.name} ===`);
  console.log("  Background preset:", scene.background.preset);
  console.log("  Camera zoom:", scene.camera?.zoom, "focusSlot:", scene.camera?.focusSlot);
  console.log("  Character visible:", scene.character.visible, "pose:", scene.character.pose, "slot:", scene.character.slot);
  console.log("  Props count:", scene.props.length);
  for (const p of scene.props) {
    console.log(`    - prop: id=${p.id}, type=${p.type}, slot=${p.slot}, scale=${p.scale}, label=${p.properties?.label}, hasSpider=${p.properties?.hasSpiderInside}`);
  }
  console.log("  Subtitles:", scene.subtitles?.[0]?.text);
  console.log("  Lighting:", scene.lighting?.preset);
  console.log("  VFX:", scene.environmentVfx);
}
