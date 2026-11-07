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

/**
 * DynamicProp: Bộ Nạp Tài Nguyên Động & Tự Động Gắn Neo (100% Automation)
 * 
 * 1. Tự động load file SVG từ static asset bank: `/assets/props/${id}.svg`
 * 2. Tự động bóc tách Bounding Box từ SVG và tính toán:
 *    - leftGrip = (-width/2, 0)
 *    - rightGrip = (+width/2, 0)
 *    - surfaceDecal = (0, 0)
 * 3. Cung cấp tọa độ neo cho Stickman IK bám dính tự động 100%.
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
  const [dimensions, setDimensions] = useState<SvgDimensionInfo>(defaultDimensions);
  const [svgXml, setSvgXml] = useState<string | null>(customSvgContent || null);

  const assetUrl = staticFile(`assets/props/${id}.svg`);

  // Tự động tải SVG để bóc tách kích thước thực tế (Bounding Box)
  useEffect(() => {
    let isMounted = true;

    if (customSvgContent) {
      const dims = extractSvgDimensions(customSvgContent);
      setDimensions(dims);
      return;
    }

    // Tải file SVG từ public/assets/props/
    fetch(assetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Không tìm thấy file ${id}.svg trong public/assets/props/`);
        return res.text();
      })
      .then((svgText) => {
        if (!isMounted) return;
        setSvgXml(svgText);
        const dims = extractSvgDimensions(svgText);
        setDimensions(dims);
      })
      .catch((err) => {
        // Fallback giữ nguyên defaultDimensions nếu chưa có file
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

  return (
    <g
      id={`dynamic-prop-${id}`}
      transform={`translate(${x}, ${y}) scale(${scale}) rotate(${rotation})`}
      data-prop-id={id}
    >
      {/* =========================================================================
          1. NẠP HÌNH ẢNH SVG ĐỘNG (Render vector bằng thẻ <image> hoặc nội suy XML)
         ========================================================================= */}
      <g id={`artwork-container-${id}`}>
        {svgXml ? (
          // Đặt SVG đối xứng tâm (0, 0)
          <image
            href={assetUrl}
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          /* BẠN HÃY PASTE MÃ SVG TỪ FIGMA VÀO ĐÂY HOẶC NÉM FILE VÀO public/assets/props/ */
          <image
            href={assetUrl}
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
      </g>

      {/* =========================================================================
          2. VẬT THỂ CON BÊN TRONG (Slot chứa nhện con, thức ăn,...)
         ========================================================================= */}
      {children && (
        <g id={`prop-children-${id}`} transform="translate(0, 30)">
          {children}
        </g>
      )}

      {/* =========================================================================
          3. TỰ ĐỘNG GẮN NHÃN DÁN (Tự động neo vào surfaceDecal)
         ========================================================================= */}
      {label && !showPointerCallout && (
        <g id={`prop-label-decal-${id}`} transform="translate(0, 35)">
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

      {/* 4. THANH CALLOUT TRỎ (Cận cảnh 1.2) */}
      {label && showPointerCallout && (
        <g id={`prop-pointer-callout-${id}`} transform={`translate(${width / 2}, 20)`}>
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
