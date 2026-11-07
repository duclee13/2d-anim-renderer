import React from "react";
import { SubtitleWord } from "../../types/sceneGraph";

interface SubtitleBoxProps {
  text: string;
  words?: SubtitleWord[];
  currentFrame: number;
  fps: number;
  x?: number;
  y?: number;
  fontSize?: number;
}

export const SubtitleBox: React.FC<SubtitleBoxProps> = ({
  text,
  words,
  currentFrame,
  fps = 60,
  x = 1280, // Centered on 2K canvas
  y = 1340, // 100px from bottom of 1440 canvas
  fontSize = 72,
}) => {
  if (!text) return null;

  const currentMs = (currentFrame / fps) * 1000;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{
        filter: "drop-shadow(0px 8px 18px rgba(0, 0, 0, 0.75))",
      }}
    >
      {/* If word-level timing is available, render interactive karaoke highlight */}
      {words && words.length > 0 ? (
        <text
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="900"
          fontFamily="var(--font-be-vietnam-pro), sans-serif"
        >
          {words.map((item, index) => {
            const isActive = currentMs >= item.startMs && currentMs <= item.endMs;
            return (
              <tspan
                key={index}
                dx={index === 0 ? 0 : 16}
                fill={isActive ? "#FFD13B" : "#FFFFFF"}
                stroke="#141414"
                strokeWidth={isActive ? 18 : 16}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  paintOrder: "stroke fill",
                  transition: "fill 0.1s ease",
                }}
              >
                {item.word}
              </tspan>
            );
          })}
        </text>
      ) : (
        /* Fallback standard solid subtitle */
        <text
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="900"
          fontFamily="var(--font-be-vietnam-pro), sans-serif"
          fill="#FFFFFF"
          stroke="#141414"
          strokeWidth={16}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            paintOrder: "stroke fill",
          }}
        >
          {text}
        </text>
      )}
    </g>
  );
};
