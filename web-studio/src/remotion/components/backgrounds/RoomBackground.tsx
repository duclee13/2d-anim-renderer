import React from "react";

export interface RoomBackgroundProps {
  isNight?: boolean;
  floorY?: number;
  hasPottedPlant?: boolean;
  artwork?: React.ReactNode;
}

/**
 * RoomBackground Wrapper Component (Figma-to-React Standard)
 */
export const RoomBackground: React.FC<RoomBackgroundProps> = ({
  isNight = false,
  floorY = 1040,
  hasPottedPlant = true,
  artwork,
}) => {
  return (
    <g id="room-background-wrapper" data-preset={isNight ? "livingRoomNight" : "livingRoomDay"}>
      {/* =========================================================================
          FIGMA SVG ARTWORK CONTAINER (2560x1440 2K)
          BẠN HÃY PASTE MÃ SVG BỐI CẢNH PHÒNG TỪ FIGMA VÀO ĐÂY (<!-- PASTE REAL SVG HERE -->)
         ========================================================================= */}
      <g id="figma-room-background-artwork">
        {artwork ? (
          artwork
        ) : (
          /* BẠN HÃY PASTE MÃ SVG BỐI CẢNH PHÒNG TỪ FIGMA VÀO ĐÂY */
          /* <!-- PASTE REAL SVG HERE --> */
          null
        )}
      </g>
    </g>
  );
};
