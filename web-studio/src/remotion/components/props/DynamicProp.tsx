import React, { useEffect, useState } from "react";
import { staticFile } from "remotion";
import { Point2D, PropAnchorPorts } from "../../types/character";
import { computeAutoAnchorPorts, extractSvgDimensions, SvgDimensionInfo } from "../../lib/autoAnchoring";

export interface DynamicPropProps {
  id: string; // Tên file trong public/assets/props/${id}.svg
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  label?: string;
  showPointerCallout?: boolean;
  defaultDimensions?: SvgDimensionInfo;
  customSvgContent?: string;
  onAnchorsComputed?: (anchors: PropAnchorPorts) => void;
  children?: React.ReactNode;
}

const KNOWN_PROP_DIMENSIONS: Record<string, SvgDimensionInfo> = {
  "glass-jar": { width: 320, height: 420 },
  "spider": { width: 320, height: 240 },
  "sofa": { width: 720, height: 500 },
  "desk": { width: 1100, height: 400 },
  "desk-front": { width: 1100, height: 400 },
  "desk-back": { width: 1100, height: 400 },
  "gauge-meter": { width: 520, height: 280 },
  "desk-lamp": { width: 390, height: 300 },
  "potted-plant": { width: 280, height: 350 },
  "laptop": { width: 340, height: 260 },
  "coffee-cup": { width: 220, height: 220 },
  "cup": { width: 220, height: 220 },
  "alarm-clock": { width: 240, height: 240 },
  "clock": { width: 240, height: 240 },
  "book": { width: 240, height: 240 },
  "phone": { width: 160, height: 280 },
  "chair": { width: 300, height: 400 },
  "table": { width: 500, height: 350 },
  "door": { width: 280, height: 600 },
  "tv": { width: 480, height: 360 },
  "pizza": { width: 260, height: 260 },
  "apple": { width: 240, height: 240 },
  "guitar": { width: 260, height: 500 },
  "cat": { width: 300, height: 280 },
  "tree": { width: 450, height: 600 },
  "balloon": { width: 200, height: 320 },
  "trophy": { width: 280, height: 340 },
  "star": { width: 240, height: 240 },
  "heart": { width: 240, height: 240 },
  "whiteboard": { width: 600, height: 400 },
  "environment": { width: 300, height: 300 },
};

/**
 * DynamicProp: Bộ Nạp Tài Nguyên Động & Tự Động Gắn Neo (100% Automation)
 * 
 * QUY CHUẨN ORIGIN = BOTTOM-CENTER (Gốc tọa độ tại Chính Giữa Đáy):
 * - Điểm (x, y) truyền vào là điểm chính giữa cạnh đáy của vật thể.
 * - Khi đặt trên sàn (y = 1120), cạnh đáy chạm khít sàn nhà.
 * - Khi đặt trên mặt bàn (y = 760), chân đế chạm khít mặt gỗ của bàn.
 */
export const DynamicProp: React.FC<DynamicPropProps> = ({
  id,
  x,
  y,
  scale = 1,
  rotation = 0,
  label,
  showPointerCallout = false,
  defaultDimensions = { width: 240, height: 280 },
  customSvgContent,
  onAnchorsComputed,
  children,
}) => {
  const initialDims = customSvgContent
    ? defaultDimensions
    : KNOWN_PROP_DIMENSIONS[id] || defaultDimensions;
  const [dimensions, setDimensions] = useState<SvgDimensionInfo>(initialDims);
  const [hasLoadError, setHasLoadError] = useState(false);

  // Sử dụng staticFile chuẩn không chứa query param
  const baseAssetPath = staticFile(`assets/props/${id}.svg`);
  const assetUrl = `${baseAssetPath}?v=20261107_2k`;

  // Tự động tải SVG để bóc tách kích thước thực tế (Bounding Box)
  useEffect(() => {
    let isMounted = true;

    if (customSvgContent) {
      const dims = extractSvgDimensions(customSvgContent);
      setDimensions(dims);
      return;
    }

    fetch(assetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Không tìm thấy file ${id}.svg trong public/assets/props/`);
        return res.text();
      })
      .then((svgText) => {
        if (!isMounted) return;
        const dims = extractSvgDimensions(svgText);
        setDimensions(dims);
      })
      .catch((err) => {
        console.warn(`[DynamicProp] Dùng kích thước mặc định cho prop '${id}':`, err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [id, customSvgContent, assetUrl]);

  // Tự động tính toán Anchor Ports (Auto-Anchoring) và đẩy ra cho Stickman IK
  useEffect(() => {
    if (onAnchorsComputed) {
      const anchors = computeAutoAnchorPorts(dimensions, {
        x,
        y,
        scale,
        rotationDeg: rotation,
      });
      onAnchorsComputed(anchors);
    }
  }, [dimensions, x, y, scale, rotation]);

  const { width, height } = dimensions;

  // Tính toán vị trí Y của ảnh dựa trên cấu trúc viewBox của từng loại đạo cụ
  // Đối với gauge-meter: trục quay kim ở (0, 0), vòng cung ở y: -240 đến 0
  const isGauge = id === "gauge-meter";
  const imageY = isGauge ? -240 : -height;

  // Vị trí gắn nhãn:
  // - gauge-meter: đặt BÊN DƯỚI trục quay (y = +75px) để kim quay tự do phía trên không bao giờ cắt qua
  // - glass-jar: đặt ở 1/3 phía trên thân lọ (y = -height * 0.72) để nằm trên đầu con nhện
  // - Các prop khác: đặt ở giữa thân (y = -height * 0.5)
  const labelY = isGauge
    ? 75
    : id === "glass-jar"
      ? -Math.round(height * 0.72)
      : -Math.round(height * 0.5);

  const labelBoxWidth = isGauge ? 280 : 150;
  const labelBoxHeight = isGauge ? 60 : 56;

  return (
    <g
      id={`dynamic-prop-${id}`}
      transform={`translate(${x}, ${y}) scale(${scale}) rotate(${rotation})`}
      data-prop-id={id}
    >
      {/* =========================================================================
          1. NẠP HÌNH ẢNH SVG ĐỘNG (Render vector Bottom-Center hoặc Procedural Fallback)
         ========================================================================= */}
      <g id={`artwork-container-${id}`}>
        {!hasLoadError ? (
          <image
            href={assetUrl}
            xlinkHref={assetUrl}
            x={-width / 2}
            y={imageY}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid meet"
            onError={() => setHasLoadError(true)}
          />
        ) : (
          /* Fallback hoạt hình đẹp mắt nếu file chưa tải kịp, KHÔNG BAO GIỜ bị icon ảnh vỡ */
          <g id={`fallback-badge-${id}`}>
            <rect
              x={-width / 2}
              y={-height}
              width={width}
              height={height}
              rx={24}
              fill="#F3F4F6"
              stroke="#141414"
              strokeWidth={8}
            />
            <rect
              x={-width / 2 + 16}
              y={-height + 16}
              width={width - 32}
              height={height - 32}
              rx={16}
              fill="#E0E7FF"
              stroke="#6366F1"
              strokeWidth={4}
            />
            <text
              x={0}
              y={-height / 2 + 10}
              textAnchor="middle"
              fill="#141414"
              fontSize={24}
              fontWeight="900"
              fontFamily="var(--font-be-vietnam-pro), sans-serif"
            >
              {id.replace(/[-_]/g, " ").toUpperCase()}
            </text>
          </g>
        )}
      </g>

      {/* =========================================================================
          2. VẬT THỂ CON BÊN TRONG (Slot chứa nhện con bám đáy lọ thủy tinh)
         ========================================================================= */}
      {children && (
        <g id={`prop-children-${id}`} transform={`translate(0, ${-Math.round(height * 0.22)})`}>
          {children}
        </g>
      )}

      {/* =========================================================================
          3. TỰ ĐỘNG GẮN NHÃN DÁN (Tránh chạm kim đồng hồ, tránh che mắt nhện)
         ========================================================================= */}
      {label && !showPointerCallout && (
        <g id={`prop-label-decal-${id}`} transform={`translate(0, ${labelY})`}>
          <rect
            x={-labelBoxWidth / 2}
            y={-labelBoxHeight / 2}
            width={labelBoxWidth}
            height={labelBoxHeight}
            rx={14}
            fill="#FFFFFF"
            stroke="#141414"
            strokeWidth={5}
          />
          <text
            x={0}
            y={isGauge ? 10 : 12}
            textAnchor="middle"
            fill={isGauge ? "#141414" : "#E11D48"}
            fontSize={isGauge ? 30 : 36}
            fontWeight="900"
            fontFamily="var(--font-be-vietnam-pro), sans-serif"
          >
            {label}
          </text>
        </g>
      )}

      {/* 4. THANH CALLOUT TRỎ (Neo khít vào thành lọ, không lơ lửng) */}
      {label && showPointerCallout && (
        <g id={`prop-pointer-callout-${id}`} transform={`translate(${Math.round(width * 0.45)}, ${-Math.round(height * 0.65)})`}>
          {/* Đầu mút tròn chạm khít đường viền thành lọ */}
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
