import React from "react";
import { Point2D } from "../../types/character";

export interface SpeechBubbleProps {
  x: number;
  y: number;
  text: string;
  hasMusicNote?: boolean;
  tailAnchor?: Point2D;
  bubbleArtwork?: React.ReactNode;
}

/**
 * SpeechBubble Wrapper Component (Figma-to-React Standard)
 */
export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  x,
  y,
  text,
  hasMusicNote = false,
  tailAnchor = { x: -40, y: 90 },
  bubbleArtwork,
}) => {
  const width = Math.max(260, text.length * 44 + 80);
  const height = 130;
  const radius = 65;

  return (
    <g id="speech-bubble-wrapper" transform={`translate(${x}, ${y})`}>
      {/* =========================================================================
          FIGMA SVG BUBBLE ARTWORK (Nếu có khung vẽ tùy biến từ Figma)
         ========================================================================= */}
      {bubbleArtwork ? (
        bubbleArtwork
      ) : (
        /* Mặc định vector bubble capsule */
        <g id="default-bubble-vector">
          <polygon
            points={`-30,${height / 2 - 10} 30,${height / 2 - 10} ${tailAnchor.x},${tailAnchor.y}`}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={12}
            strokeLinejoin="round"
          />
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            rx={radius}
            ry={radius}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={12}
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Bubble text content (>= 48px standard) */}
      <text
        x={0}
        y={18}
        textAnchor="middle"
        fontSize={52}
        fontWeight="900"
        fontFamily="var(--font-be-vietnam-pro), sans-serif"
        fill="#141414"
      >
        {text}
      </text>

      {/* Musical note decoration */}
      {hasMusicNote && (
        <text
          x={tailAnchor.x + 30}
          y={tailAnchor.y - 12}
          fontSize={44}
          fill="#666666"
        >
          ♪
        </text>
      )}
    </g>
  );
};
