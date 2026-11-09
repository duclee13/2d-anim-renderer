import { sanitizeSceneGraph } from "../src/remotion/utils/sceneGraphSanitizer";
import { MasterSceneGraph } from "../src/remotion/types/sceneGraph";

console.log("=== 1. TESTING WALKING DETECTION & ANTI-SKATING (CHỐNG DI CHUYỂN LUNG TUNG) ===");

const graphWithOrdinaryDialogue: MasterSceneGraph = {
  version: "3.2.0",
  title: "Test Ordinary Sentences",
  width: 2560,
  height: 1440,
  fps: 60,
  totalDurationInFrames: 300,
  scenes: [
    {
      id: "scene_01",
      name: "Phát hiện con nhện",
      startFrame: 0,
      durationInFrames: 150,
      background: { preset: "livingRoomDay" },
      character: {
        slot: "floor.right",
        facing: "left",
        pose: "standing",
        visible: true,
      },
      props: [
        {
          id: "jar_1",
          type: "glass-jar",
          slot: "floor.left",
          properties: { hasSpiderInside: true },
        },
      ],
      subtitles: [
        {
          id: "sub_1",
          // Sentence contains "đi" in "quên bẵng nó đi"
          text: "Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ. Tôi bảo 'Để sau!' rồi quên bẵng nó đi.",
          startFrame: 5,
          endFrame: 145,
        },
      ],
      keyframes: [],
    },
    {
      id: "scene_02",
      name: "Làm việc buổi tối",
      startFrame: 150,
      durationInFrames: 150,
      background: { preset: "livingRoomNight" },
      character: {
        slot: "desk.seat",
        facing: "right",
        pose: "sittingBehindDesk",
        visible: true,
      },
      props: [
        {
          id: "desk_1",
          type: "desk",
          slot: "floor.center",
        },
      ],
      subtitles: [
        {
          id: "sub_2",
          // Sentence contains "bước" in "từng bước"
          text: "Tôi bắt đầu từng bước làm việc dưới ánh đèn bàn ấm áp.",
          startFrame: 155,
          endFrame: 295,
        },
      ],
      keyframes: [],
    },
  ],
};

const sanitized = sanitizeSceneGraph(
  graphWithOrdinaryDialogue,
  "Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ. Tôi bảo 'Để sau!' rồi quên bẵng nó đi."
);

// Scene 1: Must remain "standing" (NOT forced to "walking") and NO moveCharacter keyframe!
const s1Char = sanitized.scenes[0].character;
const s1Keyframes = sanitized.scenes[0].keyframes || [];

console.log("Scene 1 Character Pose:", s1Char.pose);
console.log("Scene 1 Keyframes count:", s1Keyframes.length);

if (s1Char.pose === "walking") {
  throw new Error("FAIL: Ordinary sentence falsely triggered pose='walking'!");
}

const hasSkateKf = s1Keyframes.some(
  (kf) => (kf.params?.fromX === 600 && kf.params?.toX === 1850)
);
if (hasSkateKf) {
  throw new Error("FAIL: Sanitizer injected automatic 600 -> 1850 skating keyframe!");
}

console.log(">>> Test 1 Passed: Character stays stably stationed, zero accidental walking or skating!");

// Scene 2: Must remain "sittingBehindDesk" and NO moveCharacter keyframe!
const s2Char = sanitized.scenes[1].character;
const s2Keyframes = sanitized.scenes[1].keyframes || [];

console.log("\nScene 2 Character Pose:", s2Char.pose);
console.log("Scene 2 Keyframes count:", s2Keyframes.length);

if (s2Char.pose !== "sittingBehindDesk") {
  throw new Error(`FAIL: Seated character changed to ${s2Char.pose}!`);
}
if (s2Keyframes.length > 0) {
  throw new Error("FAIL: Seated scene received unexpected keyframes!");
}

console.log(">>> Test 2 Passed: Sitting pose preserved without any unwanted movement!");
console.log("\n>>> ALL MOTION STABILITY TESTS PASSED 100%! <<<");
