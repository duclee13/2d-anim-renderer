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
 * GlassJar Wrapper Component (Figma-to-React Standard & Bottom-Center Origin)
 * 
 * QUY CHUẨN ORIGIN = BOTTOM-CENTER:
 * - Điểm (x, y) là đáy chính giữa chiếc lọ (chạm sàn / chạm mặt bàn).
 * - Nhãn dán "TÁM" neo tại 1/3 phía trên thân lọ (y = -height * 0.72), nằm trên con nhện.
 * - Con nhện ở đáy lọ (y = -height * 0.22).
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
  const jarWidth = 320;
  const jarHeight = 420;

  // Tính toán Anchor Ports theo chuẩn Bottom-Center
  const leftGrip: Point2D = { x: x - (jarWidth * 0.42) * scale, y: y - (jarHeight * 0.45) * scale };
  const rightGrip: Point2D = { x: x + (jarWidth * 0.42) * scale, y: y - (jarHeight * 0.45) * scale };
  const surfaceDecal: Point2D = { x, y: y - (jarHeight * 0.72) * scale };
  const lidCenter: Point2D = { x, y: y - jarHeight * scale };
  const baseCenter: Point2D = { x, y };

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
      <g id="figma-glass-jar-artwork">
        {artwork || null}
      </g>

      {/* SLOT VẬT THỂ BÊN TRONG LỌ (Con nhện bám đáy lọ) */}
      {children && (
        <g id="jar-interior-contents" transform={`translate(0, ${-Math.round(jarHeight * 0.22)})`}>
          {children}
        </g>
      )}

      {/* NHÃN DÁN ĐẠO CỤ (Nằm ở 1/3 trên thân lọ, không che nhện) */}
      {label && !showPointerCallout && (
        <g id="jar-surface-decal" transform={`translate(0, ${-Math.round(jarHeight * 0.72)})`}>
          <rect
            x={-75}
            y={-28}
            width={150}
            height={56}
            rx={14}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={5}
          />
          <text
            x={0}
            y={12}
            textAnchor="middle"
            fill="#E11D48"
            fontSize={36}
            fontWeight="900"
            fontFamily="var(--font-be-vietnam-pro), sans-serif"
          >
            {label}
          </text>
        </g>
      )}

      {/* THANH CALLOUT TRỎ */}
      {label && showPointerCallout && (
        <g id="jar-pointer-callout" transform={`translate(${Math.round(jarWidth * 0.45)}, ${-Math.round(jarHeight * 0.65)})`}>
          <circle cx={0} cy={0} r={7} fill="#141414" />
          <line x1={0} y1={0} x2={55} y2={-10} stroke="#141414" strokeWidth={5} strokeLinecap="round" />

          <g transform="translate(55, -45)">
            <rect
              x={0}
              y={0}
              width={150}
              height={64}
              rx={14}
              fill="#FFFFFF"
              stroke="#141414"
              strokeWidth={6}
            />
            <text
              x={75}
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
