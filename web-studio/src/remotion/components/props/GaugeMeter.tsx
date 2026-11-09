import React from "react";

export interface GaugeMeterProps {
  x?: number;
  y?: number;
  scale?: number;
  value?: number; // 0 to 100
  needleAngle?: number; // Direct angle (-90 to +90 deg), takes precedence over value
  label?: string;
  dialArtwork?: React.ReactNode;
  needleArtwork?: React.ReactNode;
}

/**
 * GaugeMeter: Component Đồng hồ đo Trao đổi chất & Chỉ số Infographic hoàn chỉnh (2K Vector SVG)
 * Tự thân chứa toàn bộ vòm màu (Xanh lá - Vàng - Đỏ), vạch chia độ, kim quay mượt mà và nhãn chữ.
 * 100% vector SVG, không phụ thuộc fetch file bên ngoài, bảo đảm không bao giờ vỡ hình hoặc lỗi placeholder.
 */
export const GaugeMeter: React.FC<GaugeMeterProps> = ({
  x = 0,
  y = 0,
  scale = 1,
  value,
  needleAngle: propNeedleAngle,
  label = "TRAO ĐỔI CHẤT: THẤP",
  dialArtwork,
  needleArtwork,
}) => {
  // needleAngle: ưu tiên propNeedleAngle nếu truyền vào, hoặc tính từ value (0-100 -> -70 đến +70 deg), mặc định -35 deg
  const effectiveNeedleAngle =
    propNeedleAngle !== undefined
      ? propNeedleAngle
      : value !== undefined
      ? -70 + (Math.max(0, Math.min(100, value)) / 100) * 140
      : -35;

  return (
    <g
      id="gauge-meter-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      data-prop-type="gaugeMeter"
    >
      {/* 1. MẶT ĐỒNG HỒ ĐO (Gauge Dial Background) */}
      <g id="gauge-meter-dial">
        {dialArtwork || (
          <g id="gauge-dial-default-vector">
            {/* Vòm bán nguyệt nền sau */}
            <path
              d="M -230 0 A 230 230 0 0 1 230 0 Z"
              fill="#F8FAFC"
              stroke="#E2E8F0"
              strokeWidth={4}
            />

            {/* Các vòm màu thể hiện mức độ trao đổi chất: Xanh lá -> Vàng -> Đỏ */}
            <g stroke="#141414" strokeWidth={8} strokeLinejoin="round">
              {/* Vòm Xanh lá (Ngủ đông / Tiết kiệm năng lượng - Tọa độ R=220, r=140) */}
              <path
                d="M -220 0 A 220 220 0 0 1 -126 -180 L -80 -115 A 140 140 0 0 0 -140 0 Z"
                fill="#22C55E"
              />
              {/* Vòm Vàng (Mức trung bình) */}
              <path
                d="M -126 -180 A 220 220 0 0 1 126 -180 L 80 -115 A 140 140 0 0 0 -80 -115 Z"
                fill="#F59E0B"
              />
              {/* Vòm Đỏ (Mức tiêu hao cao) */}
              <path
                d="M 126 -180 A 220 220 0 0 1 220 0 L 140 0 A 140 140 0 0 0 80 -115 Z"
                fill="#EF4444"
              />
              {/* Đường đáy bán nguyệt chắc chắn */}
              <line
                x1="-250"
                y1="0"
                x2="250"
                y2="0"
                stroke="#141414"
                strokeWidth={10}
                strokeLinecap="round"
              />
            </g>

            {/* Các vạch khắc chia độ sắc nét */}
            <g stroke="#141414" strokeWidth={6} strokeLinecap="round">
              <line x1="-126" y1="-180" x2="-145" y2="-205" />
              <line x1="0" y1="-220" x2="0" y2="-245" />
              <line x1="126" y1="-180" x2="145" y2="-205" />
              <line x1="-185" y1="-118" x2="-202" y2="-129" strokeWidth={4} />
              <line x1="-68" y1="-209" x2="-75" y2="-230" strokeWidth={4} />
              <line x1="68" y1="-209" x2="75" y2="-230" strokeWidth={4} />
              <line x1="185" y1="-118" x2="202" y2="-129" strokeWidth={4} />
            </g>
          </g>
        )}
      </g>

      {/* 2. KIM ĐỒNG HỒ ĐƯỢC XOAY ĐỘNG THEO effectiveNeedleAngle */}
      <g
        id="gauge-meter-needle"
        transform={`rotate(${effectiveNeedleAngle}, 0, 0)`}
      >
        {needleArtwork || (
          <g id="gauge-needle-default-vector">
            {/* Bóng kim đổ nhẹ */}
            <polygon
              points="-7,0 0,-187 7,0"
              fill="#000000"
              opacity={0.25}
              transform="translate(4, 4)"
            />
            {/* Thân kim thuôn nhọn sắc nét */}
            <polygon points="-6,0 0,-185 6,0" fill="#141414" />
            {/* Chốt xoay trung tâm */}
            <circle cx={0} cy={0} r={16} fill="#141414" />
            <circle cx={0} cy={0} r={6} fill="#FFFFFF" />
          </g>
        )}
      </g>

      {/* 3. NHÃN CHỮ INFOGRAPHIC (Đặt bên dưới trục quay y = +75px kèm nền trắng bo góc, kim quay không bao giờ quệt vào) */}
      {label && (
        <g id="gauge-meter-label-pill" transform="translate(0, 75)">
          <rect
            x={-150}
            y={-30}
            width={300}
            height={60}
            rx={16}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={5}
          />
          <text
            x={0}
            y={12}
            textAnchor="middle"
            fill="#141414"
            fontSize={26}
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
