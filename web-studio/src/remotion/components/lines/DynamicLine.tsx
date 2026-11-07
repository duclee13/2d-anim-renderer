import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Point2D } from "../../types/character";
import { DynamicLineStyle } from "../../types/sceneGraph";

export interface DynamicLineProps {
  /**
   * Đầu mút gốc (tọa độ tuyệt đối trên canvas 2K).
   */
  start: Point2D;
  /**
   * Đầu mút đích.
   */
  end: Point2D;
  /**
   * Kiểu hình thái đường line.
   */
  style: DynamicLineStyle;
  /**
   * Màu sắc chính.
   */
  color?: string;
  strokeWidth?: number;
  /**
   * Có dùng spring animation để thả dần xuống không (cho dây tơ nhện).
   */
  animated?: boolean;
  /**
   * Frame bắt đầu animation (relative to composition).
   */
  animationDelay?: number;
  /**
   * Cho kiểu "light": góc mở hình chóp.
   */
  coneAngle?: number;
  /**
   * Cho kiểu "light": chiều dài hình chóp.
   */
  coneLength?: number;
}

/**
 * DynamicLine: Đường line SVG động với đầu mút trực tiếp bám theo tọa độ anchor.
 *
 * Hỗ trợ 5 kiểu hiển thị:
 * 1. "silk"    — Sợi tơ nhện (catenary curve, spring dangle)
 * 2. "light"   — Hình chóp sáng từ đèn bàn
 * 3. "pointer" — Đường chỉ dẫn tên (từ nhãn đến vật thể)
 * 4. "dashed"  — Đường nét đứt
 * 5. "glow"    — Đường phát sáng neon
 */
export const DynamicLine: React.FC<DynamicLineProps> = ({
  start,
  end,
  style = "pointer",
  color,
  strokeWidth,
  animated = false,
  animationDelay = 0,
  coneAngle = 40,
  coneLength = 300,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // =========================================================================
  // SPRING ANIMATION cho đầu mút đích (thả dây tơ nhện)
  // =========================================================================
  let effectiveEnd = end;
  if (animated) {
    const progress = spring({
      frame: Math.max(0, frame - animationDelay),
      fps,
      config: {
        damping: 6,
        stiffness: 40,
        mass: 1.2,
      },
    });
    effectiveEnd = {
      x: interpolate(progress, [0, 1], [start.x, end.x]),
      y: interpolate(progress, [0, 1], [start.y, end.y]),
    };
  }

  switch (style) {
    case "silk":
      return <SpiderSilkLine start={start} end={effectiveEnd} color={color} strokeWidth={strokeWidth} />;
    case "light":
      return <LightCone origin={start} coneAngle={coneAngle} coneLength={coneLength} />;
    case "pointer":
      return <PointerLine start={start} end={effectiveEnd} color={color} strokeWidth={strokeWidth} />;
    case "dashed":
      return <DashedLine start={start} end={effectiveEnd} color={color} strokeWidth={strokeWidth} />;
    case "glow":
      return <GlowLine start={start} end={effectiveEnd} color={color} strokeWidth={strokeWidth} />;
    default:
      return <PointerLine start={start} end={effectiveEnd} color={color} strokeWidth={strokeWidth} />;
  }
};

// =========================================================================
// 1. SỢI TƠ NHỆN (Catenary Curve từ trần nhà xuống vật thể)
// =========================================================================
const SpiderSilkLine: React.FC<{
  start: Point2D;
  end: Point2D;
  color?: string;
  strokeWidth?: number;
}> = ({ start, end, color = "#888888", strokeWidth = 3 }) => {
  // Catenary sag dựa trên khoảng cách dọc
  const sagAmount = Math.abs(end.y - start.y) * 0.06;
  const midX = (start.x + end.x) / 2 + sagAmount * 0.3;
  const midY = (start.y + end.y) / 2;

  const d = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

  return (
    <g id="spider-silk-line">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={0.75}
      />
      {/* Nút nhỏ ở đầu treo */}
      <circle cx={start.x} cy={start.y} r={4} fill={color} opacity={0.6} />
    </g>
  );
};

// =========================================================================
// 2. HÌNH CHÓP SÁNG TỪ ĐÈN BÀN (Triangular light cone)
// =========================================================================
const LightCone: React.FC<{
  origin: Point2D;
  coneAngle?: number;
  coneLength?: number;
}> = ({ origin, coneAngle = 40, coneLength = 300 }) => {
  // Tia sáng chiếu xuống (angle = 90 deg = thẳng xuống)
  const halfAngleRad = ((coneAngle / 2) * Math.PI) / 180;
  const baseAngleRad = (90 * Math.PI) / 180; // chiếu thẳng xuống

  const leftX = origin.x + Math.cos(baseAngleRad - halfAngleRad) * coneLength;
  const leftY = origin.y + Math.sin(baseAngleRad - halfAngleRad) * coneLength;
  const rightX = origin.x + Math.cos(baseAngleRad + halfAngleRad) * coneLength;
  const rightY = origin.y + Math.sin(baseAngleRad + halfAngleRad) * coneLength;

  return (
    <g id="light-cone">
      <defs>
        <linearGradient id="light-cone-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFEAA7" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#FFEAA7" stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${origin.x},${origin.y} ${leftX},${leftY} ${rightX},${rightY}`}
        fill="url(#light-cone-gradient)"
        opacity={0.5}
      />
    </g>
  );
};

// =========================================================================
// 3. ĐƯỜNG CHỈ DẪN TÊN (Pointer line từ nhãn đến vật thể)
// =========================================================================
const PointerLine: React.FC<{
  start: Point2D;
  end: Point2D;
  color?: string;
  strokeWidth?: number;
}> = ({ start, end, color = "#141414", strokeWidth = 5 }) => {
  return (
    <g id="pointer-line">
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Nút tròn ở điểm gắn (pivot) */}
      <circle cx={end.x} cy={end.y} r={7} fill="#FFFFFF" stroke={color} strokeWidth={4} />
    </g>
  );
};

// =========================================================================
// 4. ĐƯỜNG NÉT ĐỨT (Dashed line)
// =========================================================================
const DashedLine: React.FC<{
  start: Point2D;
  end: Point2D;
  color?: string;
  strokeWidth?: number;
}> = ({ start, end, color = "#666666", strokeWidth = 4 }) => {
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray="12 8"
      strokeLinecap="round"
    />
  );
};

// =========================================================================
// 5. ĐƯỜNG PHÁT SÁNG NEON (Glow line)
// =========================================================================
const GlowLine: React.FC<{
  start: Point2D;
  end: Point2D;
  color?: string;
  strokeWidth?: number;
}> = ({ start, end, color = "#00E5FF", strokeWidth = 4 }) => {
  const glowId = `glow-filter-${Math.round(start.x)}-${Math.round(start.y)}`;
  return (
    <g id="glow-line">
      <defs>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        filter={`url(#${glowId})`}
        opacity={0.6}
      />
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </g>
  );
};

// =========================================================================
// UTILITY: Giải quyết tham chiếu anchor thành tọa độ tuyệt đối
// =========================================================================

export interface AnchorResolverContext {
  propAnchors: Record<string, { x: number; y: number; leftGrip: Point2D; rightGrip: Point2D; surfaceDecal: Point2D }>;
  characterAnchors: Record<string, Point2D>;
  canvasHeight: number;
}

/**
 * Giải quyết chuỗi tham chiếu anchor thành tọa độ Point2D.
 * Format: "prop:{propId}:{port}" | "character:{anchorName}" | "ceiling:{x}" | "floor:{x}"
 */
export function resolveAnchorRef(
  ref: string,
  context: AnchorResolverContext
): Point2D {
  const parts = ref.split(":");

  if (parts[0] === "prop" && parts.length >= 3) {
    const propId = parts[1];
    const port = parts[2];
    const propData = context.propAnchors[propId];
    if (!propData) return { x: 0, y: 0 };
    switch (port) {
      case "leftGrip":
        return propData.leftGrip;
      case "rightGrip":
        return propData.rightGrip;
      case "surfaceDecal":
        return propData.surfaceDecal;
      case "center":
        return { x: propData.x, y: propData.y };
      default:
        return { x: propData.x, y: propData.y };
    }
  }

  if (parts[0] === "character" && parts.length >= 2) {
    const anchorName = parts[1];
    return context.characterAnchors[anchorName] || { x: 0, y: 0 };
  }

  if (parts[0] === "ceiling") {
    const xPos = parts.length >= 2 ? parseFloat(parts[1]) : 1280;
    return { x: xPos, y: 0 };
  }

  if (parts[0] === "floor") {
    const xPos = parts.length >= 2 ? parseFloat(parts[1]) : 1280;
    return { x: xPos, y: context.canvasHeight };
  }

  return { x: 0, y: 0 };
}
