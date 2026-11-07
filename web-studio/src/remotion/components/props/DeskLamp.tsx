import React from "react";

export interface DeskLampProps {
  x: number;
  y: number;
  scale?: number;
  isOn?: boolean;
  lampArtwork?: React.ReactNode;
  lightConeArtwork?: React.ReactNode;
}

/**
 * DeskLamp Wrapper Component (Figma-to-React Standard)
 */
export const DeskLamp: React.FC<DeskLampProps> = ({
  x,
  y,
  scale = 1,
  isOn = true,
  lampArtwork,
  lightConeArtwork,
}) => {
  return (
    <g
      id="desk-lamp-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      data-prop-type="deskLamp"
    >
      {/* =========================================================================
          1. NÓN ÁNH SÁNG ĐÈN BÀN (Light Cone Overlay)
         ========================================================================= */}
      {isOn && (
        <g id="desk-lamp-light-cone">
          {lightConeArtwork ? (
            lightConeArtwork
          ) : (
            /* BẠN HÃY PASTE MÃ SVG NÓN ÁNH SÁNG TỪ FIGMA VÀO ĐÂY */
            /* <!-- PASTE REAL SVG HERE --> */
            null
          )}
        </g>
      )}

      {/* =========================================================================
          2. THÂN ĐÈN BÀN (Desk Lamp Body & Stand)
         ========================================================================= */}
      <g id="desk-lamp-body">
        {lampArtwork ? (
          lampArtwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG ĐÈN BÀN TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>
    </g>
  );
};
