import React from "react";

export interface InfographicBackgroundProps {
  artwork?: React.ReactNode;
}

/**
 * InfographicBackground Wrapper Component (Figma-to-React Standard)
 */
export const InfographicBackground: React.FC<InfographicBackgroundProps> = ({
  artwork,
}) => {
  return (
    <g id="infographic-background-wrapper" data-preset="infographicStripes">
      {/* =========================================================================
          FIGMA SVG ARTWORK CONTAINER (2560x1440 2K)
          BẠN HÃY PASTE MÃ SVG BỐI CẢNH INFOGRAPHIC TỪ FIGMA VÀO ĐÂY (<!-- PASTE REAL SVG HERE -->)
         ========================================================================= */}
      <g id="figma-infographic-background-artwork">
        {artwork ? (
          artwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG BỐI CẢNH INFOGRAPHIC TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>
    </g>
  );
};
