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
  startAnchorRef?: string;
  startFixed?: Point2D;
  endAnchorRef?: string;
  endFixed?: Point2D;
  startFrame: number;
  endFrame: number;
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
  coneAngle?: number;
  coneLength?: number;
}

export interface AlphaConfig {
  fadeInFrames?: number;
  fadeOutFrames?: number;
  pulseAlpha?: boolean;
  minAlpha?: number;
  maxAlpha?: number;
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
    | string;
  layer: "midgroundBackLayer" | "midgroundFrontLayer" | "characterLayer";
  x: number;
  y: number;
  slot?: string; // Semantic slot e.g. "desk.topLeft", "floor.left"
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  alphaConfig?: AlphaConfig;
  anchorPoint?: "bottomCenter" | "center" | "topCenter";
  pivotPoint?: "center" | "bottomCenter" | "topCenter" | "topLeft" | "custom";
  pivotX?: number;
  pivotY?: number;
  visible?: boolean;
  properties?: Record<string, any>;
  entrance?: EntranceConfig;
}

export type EnvironmentVfxType =
  | "rainLoop"
  | "windBreeze"
  | "cloudDrift"
  | "foliageSway"
  | "sunbeams";

export interface LightingConfig {
  preset?: "warmNightLamp" | "sunbeams" | "moonlight" | "neutral" | string;
  intensity?: number;
  sunbeams?: boolean;
  color?: string;
}

export interface CameraConfig {
  x?: number;
  y?: number;
  zoom?: number;
  zoomFrom?: number;
  zoomTo?: number;
  focusSlot?: string;
  focusTarget?: string;
  easing?: "bezier" | "spring" | "linear";
  panDurationFrames?: number;
}

export interface PropAnimation {
  targetId: string;
  type: "scaleBounce" | "squashStretch" | "idlePulse" | "fadeIn" | "fadeOut" | "rotateNeedle";
  fadeInFrames?: number;
  fadeOutFrames?: number;
  fromScale?: number;
  toScale?: number;
  fromDeg?: number;
  toDeg?: number;
  pivotPoint?: "center" | "bottomCenter" | "topCenter" | "custom";
  pivotX?: number;
  pivotY?: number;
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
  camera: CameraConfig;
  character: StickmanState;
  props: PropItem[];
  subtitles: SubtitleItem[];
  speechBubbles?: SpeechBubbleItem[];
  keyframes?: SceneKeyframe[];
  lines?: DynamicLineItem[];
  environmentVfx?: EnvironmentVfxType[];
  lighting?: LightingConfig;
  propAnimations?: PropAnimation[];
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
