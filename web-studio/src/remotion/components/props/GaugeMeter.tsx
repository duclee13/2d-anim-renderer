import React from "react";

export interface GaugeMeterProps {
  x: number;
  y: number;
  scale?: number;
  value?: number; // 0 to 100
  label?: string;
  dialArtwork?: React.ReactNode;
  needleArtwork?: React.ReactNode;
}

/**
 * GaugeMeter Wrapper Component (Figma-to-React Standard)
 * Xử lý chuyển động quay của kim đo (`needleAngle`) dựa trên giá trị tham số.
 */
export const GaugeMeter: React.FC<GaugeMeterProps> = ({
  x,
  y,
  scale = 1,
  value = 35,
  label = "TRAO ĐỔI CHẤT",
  dialArtwork,
  needleArtwork,
}) => {
  // Chuyển đổi giá trị 0-100 thành góc quay -70 deg đến +70 deg
  const needleAngle = -70 + (value / 100) * 140;

  return (
    <g
      id="gauge-meter-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      data-prop-type="gaugeMeter"
    >
      {/* =========================================================================
          1. MẶT ĐỒNG HỒ ĐO (Gauge Dial Background)
         ========================================================================= */}
      <g id="gauge-meter-dial">
        {dialArtwork ? (
          dialArtwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG MẶT ĐỒNG HỒ TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>

      {/* =========================================================================
          2. KIM ĐỒNG HỒ ĐƯỢC XOAY ĐỘNG THEO needleAngle (Needle Pointer)
         ========================================================================= */}
      <g id="gauge-meter-needle" transform={`rotate(${needleAngle}, 0, 0)`}>
        {needleArtwork ? (
          needleArtwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG KIM CHỈ ĐỒNG HỒ TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>

      {/* 3. NHÃN CHỮ INFOGRAPHIC */}
      {label && (
        <text
          x={0}
          y={65}
          textAnchor="middle"
          fill="#141414"
          fontSize={38}
          fontWeight="900"
          letterSpacing="2px"
          fontFamily="var(--font-be-vietnam-pro), sans-serif"
        >
          {label}
        </text>
      )}
    </g>
  );
};
