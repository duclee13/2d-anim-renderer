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
  // Eye geometry (2K Proportions for headRadius 95)
  const eyeRadius = 20;
  const pupilRadius = 13;
  const eyeDistance = 44;
  const eyeY = -16;

  // Pupil offset from gaze
  const maxGazeOffset = 6;
  const gazeX = (pupilGaze.x || 0) * maxGazeOffset;
  const gazeY = (pupilGaze.y || 0) * maxGazeOffset;

  const leftEyeCenter = { x: -eyeDistance + gazeX, y: eyeY + gazeY };
  const rightEyeCenter = { x: eyeDistance + gazeX, y: eyeY + gazeY };

  return (
    <g className="stickman-face">
      {/* Blush cheeks */}
      {blush && (
        <g opacity={0.65}>
          <ellipse cx={-eyeDistance - 12} cy={eyeY + 38} rx={18} ry={10} fill="#FF8BA7" />
          <ellipse cx={eyeDistance + 12} cy={eyeY + 38} rx={18} ry={10} fill="#FF8BA7" />
        </g>
      )}

      {/* Eyebrows */}
      <g stroke={strokeColor} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {eyebrows === "neutral" && (
          <>
            <path d={`M ${-eyeDistance - 22} ${eyeY - 26} Q ${-eyeDistance} ${eyeY - 32} ${-eyeDistance + 22} ${eyeY - 26}`} />
            <path d={`M ${eyeDistance - 22} ${eyeY - 26} Q ${eyeDistance} ${eyeY - 32} ${eyeDistance + 22} ${eyeY - 26}`} />
          </>
        )}
        {eyebrows === "raised" && (
          <>
            <path d={`M ${-eyeDistance - 22} ${eyeY - 36} Q ${-eyeDistance} ${eyeY - 44} ${-eyeDistance + 22} ${eyeY - 34}`} />
            <path d={`M ${eyeDistance - 22} ${eyeY - 34} Q ${eyeDistance} ${eyeY - 44} ${eyeDistance + 22} ${eyeY - 36}`} />
          </>
        )}
        {eyebrows === "inquisitive" && (
          <>
            <path d={`M ${-eyeDistance - 22} ${eyeY - 28} Q ${-eyeDistance} ${eyeY - 34} ${-eyeDistance + 22} ${eyeY - 26}`} />
            <path d={`M ${eyeDistance - 22} ${eyeY - 42} Q ${eyeDistance} ${eyeY - 50} ${eyeDistance + 22} ${eyeY - 36}`} />
          </>
        )}
        {eyebrows === "worried" && (
          <>
            <path d={`M ${-eyeDistance - 22} ${eyeY - 34} Q ${-eyeDistance} ${eyeY - 26} ${-eyeDistance + 22} ${eyeY - 24}`} />
            <path d={`M ${eyeDistance - 22} ${eyeY - 24} Q ${eyeDistance} ${eyeY - 26} ${eyeDistance + 22} ${eyeY - 34}`} />
          </>
        )}
        {eyebrows === "furrowed" && (
          <>
            <path d={`M ${-eyeDistance - 22} ${eyeY - 24} L ${-eyeDistance + 22} ${eyeY - 32}`} />
            <path d={`M ${eyeDistance - 22} ${eyeY - 32} L ${eyeDistance + 22} ${eyeY - 24}`} />
          </>
        )}
      </g>

      {/* Eyes */}
      {eyes === "closed" ? (
        <g stroke={strokeColor} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M ${-eyeDistance - 18} ${eyeY} Q ${-eyeDistance} ${eyeY + 16} ${-eyeDistance + 18} ${eyeY}`} />
          <path d={`M ${eyeDistance - 18} ${eyeY} Q ${eyeDistance} ${eyeY + 16} ${eyeDistance + 18} ${eyeY}`} />
        </g>
      ) : eyes === "happy" ? (
        <g stroke={strokeColor} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M ${-eyeDistance - 18} ${eyeY + 8} Q ${-eyeDistance} ${eyeY - 14} ${-eyeDistance + 18} ${eyeY + 8}`} />
          <path d={`M ${eyeDistance - 18} ${eyeY + 8} Q ${eyeDistance} ${eyeY - 14} ${eyeDistance + 18} ${eyeY + 8}`} />
        </g>
      ) : (
        <g>
          {/* Eye whites */}
          <circle cx={-eyeDistance} cy={eyeY} r={eyeRadius} fill="#FFFFFF" stroke={strokeColor} strokeWidth={7} />
          <circle cx={eyeDistance} cy={eyeY} r={eyeRadius} fill="#FFFFFF" stroke={strokeColor} strokeWidth={7} />

          {/* Pupils */}
          <circle cx={leftEyeCenter.x} cy={leftEyeCenter.y} r={pupilRadius} fill={strokeColor} />
          <circle cx={rightEyeCenter.x} cy={rightEyeCenter.y} r={pupilRadius} fill={strokeColor} />

          {/* Specular highlights for cute shiny eyes */}
          <circle cx={leftEyeCenter.x - 4} cy={leftEyeCenter.y - 4} r={4.5} fill="#FFFFFF" />
          <circle cx={rightEyeCenter.x - 4} cy={rightEyeCenter.y - 4} r={4.5} fill="#FFFFFF" />
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
