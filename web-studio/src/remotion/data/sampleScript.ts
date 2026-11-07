import { MasterSceneGraph } from "../types/sceneGraph";

/**
 * Kịch bản mẫu 3 scene — "Chuyện Con Nhện Tám" (phiên bản Motion Engine đầy đủ)
 *
 * Tổng: 360 frames = 6 giây @ 60 FPS
 * - Scene 1 (0→120f / 0s→2s): Nhân vật bước vào + dây tơ nhện thả xuống từ trần nhà
 * - Scene 2 (120→240f / 2s→4s): Lọ rơi úp lên nhện + squash/stretch va chạm
 * - Scene 3 (240→360f / 4s→6s): Nhãn "TÁM" bay vào + pointer line bám mặt lọ
 *
 * Mỗi scene có word-level karaoke timestamps cho phụ đề.
 */
export const sampleScriptSceneGraph: MasterSceneGraph = {
  version: "3.0.0",
  title: "Chuyện Con Nhện Tám — Motion Engine Demo",
  width: 2560,
  height: 1440,
  fps: 60,
  totalDurationInFrames: 360,
  scenes: [
    // =====================================================================
    // SCENE 1 (0→120 frames / 0s→2s)
    // Nhân vật spring-enter từ phải, nhện treo lủng lẳng từ trần nhà
    // =====================================================================
    {
      id: "scene_01",
      name: "Phát hiện con nhện treo tơ",
      startFrame: 0,
      durationInFrames: 120,
      background: { preset: "livingRoomDay" },
      camera: { x: 1280, y: 720, zoom: 1.0 },
      character: {
        x: 1560,
        y: 1040,
        scale: 1.0,
        facing: "left",
        pose: "standing",
        eyes: "surprised",
        eyebrows: "raised",
        mouth: "gasp",
        pupilGaze: { x: -0.9, y: -0.3 },
      },
      props: [
        {
          id: "spider_hanging",
          type: "spider",
          layer: "midgroundFrontLayer",
          x: 750,
          y: 600,
          scale: 0.7,
          entrance: {
            type: "drop",
            delay: 20,
            from: "top",
            springConfig: { damping: 6, stiffness: 40, mass: 1.2 },
          },
        },
        {
          id: "sofa_bg",
          type: "sofa",
          layer: "midgroundBackLayer",
          x: 2320,
          y: 1040,
          scale: 1.0,
        },
        {
          id: "desk_bg",
          type: "desk",
          layer: "midgroundBackLayer",
          x: 400,
          y: 1040,
          scale: 0.85,
        },
      ],
      subtitles: [
        {
          id: "sub_s1",
          text: "Một hôm tôi thấy con nhện treo lơ lửng.",
          startFrame: 5,
          endFrame: 115,
          words: [
            { word: "Một", startMs: 83, endMs: 250 },
            { word: "hôm", startMs: 250, endMs: 450 },
            { word: "tôi", startMs: 450, endMs: 600 },
            { word: "thấy", startMs: 600, endMs: 820 },
            { word: "con", startMs: 820, endMs: 960 },
            { word: "nhện", startMs: 960, endMs: 1180 },
            { word: "treo", startMs: 1180, endMs: 1380 },
            { word: "lơ", startMs: 1380, endMs: 1530 },
            { word: "lửng.", startMs: 1530, endMs: 1850 },
          ],
        },
      ],
      speechBubbles: [
        {
          id: "bubble_s1",
          text: "Ơ kìa!",
          hasMusicNote: false,
          position: { x: 1780, y: 450 },
          tailAnchor: { x: -70, y: 65 },
          startFrame: 40,
          endFrame: 110,
        },
      ],
      // Keyframes — hành động timeline chính xác
      keyframes: [
        {
          frame: 0,
          action: "moveCharacter",
          target: "character",
          params: { fromX: 2800, toX: 1560, fromY: 1040, toY: 1040 },
          springConfig: { damping: 14, stiffness: 80, mass: 0.8 },
        },
        {
          frame: 20,
          action: "showLine",
          target: "silk_01",
          params: {},
        },
        {
          frame: 60,
          action: "changeExpression",
          target: "character",
          params: { eyes: "wide", mouth: "gasp", eyebrows: "raised" },
        },
      ],
      // Dynamic Lines
      lines: [
        {
          id: "silk_01",
          style: "silk",
          startFixed: { x: 750, y: 0 },
          endFixed: { x: 750, y: 600 },
          startFrame: 20,
          endFrame: 120,
          color: "#999999",
          strokeWidth: 3,
          animated: true,
        },
      ],
    },

    // =====================================================================
    // SCENE 2 (120→240 frames / 2s→4s)
    // Lọ thủy tinh rơi úp lên nhện — Squash & Stretch impact
    // =====================================================================
    {
      id: "scene_02",
      name: "Úp lọ bắt nhện",
      startFrame: 120,
      durationInFrames: 120,
      background: { preset: "livingRoomDay" },
      camera: { x: 1280, y: 720, zoom: 1.3 },
      character: {
        x: 1560,
        y: 1040,
        scale: 1.0,
        facing: "left",
        pose: "standing",
        eyes: "happy",
        eyebrows: "neutral",
        mouth: "smile",
        pupilGaze: { x: -0.8, y: 0.5 },
      },
      props: [
        {
          id: "jar_drop",
          type: "glassJar",
          layer: "midgroundFrontLayer",
          x: 750,
          y: 970,
          scale: 0.95,
          entrance: {
            type: "drop",
            delay: 10,
            from: "top",
            springConfig: { damping: 8, stiffness: 180, mass: 0.5 },
          },
          properties: {
            hasSpiderInside: true,
          },
        },
      ],
      subtitles: [
        {
          id: "sub_s2",
          text: "Tôi lấy cái lọ úp lên nó luôn!",
          startFrame: 125,
          endFrame: 235,
          words: [
            { word: "Tôi", startMs: 2083, endMs: 2250 },
            { word: "lấy", startMs: 2250, endMs: 2430 },
            { word: "cái", startMs: 2430, endMs: 2580 },
            { word: "lọ", startMs: 2580, endMs: 2750 },
            { word: "úp", startMs: 2750, endMs: 2930 },
            { word: "lên", startMs: 2930, endMs: 3100 },
            { word: "nó", startMs: 3100, endMs: 3260 },
            { word: "luôn!", startMs: 3260, endMs: 3600 },
          ],
        },
      ],
      keyframes: [
        {
          frame: 10,
          action: "moveProp",
          target: "jar_drop",
          params: { fromY: 400, toY: 970 },
          springConfig: { damping: 8, stiffness: 180, mass: 0.5 },
        },
        {
          frame: 45,
          action: "squashImpact",
          target: "jar_drop",
          params: { impactFrame: 45 },
        },
        {
          frame: 50,
          action: "changeExpression",
          target: "character",
          params: { eyes: "happy", mouth: "smile" },
        },
      ],
    },

    // =====================================================================
    // SCENE 3 (240→360 frames / 4s→6s)
    // Cận cảnh lọ + nhãn "TÁM" bay vào + pointer line bám bề mặt lọ
    // =====================================================================
    {
      id: "scene_03",
      name: "Đặt tên cho nhện: TÁM",
      startFrame: 240,
      durationInFrames: 120,
      background: { preset: "infographicStripes" },
      camera: { x: 1280, y: 720, zoom: 1.0 },
      character: {
        x: -9999,
        y: 0,
        pose: "standing",
      },
      props: [
        {
          id: "jar_closeup",
          type: "glassJar",
          layer: "midgroundFrontLayer",
          x: 1100,
          y: 680,
          scale: 2.2,
          entrance: {
            type: "pop",
            delay: 0,
            springConfig: { damping: 10, stiffness: 120, mass: 0.6 },
          },
          properties: {
            hasSpiderInside: true,
            label: "TÁM",
            showPointerCallout: true,
          },
        },
      ],
      subtitles: [
        {
          id: "sub_s3",
          text: "Tôi còn đặt tên cho nó là Tám.",
          startFrame: 245,
          endFrame: 355,
          words: [
            { word: "Tôi", startMs: 4083, endMs: 4250 },
            { word: "còn", startMs: 4250, endMs: 4420 },
            { word: "đặt", startMs: 4420, endMs: 4600 },
            { word: "tên", startMs: 4600, endMs: 4780 },
            { word: "cho", startMs: 4780, endMs: 4930 },
            { word: "nó", startMs: 4930, endMs: 5080 },
            { word: "là", startMs: 5080, endMs: 5210 },
            { word: "Tám.", startMs: 5210, endMs: 5700 },
          ],
        },
      ],
      keyframes: [
        {
          frame: 0,
          action: "scaleProp",
          target: "jar_closeup",
          params: { fromScale: 0, toScale: 2.2 },
          springConfig: { damping: 10, stiffness: 120, mass: 0.6 },
        },
        {
          frame: 30,
          action: "showLine",
          target: "label_pointer",
          params: {},
        },
      ],
      lines: [
        {
          id: "label_pointer",
          style: "pointer",
          startAnchorRef: "prop:jar_closeup:rightGrip",
          endFixed: { x: 1650, y: 580 },
          startFrame: 270,
          endFrame: 360,
          color: "#141414",
          strokeWidth: 5,
          animated: true,
        },
      ],
    },
  ],
};
