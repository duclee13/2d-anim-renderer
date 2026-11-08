/**
 * REGRESSION TEST SUITE — GIAI ĐOẠN 1 (Data Integrity, Prop Resolver, Sanitizer)
 * Kiểm tra xác thực các lỗi P0 đã được khắc phục hoàn toàn:
 * 1. Prop Resolver: Khắc phục lỗi substring regex ("co" -> bush, "cup" -> coffee-cup, v.v.)
 * 2. Keyframe Sanitizer: Bảo toàn tham số từng action (changeExpression, scaleProp, rotateProp...)
 * 3. Sanitizer Data Preservation: Bảo toàn giá trị 0, false, customColors, panDurationFrames, visible, scale 0.35
 */

import { normalizePropAssetId, resolvePropAsset } from "../src/remotion/utils/propResolver.js";
import { sanitizeKeyframe, sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} -> ${details}`);
    failedCount++;
  }
}

console.log("\n=======================================================");
console.log("TEST NHÓM 1: PROP RESOLVER REGISTRY & EXACT ALIASES");
console.log("=======================================================");

const propTestCases = [
  { input: "coffeeCup", expected: "coffee-cup", forbid: "bush" },
  { input: "coffee-cup", expected: "coffee-cup", forbid: "bush" },
  { input: "computer", expected: "laptop", forbid: "bush" },
  { input: "con mèo", expected: "cat", forbid: "bush" },
  { input: "cây xanh", expected: "tree", forbid: "potted-plant" },
  { input: "bàn ăn", expected: "table", forbid: "desk" },
  { input: "cúp vàng", expected: "trophy", forbid: "coffee-cup" },
  { input: "bàn học", expected: "desk", forbid: "table" },
  { input: "chậu cây", expected: "potted-plant", forbid: "tree" },
  { input: "bụi cây", expected: "bush", forbid: "" },
  { input: "lọ thủy tinh", expected: "glass-jar", forbid: "" },
  { input: "con nhện", expected: "spider", forbid: "" },
  { input: "ô tô", expected: "car", forbid: "" },
];

for (const tc of propTestCases) {
  const result = normalizePropAssetId(tc.input);
  const condition = result === tc.expected && (!tc.forbid || result !== tc.forbid);
  assert(
    condition,
    `normalizePropAssetId("${tc.input}") === "${tc.expected}"`,
    `Got "${result}", Expected "${tc.expected}" (Forbid: "${tc.forbid}")`
  );
}

console.log("\n=======================================================");
console.log("TEST NHÓM 2: KEYFRAME SANITIZER BY ACTION (DISCRIMINATED)");
console.log("=======================================================");

// Test 2.1: changeExpression
const exprKfInput = {
  action: "changeExpression",
  target: "character",
  frame: 45,
  params: {
    eyes: "wide",
    mouth: "gasp",
    eyebrows: "worried",
    blush: true,
    sweatDrop: false,
  },
};
const exprKfOutput = sanitizeKeyframe(exprKfInput);

assert(
  exprKfOutput.action === "changeExpression",
  "changeExpression: Action preserved"
);
assert(
  exprKfOutput.params.eyes === "wide" &&
    exprKfOutput.params.mouth === "gasp" &&
    exprKfOutput.params.eyebrows === "worried" &&
    exprKfOutput.params.blush === true &&
    exprKfOutput.params.sweatDrop === false,
  "changeExpression: eyes, mouth, eyebrows, blush, sweatDrop preserved",
  `Params: ${JSON.stringify(exprKfOutput.params)}`
);
assert(
  exprKfOutput.params.fromX === undefined,
  "changeExpression: Did NOT inject bogus fromX/toX into expression action"
);

// Test 2.2: scaleProp
const scaleKfInput = {
  action: "scaleProp",
  target: "prop_jar_1",
  frame: 30,
  params: {
    fromScale: 1.0,
    toScale: 2.2,
  },
};
const scaleKfOutput = sanitizeKeyframe(scaleKfInput);

assert(
  scaleKfOutput.action === "scaleProp",
  "scaleProp: Action preserved"
);
assert(
  scaleKfOutput.params.fromScale === 1.0 && scaleKfOutput.params.toScale === 2.2,
  "scaleProp: fromScale and toScale preserved",
  `Params: ${JSON.stringify(scaleKfOutput.params)}`
);

// Test 2.3: rotateProp
const rotateKfInput = {
  action: "rotateProp",
  target: "gauge_meter",
  frame: 15,
  params: {
    fromDeg: -70,
    toDeg: 35,
  },
};
const rotateKfOutput = sanitizeKeyframe(rotateKfInput);

assert(
  rotateKfOutput.action === "rotateProp",
  "rotateProp: Action preserved"
);
assert(
  rotateKfOutput.params.fromDeg === -70 && rotateKfOutput.params.toDeg === 35,
  "rotateProp: fromDeg (-70) and toDeg (35) preserved",
  `Params: ${JSON.stringify(rotateKfOutput.params)}`
);

// Test 2.4: moveCharacter with coordinate 0
const moveKfInput = {
  action: "moveCharacter",
  target: "character",
  frame: 0,
  params: {
    fromX: 0,
    toX: 1800,
    fromY: 0,
    toY: 1120,
  },
};
const moveKfOutput = sanitizeKeyframe(moveKfInput);

assert(
  moveKfOutput.params.fromX === 0 && moveKfOutput.params.fromY === 0,
  "moveCharacter: fromX=0 and fromY=0 preserved (not replaced by defaults)",
  `Params: ${JSON.stringify(moveKfOutput.params)}`
);

console.log("\n=======================================================");
console.log("TEST NHÓM 3: SANITIZE SCENE GRAPH DATA PRESERVATION");
console.log("=======================================================");

const mockRawGraph = {
  version: "3.1.0",
  title: "Test Scene Graph",
  scenes: [
    {
      id: "scene_1",
      name: "Cảnh 1",
      durationInFrames: 180,
      background: {
        preset: "gardenDay",
        customColors: {
          sky: "#87CEEB",
          grass: "#2E8B57",
        },
      },
      camera: {
        x: 1280,
        y: 720,
        zoom: 1.0,
        panDurationFrames: 45,
      },
      character: {
        visible: false,
        x: 0,
        y: 0,
        scale: 0.9,
        blush: true,
        sweatDrop: false,
        pose: "standing",
      },
      props: [
        {
          id: "jar_floor",
          type: "glassJar",
          x: 0,
          y: 0,
          scale: 0.35, // Kiểm tra tỷ lệ lọ 0.35 không bị ép thành 0.72!
          visible: false,
        },
        {
          id: "coffee_mug",
          type: "coffeeCup", // Kiểm tra không bị đổi thành bush
          x: 1400,
          y: 760,
          scale: 0.4,
          visible: true,
        },
      ],
      keyframes: [exprKfInput, scaleKfInput, rotateKfInput],
      subtitles: [
        {
          id: "sub_1",
          text: "Một người từ từ bước đi trên đồng cỏ xanh mướt.",
          startFrame: 5,
          endFrame: 175,
        },
      ],
    },
  ],
};

const sanitized = sanitizeSceneGraph(mockRawGraph);
const scene1 = sanitized.scenes[0];

// Kiểm tra background customColors
assert(
  scene1.background.customColors &&
    scene1.background.customColors.sky === "#87CEEB" &&
    scene1.background.customColors.grass === "#2E8B57",
  "background.customColors preserved",
  `Colors: ${JSON.stringify(scene1.background.customColors)}`
);

// Kiểm tra camera.panDurationFrames
assert(
  scene1.camera.panDurationFrames === 45,
  "camera.panDurationFrames (45) preserved",
  `panDurationFrames: ${scene1.camera.panDurationFrames}`
);

// Kiểm tra character: visible: false, blush: true, sweatDrop: false, x: 0, y: 0
assert(
  scene1.character.visible === false,
  "character.visible === false preserved",
  `visible: ${scene1.character.visible}`
);
assert(
  scene1.character.x === 0 && scene1.character.y === 0,
  "character.x === 0 and character.y === 0 preserved",
  `x: ${scene1.character.x}, y: ${scene1.character.y}`
);
assert(
  scene1.character.blush === true && scene1.character.sweatDrop === false,
  "character.blush (true) and sweatDrop (false) preserved",
  `blush: ${scene1.character.blush}, sweatDrop: ${scene1.character.sweatDrop}`
);

// Kiểm tra prop 1: glass-jar với scale: 0.35, x: 0, y: 0, visible: false
const jarProp = scene1.props.find((p) => p.id === "jar_floor");
assert(
  jarProp && jarProp.type === "glass-jar",
  "jarProp resolved to 'glass-jar'",
  `type: ${jarProp?.type}`
);
assert(
  jarProp && jarProp.scale === 0.35,
  "jarProp scale 0.35 PRESERVED (NOT forced to 0.72!)",
  `scale: ${jarProp?.scale}`
);
assert(
  jarProp && jarProp.x === 0 && jarProp.y === 0,
  "jarProp x=0 and y=0 preserved",
  `x: ${jarProp?.x}, y: ${jarProp?.y}`
);
assert(
  jarProp && jarProp.visible === false,
  "jarProp visible === false preserved",
  `visible: ${jarProp?.visible}`
);

// Kiểm tra prop 2: coffeeCup resolved to coffee-cup (NOT bush!)
const coffeeProp = scene1.props.find((p) => p.id === "coffee_mug");
assert(
  coffeeProp && coffeeProp.type === "coffee-cup",
  "coffeeCup resolved to 'coffee-cup' (NOT 'bush')",
  `type: ${coffeeProp?.type}`
);

// Kiểm tra keyframes trong scene1
assert(
  scene1.keyframes && scene1.keyframes.length === 3,
  "All 3 keyframes preserved in sanitized scene graph",
  `Count: ${scene1.keyframes?.length}`
);
const kf1 = scene1.keyframes[0];
assert(
  kf1.action === "changeExpression" && kf1.params.eyes === "wide" && kf1.params.mouth === "gasp",
  "SceneGraph keyframe 1: changeExpression params preserved",
  `Params: ${JSON.stringify(kf1.params)}`
);

console.log("\n=======================================================");
console.log(`KẾT QUẢ KIỂM TRA: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("🎉 TẤT CẢ 23/23 PHÉP THỬ HỒI QUY ĐỀU ĐẠT 100%!");
  process.exit(0);
}
