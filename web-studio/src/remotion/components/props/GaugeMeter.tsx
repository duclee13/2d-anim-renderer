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
 * GaugeMeter Wrapper Component (Figma-to-React Standard & Pivot Isolation)
 * Xử lý chuyển động quay của kim đo (`needleAngle`) dựa trên giá trị tham số.
 * Nhãn chữ được đặt bên dưới trục quay (y = +75px) để kim quay tự do không bao giờ quệt vào chữ.
 */
export const GaugeMeter: React.FC<GaugeMeterProps> = ({
  x,
  y,
  scale = 1,
  value = 35,
  label = "TRAO ĐỔI CHẤT: 35%",
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
      {/* 1. MẶT ĐỒNG HỒ ĐO (Gauge Dial Background) */}
      <g id="gauge-meter-dial">
        {dialArtwork || null}
      </g>

      {/* 2. KIM ĐỒNG HỒ ĐƯỢC XOAY ĐỘNG THEO needleAngle (Needle Pointer) */}
      <g id="gauge-meter-needle" transform={`rotate(${needleAngle}, 0, 0)`}>
        {needleArtwork || null}
      </g>

      {/* 3. NHÃN CHỮ INFOGRAPHIC (Đặt bên dưới trục quay y = +75px kèm nền trắng bo góc) */}
      {label && (
        <g id="gauge-meter-label-pill" transform="translate(0, 75)">
          <rect
            x={-140}
            y={-30}
            width={280}
            height={60}
            rx={14}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={5}
          />
          <text
            x={0}
            y={12}
            textAnchor="middle"
            fill="#141414"
            fontSize={30}
            fontWeight="900"
            letterSpacing="1px"
            fontFamily="var(--font-be-vietnam-pro), sans-serif"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
};
