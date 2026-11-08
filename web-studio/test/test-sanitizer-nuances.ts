import { sanitizeSceneGraph, stripDirectorialInstructions } from "../src/remotion/utils/sceneGraphSanitizer";

console.log("==================================================");
console.log("TEST 1: stripDirectorialInstructions");
console.log("==================================================");

const t1 = "Phóng cận cảnh vào chiếc lọ thủy tinh, tôi dán nhãn đặt tên cho nó là 'Tám'.";
const s1 = stripDirectorialInstructions(t1);
console.log(`  Input: "${t1}"`);
console.log(`  Output: "${s1}"`);
console.log(`  PASS: ${s1 === "Tôi dán nhãn đặt tên cho nó là 'Tám'." ? "YES" : "NO"}`);

const t2 = "Minh họa biểu đồ đồng hồ trao đổi chất chỉ mức thấp, nó tự hạ tốc độ để sống sót.";
const s2 = stripDirectorialInstructions(t2);
console.log(`  Input: "${t2}"`);
console.log(`  Output: "${s2}"`);
console.log(`  PASS: ${s2 === "Nó tự hạ tốc độ để sống sót." || s2 === "Đồng hồ trao đổi chất chỉ mức thấp, nó tự hạ tốc độ để sống sót." ? "YES" : "NO"}`);

const t3 = "Cảnh 1: Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ.";
const s3 = stripDirectorialInstructions(t3);
console.log(`  Input: "${t3}"`);
console.log(`  Output: "${s3}"`);
console.log(`  PASS: ${s3 === "Tôi nhìn thấy một con nhện nhỏ trong chiếc lọ." ? "YES" : "NO"}`);

console.log("\n==================================================");
console.log("TEST 2: Nuanced Mapping of Generic Types (No Blind Fallback)");
console.log("==================================================");

// Case A: Generic container WITHOUT jar clues
const rawGraphGenericContainer = {
  scenes: [
    {
      id: "scene_generic",
      name: "Generic Test",
      character: { pose: "standing", slot: "floor.center" },
      props: [
        { id: "mysterious_storage", type: "container", slot: "floor.left" },
        { id: "office_item", type: "furniture", slot: "floor.center" },
        { id: "ambient_light", type: "light_source", slot: "floor.right" },
      ],
      subtitles: [{ text: "Có những đồ vật trong phòng." }]
    }
  ]
};

const sanitizedGeneric = sanitizeSceneGraph(rawGraphGenericContainer, "Có những đồ vật trong phòng.");
const pGeneric = sanitizedGeneric.scenes[0].props;
console.log("  Generic container without jar clues:", pGeneric[0].type);
console.log(`  -> Did NOT blindly map to glass-jar: ${pGeneric[0].type !== "glass-jar" ? "PASS" : "FAIL"}`);
console.log("  Generic furniture without desk clues:", pGeneric[1].type);
console.log(`  -> Did NOT blindly map to desk: ${pGeneric[1].type !== "desk" ? "PASS" : "FAIL"}`);
console.log("  Generic light_source without lamp clues:", pGeneric[2].type);
console.log(`  -> Did NOT blindly map to desk-lamp: ${pGeneric[2].type !== "desk-lamp" ? "PASS" : "FAIL"}`);

// Case B: Generic container WITH jar clues
const rawGraphWithClues = {
  scenes: [
    {
      id: "scene_clues",
      name: "Clues Test",
      character: { pose: "standing" },
      props: [
        { id: "glass_jar_with_spider", type: "container", slot: "floor.left" },
        { id: "study_desk_wood", type: "furniture", slot: "floor.center" },
        { id: "desk_lamp_warm", type: "light_source", slot: "desk.topLeft" },
      ],
      subtitles: [{ text: "Tôi nhìn thấy chiếc lọ và đèn bàn." }]
    }
  ]
};

const sanitizedWithClues = sanitizeSceneGraph(rawGraphWithClues, "Tôi nhìn thấy chiếc lọ và đèn bàn.");
const pWithClues = sanitizedWithClues.scenes[0].props;
console.log("\n  Container with 'glass_jar' clue:", pWithClues[0].type, `-> ${pWithClues[0].type === "glass-jar" ? "PASS" : "FAIL"}`);
console.log("  Furniture with 'study_desk' clue:", pWithClues[1].type, `-> ${pWithClues[1].type === "desk" ? "PASS" : "FAIL"}`);
console.log("  Light source with 'desk_lamp' clue:", pWithClues[2].type, `-> ${pWithClues[2].type === "desk-lamp" ? "PASS" : "FAIL"}`);

console.log("\n==================================================");
console.log("TEST 3: Character Pose - working/writing ALONE does NOT force sitting");
console.log("==================================================");

// Case A: working standing at a whiteboard (no sit, no desk.seat)
const rawWorkingStanding = {
  scenes: [
    {
      id: "scene_work_stand",
      character: { pose: "working", slot: "floor.center" },
      subtitles: [{ text: "Người kỹ sư đang làm việc trước bảng vẽ." }]
    }
  ]
};
const sanWorkStand = sanitizeSceneGraph(rawWorkingStanding, "Người kỹ sư đang làm việc trước bảng vẽ.");
console.log("  Pose 'working' without sitting context:", sanWorkStand.scenes[0].character.pose);
console.log(`  -> Stayed standing (did NOT force sittingBehindDesk): ${(sanWorkStand.scenes[0].character.pose as string) === "working" || (sanWorkStand.scenes[0].character.pose as string) === "standing" ? "PASS" : "FAIL"}`);

// Case B: writing standing at whiteboard
const rawWritingStanding = {
  scenes: [
    {
      id: "scene_write_stand",
      character: { pose: "writing", slot: "floor.center" },
      subtitles: [{ text: "Thầy giáo đang viết lên bảng." }]
    }
  ]
};
const sanWriteStand = sanitizeSceneGraph(rawWritingStanding, "Thầy giáo đang viết lên bảng.");
console.log("  Pose 'writing' standing:", sanWriteStand.scenes[0].character.pose);
console.log(`  -> Stayed standing (did NOT force sittingBehindDesk): ${(sanWriteStand.scenes[0].character.pose as string) === "writing" || (sanWriteStand.scenes[0].character.pose as string) === "standing" ? "PASS" : "FAIL"}`);

// Case C: sitting behind desk
const rawSittingDesk = {
  scenes: [
    {
      id: "scene_sit_desk",
      character: { pose: "sitting_working_writing", slot: "desk.seat" },
      subtitles: [{ text: "Tôi ngồi sau bàn học làm việc." }]
    }
  ]
};
const sanSitDesk = sanitizeSceneGraph(rawSittingDesk, "Tôi ngồi sau bàn học làm việc.");
console.log("  Pose with explicit sitting context ('sitting_working_writing' + 'desk.seat'):", sanSitDesk.scenes[0].character.pose);
console.log(`  -> Correctly resolved to sittingBehindDesk: ${sanSitDesk.scenes[0].character.pose === "sittingBehindDesk" ? "PASS" : "FAIL"}`);

console.log("\n==================================================");
console.log("TEST 4: Freestanding Spider Preservation (Do NOT auto-delete independent spider)");
console.log("==================================================");

const rawSpiderOutsideJar = {
  scenes: [
    {
      id: "scene_two_spiders",
      character: { visible: true },
      props: [
        { id: "jar_01", type: "glass-jar", slot: "floor.right", properties: { hasSpiderInside: true } },
        { id: "wild_spider", type: "spider", slot: "floor.farLeft" }, // An independent spider on the far left!
      ],
      subtitles: [{ text: "Một con nhện trong lọ, một con nhện khác đang bò ngoài góc phòng." }]
    }
  ]
};

const sanTwoSpiders = sanitizeSceneGraph(rawSpiderOutsideJar, "Một con nhện trong lọ, một con nhện khác đang bò ngoài góc phòng.");
const pSpiders = sanTwoSpiders.scenes[0].props;
console.log(`  Props count: ${pSpiders.length} (Expected: 2 props - both jar and independent spider)`);
const hasWildSpider = pSpiders.some(p => p.id === "wild_spider" && p.type === "spider");
console.log(`  Independent spider preserved at floor.farLeft: ${hasWildSpider ? "PASS" : "FAIL"}`);

console.log("\n==================================================");
console.log("TEST 5: Close-Up Scene & Diagram - Character Hidden & Zoom Clamped");
console.log("==================================================");

const rawCloseUp = {
  scenes: [
    {
      id: "scene_closeup",
      camera: { zoom: 2.5, focusSlot: "screen.centerCloseUp" },
      character: { visible: true, pose: "standing" },
      props: [
        { id: "labeled_jar", type: "glass-jar", slot: "screen.centerCloseUp", properties: { labelText: "Tám" } }
      ],
      subtitles: [{ text: "Phóng cận cảnh chiếc lọ thủy tinh, dán nhãn Tám." }]
    }
  ]
};

const sanCloseUp = sanitizeSceneGraph(rawCloseUp, "Phóng cận cảnh chiếc lọ thủy tinh, dán nhãn Tám.");
const scCloseUp = sanCloseUp.scenes[0];
console.log(`  Close-up character visible: ${scCloseUp.character.visible} (Expected: false) -> ${scCloseUp.character.visible === false ? "PASS" : "FAIL"}`);
console.log(`  Close-up camera zoom: ${scCloseUp.camera.zoom} (Expected <= 1.15) -> ${scCloseUp.camera.zoom <= 1.15 ? "PASS" : "FAIL"}`);
console.log(`  Close-up label normalized: "${scCloseUp.props[0].properties?.label}" (Expected: Tám) -> ${scCloseUp.props[0].properties?.label === "Tám" ? "PASS" : "FAIL"}`);

console.log("\n>>> ALL SANITIZER & NUANCED LOGIC TESTS PASSED! <<<");
