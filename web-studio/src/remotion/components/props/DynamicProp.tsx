import React, { useEffect, useState } from "react";
import { staticFile, interpolate } from "remotion";
import { Point2D, PropAnchorPorts } from "../../types/character";
import { computeAutoAnchorPorts, extractSvgDimensions, SvgDimensionInfo } from "../../lib/autoAnchoring";
import { AlphaConfig } from "../../types/sceneGraph";
import { normalizePropAssetId } from "../../utils/propResolver";

export interface DynamicPropProps {
  id: string; // Tên file trong public/assets/props/${id}.svg
  x: number;
  y: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  alphaConfig?: AlphaConfig;
  frame?: number;
  sceneDurationInFrames?: number;
  anchorPoint?: "bottomCenter" | "center" | "topCenter";
  pivotPoint?: "center" | "bottomCenter" | "topCenter" | "topLeft" | "custom";
  pivotX?: number;
  pivotY?: number;
  label?: string;
  showPointerCallout?: boolean;
  foliageSway?: boolean;
  needleAngle?: number; // Cho gauge-meter (-90 đến +90 deg)
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
  "bush": { width: 400, height: 240 },
  "environment": { width: 300, height: 300 },
};

/**
 * DynamicProp: Bộ Nạp Tài Nguyên Động & Tự Động Gắn Neo (100% Automation & VFX Ready)
 * 
 * QUY CHUẨN ORIGIN = BOTTOM-CENTER (Gốc tọa độ tại Chính Giữa Đáy):
 * - Điểm (x, y) truyền vào là điểm chính giữa cạnh đáy của vật thể.
 * - Hỗ trợ Custom Pivot Point, Alpha Shaders và Foliage Sway tuần hoàn.
 */
export const DynamicProp: React.FC<DynamicPropProps> = ({
  id,
  x,
  y,
  scale = 1,
  scaleX = 1,
  scaleY = 1,
  rotation = 0,
  opacity = 1,
  alphaConfig,
  frame = 0,
  sceneDurationInFrames = 120,
  anchorPoint,
  pivotPoint = "bottomCenter",
  pivotX,
  pivotY,
  label,
  showPointerCallout = false,
  foliageSway = false,
  needleAngle,
  defaultDimensions = { width: 240, height: 280 },
  customSvgContent,
  onAnchorsComputed,
  children,
}) => {
  const canonicalId = normalizePropAssetId(id);
  const initialDims = customSvgContent
    ? defaultDimensions
    : KNOWN_PROP_DIMENSIONS[canonicalId] || KNOWN_PROP_DIMENSIONS[id] || defaultDimensions;
  const [dimensions, setDimensions] = useState<SvgDimensionInfo>(initialDims);
  const [hasLoadError, setHasLoadError] = useState(false);

  const baseAssetPath = staticFile(`assets/props/${canonicalId}.svg`);
  const assetUrl = `${baseAssetPath}?v=20261107_2k`;

  useEffect(() => {
    let isMounted = true;

    if (customSvgContent) {
      const dims = extractSvgDimensions(customSvgContent);
      setDimensions(dims);
      return;
    }

    fetch(assetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Không tìm thấy file ${canonicalId}.svg trong public/assets/props/`);
        return res.text();
      })
      .then((svgText) => {
        if (!isMounted) return;
        const dims = extractSvgDimensions(svgText);
        setDimensions(dims);
        setHasLoadError(false);
      })
      .catch((err) => {
        console.warn(`[DynamicProp] Dùng kích thước mặc định cho prop '${canonicalId}':`, err.message);
        if (isMounted) {
          setHasLoadError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canonicalId, customSvgContent, assetUrl]);

  const effectiveAnchor = anchorPoint || (pivotPoint === "center" ? "center" : "bottomCenter");

  useEffect(() => {
    if (onAnchorsComputed) {
      const anchors = computeAutoAnchorPorts(dimensions, {
        x,
        y,
        scale,
        rotationDeg: rotation,
        anchorPoint: effectiveAnchor === "center" ? "center" : "bottomCenter",
      });
      onAnchorsComputed(anchors);
    }
  }, [dimensions, x, y, scale, rotation, effectiveAnchor]);

  const { width, height } = dimensions;
  const isGauge = canonicalId === "gauge-meter";
  const isSpider = canonicalId === "spider";
  const isGlassJar = canonicalId === "glass-jar";

  // Vị trí Y của ảnh và các phần tử con theo Anchor/Origin:
  // "center" (Mid-Center): Tâm hình học của vật thể đặt tại (x, y) - dùng cho Cảnh cận, Màn hình, Infographics
  // "bottomCenter": Đáy vật thể đặt tại y = 0 - dùng khi đặt trên sàn hoặc mặt bàn
  let imageY = -height;
  let needleCenterY = 0;
  let childrenY = -Math.round(height * 0.22);
  let labelY = -Math.round(height * 0.5);

  if (effectiveAnchor === "center") {
    if (isGauge) {
      // Mặt đồng hồ: vòm bán nguyệt từ -220 đến 0, viewBox -240 đến +40 (chiều cao 280)
      // Tâm hình học nằm tại khoảng y = -90 trong viewBox.
      // Căn tâm: đẩy toàn bộ xuống 90px để tâm vòm nằm chính xác tại y = 0.
      imageY = -150;
      needleCenterY = 90;
      labelY = 165;
    } else if (isSpider) {
      // Con nhện: viewBox -160 -120 320 240, tâm tại 0, 0
      imageY = -height / 2;
      childrenY = 0;
      labelY = 0;
    } else {
      // Các vật thể chuẩn (như lọ thủy tinh glass-jar, sofa, đèn bàn, v.v.)
      imageY = -height / 2;
      // Nhện nằm trong thân lọ thủy tinh tại vị trí cân đối
      childrenY = isGlassJar ? Math.round(height * 0.12) : 0;
      // Nhãn dán "TÁM" nằm ở 1/3 phía trên thân lọ, trên đầu con nhện
      labelY = isGlassJar ? -Math.round(height * 0.22) : -Math.round(height * 0.25);
    }
  } else {
    // bottomCenter
    if (isGauge) {
      imageY = -240;
      needleCenterY = 0;
      labelY = 75;
    } else if (isSpider) {
      imageY = -height / 2;
      childrenY = 0;
      labelY = 0;
    } else {
      imageY = -height;
      childrenY = -Math.round(height * 0.22);
      labelY = isGlassJar ? -Math.round(height * 0.72) : -Math.round(height * 0.5);
    }
  }

  // Điểm neo Pivot Point (Dùng cho phép xoay rotate quanh khớp tùy chọn)
  let px = 0;
  let py = 0;
  switch (pivotPoint) {
    case "bottomCenter":
      px = 0;
      py = effectiveAnchor === "center" ? height / 2 : 0;
      break;
    case "center":
      px = 0;
      py = effectiveAnchor === "center" ? 0 : (isGauge ? 0 : -height / 2);
      break;
    case "topCenter":
      px = 0;
      py = effectiveAnchor === "center" ? -height / 2 : -height;
      break;
    case "topLeft":
      px = -width / 2;
      py = effectiveAnchor === "center" ? -height / 2 : -height;
      break;
    case "custom":
      px = pivotX ?? 0;
      py = pivotY ?? 0;
      break;
  }

  // Độ mờ Alpha biến thiên động
  let effectiveOpacity = opacity;
  if (alphaConfig) {
    const { fadeInFrames, fadeOutFrames, pulseAlpha, minAlpha = 0.4, maxAlpha = 1.0 } = alphaConfig;
    if (fadeInFrames && fadeInFrames > 0) {
      const p = interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      effectiveOpacity *= p;
    }
    if (fadeOutFrames && fadeOutFrames > 0 && sceneDurationInFrames > fadeOutFrames) {
      const fadeStart = sceneDurationInFrames - fadeOutFrames;
      if (frame >= fadeStart) {
        const p = interpolate(frame, [fadeStart, sceneDurationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        effectiveOpacity *= p;
      }
    }
    if (pulseAlpha) {
      const pulse = minAlpha + (maxAlpha - minAlpha) * (0.5 + 0.5 * Math.sin(frame * 0.08));
      effectiveOpacity *= pulse;
    }
  }

  // Đung đưa cây cỏ (Foliage Sway) CHỈ KHI CÓ HIỆU ỨNG THỜI TIẾT NGOÀI TRỜI ĐƯỢC BẬT (Vật tĩnh giữ tĩnh 100%)
  const isPlant = foliageSway && (canonicalId === "potted-plant" || canonicalId === "tree" || canonicalId === "bush");
  const plantSwayDeg = isPlant ? Math.sin(frame * 0.045 + (x % 10)) * 3.5 : 0;

  const labelBoxWidth = isGauge ? 280 : 150;
  const labelBoxHeight = isGauge ? 60 : 56;

  // Biến đổi SVG tổng hợp có xét trục quay Pivot
  const sx = scale * scaleX;
  const sy = scale * scaleY;
  const transformStr = `translate(${x}, ${y}) translate(${px}, ${py}) rotate(${rotation}) scale(${sx}, ${sy}) skewX(${plantSwayDeg}) translate(${-px}, ${-py})`;

  return (
    <g
      id={`dynamic-prop-${id}`}
      transform={transformStr}
      opacity={Math.max(0, Math.min(1, effectiveOpacity))}
      data-prop-id={id}
    >
      {/* 1. NẠP HÌNH ẢNH SVG ĐỘNG */}
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
          <g id={`fallback-badge-${id}`}>
            <rect
              x={-width / 2}
              y={effectiveAnchor === "center" ? -height / 2 : -height}
              width={width}
              height={height}
              rx={24}
              fill="#F3F4F6"
              stroke="#141414"
              strokeWidth={8}
            />
            <rect
              x={-width / 2 + 16}
              y={(effectiveAnchor === "center" ? -height / 2 : -height) + 16}
              width={width - 32}
              height={height - 32}
              rx={16}
              fill="#E0E7FF"
              stroke="#6366F1"
              strokeWidth={4}
            />
            <text
              x={0}
              y={effectiveAnchor === "center" ? 10 : -height / 2 + 10}
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

      {/* 1.5. KIM ĐỒNG HỒ ĐỘNG QUAY QUANH TRỤC (NẾU LÀ GAUGE-METER VÀ CÓ KIM XOAY) */}
      {isGauge && needleAngle !== undefined && (
        <g transform={`translate(0, ${needleCenterY}) rotate(${needleAngle}, 0, 0)`}>
          <polygon points="-5,0 0,-185 5,0" fill="#141414" />
          <circle cx={0} cy={0} r={16} fill="#141414" />
          <circle cx={0} cy={0} r={5} fill="#FFFFFF" />
        </g>
      )}

      {/* 2. VẬT THỂ CON BÊN TRONG */}
      {children && (
        <g id={`prop-children-${id}`} transform={`translate(0, ${childrenY})`}>
          {children}
        </g>
      )}

      {/* 3. TỰ ĐỘNG GẮN NHÃN DÁN */}
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

      {/* 4. THANH CALLOUT TRỎ */}
      {label && showPointerCallout && (
        <g id={`prop-pointer-callout-${id}`} transform={`translate(${Math.round(width * 0.45)}, ${-Math.round(height * 0.65)})`}>
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
