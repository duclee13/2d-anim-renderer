import React from "react";
import { StickmanState, Point2D, StickmanAnchors } from "../../types/character";
import {
  solveTwoBoneIKHierarchical,
  calculateWalkCycleHierarchical,
  calculateLocalAngle,
} from "./Kinematics";
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
  breathScaleY?: number;
  onAnchorsComputed?: (anchors: StickmanAnchors) => void;
}

/**
 * StickmanRig: Khung Xương Phả Hệ Cha - Con Độc Lập 2K (Hierarchical Nested Rigging)
 * 
 * NGUYÊN TẮC BẤT DI BẤT DỊCH:
 * 1. Mọi bộ phận nối tiếp nhau PHẢI được lồng trực tiếp vào trong thẻ <g> của bộ phận cha.
 *    - Khớp Vai -> Bắp tay -> Khớp Cùi chỏ (Elbow) -> Cẳng tay -> Khớp Cổ tay -> Bàn tay.
 *    - Khớp Hông -> Đùi -> Khớp Đầu gối (Knee) -> Cẳng chân -> Khớp Cổ chân -> Bàn chân.
 * 2. Tuyệt đối không dùng tọa độ rời rạc (KHÔNG BAO GIỜ ĐỨT KHỚP).
 * 3. Hỗ trợ thay thế từng bộ phận độc lập qua props `parts` (Custom Skins / Assets).
 */
export const StickmanRig: React.FC<StickmanRigProps> = ({
  state,
  renderPart = "all",
  parts,
  breathScale = 1.0,
  breathScaleY = 1.0,
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
    limbAngles,
  } = state;

  // Kích thước chuẩn xương que 2K (Canvas 2560x1440, tổng chiều cao ~750px - 850px)
  const spineLength = 310;
  const upperArmLength = 145;
  const forearmLength = 145;
  const thighLength = 175;
  const calfLength = 175;
  const headRadius = 95;

  // Hơi thở tác động nhẹ lên chiều dài sống lưng
  const effectiveSpineLength = spineLength * breathScale;

  // =========================================================================
  // GỐC TOÀN CỤC KHỚP XƯƠNG (CONNECTED TOPOLOGY - HỘI TỤ 100% VÀO TRỤC THÂN)
  // =========================================================================
  const hip: Point2D = { x: 0, y: -350 };
  const neck: Point2D = { x: 0, y: -350 - effectiveSpineLength };
  const headCenter: Point2D = { x: 0, y: neck.y - headRadius };

  // Cả hai vai hội tụ chính xác tại 1 điểm duy nhất trên đốt sống cổ
  const leftShoulder: Point2D = { x: 0, y: neck.y };
  const rightShoulder: Point2D = { x: 0, y: neck.y };

  // Cả hai hông hội tụ chính xác tại 1 điểm duy nhất tại đáy cột sống
  const leftHipJoint: Point2D = { x: 0, y: hip.y };
  const rightHipJoint: Point2D = { x: 0, y: hip.y };

  const flipSign = facing === "left" ? -1 : 1;

  // Trọng số bước đi và trạng thái đang bước đi
  const weight = state.walkWeight !== undefined ? state.walkWeight : 1.0;
  const isWalking = (pose === "walking" || walkCycleProgress > 0) && weight > 0.02;

  // =========================================================================
  // 1. TÍNH TOÁN GÓC XOAY KHỚP TAY (HIERARCHICAL ARM ANGLES)
  // Gồm: upperArmAngle (Góc toàn cục) và lowerArmLocalAngle (Góc cục bộ bên trong bắp tay)
  // =========================================================================
  // Góc nghỉ tự nhiên khi đứng: Hai tay buông xuôi mềm mại, hơi gập nhẹ ở cùi chỏ
  let leftUpperArmAngle = -14;
  let leftLowerArmLocalAngle = -12;
  let leftHandLocalAngle = 0;

  let rightUpperArmAngle = -18;
  let rightLowerArmLocalAngle = -16;
  let rightHandLocalAngle = 0;

  if (isWalking && pose !== "holdingObject" && !holdingTarget) {
    // Vung tay tự nhiên đối xứng với bước chân khi thực sự di chuyển
    const armSwing = Math.sin(walkCycleProgress * Math.PI * 2) * (32 * weight);
    leftUpperArmAngle = -14 - armSwing;
    leftLowerArmLocalAngle = -12 + Math.abs(armSwing) * 0.25;

    rightUpperArmAngle = -18 + armSwing;
    rightLowerArmLocalAngle = -16 + Math.abs(armSwing) * 0.25;
  } else if (pose === "waving") {
    // Tay trái ở tư thế nghỉ tự nhiên
    leftUpperArmAngle = -14;
    leftLowerArmLocalAngle = -12;

    // Tay phải giơ cao vẫy tay nhịp nhàng qua khớp cùi chỏ
    rightUpperArmAngle = -135; // Giơ xéo lên trên về phía trước
    const waveSway = Math.sin((walkCycleProgress || 0) * Math.PI * 8) * 25;
    rightLowerArmLocalAngle = -35 + waveSway;
    rightHandLocalAngle = 12;
  } else if (pose === "holdingObject" && holdingTarget) {
    const targetLeftLocal: Point2D = {
      x: ((holdingTarget.leftGrip.x - x) / scale) * flipSign,
      y: (holdingTarget.leftGrip.y - y) / scale,
    };
    const targetRightLocal: Point2D = {
      x: ((holdingTarget.rightGrip.x - x) / scale) * flipSign,
      y: (holdingTarget.rightGrip.y - y) / scale,
    };

    const leftIK = solveTwoBoneIKHierarchical(leftShoulder, targetLeftLocal, upperArmLength, forearmLength, false);
    const rightIK = solveTwoBoneIKHierarchical(rightShoulder, targetRightLocal, upperArmLength, forearmLength, true);

    leftUpperArmAngle = leftIK.upperAngleDeg;
    leftLowerArmLocalAngle = leftIK.lowerLocalAngleDeg;
    rightUpperArmAngle = rightIK.upperAngleDeg;
    rightLowerArmLocalAngle = rightIK.lowerLocalAngleDeg;
  } else if (pose === "holdingObject") {
    // Giơ hai tay ra phía trước ôm/cầm đồ vật tự nhiên
    leftUpperArmAngle = -35;
    leftLowerArmLocalAngle = -50;
    rightUpperArmAngle = -40;
    rightLowerArmLocalAngle = -45;
  } else if (pose === "sittingBehindDesk") {
    // Hai tay xuôi tự nhiên từ vai và đặt nhẹ bàn tay lên mặt bàn phía trước
    leftUpperArmAngle = -28;
    leftLowerArmLocalAngle = -42;
    rightUpperArmAngle = -32;
    rightLowerArmLocalAngle = -38;
  } else if (pose === "pointing" && pointingTarget) {
    const targetLocal: Point2D = {
      x: ((pointingTarget.x - x) / scale) * flipSign,
      y: (pointingTarget.y - y) / scale,
    };
    const pointIK = solveTwoBoneIKHierarchical(rightShoulder, targetLocal, upperArmLength, forearmLength, true);
    rightUpperArmAngle = pointIK.upperAngleDeg;
    rightLowerArmLocalAngle = pointIK.lowerLocalAngleDeg;

    leftUpperArmAngle = -14;
    leftLowerArmLocalAngle = -12;
  } else if (pose === "pointing") {
    // Chỉ tay dứt khoát về phía trước/trên
    rightUpperArmAngle = -70;
    rightLowerArmLocalAngle = -8;
    leftUpperArmAngle = -14;
    leftLowerArmLocalAngle = -12;
  } else if (pose === "shrugging") {
    // Nhún vai biểu cảm: Hai cùi chỏ khép sát sườn, hai cẳng tay ngửa lên phía trước
    leftUpperArmAngle = -18;
    leftLowerArmLocalAngle = -65;
    rightUpperArmAngle = -22;
    rightLowerArmLocalAngle = -70;
  }

  // Áp dụng ghi đè góc chi tiết (nếu có từ Animation Keyframes)
  if (limbAngles?.leftUpperArm !== undefined) leftUpperArmAngle = limbAngles.leftUpperArm;
  if (limbAngles?.leftLowerArm !== undefined) leftLowerArmLocalAngle = limbAngles.leftLowerArm;
  if (limbAngles?.leftHand !== undefined) leftHandLocalAngle = limbAngles.leftHand;
  if (limbAngles?.rightUpperArm !== undefined) rightUpperArmAngle = limbAngles.rightUpperArm;
  if (limbAngles?.rightLowerArm !== undefined) rightLowerArmLocalAngle = limbAngles.rightLowerArm;
  if (limbAngles?.rightHand !== undefined) rightHandLocalAngle = limbAngles.rightHand;

  // =========================================================================
  // 2. TÍNH TOÁN GÓC XOAY KHỚP CHÂN (HIERARCHICAL LEG ANGLES)
  // Gồm: thighAngle (Toàn cục), calfLocalAngle (Cục bộ đùi) và footLocalAngle (Cục bộ cẳng chân)
  // =========================================================================
  // Đứng thẳng vững chãi, hai chân song song chạm đất phẳng 100%
  let leftThighAngle = -2;
  let leftCalfLocalAngle = 2;
  let leftFootLocalAngle = 0;

  let rightThighAngle = 1;
  let rightCalfLocalAngle = -1;
  let rightFootLocalAngle = 0;

  if (isWalking) {
    const stride = 65 * weight;
    const stepH = 22 * weight;
    const walkData = calculateWalkCycleHierarchical(
      hip,
      walkCycleProgress,
      stride,
      stepH,
      thighLength,
      calfLength
    );
    leftThighAngle = walkData.leftThighAngle;
    leftCalfLocalAngle = walkData.leftCalfLocalAngle;
    leftFootLocalAngle = walkData.leftFootLocalAngle;
    rightThighAngle = walkData.rightThighAngle;
    rightCalfLocalAngle = walkData.rightCalfLocalAngle;
    rightFootLocalAngle = walkData.rightFootLocalAngle;
  } else if (pose === "sittingBehindDesk") {
    // Cả hai đùi hướng về phía trước dưới bàn, hai cẳng chân vuông góc xuống đất
    leftThighAngle = -80;
    leftCalfLocalAngle = 80;
    leftFootLocalAngle = 0;
    rightThighAngle = -82;
    rightCalfLocalAngle = 82;
    rightFootLocalAngle = 0;
  }

  if (limbAngles?.leftThigh !== undefined) leftThighAngle = limbAngles.leftThigh;
  if (limbAngles?.leftCalf !== undefined) leftCalfLocalAngle = limbAngles.leftCalf;
  if (limbAngles?.leftFoot !== undefined) leftFootLocalAngle = limbAngles.leftFoot;
  if (limbAngles?.rightThigh !== undefined) rightThighAngle = limbAngles.rightThigh;
  if (limbAngles?.rightCalf !== undefined) rightCalfLocalAngle = limbAngles.rightCalf;
  if (limbAngles?.rightFoot !== undefined) rightFootLocalAngle = limbAngles.rightFoot;

  const headAngle = limbAngles?.head ?? 0;

  // =========================================================================
  // 3. TÍNH TOÁN TỌA ĐỘ TIÊU ĐIỂM (FORWARD KINEMATICS FOR ANCHORS)
  // Trong hệ tọa độ SVG: Điểm (0, L) quay góc theta sẽ có x = -L * sin(theta), y = L * cos(theta)
  // =========================================================================
  const leftUpperRad = (leftUpperArmAngle * Math.PI) / 180;
  const leftLowerGlobalRad = ((leftUpperArmAngle + leftLowerArmLocalAngle) * Math.PI) / 180;
  const leftElbow: Point2D = {
    x: leftShoulder.x - Math.sin(leftUpperRad) * upperArmLength,
    y: leftShoulder.y + Math.cos(leftUpperRad) * upperArmLength,
  };
  const leftHand: Point2D = {
    x: leftElbow.x - Math.sin(leftLowerGlobalRad) * forearmLength,
    y: leftElbow.y + Math.cos(leftLowerGlobalRad) * forearmLength,
  };

  const rightUpperRad = (rightUpperArmAngle * Math.PI) / 180;
  const rightLowerGlobalRad = ((rightUpperArmAngle + rightLowerArmLocalAngle) * Math.PI) / 180;
  const rightElbow: Point2D = {
    x: rightShoulder.x - Math.sin(rightUpperRad) * upperArmLength,
    y: rightShoulder.y + Math.cos(rightUpperRad) * upperArmLength,
  };
  const rightHand: Point2D = {
    x: rightElbow.x - Math.sin(rightLowerGlobalRad) * forearmLength,
    y: rightElbow.y + Math.cos(rightLowerGlobalRad) * forearmLength,
  };

  const leftThighRad = (leftThighAngle * Math.PI) / 180;
  const leftCalfGlobalRad = ((leftThighAngle + leftCalfLocalAngle) * Math.PI) / 180;
  const leftKnee: Point2D = {
    x: leftHipJoint.x - Math.sin(leftThighRad) * thighLength,
    y: leftHipJoint.y + Math.cos(leftThighRad) * thighLength,
  };
  const leftFoot: Point2D = {
    x: leftKnee.x - Math.sin(leftCalfGlobalRad) * calfLength,
    y: leftKnee.y + Math.cos(leftCalfGlobalRad) * calfLength,
  };

  const rightThighRad = (rightThighAngle * Math.PI) / 180;
  const rightCalfGlobalRad = ((rightThighAngle + rightCalfLocalAngle) * Math.PI) / 180;
  const rightKnee: Point2D = {
    x: rightHipJoint.x - Math.sin(rightThighRad) * thighLength,
    y: rightHipJoint.y + Math.cos(rightThighRad) * thighLength,
  };
  const rightFoot: Point2D = {
    x: rightKnee.x - Math.sin(rightCalfGlobalRad) * calfLength,
    y: rightKnee.y + Math.cos(rightCalfGlobalRad) * calfLength,
  };

  React.useEffect(() => {
    if (onAnchorsComputed) {
      onAnchorsComputed({
        headCenter: { x: x + headCenter.x * scale, y: y + headCenter.y * scale },
        mouth: { x: x + headCenter.x * scale, y: y + (headCenter.y + 35) * scale },
        neck: { x: x + neck.x * scale, y: y + neck.y * scale },
        hip: { x: x + hip.x * scale, y: y + hip.y * scale },
        leftShoulder: { x: x + leftShoulder.x * scale * flipSign, y: y + leftShoulder.y * scale },
        rightShoulder: { x: x + rightShoulder.x * scale * flipSign, y: y + rightShoulder.y * scale },
        leftElbow: { x: x + leftElbow.x * scale * flipSign, y: y + leftElbow.y * scale },
        rightElbow: { x: x + rightElbow.x * scale * flipSign, y: y + rightElbow.y * scale },
        leftHand: { x: x + leftHand.x * scale * flipSign, y: y + leftHand.y * scale },
        rightHand: { x: x + rightHand.x * scale * flipSign, y: y + rightHand.y * scale },
        leftHip: { x: x + leftHipJoint.x * scale * flipSign, y: y + hip.y * scale },
        rightHip: { x: x + rightHipJoint.x * scale * flipSign, y: y + hip.y * scale },
        leftKnee: { x: x + leftKnee.x * scale * flipSign, y: y + leftKnee.y * scale },
        rightKnee: { x: x + rightKnee.x * scale * flipSign, y: y + rightKnee.y * scale },
        leftFoot: { x: x + leftFoot.x * scale * flipSign, y: y + leftFoot.y * scale },
        rightFoot: { x: x + rightFoot.x * scale * flipSign, y: y + rightFoot.y * scale },
      });
    }
  }, [
    x,
    y,
    scale,
    pose,
    holdingTarget,
    pointingTarget,
    walkCycleProgress,
    effectiveSpineLength,
    facing,
    leftUpperArmAngle,
    leftLowerArmLocalAngle,
    rightUpperArmAngle,
    rightLowerArmLocalAngle,
    leftThighAngle,
    leftCalfLocalAngle,
    rightThighAngle,
    rightCalfLocalAngle,
  ]);

  const flipTransform = facing === "left" ? "scale(-1, 1)" : "";
  const isSitting = pose === "sittingBehindDesk";

  return (
    <g
      id="stickman-rig-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale}) ${flipTransform} scale(1, ${breathScaleY})`}
      data-character-pose={pose}
      clipPath={isSitting ? "url(#seated-desk-clip)" : undefined}
    >
      {/* ClipPath cắt phẳng toàn bộ phần dưới mặt bàn khi ngồi làm việc */}
      {isSitting && (
        <defs>
          <clipPath id="seated-desk-clip">
            <rect x={-500} y={-1000} width={1000} height={642} />
          </clipPath>
        </defs>
      )}

      {/* =========================================================================
          LAYER A: CHÂN (HIERARCHICAL NESTED LEGS: HIP -> THIGH -> KNEE -> CALF -> FOOT)
          Ẩn 100% khi ngồi sau bàn
         ========================================================================= */}
      {(renderPart === "all" || renderPart === "legsOnly") && !isSitting && (
        <g id="layer-character-legs">
          {/* CHÂN TRÁI */}
          <g id="left-hip-cluster" transform={`translate(${leftHipJoint.x}, ${leftHipJoint.y})`}>
            {/* Đùi trái: Xoay quanh khớp hông (0, 0) */}
            <g id="bone-left-thigh" transform={`rotate(${leftThighAngle})`}>
              {parts?.leftThigh ? (
                parts.leftThigh
              ) : (
                <g id="default-left-thigh">
                  <circle cx={0} cy={0} r={8} fill="#141414" />
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={thighLength}
                    stroke="#141414"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Khớp đầu gối (Left Knee Joint): Nằm chính xác tại đầu mút đùi (0, thighLength) */}
              <g id="left-knee-cluster" transform={`translate(0, ${thighLength})`}>
                {/* Cẳng chân trái: Xoay cục bộ quanh đầu gối */}
                <g id="bone-left-calf" transform={`rotate(${leftCalfLocalAngle})`}>
                  {parts?.leftCalf ? (
                    parts.leftCalf
                  ) : (
                    <g id="default-left-calf">
                      <circle cx={0} cy={0} r={7.5} fill="#141414" />
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={calfLength}
                        stroke="#141414"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Khớp cổ chân & Bàn chân (Left Foot Joint): Nằm tại mút cẳng chân (0, calfLength) */}
                  <g id="left-foot-cluster" transform={`translate(0, ${calfLength})`}>
                    <g id="bone-left-foot" transform={`rotate(${leftFootLocalAngle})`}>
                      {parts?.leftFoot ? (
                        parts.leftFoot
                      ) : (
                        <g id="default-left-foot">
                          <circle cx={0} cy={0} r={7} fill="#141414" />
                          <line
                            x1={0}
                            y1={0}
                            x2={-28}
                            y2={0}
                            stroke="#141414"
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      )}
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* CHÂN PHẢI */}
          <g id="right-hip-cluster" transform={`translate(${rightHipJoint.x}, ${rightHipJoint.y})`}>
            {/* Đùi phải: Xoay quanh khớp hông (0, 0) */}
            <g id="bone-right-thigh" transform={`rotate(${rightThighAngle})`}>
              {parts?.rightThigh ? (
                parts.rightThigh
              ) : (
                <g id="default-right-thigh">
                  <circle cx={0} cy={0} r={8} fill="#141414" />
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={thighLength}
                    stroke="#141414"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Khớp đầu gối (Right Knee Joint): Nằm chính xác tại đầu mút đùi (0, thighLength) */}
              <g id="right-knee-cluster" transform={`translate(0, ${thighLength})`}>
                {/* Cẳng chân phải: Xoay cục bộ quanh đầu gối */}
                <g id="bone-right-calf" transform={`rotate(${rightCalfLocalAngle})`}>
                  {parts?.rightCalf ? (
                    parts.rightCalf
                  ) : (
                    <g id="default-right-calf">
                      <circle cx={0} cy={0} r={7.5} fill="#141414" />
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={calfLength}
                        stroke="#141414"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Khớp cổ chân & Bàn chân (Right Foot Joint): Nằm tại mút cẳng chân (0, calfLength) */}
                  <g id="right-foot-cluster" transform={`translate(0, ${calfLength})`}>
                    <g id="bone-right-foot" transform={`rotate(${rightFootLocalAngle})`}>
                      {parts?.rightFoot ? (
                        parts.rightFoot
                      ) : (
                        <g id="default-right-foot">
                          <circle cx={0} cy={0} r={7} fill="#141414" />
                          <line
                            x1={0}
                            y1={0}
                            x2={28}
                            y2={0}
                            stroke="#141414"
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      )}
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      )}

      {/* =========================================================================
          LAYER B: THÂN & ĐẦU (TORSO & HEAD - HỘI TỤ ĐỐT SỐNG CỔ)
         ========================================================================= */}
      {(renderPart === "all" || renderPart === "bodyOnly") && (
        <g id="layer-character-torso-head">
          {/* CỘT SỐNG (TORSO) - Nối từ hip (y = -350) lên cổ neck */}
          <g id="bone-torso">
            {parts?.torso ? (
              parts.torso
            ) : (
              <line
                x1={0}
                y1={hip.y}
                x2={0}
                y2={neck.y}
                stroke="#141414"
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>

          {/* ĐẦU & BIỂU CẢM KHUÔN MẶT - Lồng tại đỉnh đốt sống cổ neck (y = neck.y) */}
          <g id="neck-head-cluster" transform={`translate(0, ${neck.y})`}>
            <g id="bone-head" transform={`translate(0, ${-headRadius}) rotate(${headAngle})`}>
              {parts?.head ? (
                parts.head
              ) : (
                <g id="default-stickman-head">
                  <circle cx={0} cy={0} r={headRadius} fill="#FFFFFF" stroke="#141414" strokeWidth={14} />
                  <FacialExpressions
                    headRadius={headRadius}
                    facing={facing}
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
        </g>
      )}

      {/* =========================================================================
          LAYER C: CÁNH TAY (HIERARCHICAL NESTED ARMS: SHOULDER -> UPPER ARM -> ELBOW -> LOWER ARM -> HAND)
         ========================================================================= */}
      {(renderPart === "all" || renderPart === "armsOnly") && (
        <g id="layer-character-arms">
          {/* CÁNH TAY TRÁI (LEFT ARM CLUSTER) */}
          <g id="left-shoulder-cluster" transform={`translate(${leftShoulder.x}, ${leftShoulder.y})`}>
            {/* Bắp tay trái: Xoay quanh góc (0, 0) của vai */}
            <g id="bone-left-upper-arm" transform={`rotate(${leftUpperArmAngle})`}>
              {parts?.leftUpperArm ? (
                parts.leftUpperArm
              ) : (
                <g id="default-left-upper-arm">
                  <circle cx={0} cy={0} r={8} fill="#141414" />
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={upperArmLength}
                    stroke="#141414"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Khớp cùi chỏ (Left Elbow Joint): Nằm ngay tại đầu mút bắp tay (0, upperArmLength) */}
              <g id="left-elbow-cluster" transform={`translate(0, ${upperArmLength})`}>
                {/* Cẳng tay trái: Xoay cục bộ quanh khớp cùi chỏ (0, 0) */}
                <g id="bone-left-lower-arm" transform={`rotate(${leftLowerArmLocalAngle})`}>
                  {parts?.leftLowerArm ? (
                    parts.leftLowerArm
                  ) : (
                    <g id="default-left-lower-arm">
                      <circle cx={0} cy={0} r={7.5} fill="#141414" />
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={forearmLength}
                        stroke="#141414"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Khớp cổ tay & Bàn tay: Nằm tại đầu mút cẳng tay (0, forearmLength) */}
                  <g id="left-hand-cluster" transform={`translate(0, ${forearmLength})`}>
                    <g id="bone-left-hand" transform={`rotate(${leftHandLocalAngle})`}>
                      {parts?.leftHand ? (
                        parts.leftHand
                      ) : (
                        <circle cx={0} cy={2} r={12} fill="#141414" />
                      )}
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* CÁNH TAY PHẢI (RIGHT ARM CLUSTER) */}
          <g id="right-shoulder-cluster" transform={`translate(${rightShoulder.x}, ${rightShoulder.y})`}>
            {/* Bắp tay phải: Xoay quanh góc (0, 0) của vai */}
            <g id="bone-right-upper-arm" transform={`rotate(${rightUpperArmAngle})`}>
              {parts?.rightUpperArm ? (
                parts.rightUpperArm
              ) : (
                <g id="default-right-upper-arm">
                  <circle cx={0} cy={0} r={8} fill="#141414" />
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={upperArmLength}
                    stroke="#141414"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Khớp cùi chỏ (Right Elbow Joint): Nằm ngay tại đầu mút bắp tay (0, upperArmLength) */}
              <g id="right-elbow-cluster" transform={`translate(0, ${upperArmLength})`}>
                {/* Cẳng tay phải: Xoay cục bộ quanh khớp cùi chỏ (0, 0) */}
                <g id="bone-right-lower-arm" transform={`rotate(${rightLowerArmLocalAngle})`}>
                  {parts?.rightLowerArm ? (
                    parts.rightLowerArm
                  ) : (
                    <g id="default-right-lower-arm">
                      <circle cx={0} cy={0} r={7.5} fill="#141414" />
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={forearmLength}
                        stroke="#141414"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Khớp cổ tay & Bàn tay: Nằm tại đầu mút cẳng tay (0, forearmLength) */}
                  <g id="right-hand-cluster" transform={`translate(0, ${forearmLength})`}>
                    <g id="bone-right-hand" transform={`rotate(${rightHandLocalAngle})`}>
                      {parts?.rightHand ? (
                        parts.rightHand
                      ) : (
                        <circle cx={0} cy={2} r={12} fill="#141414" />
                      )}
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      )}
    </g>
  );
};
