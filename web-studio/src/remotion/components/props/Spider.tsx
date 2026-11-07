import React from "react";

export interface SpiderProps {
  x?: number;
  y?: number;
  scale?: number;
  isBlinking?: boolean;
  artwork?: React.ReactNode;
}

/**
 * Spider Wrapper Component (Figma-to-React Standard)
 */
export const Spider: React.FC<SpiderProps> = ({
  x = 0,
  y = 0,
  scale = 1,
  isBlinking = false,
  artwork,
}) => {
  return (
    <g
      id="spider-wrapper"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      data-prop-type="spider"
    >
      {/* =========================================================================
          FIGMA SVG ARTWORK CONTAINER
          BẠN HÃY PASTE MÃ SVG CON NHỆN TỪ FIGMA VÀO ĐÂY (<!-- PASTE REAL SVG HERE -->)
         ========================================================================= */}
      <g id="figma-spider-artwork">
        {artwork ? (
          artwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG CON NHỆN TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>
    </g>
  );
};
