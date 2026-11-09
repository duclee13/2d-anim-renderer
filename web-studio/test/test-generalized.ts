import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer";

const prompts = [
  {
    title: "Đồng cỏ xanh",
    text: "Một người từ từ bước đi trên đồng cỏ xanh mướt, với bầu trời trong xanh và mây trắng nắng vàng."
  },
  {
    title: "Lớp học",
    text: "Thầy giáo đang đứng trước bảng đen giảng bài cho học sinh trong lớp học."
  },
  {
    title: "Bãi biển mùa hè",
    text: "Tôi đi dạo trên bờ cát vàng bãi biển đầy nắng và sóng vỗ rì rào."
  },
  {
    title: "Ngắm sao đêm",
    text: "Đêm khuya thanh vắng, tôi ngước nhìn lên bầu trời đêm đầy sao lấp lánh và dải ngân hà."
  },
  {
    title: "Văn phòng làm việc",
    text: "Hai đồng nghiệp đang thảo luận về dự án mới trong phòng họp công ty."
  }
];

for (const p of prompts) {
  const sanitized = sanitizeSceneGraph(
    { scenes: [{ name: p.title, subtitles: [{ text: p.text }] }] },
    p.text
  );
  console.log(`[${p.title}] => Preset: ${sanitized.scenes[0].background.preset} | Pose: ${sanitized.scenes[0].character.pose} | VFX: ${sanitized.scenes[0].environmentVfx?.join(", ")}`);
}
