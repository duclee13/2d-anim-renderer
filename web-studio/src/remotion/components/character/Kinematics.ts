import { Point2D } from "../../types/character";

/**
 * Calculates 2-bone Inverse Kinematics (IK) for stickman arms and legs.
 * Given root (shoulder/hip) and target (hand/foot), finds intermediate joint (elbow/knee).
 *
 * @param root Joint start position (Shoulder or Hip)
 * @param target End effector position (Hand or Foot)
 * @param length1 Upper segment length
 * @param length2 Lower segment length
 * @param bendPositive Direction of bend (true = outwards/downwards, false = inwards/upwards)
 */
export function solveTwoBoneIK(
  root: Point2D,
  target: Point2D,
  length1: number,
  length2: number,
  bendPositive: boolean = true
): { joint: Point2D; reachedTarget: Point2D } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const distance = Math.hypot(dx, dy);

  // Maximum reach limit
  const maxReach = length1 + length2;
  const minReach = Math.abs(length1 - length2);

  // Clamp distance if target is out of reach
  const clampedDist = Math.max(minReach + 0.1, Math.min(distance, maxReach - 0.1));

  // Base angle from root to target
  const baseAngle = Math.atan2(dy, dx);

  // Law of Cosines to find angle at root
  // c^2 = a^2 + b^2 - 2ab * cos(C)
  const cosAngle1 =
    (length1 * length1 + clampedDist * clampedDist - length2 * length2) /
    (2 * length1 * clampedDist);
  const clampedCos1 = Math.max(-1, Math.min(1, cosAngle1));
  const angle1 = Math.acos(clampedCos1);

  // Determine actual angle of upper segment
  const jointAngle = bendPositive ? baseAngle + angle1 : baseAngle - angle1;

  const joint: Point2D = {
    x: root.x + Math.cos(jointAngle) * length1,
    y: root.y + Math.sin(jointAngle) * length1,
  };

  // Reached target position (handles clamped distance if out of reach)
  let reachedTarget: Point2D = target;
  if (distance > maxReach) {
    reachedTarget = {
      x: root.x + (dx / distance) * (maxReach - 0.1),
      y: root.y + (dy / distance) * (maxReach - 0.1),
    };
  }

  return { joint, reachedTarget };
}

/**
 * Procedural walk cycle calculator returning leg angles and foot positions.
 * Connected topology: Both legs branch from the exact same hip pivot (0, 0).
 */
export function calculateWalkCycle(
  hip: Point2D,
  progress: number,
  strideWidth: number = 65,
  stepHeight: number = 22
): {
  leftFoot: Point2D;
  rightFoot: Point2D;
  leftKnee: Point2D;
  rightKnee: Point2D;
} {
  const phase = (progress * Math.PI * 2) % (Math.PI * 2);
  const legLength = 350;
  const halfLeg = legLength / 2;

  // Chu kỳ bước đi tự nhiên 2 pha (Không moonwalk):
  // Pha vung chân (Swing): Chân nhấc lên không trung (sin > 0) và vung từ sau ra trước (-cos tăng từ -strideWidth sang +strideWidth)
  // Pha chống chân (Stance): Chân chạm đất (y = 0) và đạp lùi từ trước về sau (-cos giảm từ +strideWidth sang -strideWidth)
  const leftPhase = phase;
  const leftYOffset = Math.max(0, Math.sin(leftPhase)) * stepHeight;
  const leftXOffset = -Math.cos(leftPhase) * strideWidth;

  // Chân phải lệch pha 180 độ (PI radian)
  const rightPhase = (phase + Math.PI) % (Math.PI * 2);
  const rightYOffset = Math.max(0, Math.sin(rightPhase)) * stepHeight;
  const rightXOffset = -Math.cos(rightPhase) * strideWidth;

  const leftFootTarget: Point2D = {
    x: hip.x + leftXOffset,
    y: hip.y + legLength - leftYOffset,
  };

  const rightFootTarget: Point2D = {
    x: hip.x + rightXOffset,
    y: hip.y + legLength - rightYOffset,
  };

  // Connected topology: both leg IK roots converge at single hip pivot
  const leftIK = solveTwoBoneIK(
    hip,
    leftFootTarget,
    halfLeg,
    halfLeg,
    false
  );

  const rightIK = solveTwoBoneIK(
    hip,
    rightFootTarget,
    halfLeg,
    halfLeg,
    false
  );

  return {
    leftFoot: leftIK.reachedTarget,
    rightFoot: rightIK.reachedTarget,
    leftKnee: leftIK.joint,
    rightKnee: rightIK.joint,
  };
}

/**
 * Calculates the orientation angle (in degrees) of a bone segment from start joint to end joint.
 * @param start Pivot point (e.g. Shoulder or Hip)
 * @param end End point (e.g. Elbow or Knee)
 * @param defaultOrientation 'downwards' (0 deg is pointing along +Y, standard for character limbs) or 'rightwards' (0 deg is +X)
 */
export function calculateSegmentAngle(
  start: Point2D,
  end: Point2D,
  defaultOrientation: "downwards" | "rightwards" = "downwards"
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  return defaultOrientation === "downwards" ? angleDeg - 90 : angleDeg;
}

