import React from "react";
import { StickmanState, Point2D, StickmanAnchors } from "../../types/character";
import { solveTwoBoneIK, calculateWalkCycle, calculateSegmentAngle } from "./Kinematics";
import { FacialExpressions } from "./FacialExpressions";

export interface StickmanBodyParts {
  head?: React.ReactNode;
  torso?: React.ReactNode;
  leftUpperArm?: React.ReactNode;
  leftLowerArm?: React.ReactNode;
  leftHand?: React.ReactNode;
  rightUpperArm?: React.ReactNode;
  rightLowerArm?: React.ReactNode;
  rightHand?: React.ReactNode;
  leftThigh?: React.ReactNode;
  leftCalf?: React.ReactNode;
  leftFoot?: React.ReactNode;
  rightThigh?: React.ReactNode;
  rightCalf?: React.ReactNode;
  rightFoot?: React.ReactNode;
}

export interface StickmanRigProps {
  state: StickmanState;
  renderPart?: "all" | "bodyOnly" | "armsOnly" | "legsOnly";
  parts?: StickmanBodyParts;
  breathScale?: number;
  onAnchorsComputed?: (anchors: StickmanAnchors) => void;
}

/**
 * StickmanRig: Khung Xương Động "Figma-to-React Wrapper"
 * 
 * NGUYÊN TẮC:
 * - Giải thuật Kinematics tính toán chính xác tọa độ Pivot và Góc xoay (Rotation) của từng khớp.
 * - Mỗi bộ phận cơ thể là một thẻ <g id="bone-..."> được gắn:
 *   transform="translate(jointX, jointY) rotate(angleDeg)"
 * - Người dùng có thể paste các mảnh SVG từ Figma vào `parts`.
 * - NẾU CHƯA CÓ MẢNH TỪ FIGMA, hệ thống tự động render nét que tối giản siêu nét chuẩn 2K 60FPS
 *   kèm biểu cảm khuôn mặt động (FacialExpressions) và hiệu ứng thở phập phồng (breathScale).
 */
export const StickmanRig: React.FC<StickmanRigProps> = ({
  state,
  renderPart = "all",
  parts,
  breathScale = 1.0,
  onAnchorsComputed,
}) => {
  const {
    x,
    y,
    scale = 1,
    facing = "right",
    pose = "standing",
    holdingTarget,
    pointingTarget,
    walkCycleProgress = 0,
  } = state;

  // Kích thước chuẩn xương que 2K (Canvas 2560x1440, nhân vật cao ~750px-800px)
  const spineLength = 310;
  const upperArmLength = 145;
  const forearmLength = 145;
  const thighLength = 175;
  const calfLength = 175;
  const headRadius = 95;

  // Hơi thở tác động nhẹ lên chiều dài sống lưng
  const effectiveSpineLength = spineLength * breathScale;

  // Khớp gốc: Cổ và Hông (Connected Topology: 100% hội tụ tại trục thân 0, không có thanh đinh ba ngang)
  const hip: Point2D = { x: 0, y: 0 };
  const neck: Point2D = { x: 0, y: -effectiveSpineLength };
  const headCenter: Point2D = { x: 0, y: -effectiveSpineLength - headRadius };

  // Cả hai vai hội tụ chính xác tại 1 điểm duy nhất trên đốt sống cổ
  const leftShoulder: Point2D = { x: 0, y: neck.y };
  const rightShoulder: Point2D = { x: 0, y: neck.y };

  // Cả hai hông hội tụ chính xác tại 1 điểm duy nhất tại đáy cột sống
  const leftHipJoint: Point2D = { x: 0, y: hip.y };
  const rightHipJoint: Point2D = { x: 0, y: hip.y };

  // 1. TÍNH TOÁN CÁNH TAY (Tư thế đứng A-pose tự nhiên: mở 28 độ so với thân, cong nhẹ khuỷu)
  let leftElbow: Point2D = { x: -70, y: neck.y + 130 };
  let leftHand: Point2D = { x: -100, y: neck.y + 265 };
  let rightElbow: Point2D = { x: 70, y: neck.y + 130 };
  let rightHand: Point2D = { x: 100, y: neck.y + 265 };

  if (pose === "holdingObject" && holdingTarget) {
    const targetLeftLocal: Point2D = {
      x: (holdingTarget.leftGrip.x - x) / scale,
      y: (holdingTarget.leftGrip.y - y) / scale,
    };
    const targetRightLocal: Point2D = {
      x: (holdingTarget.rightGrip.x - x) / scale,
      y: (holdingTarget.rightGrip.y - y) / scale,
    };

    const leftArmIK = solveTwoBoneIK(leftShoulder, targetLeftLocal, upperArmLength, forearmLength, false);
    const rightArmIK = solveTwoBoneIK(rightShoulder, targetRightLocal, upperArmLength, forearmLength, true);

    leftElbow = leftArmIK.joint;
    leftHand = leftArmIK.reachedTarget;
    rightElbow = rightArmIK.joint;
    rightHand = rightArmIK.reachedTarget;
  } else if (pose === "holdingObject") {
    leftHand = { x: -50, y: -130 };
    rightHand = { x: 50, y: -130 };
    leftElbow = { x: -105, y: -180 };
    rightElbow = { x: 105, y: -180 };
  } else if (pose === "sittingBehindDesk") {
    leftHand = { x: -70, y: -60 };
    rightHand = { x: 70, y: -60 };
    leftElbow = { x: -100, y: -150 };
    rightElbow = { x: 100, y: -150 };
  } else if (pose === "pointing" && pointingTarget) {
    const targetLocal: Point2D = {
      x: (pointingTarget.x - x) / scale,
      y: (pointingTarget.y - y) / scale,
    };
    const pointIK = solveTwoBoneIK(rightShoulder, targetLocal, upperArmLength, forearmLength, true);
    rightElbow = pointIK.joint;
    rightHand = pointIK.reachedTarget;
  }

  const leftUpperArmAngle = calculateSegmentAngle(leftShoulder, leftElbow, "downwards");
  const leftLowerArmAngle = calculateSegmentAngle(leftElbow, leftHand, "downwards");
  const leftHandAngle = leftLowerArmAngle;

  const rightUpperArmAngle = calculateSegmentAngle(rightShoulder, rightElbow, "downwards");
  const rightLowerArmAngle = calculateSegmentAngle(rightElbow, rightHand, "downwards");
  const rightHandAngle = rightLowerArmAngle;

  // 2. TÍNH TOÁN CHÂN (Tư thế đứng thẳng tự nhiên chữ V nhẹ: mở góc nhẹ)
  let leftKnee: Point2D = { x: -35, y: thighLength };
  let rightKnee: Point2D = { x: 35, y: thighLength };
  let leftFoot: Point2D = { x: -50, y: thighLength + calfLength };
  let rightFoot: Point2D = { x: 50, y: thighLength + calfLength };

  if (pose === "walking") {
    const walkData = calculateWalkCycle(hip, walkCycleProgress);
    leftKnee = walkData.leftKnee;
    rightKnee = walkData.rightKnee;
    leftFoot = walkData.leftFoot;
    rightFoot = walkData.rightFoot;
  } else if (pose === "sittingBehindDesk") {
    leftKnee = { x: -35, y: 45 };
    rightKnee = { x: 35, y: 45 };
    leftFoot = { x: -35, y: 190 };
    rightFoot = { x: 35, y: 190 };
  }

  const leftThighAngle = calculateSegmentAngle(leftHipJoint, leftKnee, "downwards");
  const leftCalfAngle = calculateSegmentAngle(leftKnee, leftFoot, "downwards");
  const leftFootAngle = 0;

  const rightThighAngle = calculateSegmentAngle(rightHipJoint, rightKnee, "downwards");
  const rightCalfAngle = calculateSegmentAngle(rightKnee, rightFoot, "downwards");
  const rightFootAngle = 0;

  React.useEffect(() => {
    if (onAnchorsComputed) {
      onAnchorsComputed({
        headCenter: { x: x + headCenter.x * scale, y: y + headCenter.y * scale },
        mouth: { x: x + headCenter.x * scale, y: y + (headCenter.y + 35) * scale },
        neck: { x: x + neck.x * scale, y: y + neck.y * scale },
        hip: { x: x + hip.x * scale, y: y + hip.y * scale },
        leftShoulder: { x: x + leftShoulder.x * scale, y: y + leftShoulder.y * scale },
        rightShoulder: { x: x + rightShoulder.x * scale, y: y + rightShoulder.y * scale },
        leftElbow: { x: x + leftElbow.x * scale, y: y + leftElbow.y * scale },
        rightElbow: { x: x + rightElbow.x * scale, y: y + rightElbow.y * scale },
        leftHand: { x: x + leftHand.x * scale, y: y + leftHand.y * scale },
        rightHand: { x: x + rightHand.x * scale, y: y + rightHand.y * scale },
        leftHip: { x: x + leftHipJoint.x * scale, y: y },
        rightHip: { x: x + rightHipJoint.x * scale, y: y },
        leftKnee: { x: x + leftKnee.x * scale, y: y + leftKnee.y * scale },
        rightKnee: { x: x + rightKnee.x * scale, y: y + rightKnee.y * scale },
        leftFoot: { x: x + leftFoot.x * scale, y: y + leftFoot.y * scale },
        rightFoot: { x: x + rightFoot.x * scale, y: y + rightFoot.y * scale },
      });
    }
  }, [x, y, scale, pose, holdingTarget, pointingTarget, walkCycleProgress, effectiveSpineLength]);

  const flipTransform = facing === "left" ? "scale(-1, 1)" : "";

  return (
    <g
      id="stickman-rig-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale}) ${flipTransform}`}
      data-character-pose={pose}
    >
      {/* =========================================================================
          LAYER A: CHÂN (LEGS & FEET)
         ========================================================================= */}
      {(renderPart === "all" || renderPart === "legsOnly") && pose !== "sittingBehindDesk" && (
        <g id="layer-character-legs">
          {/* CHÂN TRÁI */}
          <g id="bone-left-thigh" transform={`translate(${leftHipJoint.x}, ${leftHipJoint.y}) rotate(${leftThighAngle})`}>
            {parts?.leftThigh ? parts.leftThigh : (
              <line x1={0} y1={0} x2={0} y2={thighLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-left-calf" transform={`translate(${leftKnee.x}, ${leftKnee.y}) rotate(${leftCalfAngle})`}>
            {parts?.leftCalf ? parts.leftCalf : (
              <line x1={0} y1={0} x2={0} y2={calfLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-left-foot" transform={`translate(${leftFoot.x}, ${leftFoot.y}) rotate(${leftFootAngle})`}>
            {parts?.leftFoot ? parts.leftFoot : (
              <line x1={0} y1={0} x2={-30} y2={0} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          {/* CHÂN PHẢI */}
          <g id="bone-right-thigh" transform={`translate(${rightHipJoint.x}, ${rightHipJoint.y}) rotate(${rightThighAngle})`}>
            {parts?.rightThigh ? parts.rightThigh : (
              <line x1={0} y1={0} x2={0} y2={thighLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-right-calf" transform={`translate(${rightKnee.x}, ${rightKnee.y}) rotate(${rightCalfAngle})`}>
            {parts?.rightCalf ? parts.rightCalf : (
              <line x1={0} y1={0} x2={0} y2={calfLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-right-foot" transform={`translate(${rightFoot.x}, ${rightFoot.y}) rotate(${rightFootAngle})`}>
            {parts?.rightFoot ? parts.rightFoot : (
              <line x1={0} y1={0} x2={30} y2={0} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>
        </g>
      )}

      {/* =========================================================================
          LAYER B: THÂN & ĐẦU (TORSO & HEAD)
         ========================================================================= */}
      {(renderPart === "all" || renderPart === "bodyOnly") && (
        <g id="layer-character-torso-head">
          <g id="bone-torso" transform={`translate(0, 0)`}>
            {parts?.torso ? parts.torso : (
              <line x1={0} y1={0} x2={0} y2={-effectiveSpineLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-head" transform={`translate(${headCenter.x}, ${headCenter.y})`}>
            {parts?.head ? parts.head : (
              <g id="default-stickman-head">
                <circle cx={0} cy={0} r={headRadius} fill="#FFFFFF" stroke="#141414" strokeWidth={14} />
                <FacialExpressions
                  headRadius={headRadius}
                  eyes={state.eyes}
                  eyebrows={state.eyebrows}
                  mouth={state.mouth}
                  pupilGaze={state.pupilGaze}
                  blush={state.blush}
                  sweatDrop={state.sweatDrop}
                />
              </g>
            )}
          </g>
        </g>
      )}

      {/* =========================================================================
          LAYER C: TAY VÀ BÀN TAY (ARMS & HANDS - ĐƯỢC IK TỰ ĐỘNG XOAY)
         ========================================================================= */}
      {(renderPart === "all" || renderPart === "armsOnly") && (
        <g id="layer-character-arms">
          {/* TAY TRÁI */}
          <g id="bone-left-upper-arm" transform={`translate(${leftShoulder.x}, ${leftShoulder.y}) rotate(${leftUpperArmAngle})`}>
            {parts?.leftUpperArm ? parts.leftUpperArm : (
              <line x1={0} y1={0} x2={0} y2={upperArmLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-left-lower-arm" transform={`translate(${leftElbow.x}, ${leftElbow.y}) rotate(${leftLowerArmAngle})`}>
            {parts?.leftLowerArm ? parts.leftLowerArm : (
              <line x1={0} y1={0} x2={0} y2={forearmLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-left-hand" transform={`translate(${leftHand.x}, ${leftHand.y}) rotate(${leftHandAngle})`}>
            {parts?.leftHand ? parts.leftHand : (
              <circle cx={0} cy={0} r={10} fill="#141414" />
            )}
          </g>

          {/* TAY PHẢI */}
          <g id="bone-right-upper-arm" transform={`translate(${rightShoulder.x}, ${rightShoulder.y}) rotate(${rightUpperArmAngle})`}>
            {parts?.rightUpperArm ? parts.rightUpperArm : (
              <line x1={0} y1={0} x2={0} y2={upperArmLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-right-lower-arm" transform={`translate(${rightElbow.x}, ${rightElbow.y}) rotate(${rightLowerArmAngle})`}>
            {parts?.rightLowerArm ? parts.rightLowerArm : (
              <line x1={0} y1={0} x2={0} y2={forearmLength} stroke="#141414" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>

          <g id="bone-right-hand" transform={`translate(${rightHand.x}, ${rightHand.y}) rotate(${rightHandAngle})`}>
            {parts?.rightHand ? parts.rightHand : (
              <circle cx={0} cy={0} r={10} fill="#141414" />
            )}
          </g>
        </g>
      )}
    </g>
  );
};
