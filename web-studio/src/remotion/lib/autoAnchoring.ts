import { Point2D, PropAnchorPorts } from "../types/character";

export interface SvgDimensionInfo {
  width: number;
  height: number;
  minX?: number;
  minY?: number;
}

/**
 * Phân tích cú pháp chuỗi SVG để tự động bóc tách viewBox hoặc thuộc tính width/height.
 */
export function extractSvgDimensions(svgText: string): SvgDimensionInfo {
  let width = 240;
  let height = 240;
  let minX = 0;
  let minY = 0;

  // 1. Tìm viewBox="minX minY width height"
  const viewBoxMatch = svgText.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    minX = parseFloat(viewBoxMatch[1]);
    minY = parseFloat(viewBoxMatch[2]);
    width = parseFloat(viewBoxMatch[3]);
    height = parseFloat(viewBoxMatch[4]);
    return { width, height, minX, minY };
  }

  // 2. Tìm width="..." và height="..."
  const widthMatch = svgText.match(/width=["']([\d.]+)(?:px)?["']/i);
  const heightMatch = svgText.match(/height=["']([\d.]+)(?:px)?["']/i);
  if (widthMatch) width = parseFloat(widthMatch[1]);
  if (heightMatch) height = parseFloat(heightMatch[1]);

  return { width, height, minX, minY };
}

/**
 * Tự động tính toán các cổng neo toán học (Auto-Anchoring) dựa trên Bounding Box thực tế của SVG.
 * 
 * QUY CHUẨN ORIGIN = BOTTOM-CENTER (Gốc tọa độ tại Chính Giữa Đáy):
 * - Điểm (0, 0) là đáy chính giữa của vật thể (chạm sàn / chạm mặt bàn).
 * - baseCenter / bottomAnchor: (0, 0)
 * - topAnchor / lidCenter: Đỉnh trên (0, -height)
 * - surfaceDecal: Tâm mặt trước (0, -height * 0.5)
 * - leftGrip: Cạnh trái cầm nắm (-width * 0.42, -height * 0.45)
 * - rightGrip: Cạnh phải cầm nắm (+width * 0.42, -height * 0.45)
 */
export function computeAutoAnchorPorts(
  dimensions: SvgDimensionInfo,
  transform: { x: number; y: number; scale?: number; rotationDeg?: number }
): PropAnchorPorts {
  const { width, height } = dimensions;
  const scale = transform.scale ?? 1;
  const rotationDeg = transform.rotationDeg ?? 0;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Helper xoay điểm cục bộ quanh đáy chính giữa (0, 0) và cộng offset toàn cục (x, y)
  const toGlobal = (localX: number, localY: number): Point2D => {
    const scaledX = localX * scale;
    const scaledY = localY * scale;
    return {
      x: transform.x + (scaledX * cos - scaledY * sin),
      y: transform.y + (scaledX * sin + scaledY * cos),
    };
  };

  return {
    leftGrip: toGlobal(-width * 0.42, -height * 0.45),
    rightGrip: toGlobal(width * 0.42, -height * 0.45),
    surfaceDecal: toGlobal(0, -height * 0.5),
    lidCenter: toGlobal(0, -height),
    baseCenter: toGlobal(0, 0),
  };
}
