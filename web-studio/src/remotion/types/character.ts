export type StickmanPoseType =
  | "standing"
  | "sittingBehindDesk"
  | "holdingObject"
  | "walking"
  | "pointing"
  | "shrugging";

export type EyeExpression =
  | "neutral"
  | "wide"
  | "surprised"
  | "happy"
  | "closed"
  | "curious";

export type EyebrowExpression =
  | "neutral"
  | "raised"
  | "inquisitive"
  | "worried"
  | "furrowed";

export type MouthExpression =
  | "smile"
  | "circleOpen"
  | "line"
  | "talking"
  | "gasp";

export interface Point2D {
  x: number;
  y: number;
}

export interface StickmanAnchors {
  headCenter: Point2D;
  mouth: Point2D;
  neck: Point2D;
  hip: Point2D;
  leftShoulder: Point2D;
  rightShoulder: Point2D;
  leftElbow: Point2D;
  rightElbow: Point2D;
  leftHand: Point2D;
  rightHand: Point2D;
  leftHip: Point2D;
  rightHip: Point2D;
  leftKnee: Point2D;
  rightKnee: Point2D;
  leftFoot: Point2D;
  rightFoot: Point2D;
}

export interface StickmanState {
  x: number;
  y: number;
  slot?: string; // Semantic slot e.g. "floor.center", "desk.seat"
  scale?: number;
  rotation?: number;
  facing?: "left" | "right";
  pose: StickmanPoseType;
  eyes?: EyeExpression;
  eyebrows?: EyebrowExpression;
  mouth?: MouthExpression;
  pupilGaze?: Point2D; // -1 to +1 relative offset
  blush?: boolean;
  sweatDrop?: boolean;
  holdingTarget?: {
    leftGrip: Point2D;
    rightGrip: Point2D;
  };
  pointingTarget?: Point2D;
  walkCycleProgress?: number; // 0 to 1 for continuous walk
  walkWeight?: number; // 0 (standing flat) to 1 (full stride) for smooth deceleration
}

export interface PropAnchorPorts {
  leftGrip: Point2D;
  rightGrip: Point2D;
  surfaceDecal: Point2D;
  lidCenter?: Point2D;
  baseCenter?: Point2D;
}
