import React from "react";
import { Point2D } from "../../types/character";

export interface DeskProps {
  x: number;
  y: number;
  width?: number;
  height?: number;
  scale?: number;
  layerPart?: "all" | "tableTopAndFrontLegs" | "backLegs";
  onSurfaceAnchorComputed?: (surfaceAnchor: Point2D) => void;
  backLegsArtwork?: React.ReactNode;
  frontArtwork?: React.ReactNode;
}

/**
 * Desk Wrapper Component (Figma-to-React Standard)
 * Đảm bảo luật Z-Index: tách lớp chân sau (backLegs) và mặt bàn + chân trước (tableTopAndFrontLegs).
 */
export const Desk: React.FC<DeskProps> = ({
  x,
  y,
  width = 720,
  height = 240,
  scale = 1,
  layerPart = "all",
  onSurfaceAnchorComputed,
  backLegsArtwork,
  frontArtwork,
}) => {
  const deskTopY = -height;

  React.useEffect(() => {
    if (onSurfaceAnchorComputed) {
      onSurfaceAnchorComputed({
        x,
        y: y + deskTopY * scale,
      });
    }
  }, [x, y, scale, height]);

  return (
    <g
      id="desk-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      data-prop-type="desk"
    >
      {/* =========================================================================
          1. CHÂN SAU CỦA BÀN (Render ở MidgroundBackLayer - Z-Index sau nhân vật)
         ========================================================================= */}
      {(layerPart === "all" || layerPart === "backLegs") && (
        <g id="desk-back-legs">
          {backLegsArtwork ? (
            backLegsArtwork
          ) : (
            /* BẠN HÃY PASTE MÃ SVG CHÂN SAU CỦA BÀN TỪ FIGMA VÀO ĐÂY */
            /* <!-- PASTE REAL SVG HERE --> */
            null
          )}
        </g>
      )}

      {/* =========================================================================
          2. MẶT BÀN & CHÂN TRƯỚC (Render ở MidgroundFrontLayer - Z-Index ĐÈ LÊN nhân vật)
         ========================================================================= */}
      {(layerPart === "all" || layerPart === "tableTopAndFrontLegs") && (
        <g id="desk-tabletop-and-front-legs">
          {frontArtwork ? (
            frontArtwork
          ) : (
            /* BẠN HÃY PASTE MÃ SVG MẶT BÀN VÀ CHÂN TRƯỚC TỪ FIGMA VÀO ĐÂY */
            /* <!-- PASTE REAL SVG HERE --> */
            null
          )}
        </g>
      )}
    </g>
  );
};
