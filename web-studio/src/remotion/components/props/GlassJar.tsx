import React from "react";
import { PropAnchorPorts, Point2D } from "../../types/character";

export interface GlassJarProps {
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  label?: string;
  showPointerCallout?: boolean;
  onAnchorsComputed?: (anchors: PropAnchorPorts) => void;
  artwork?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * GlassJar Wrapper Component (Figma-to-React Standard)
 * Chịu trách nhiệm quản lý tọa độ không gian và xuất các cổng neo toán học (Anchor Ports).
 * Toàn bộ hình ảnh đồ họa đã được làm rỗng để chờ ghép mã SVG từ Figma.
 */
export const GlassJar: React.FC<GlassJarProps> = ({
  x,
  y,
  scale = 1,
  rotation = 0,
  label,
  showPointerCallout = false,
  onAnchorsComputed,
  artwork,
  children,
}) => {
  // Kích thước chuẩn bounding box (240x280px ở canvas 2K) để tính toán điểm neo
  const jarWidth = 240;
  const jarHeight = 280;

  // Tính toán Anchor Ports trong hệ tọa độ toàn cục
  const leftGrip: Point2D = { x: x - (jarWidth / 2) * scale, y };
  const rightGrip: Point2D = { x: x + (jarWidth / 2) * scale, y };
  const surfaceDecal: Point2D = { x, y: y + 20 * scale };
  const lidCenter: Point2D = { x, y: y - (jarHeight / 2) * scale };
  const baseCenter: Point2D = { x, y: y + (jarHeight / 2) * scale };

  React.useEffect(() => {
    if (onAnchorsComputed) {
      onAnchorsComputed({
        leftGrip,
        rightGrip,
        surfaceDecal,
        lidCenter,
        baseCenter,
      });
    }
  }, [x, y, scale, rotation]);

  return (
    <g
      id="glass-jar-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale}) rotate(${rotation})`}
      data-prop-type="glassJar"
    >
      {/* =========================================================================
          FIGMA SVG ARTWORK CONTAINER
          BẠN HÃY PASTE MÃ SVG TỪ FIGMA VÀO ĐÂY (<!-- PASTE REAL SVG HERE -->)
          
          Lưu ý khi vẽ trên Figma:
          - Vẽ chiếc lọ với tâm (Center/Pivot) tại tọa độ (0, 0).
          - Kích thước tham chiếu 2K: rộng ~240px, cao ~280px.
         ========================================================================= */}
      <g id="figma-glass-jar-artwork">
        {artwork ? (
          artwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>

      {/* =========================================================================
          SLOT VẬT THỂ BÊN TRONG LỌ (Chứa con nhện Spider, thức ăn...)
         ========================================================================= */}
      {children && (
        <g id="jar-interior-contents" transform="translate(0, 30)">
          {children}
        </g>
      )}

      {/* =========================================================================
          NHÃN DÁN ĐẠO CỤ (Neo cứng vào surfaceDecal - Triệt tiêu lỗi 1.2)
         ========================================================================= */}
      {label && !showPointerCallout && (
        <g id="jar-surface-decal" transform="translate(0, 35)">
          <rect
            x={-60}
            y={-22}
            width={120}
            height={44}
            rx={8}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={4}
          />
          <text
            x={0}
            y={8}
            textAnchor="middle"
            fill="#E11D48"
            fontSize={26}
            fontWeight="900"
            fontFamily="var(--font-be-vietnam-pro), sans-serif"
          >
            {label}
          </text>
        </g>
      )}

      {/* THANH CHỈ TRỎ CALLOUT (Neo liền mạch với mép lọ cho Cảnh cận 1.2) */}
      {label && showPointerCallout && (
        <g id="jar-pointer-callout" transform="translate(120, 20)">
          <line x1={0} y1={0} x2={45} y2={0} stroke="#141414" strokeWidth={5} strokeLinecap="round" />
          <circle cx={48} cy={0} r={7} fill="#FFFFFF" stroke="#141414" strokeWidth={4} />
          <line x1={55} y1={0} x2={95} y2={8} stroke="#141414" strokeWidth={5} strokeLinecap="round" />

          <g transform="translate(95, -30)">
            <rect
              x={0}
              y={0}
              width={140}
              height={64}
              rx={12}
              fill="#FFFFFF"
              stroke="#141414"
              strokeWidth={6}
            />
            <text
              x={70}
              y={44}
              textAnchor="middle"
              fill="#E11D48"
              fontSize={36}
              fontWeight="900"
              fontFamily="var(--font-be-vietnam-pro), sans-serif"
            >
              {label}
            </text>
          </g>
        </g>
      )}
    </g>
  );
};
