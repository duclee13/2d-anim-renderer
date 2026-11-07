import { StickmanState, Point2D } from "./character";
import { SpringConfig } from "../lib/motionEngine";

export type BackgroundPreset =
  | "livingRoomDay"
  | "livingRoomNight"
  | "gardenDay"
  | "infographicStripes";

export interface SubtitleWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SubtitleItem {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  words?: SubtitleWord[];
}

export interface SpeechBubbleItem {
  id: string;
  text: string;
  tailAnchor: Point2D;
  position: Point2D;
  startFrame: number;
  endFrame: number;
  hasMusicNote?: boolean;
}

/**
 * Cấu hình hiệu ứng xuất hiện của đạo cụ (entrance animation).
 */
export interface EntranceConfig {
  type: "spring" | "slide" | "pop" | "drop" | "fadeIn";
  delay?: number; // delay tính bằng frames
  from?: "left" | "right" | "top" | "bottom"; // hướng bay vào
  springConfig?: SpringConfig;
}

/**
 * Keyframe cho hành động diễn ra trong một scene.
 * Cho phép lập trình animation theo timeline chính xác.
 */
export interface SceneKeyframe {
  frame: number; // frame tương đối trong scene (0 = scene start)
  action:
    | "moveProp"
    | "scaleProp"
    | "rotateProp"
    | "squashImpact"
    | "changeExpression"
    | "moveCharacter"
    | "showLine"
    | "hideLine"
    | "showBubble"
    | "hideBubble"
    | "cameraZoom"
    | "cameraPan";
  target: string; // id của prop/character/line cần tác động
  params: Record<string, any>; // tham số tùy ý cho action
  springConfig?: SpringConfig;
}

/**
 * Đường line nối động (Dynamic Line) cho dây tơ, tia sáng, đường chỉ dẫn.
 */
export type DynamicLineStyle = "silk" | "light" | "pointer" | "dashed" | "glow";

export interface DynamicLineItem {
  id: string;
  style: DynamicLineStyle;
  /**
   * Đầu mút gốc — có thể là tọa độ cố định hoặc tham chiếu anchor.
   * Nếu dùng anchorRef: "prop:{propId}:{port}" hoặc "character:{anchorName}" hoặc "ceiling" hoặc "fixed"
   */
  startAnchorRef?: string;
  startFixed?: Point2D;
  /**
   * Đầu mút đích — tương tự.
   */
  endAnchorRef?: string;
  endFixed?: Point2D;
  startFrame: number;
  endFrame: number;
  color?: string;
  strokeWidth?: number;
  animated?: boolean; // spring dangle cho dây tơ
  /**
   * Cho kiểu "light": góc mở hình chóp (degrees)
   */
  coneAngle?: number;
  coneLength?: number;
}

export interface PropItem {
  id: string;
  type:
    | "glassJar"
    | "desk"
    | "deskLamp"
    | "sofa"
    | "spider"
    | "gaugeMeter"
    | "pottedPlant"
    | "window"
    | "bush"
    | "cloud"
    | "sun"
    | string; // cho phép type tùy ý từ AI
  layer: "midgroundBackLayer" | "midgroundFrontLayer" | "characterLayer";
  x: number;
  y: number;
  slot?: string; // Semantic slot e.g. "desk.topLeft", "floor.left"
  scale?: number;
  rotation?: number;
  visible?: boolean;
  properties?: Record<string, any>;
  entrance?: EntranceConfig;
}

export interface SceneGraphScene {
  id: string;
  name: string;
  startFrame: number;
  durationInFrames: number;
  background: {
    preset: BackgroundPreset;
    customColors?: Record<string, string>;
  };
  camera: {
    x: number;
    y: number;
    zoom: number; // 1.0 = normal, 2.5 = close-up
  };
  character: StickmanState;
  props: PropItem[];
  subtitles: SubtitleItem[];
  speechBubbles?: SpeechBubbleItem[];
  /**
   * Keyframes — hành động diễn ra tại frame cụ thể trong scene.
   */
  keyframes?: SceneKeyframe[];
  /**
   * Dynamic Lines — dây tơ, tia sáng, đường chỉ dẫn.
   */
  lines?: DynamicLineItem[];
}

export interface MasterSceneGraph {
  version: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  totalDurationInFrames: number;
  audioTrack?: {
    src: string;
    volume?: number;
  };
  scenes: SceneGraphScene[];
}
