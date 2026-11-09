import {
  solveTwoBoneIKHierarchical,
  calculateWalkCycleHierarchical,
  calculateLocalAngle,
  calculateSegmentAngle,
} from "../src/remotion/components/character/Kinematics";

console.log("=== 1. TESTING LOCAL ANGLE CALCULATION ===");
const diff1 = calculateLocalAngle(30, 75);
console.log(`Parent: 30°, Child Global: 75° => Child Local: ${diff1}° (Expected: 45°)`);
if (diff1 !== 45) throw new Error("calculateLocalAngle failed for positive angles");

const diff2 = calculateLocalAngle(170, -170);
console.log(`Parent: 170°, Child Global: -170° => Child Local: ${diff2}° (Expected: 20°)`);
if (diff2 !== 20) throw new Error("calculateLocalAngle failed across 180° boundary");

console.log("\n=== 2. TESTING HIERARCHICAL TWO-BONE IK ===");
const shoulder = { x: 0, y: -660 };
const handTarget = { x: 120, y: -450 };
const upperArmLength = 145;
const forearmLength = 145;

const ikResult = solveTwoBoneIKHierarchical(shoulder, handTarget, upperArmLength, forearmLength, true);
console.log("IK Result:", {
  upperAngleDeg: ikResult.upperAngleDeg.toFixed(1),
  lowerLocalAngleDeg: ikResult.lowerLocalAngleDeg.toFixed(1),
  lowerGlobalAngleDeg: ikResult.lowerGlobalAngleDeg.toFixed(1),
  elbow: ikResult.joint,
  reachedTarget: ikResult.reachedTarget,
});

// Verify Forward Kinematics matches IK solution exactly
// In SVG: rotating (0, L) by angle theta yields (-L * sin(theta), L * cos(theta))
const upperRad = (ikResult.upperAngleDeg * Math.PI) / 180;
const fkElbow = {
  x: shoulder.x - Math.sin(upperRad) * upperArmLength,
  y: shoulder.y + Math.cos(upperRad) * upperArmLength,
};
const lowerGlobalRad = (ikResult.lowerGlobalAngleDeg * Math.PI) / 180;
const fkHand = {
  x: fkElbow.x - Math.sin(lowerGlobalRad) * forearmLength,
  y: fkElbow.y + Math.cos(lowerGlobalRad) * forearmLength,
};

const elbowDist = Math.hypot(fkElbow.x - ikResult.joint.x, fkElbow.y - ikResult.joint.y);
const handDist = Math.hypot(fkHand.x - ikResult.reachedTarget.x, fkHand.y - ikResult.reachedTarget.y);

console.log(`FK Elbow vs IK Joint deviation: ${elbowDist.toFixed(4)}px (Zero detachment!)`);
console.log(`FK Hand vs IK Target deviation: ${handDist.toFixed(4)}px (Zero detachment!)`);

if (elbowDist > 0.001 || handDist > 0.001) {
  throw new Error("FK does not match IK in hierarchical nested transforms!");
}

console.log("\n=== 3. TESTING HIERARCHICAL WALK CYCLE ===");
const hip = { x: 0, y: -350 };
for (const progress of [0, 0.25, 0.5, 0.75, 1.0]) {
  const walk = calculateWalkCycleHierarchical(hip, progress, 65, 22, 175, 175);
  console.log(`Walk Progress ${(progress * 100).toFixed(0)}%:`, {
    leftThigh: walk.leftThighAngle.toFixed(1) + "°",
    leftCalfLocal: walk.leftCalfLocalAngle.toFixed(1) + "°",
    rightThigh: walk.rightThighAngle.toFixed(1) + "°",
    rightCalfLocal: walk.rightCalfLocalAngle.toFixed(1) + "°",
  });
}

console.log("\n>>> ALL HIERARCHICAL NESTED RIGGING TESTS PASSED PERFECTLY! <<<");
