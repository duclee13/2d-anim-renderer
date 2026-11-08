import React from "react";
import { EyeExpression, EyebrowExpression, MouthExpression, Point2D } from "../../types/character";

interface FacialExpressionsProps {
  headRadius: number;
  facing?: "left" | "right";
  eyes?: EyeExpression;
  eyebrows?: EyebrowExpression;
  mouth?: MouthExpression;
  pupilGaze?: Point2D;
  blush?: boolean;
  sweatDrop?: boolean;
  strokeColor?: string;
}

export const FacialExpressions: React.FC<FacialExpressionsProps> = ({
  headRadius = 90,
  facing = "right",
  eyes = "neutral",
  eyebrows = "neutral",
  mouth = "smile",
  pupilGaze = { x: 0, y: 0 },
  blush = false,
  sweatDrop = false,
  strokeColor = "#141414",
}) => {
  // Eye geometry (2K Proportions: tối giản, con ngươi là 1 chấm tròn di chuyển)
  const eyeRadius = 16;
  const pupilRadius = 6;
  const eyeDistance = 38;
  const eyeY = -12;

  // Lông mày: 1 nét thẳng đơn giản duy nhất, dịch xuống một chút sát mắt
  const browY = eyeY - 20;

  // Pupil offset from gaze (xét hướng quay mặt facing để con ngươi luôn nhìn đúng hướng)
  const maxGazeOffset = 8;
  const flipSign = facing === "left" ? -1 : 1;
  const gazeX = (pupilGaze.x || 0) * maxGazeOffset * flipSign;
  const gazeY = (pupilGaze.y || 0) * maxGazeOffset;

  const leftEyeCenter = { x: -eyeDistance + gazeX, y: eyeY + gazeY };
  const rightEyeCenter = { x: eyeDistance + gazeX, y: eyeY + gazeY };

  // 1 Lông mày duy nhất (nét thẳng đơn giản, đặt tự nhiên trên mắt chính theo hướng nhìn)
  const isRightFacing = facing !== "left";
  const browX1 = isRightFacing ? eyeDistance - 15 : -eyeDistance - 17;
  const browX2 = isRightFacing ? eyeDistance + 17 : -eyeDistance + 15;

  return (
    <g className="stickman-face">
      {/* Blush cheeks */}
      {blush && (
        <g opacity={0.65}>
          <ellipse cx={-eyeDistance - 10} cy={eyeY + 36} rx={16} ry={9} fill="#FF8BA7" />
          <ellipse cx={eyeDistance + 10} cy={eyeY + 36} rx={16} ry={9} fill="#FF8BA7" />
        </g>
      )}

      {/* 1 LÔNG MÀY DUY NHẤT (Nét thẳng đơn giản trên mắt chính, không nối cầu giữa 2 mắt) */}
      <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {eyebrows === "neutral" && (
          <line x1={browX1} y1={browY} x2={browX2} y2={browY} />
        )}
        {eyebrows === "raised" && (
          <line x1={browX1} y1={browY - 10} x2={browX2} y2={browY - 10} />
        )}
        {eyebrows === "inquisitive" && (
          <line x1={browX1} y1={browY + 3} x2={browX2} y2={browY - 7} />
        )}
        {eyebrows === "worried" && (
          <line x1={browX1} y1={browY - 7} x2={browX2} y2={browY + 3} />
        )}
        {eyebrows === "furrowed" && (
          <line x1={browX1} y1={browY + 5} x2={browX2} y2={browY + 5} />
        )}
      </g>

      {/* Eyes */}
      {eyes === "closed" ? (
        <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <line x1={-eyeDistance - 14} y1={eyeY} x2={-eyeDistance + 14} y2={eyeY} />
          <line x1={eyeDistance - 14} y1={eyeY} x2={eyeDistance + 14} y2={eyeY} />
        </g>
      ) : eyes === "happy" ? (
        <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M ${-eyeDistance - 14} ${eyeY + 6} Q ${-eyeDistance} ${eyeY - 8} ${-eyeDistance + 14} ${eyeY + 6}`} />
          <path d={`M ${eyeDistance - 14} ${eyeY + 6} Q ${eyeDistance} ${eyeY - 8} ${eyeDistance + 14} ${eyeY + 6}`} />
        </g>
      ) : (
        <g>
          {/* Tròng mắt trắng tối giản */}
          <circle cx={-eyeDistance} cy={eyeY} r={eyeRadius} fill="#FFFFFF" stroke={strokeColor} strokeWidth={5} />
          <circle cx={eyeDistance} cy={eyeY} r={eyeRadius} fill="#FFFFFF" stroke={strokeColor} strokeWidth={5} />

          {/* Con ngươi: 1 chấm tròn đen đơn giản di chuyển */}
          <circle cx={leftEyeCenter.x} cy={leftEyeCenter.y} r={pupilRadius} fill={strokeColor} />
          <circle cx={rightEyeCenter.x} cy={rightEyeCenter.y} r={pupilRadius} fill={strokeColor} />
        </g>
      )}

      {/* Mouth */}
      <g stroke={strokeColor} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {mouth === "smile" && (
          <path d="M -24 38 Q 0 62 24 38" />
        )}
        {mouth === "circleOpen" && (
          <circle cx={0} cy={44} r={14} fill={strokeColor} />
        )}
        {mouth === "line" && (
          <line x1={-22} y1={44} x2={22} y2={44} />
        )}
        {mouth === "talking" && (
          <path d="M -22 36 Q 0 66 22 36 Z" fill="#881337" strokeWidth={7} />
        )}
        {mouth === "gasp" && (
          <ellipse cx={0} cy={46} rx={18} ry={26} fill="#141414" />
        )}
      </g>

      {/* Sweat drop for nervous or funny moment */}
      {sweatDrop && (
        <path
          d={`M ${headRadius - 16} ${-headRadius / 2} C ${headRadius - 6} ${-headRadius / 2 - 14}, ${headRadius + 8} ${-headRadius / 2}, ${headRadius - 4} ${-headRadius / 2 + 18} C ${headRadius - 12} ${-headRadius / 2 + 10}, ${headRadius - 20} ${-headRadius / 2 - 4}, ${headRadius - 16} ${-headRadius / 2} Z`}
          fill="#4FC3F7"
          stroke={strokeColor}
          strokeWidth={4}
        />
      )}
    </g>
  );
};
