import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer";

const prompt = "Một người từ từ bước đi trên đồng cỏ xanh mướt, với bầu trời trong xanh và mây trắng nắng vàng.";
const rawGraph = {
  scenes: [
    {
      name: "Cảnh 1",
      subtitles: [{ text: prompt }]
    }
  ]
};

const sanitized = sanitizeSceneGraph(rawGraph, prompt);
console.log("Sanitized result:", JSON.stringify({
  preset: sanitized.scenes[0].background.preset,
  pose: sanitized.scenes[0].character.pose,
  props: sanitized.scenes[0].props,
  vfx: sanitized.scenes[0].environmentVfx,
}, null, 2));
