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
 * Quy ước Bounding Box đối xứng quanh Pivot (0, 0):
 * - leftGrip: Cạnh trái ở giữa chiều cao (-width / 2, 0)
 * - rightGrip: Cạnh phải ở giữa chiều cao (+width / 2, 0)
 * - surfaceDecal: Tâm mặt trước (0, 0)
 * - lidCenter / topAnchor: Đỉnh trên (0, -height / 2)
 * - baseCenter / bottomAnchor: Đáy dưới (0, +height / 2)
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

  // Helper xoay điểm cục bộ quanh tâm (0, 0) và cộng offset toàn cục (x, y)
  const toGlobal = (localX: number, localY: number): Point2D => {
    const scaledX = localX * scale;
    const scaledY = localY * scale;
    return {
      x: transform.x + (scaledX * cos - scaledY * sin),
      y: transform.y + (scaledX * sin + scaledY * cos),
    };
  };

  return {
    leftGrip: toGlobal(-width / 2, 0),
    rightGrip: toGlobal(width / 2, 0),
    surfaceDecal: toGlobal(0, 0),
    lidCenter: toGlobal(0, -height / 2),
    baseCenter: toGlobal(0, height / 2),
  };
}
