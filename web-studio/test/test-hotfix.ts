import { normalizePropAssetId } from "../src/remotion/utils/propResolver";
import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer";
import { MasterSceneGraph } from "../src/remotion/types/sceneGraph";

console.log("=== 1. TESTING PROP NORMALIZATION (GAUGE METER & ARROW) ===");

const testCases: Record<string, string> = {
  "speed-meter": "gauge-meter",
  "speed_meter": "gauge-meter",
  "Speed Meter": "gauge-meter",
  "speedometer": "gauge-meter",
  "speedmeter": "gauge-meter",
  "speed-gauge": "gauge-meter",
  "meter": "gauge-meter",
  "gauge": "gauge-meter",
  "gauge-meter": "gauge-meter",
  "metabolic-chart": "gauge-meter",
  "metabolism": "gauge-meter",
  "trao-doi-chat": "gauge-meter",
  "pointer": "arrow-indicator",
  "arrow": "arrow-indicator",
  "pointer-arrow": "arrow-indicator",
  "arrow-pointer": "arrow-indicator",
  "arrow-indicator": "arrow-indicator",
  "mui-ten": "arrow-indicator",
  "label": "label-sticker",
  "sticker": "label-sticker",
};

for (const [input, expected] of Object.entries(testCases)) {
  const result = normalizePropAssetId(input);
  if (result !== expected) {
    throw new Error(`Failed for input '${input}': got '${result}', expected '${expected}'`);
  }
}
console.log(">>> All prop normalizations passed 100%!");

console.log("\n=== 2. TESTING CHỐNG TRÙNG LẶP PROP (DEDUPLICATION) ===");

const graphWithDuplicateSpider: MasterSceneGraph = {
  version: "3.2.0",
  title: "Test Deduplication",
  width: 2560,
  height: 1440,
  fps: 60,
  totalDurationInFrames: 120,
  scenes: [
    {
      id: "scene_01",
      name: "Phát hiện con nhện trong lọ",
      startFrame: 0,
      durationInFrames: 120,
      background: { preset: "livingRoomDay" },
      character: { slot: "floor.right", facing: "left", pose: "standing", visible: true },
      props: [
        {
          id: "jar_1",
          type: "glassJar",
          slot: "floor.left",
          layer: "midgroundFrontLayer",
          x: 720,
          y: 1120,
          properties: { hasSpiderInside: true },
        },
        {
          id: "spider_redundant",
          type: "spider",
          slot: "floor.center",
          layer: "midgroundFrontLayer",
          x: 1280,
          y: 1120,
        },
      ],
      subtitles: [{ id: "sub_1", text: "Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ.", startFrame: 5, endFrame: 110 }],
    },
  ],
};

const sanitizedDeduplication = sanitizeSceneGraph(graphWithDuplicateSpider, "Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ.");
const scene1Props = sanitizedDeduplication.scenes[0].props;
console.log("Sanitized Scene 1 prop types:", scene1Props.map((p) => p.type));

const hasStandaloneSpider = scene1Props.some((p) => p.type === "spider");
if (hasStandaloneSpider) {
  throw new Error("Deduplication failed: standalone spider still exists outside on the floor!");
}
const jarProp = scene1Props.find((p) => p.type === "glass-jar");
if (!jarProp || !jarProp.properties?.hasSpiderInside) {
  throw new Error("Jar prop missing or hasSpiderInside is not true!");
}
console.log(">>> Deduplication test passed: Standalone spider removed, jar retains internal spider!");

console.log("\n=== 3. TESTING LOẠI BỎ ĐẠO CỤ THỜI TIẾT (WIND) CHUYỂN THÀNH VFX ===");

const graphWithWindProp: MasterSceneGraph = {
  version: "3.2.0",
  title: "Test Wind VFX Conversion",
  width: 2560,
  height: 1440,
  fps: 60,
  totalDurationInFrames: 120,
  scenes: [
    {
      id: "scene_02",
      name: "Gió thoảng",
      startFrame: 0,
      durationInFrames: 120,
      background: { preset: "livingRoomDay" },
      character: { slot: "floor.center", facing: "right", pose: "standing", visible: true },
      props: [
        {
          id: "wind_prop",
          type: "wind",
          slot: "floor.right",
          layer: "midgroundFrontLayer",
          x: 1850,
          y: 1120,
        },
        {
          id: "sofa_1",
          type: "sofa",
          slot: "floor.left",
          layer: "midgroundBackLayer",
          x: 600,
          y: 1120,
        },
      ],
      subtitles: [{ id: "sub_2", text: "Gió thoảng qua góc phòng.", startFrame: 5, endFrame: 110 }],
    },
  ],
};

const sanitizedWind = sanitizeSceneGraph(graphWithWindProp, "Gió thoảng qua góc phòng.");
const scene2Props = sanitizedWind.scenes[0].props;
const scene2Vfx = sanitizedWind.scenes[0].environmentVfx;

console.log("Sanitized Scene 2 prop types:", scene2Props.map((p) => p.type));
console.log("Sanitized Scene 2 VFX:", scene2Vfx);

if (scene2Props.some((p) => p.type === "wind")) {
  throw new Error("Wind prop was not removed from props list!");
}
if (!scene2Vfx?.includes("windBreeze")) {
  throw new Error("windBreeze was not added to environmentVfx!");
}
console.log(">>> Wind prop test passed: Wind removed from props and successfully converted to windBreeze VFX!");

console.log("\n=== 4. TESTING BIỂU ĐỒ TRAO ĐỔI CHẤT (GAUGE METER) ===");

const graphWithSpeedMeter: MasterSceneGraph = {
  version: "3.2.0",
  title: "Test Speed Meter",
  width: 2560,
  height: 1440,
  fps: 60,
  totalDurationInFrames: 120,
  scenes: [
    {
      id: "scene_03",
      name: "Minh họa biểu đồ trao đổi chất",
      startFrame: 0,
      durationInFrames: 120,
      background: { preset: "infographicStripes" },
      character: { slot: "floor.center", facing: "right", pose: "standing", visible: true },
      props: [
        {
          id: "speed_meter_1",
          type: "speed-meter",
          slot: "screen.centerCloseUp",
          layer: "midgroundFrontLayer",
          x: 1280,
          y: 720,
        },
      ],
      subtitles: [{ id: "sub_3", text: "Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp.", startFrame: 5, endFrame: 110 }],
    },
  ],
};

const sanitizedMeter = sanitizeSceneGraph(graphWithSpeedMeter, "Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp.");
const scene3Props = sanitizedMeter.scenes[0].props;
const scene3Char = sanitizedMeter.scenes[0].character;

console.log("Sanitized Scene 3 prop types:", scene3Props.map((p) => p.type));
console.log("Sanitized Scene 3 character visible:", scene3Char?.visible);

if (scene3Props[0].type !== "gauge-meter") {
  throw new Error(`Speed meter prop was not mapped to gauge-meter! Got: ${scene3Props[0].type}`);
}
if (scene3Char?.visible !== false) {
  throw new Error("Character must be visible: false in diagram scene!");
}
console.log(">>> Speed meter test passed: Mapped to gauge-meter, character set to visible: false!");

console.log("\n>>> ALL 4 HOTFIX TESTS PASSED 100% PERFECTLY! <<<");
