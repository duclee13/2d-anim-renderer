import React from "react";
import { interpolate } from "remotion";
import { AlphaConfig } from "../types/sceneGraph";

export interface AnimatedTransformProps {
  children: React.ReactNode;
  frame?: number;
  fps?: number;
  // Position
  x?: number;
  y?: number;
  // Scale & Squash/Stretch
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  squashStretch?: {
    enabled?: boolean;
    impactFrame?: number;
    factor?: number;
  };
  // Rotation & Pivot
  rotation?: number;
  pivotPoint?: "center" | "bottomCenter" | "topCenter" | "topLeft" | "custom";
  pivotX?: number;
  pivotY?: number;
  objectWidth?: number;
  objectHeight?: number;
  // Alpha & Fade
  opacity?: number;
  alphaConfig?: AlphaConfig;
  sceneDurationInFrames?: number;
  id?: string;
  className?: string;
}

/**
 * AnimatedTransform: Bộ Điều Khiển Biến Đổi Vật Thể & Trục Quay Tùy Biến (Custom Pivot & Shaders)
 * 
 * 1. Hỗ trợ xoay quanh trục neo tùy chỉnh (kim đồng hồ quay quanh tâm, kim GaugeMeter quay quanh trục đáy).
 * 2. Phóng to/thu nhỏ mượt mà kèm Squash & Stretch khi rơi chạm đất.
 * 3. Fade-in, Fade-out đa tầng alpha và pulseAlpha phập phồng ánh sáng.
 */
export const AnimatedTransform: React.FC<AnimatedTransformProps> = ({
  children,
  frame = 0,
  x = 0,
  y = 0,
  scale = 1,
  scaleX = 1,
  scaleY = 1,
  squashStretch,
  rotation = 0,
  pivotPoint = "bottomCenter",
  pivotX,
  pivotY,
  objectWidth = 240,
  objectHeight = 280,
  opacity = 1,
  alphaConfig,
  sceneDurationInFrames = 120,
  id,
  className,
}) => {
  // =========================================================================
  // 1. TÍNH TOÁN ĐIỂM NEO TRỤC QUAY (PIVOT POINT ANCHOR)
  // Hệ tọa độ chuẩn Bottom-Center: (0, 0) là đáy chính giữa
  // =========================================================================
  let px = 0;
  let py = 0;

  switch (pivotPoint) {
    case "bottomCenter":
      px = 0;
      py = 0;
      break;
    case "center":
      px = 0;
      py = -objectHeight / 2;
      break;
    case "topCenter":
      px = 0;
      py = -objectHeight;
      break;
    case "topLeft":
      px = -objectWidth / 2;
      py = -objectHeight;
      break;
    case "custom":
      px = pivotX ?? 0;
      py = pivotY ?? 0;
      break;
  }

  // =========================================================================
  // 2. TÍNH TOÁN SQUASH & STRETCH (NÉN GIÃN KHI CHẠM ĐẤT)
  // =========================================================================
  let effectiveScaleX = scale * scaleX;
  let effectiveScaleY = scale * scaleY;

  if (squashStretch?.enabled) {
    const impactF = squashStretch.impactFrame ?? 0;
    const factor = squashStretch.factor ?? 0.25;
    if (frame >= impactF && frame <= impactF + 25) {
      const diff = frame - impactF;
      const osc = Math.sin(diff * 0.4) * Math.exp(-diff * 0.14);
      effectiveScaleX *= 1 + osc * factor;
      effectiveScaleY *= 1 - osc * factor;
    }
  }

  // =========================================================================
  // 3. TÍNH TOÁN ĐA TẦNG ALPHA (FADE-IN / FADE-OUT / PULSE ALPHA)
  // =========================================================================
  let effectiveOpacity = opacity;

  if (alphaConfig) {
    const { fadeInFrames, fadeOutFrames, pulseAlpha, minAlpha = 0.4, maxAlpha = 1.0 } = alphaConfig;

    if (fadeInFrames && fadeInFrames > 0) {
      const fadeProgress = interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      effectiveOpacity *= fadeProgress;
    }

    if (fadeOutFrames && fadeOutFrames > 0 && sceneDurationInFrames > fadeOutFrames) {
      const fadeOutStart = sceneDurationInFrames - fadeOutFrames;
      if (frame >= fadeOutStart) {
        const fadeOutProgress = interpolate(frame, [fadeOutStart, sceneDurationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        effectiveOpacity *= fadeOutProgress;
      }
    }

    if (pulseAlpha) {
      const pulse = minAlpha + (maxAlpha - minAlpha) * (0.5 + 0.5 * Math.sin(frame * 0.08));
      effectiveOpacity *= pulse;
    }
  }

  // Chuỗi biến đổi SVG với Pivot chuẩn xác
  const transformString = `translate(${x}, ${y}) translate(${px}, ${py}) rotate(${rotation}) scale(${effectiveScaleX}, ${effectiveScaleY}) translate(${-px}, ${-py})`;

  return (
    <g
      id={id ? `animated-transform-${id}` : undefined}
      className={className}
      transform={transformString}
      opacity={Math.max(0, Math.min(1, effectiveOpacity))}
    >
      {children}
    </g>
  );
};
