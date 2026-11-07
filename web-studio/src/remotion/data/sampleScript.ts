import { MasterSceneGraph } from "../types/sceneGraph";

/**
 * Kịch bản chuẩn 4 Scene — "Chuyện Con Nhện Tám" (Chuẩn đồ họa 2K 2560x1440 @ 60 FPS)
 *
 * Tích hợp Phân hệ VFX & Cinematography Engine:
 * - Scene 1: Bối cảnh ngày có mây trôi (cloudDrift), tia nắng chéo (sunbeams) và ngọn gió thoảng (windBreeze)
 * - Scene 2: Camera Cinematic Zoom-In từ xa vào cận cảnh chiếc lọ khổng lồ 900px, nhãn "TÁM" sắc nét
 * - Scene 3: Infographic đồng hồ đo trao đổi chất với kim đồng hồ quay động mượt mà từ -70deg lên -25deg
 * - Scene 4: Cảnh đêm ấm cúng với đèn bàn tỏa nón sáng Volumetric Falloff và vệt sáng vàng trên mặt bàn
 */
export const sampleScriptSceneGraph: MasterSceneGraph = {
  version: "3.1.0",
  title: "Chuyện Con Nhện Tám — Chuẩn 2K 60FPS Cinema VFX",
  width: 2560,
  height: 1440,
  fps: 60,
  totalDurationInFrames: 480,
  scenes: [
    // =====================================================================
    // SCENE 1 (0→120 frames / 0s→2s)
    // Cảnh toàn phòng khách: Tia nắng sunbeams + mây trôi + gió thoảng + cây rung rinh
    // =====================================================================
    {
      id: "scene_01",
      name: "Phát hiện con nhện trong lọ",
      startFrame: 0,
      durationInFrames: 120,
      background: { preset: "livingRoomDay" },
      camera: { x: 1280, y: 720, zoom: 1.0 },
      lighting: { preset: "sunbeams", sunbeams: true },
      environmentVfx: ["cloudDrift", "windBreeze"],
      character: {
        slot: "floor.right",
        x: 1850,
        y: 1120,
        scale: 1.0,
        facing: "left",
        pose: "standing",
        eyes: "surprised",
        eyebrows: "raised",
        mouth: "gasp",
        pupilGaze: { x: -0.9, y: 0.2 },
      },
      props: [
        {
          id: "jar_s1",
          type: "glassJar",
          slot: "floor.left",
          layer: "midgroundFrontLayer",
          x: 780,
          y: 1120,
          scale: 1.0,
          properties: {
            hasSpiderInside: true,
          },
          entrance: {
            type: "fadeIn",
            delay: 0,
          },
        },
        {
          id: "sofa_bg",
          type: "sofa",
          slot: "floor.farRight",
          layer: "midgroundBackLayer",
          x: 2200,
          y: 1120,
          scale: 1.0,
        },
        {
          id: "plant_s1",
          type: "pottedPlant",
          slot: "floor.farLeft",
          layer: "midgroundBackLayer",
          x: 350,
          y: 1120,
          scale: 1.0,
        },
      ],
      subtitles: [
        {
          id: "sub_s1",
          text: "Một hôm tôi phát hiện một con nhện ở trong góc phòng.",
          startFrame: 5,
          endFrame: 115,
          words: [
            { word: "Một", startMs: 83, endMs: 250 },
            { word: "hôm", startMs: 250, endMs: 450 },
            { word: "tôi", startMs: 450, endMs: 650 },
            { word: "phát", startMs: 650, endMs: 850 },
            { word: "hiện", startMs: 850, endMs: 1050 },
            { word: "một", startMs: 1050, endMs: 1250 },
            { word: "con", startMs: 1250, endMs: 1400 },
            { word: "nhện", startMs: 1400, endMs: 1600 },
            { word: "ở", startMs: 1600, endMs: 1720 },
            { word: "trong", startMs: 1720, endMs: 1850 },
            { word: "góc", startMs: 1850, endMs: 1950 },
            { word: "phòng.", startMs: 1950, endMs: 2200 },
          ],
        },
      ],
      speechBubbles: [
        {
          id: "bubble_s1",
          text: "Ơ kìa!",
          hasMusicNote: false,
          position: { x: 1820, y: 560 },
          tailAnchor: { x: -50, y: 80 },
          startFrame: 25,
          endFrame: 110,
        },
      ],
      keyframes: [
        {
          frame: 0,
          action: "moveCharacter",
          target: "character",
          params: { fromX: 2100, toX: 1750, fromY: 1120, toY: 1120 },
          springConfig: { damping: 14, stiffness: 75, mass: 0.8 },
        },
      ],
    },

    // =====================================================================
    // SCENE 2 (120→240 frames / 2s→4s)
    // Cận cảnh chiếc lọ khổng lồ 900px, camera zoom điện ảnh mượt mà
    // =====================================================================
    {
      id: "scene_02",
      name: "Đặt tên cho nhện: TÁM",
      startFrame: 120,
      durationInFrames: 120,
      background: { preset: "infographicStripes" },
      camera: {
        zoomFrom: 1.0,
        zoomTo: 1.45,
        focusSlot: "screen.centerCloseUp",
        panDurationFrames: 50,
      },
      character: {
        x: -9999,
        y: 0,
        pose: "standing",
      },
      props: [
        {
          id: "jar_closeup",
          type: "glassJar",
          slot: "screen.centerCloseUp",
          layer: "midgroundFrontLayer",
          x: 1280,
          y: 1150,
          scale: 2.15,
          properties: {
            hasSpiderInside: true,
            label: "TÁM",
            showPointerCallout: false,
          },
          entrance: {
            type: "pop",
            delay: 0,
            springConfig: { damping: 12, stiffness: 140, mass: 0.5 },
          },
        },
      ],
      propAnimations: [
        {
          targetId: "jar_closeup",
          type: "scaleBounce",
          fromScale: 1.85,
          toScale: 2.15,
        },
      ],
      subtitles: [
        {
          id: "sub_s2",
          text: "Tôi quyết định đặt tên cho chú nhện này là Tám.",
          startFrame: 125,
          endFrame: 235,
          words: [
            { word: "Tôi", startMs: 2083, endMs: 2280 },
            { word: "quyết", startMs: 2280, endMs: 2480 },
            { word: "định", startMs: 2480, endMs: 2680 },
            { word: "đặt", startMs: 2680, endMs: 2880 },
            { word: "tên", startMs: 2880, endMs: 3080 },
            { word: "cho", startMs: 3080, endMs: 3250 },
            { word: "chú", startMs: 3250, endMs: 3420 },
            { word: "nhện", startMs: 3420, endMs: 3620 },
            { word: "này", startMs: 3620, endMs: 3780 },
            { word: "là", startMs: 3780, endMs: 3900 },
            { word: "Tám.", startMs: 3900, endMs: 4200 },
          ],
        },
      ],
    },

    // =====================================================================
    // SCENE 3 (240→360 frames / 4s→6s)
    // Infographic đồng hồ đo trao đổi chất với kim xoay động từ -70deg lên -25deg
    // =====================================================================
    {
      id: "scene_03",
      name: "Tốc độ trao đổi chất",
      startFrame: 240,
      durationInFrames: 120,
      background: { preset: "infographicStripes" },
      camera: { x: 1280, y: 720, zoom: 1.2 },
      character: {
        x: -9999,
        y: 0,
        pose: "standing",
      },
      props: [
        {
          id: "gauge_meter",
          type: "gaugeMeter",
          slot: "screen.center",
          layer: "midgroundFrontLayer",
          x: 1280,
          y: 720,
          scale: 1.6,
          entrance: {
            type: "pop",
            delay: 0,
            springConfig: { damping: 10, stiffness: 120, mass: 0.6 },
          },
          properties: {
            label: "NĂNG LƯỢNG: 30%",
          },
        },
      ],
      propAnimations: [
        {
          targetId: "gauge_meter",
          type: "rotateNeedle",
          fromDeg: -70,
          toDeg: -25,
        },
      ],
      subtitles: [
        {
          id: "sub_s3",
          text: "Loài nhện có tốc độ trao đổi chất cực kỳ chậm rãi.",
          startFrame: 245,
          endFrame: 355,
          words: [
            { word: "Loài", startMs: 4083, endMs: 4280 },
            { word: "nhện", startMs: 4280, endMs: 4500 },
            { word: "có", startMs: 4500, endMs: 4680 },
            { word: "tốc", startMs: 4680, endMs: 4880 },
            { word: "độ", startMs: 4880, endMs: 5050 },
            { word: "trao", startMs: 5050, endMs: 5250 },
            { word: "đổi", startMs: 5250, endMs: 5450 },
            { word: "chất", startMs: 5450, endMs: 5650 },
            { word: "cực", startMs: 5650, endMs: 5800 },
            { word: "kỳ", startMs: 5800, endMs: 5950 },
            { word: "chậm", startMs: 5950, endMs: 6150 },
            { word: "rãi.", startMs: 6150, endMs: 6400 },
          ],
        },
      ],
    },

    // =====================================================================
    // SCENE 4 (360→480 frames / 6s→8s)
    // Cảnh đêm phòng làm việc: Nón ánh sáng vàng Volumetric + Vệt sáng bàn + Camera Focus
    // =====================================================================
    {
      id: "scene_04",
      name: "Buổi tối bên bàn làm việc",
      startFrame: 360,
      durationInFrames: 120,
      background: { preset: "livingRoomNight" },
      camera: {
        zoomFrom: 1.0,
        zoomTo: 1.15,
        focusSlot: "desk.seat",
        panDurationFrames: 50,
      },
      lighting: { preset: "warmNightLamp" },
      environmentVfx: ["windBreeze"],
      character: {
        slot: "desk.seat",
        x: 1150,
        y: 1120,
        scale: 1.0,
        facing: "right",
        pose: "sittingBehindDesk",
        eyes: "happy",
        eyebrows: "neutral",
        mouth: "smile",
        pupilGaze: { x: 0.6, y: 0.4 },
      },
      props: [
        {
          id: "desk_lamp_s4",
          type: "deskLamp",
          slot: "desk.topLeft",
          layer: "midgroundFrontLayer",
          x: 800,
          y: 760,
          scale: 1.3,
        },
        {
          id: "jar_s4",
          type: "glassJar",
          slot: "desk.topRight",
          layer: "midgroundFrontLayer",
          x: 1480,
          y: 760,
          scale: 0.7,
          properties: {
            hasSpiderInside: true,
          },
        },
        {
          id: "sofa_bg_night",
          type: "sofa",
          slot: "floor.farRight",
          layer: "midgroundBackLayer",
          x: 2200,
          y: 1120,
          scale: 1.0,
        },
      ],
      subtitles: [
        {
          id: "sub_s4",
          text: "Tối đến, Tám vẫn ngoan ngoãn đồng hành cùng tôi làm việc.",
          startFrame: 365,
          endFrame: 475,
          words: [
            { word: "Tối", startMs: 6083, endMs: 6280 },
            { word: "đến,", startMs: 6280, endMs: 6500 },
            { word: "Tám", startMs: 6500, endMs: 6750 },
            { word: "vẫn", startMs: 6750, endMs: 6950 },
            { word: "ngoan", startMs: 6950, endMs: 7150 },
            { word: "ngoãn", startMs: 7150, endMs: 7350 },
            { word: "đồng", startMs: 7350, endMs: 7550 },
            { word: "hành", startMs: 7550, endMs: 7750 },
            { word: "cùng", startMs: 7750, endMs: 7920 },
            { word: "tôi", startMs: 7920, endMs: 8100 },
            { word: "làm", startMs: 8100, endMs: 8300 },
            { word: "việc.", startMs: 8300, endMs: 8600 },
          ],
        },
      ],
    },
  ],
};
