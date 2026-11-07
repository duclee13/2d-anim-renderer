import React from "react";
import { EyeExpression, EyebrowExpression, MouthExpression, Point2D } from "../../types/character";

interface FacialExpressionsProps {
  headRadius: number;
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
  eyes = "neutral",
  eyebrows = "neutral",
  mouth = "smile",
  pupilGaze = { x: 0, y: 0 },
  blush = false,
  sweatDrop = false,
  strokeColor = "#141414",
}) => {
  // Eye geometry
  const eyeRadius = 14;
  const pupilRadius = 9;
  const eyeDistance = 32;
  const eyeY = -12;

  // Pupil offset from gaze
  const maxGazeOffset = 4.5;
  const gazeX = (pupilGaze.x || 0) * maxGazeOffset;
  const gazeY = (pupilGaze.y || 0) * maxGazeOffset;

  const leftEyeCenter = { x: -eyeDistance + gazeX, y: eyeY + gazeY };
  const rightEyeCenter = { x: eyeDistance + gazeX, y: eyeY + gazeY };

  return (
    <g className="stickman-face">
      {/* Blush cheeks */}
      {blush && (
        <g opacity={0.6}>
          <ellipse cx={-eyeDistance - 8} cy={eyeY + 28} rx={14} ry={8} fill="#FF8BA7" />
          <ellipse cx={eyeDistance + 8} cy={eyeY + 28} rx={14} ry={8} fill="#FF8BA7" />
        </g>
      )}

      {/* Eyebrows */}
      <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" fill="none">
        {eyebrows === "neutral" && (
          <>
            <path d={`M ${-eyeDistance - 18} ${eyeY - 22} Q ${-eyeDistance} ${eyeY - 26} ${-eyeDistance + 18} ${eyeY - 22}`} />
            <path d={`M ${eyeDistance - 18} ${eyeY - 22} Q ${eyeDistance} ${eyeY - 26} ${eyeDistance + 18} ${eyeY - 22}`} />
          </>
        )}
        {eyebrows === "raised" && (
          <>
            <path d={`M ${-eyeDistance - 18} ${eyeY - 30} Q ${-eyeDistance} ${eyeY - 36} ${-eyeDistance + 18} ${eyeY - 28}`} />
            <path d={`M ${eyeDistance - 18} ${eyeY - 28} Q ${eyeDistance} ${eyeY - 36} ${eyeDistance + 18} ${eyeY - 30}`} />
          </>
        )}
        {eyebrows === "inquisitive" && (
          <>
            <path d={`M ${-eyeDistance - 18} ${eyeY - 24} Q ${-eyeDistance} ${eyeY - 28} ${-eyeDistance + 18} ${eyeY - 22}`} />
            <path d={`M ${eyeDistance - 18} ${eyeY - 34} Q ${eyeDistance} ${eyeY - 40} ${eyeDistance + 18} ${eyeY - 30}`} />
          </>
        )}
        {eyebrows === "worried" && (
          <>
            <path d={`M ${-eyeDistance - 18} ${eyeY - 28} Q ${-eyeDistance} ${eyeY - 22} ${-eyeDistance + 18} ${eyeY - 20}`} />
            <path d={`M ${eyeDistance - 18} ${eyeY - 20} Q ${eyeDistance} ${eyeY - 22} ${eyeDistance + 18} ${eyeY - 28}`} />
          </>
        )}
        {eyebrows === "furrowed" && (
          <>
            <path d={`M ${-eyeDistance - 18} ${eyeY - 20} L ${-eyeDistance + 18} ${eyeY - 27}`} />
            <path d={`M ${eyeDistance - 18} ${eyeY - 27} L ${eyeDistance + 18} ${eyeY - 20}`} />
          </>
        )}
      </g>

      {/* Eyes */}
      {eyes === "closed" ? (
        <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" fill="none">
          <path d={`M ${-eyeDistance - 14} ${eyeY} Q ${-eyeDistance} ${eyeY + 12} ${-eyeDistance + 14} ${eyeY}`} />
          <path d={`M ${eyeDistance - 14} ${eyeY} Q ${eyeDistance} ${eyeY + 12} ${eyeDistance + 14} ${eyeY}`} />
        </g>
      ) : eyes === "happy" ? (
        <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" fill="none">
          <path d={`M ${-eyeDistance - 14} ${eyeY + 6} Q ${-eyeDistance} ${eyeY - 10} ${-eyeDistance + 14} ${eyeY + 6}`} />
          <path d={`M ${eyeDistance - 14} ${eyeY + 6} Q ${eyeDistance} ${eyeY - 10} ${eyeDistance + 14} ${eyeY + 6}`} />
        </g>
      ) : (
        <g>
          {/* Eye whites */}
          <circle cx={-eyeDistance} cy={eyeY} r={eyeRadius} fill="#FFFFFF" stroke={strokeColor} strokeWidth={5} />
          <circle cx={eyeDistance} cy={eyeY} r={eyeRadius} fill="#FFFFFF" stroke={strokeColor} strokeWidth={5} />

          {/* Pupils */}
          <circle cx={leftEyeCenter.x} cy={leftEyeCenter.y} r={pupilRadius} fill={strokeColor} />
          <circle cx={rightEyeCenter.x} cy={rightEyeCenter.y} r={pupilRadius} fill={strokeColor} />

          {/* Specular highlights for life/shine */}
          <circle cx={leftEyeCenter.x - 3} cy={leftEyeCenter.y - 3} r={3} fill="#FFFFFF" />
          <circle cx={rightEyeCenter.x - 3} cy={rightEyeCenter.y - 3} r={3} fill="#FFFFFF" />
        </g>
      )}

      {/* Mouth */}
      <g stroke={strokeColor} strokeWidth={6} strokeLinecap="round" fill="none">
        {mouth === "smile" && (
          <path d="M -18 28 Q 0 46 18 28" />
        )}
        {mouth === "circleOpen" && (
          <circle cx={0} cy={34} r={10} fill={strokeColor} />
        )}
        {mouth === "line" && (
          <line x1={-16} y1={34} x2={16} y2={34} />
        )}
        {mouth === "talking" && (
          <path d="M -16 28 Q 0 50 16 28 Z" fill="#751A1A" strokeWidth={5} />
        )}
        {mouth === "gasp" && (
          <ellipse cx={0} cy={36} rx={14} ry={20} fill="#141414" />
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
