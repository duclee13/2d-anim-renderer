import React from "react";

export interface GardenBackgroundProps {
  groundY?: number;
  artwork?: React.ReactNode;
}

/**
 * GardenBackground Wrapper Component (Figma-to-React Standard)
 */
export const GardenBackground: React.FC<GardenBackgroundProps> = ({
  groundY = 960,
  artwork,
}) => {
  return (
    <g id="garden-background-wrapper" data-preset="gardenDay">
      {/* =========================================================================
          FIGMA SVG ARTWORK CONTAINER (2560x1440 2K)
          BẠN HÃY PASTE MÃ SVG BỐI CẢNH KHU VƯỜN TỪ FIGMA VÀO ĐÂY (<!-- PASTE REAL SVG HERE -->)
         ========================================================================= */}
      <g id="figma-garden-background-artwork">
        {artwork ? (
          artwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG BỐI CẢNH KHU VƯỜN TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>
    </g>
  );
};
