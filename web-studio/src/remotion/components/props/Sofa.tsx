import React from "react";

export interface SofaProps {
  x: number;
  y: number;
  scale?: number;
  artwork?: React.ReactNode;
}

/**
 * Sofa Wrapper Component (Figma-to-React Standard)
 */
export const Sofa: React.FC<SofaProps> = ({
  x,
  y,
  scale = 1,
  artwork,
}) => {
  return (
    <g
      id="sofa-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      data-prop-type="sofa"
    >
      {/* =========================================================================
          FIGMA SVG ARTWORK CONTAINER
          BẠN HÃY PASTE MÃ SVG GHẾ SOFA TỪ FIGMA VÀO ĐÂY (<!-- PASTE REAL SVG HERE -->)
         ========================================================================= */}
      <g id="figma-sofa-artwork">
        {artwork ? (
          artwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG GHẾ SOFA TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>
    </g>
  );
};
