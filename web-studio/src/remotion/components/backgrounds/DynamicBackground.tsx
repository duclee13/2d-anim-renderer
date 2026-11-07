import React from "react";
import { staticFile } from "remotion";
import { BackgroundPreset } from "../../types/sceneGraph";

export interface DynamicBackgroundProps {
  preset: BackgroundPreset | string;
  customAssetFileName?: string;
}

/**
 * DynamicBackground: Bộ Nạp Bối Cảnh Động từ Kho Asset Bank
 * Tự động nạp file SVG độ phân giải 2K từ: `/assets/backgrounds/${fileName}.svg`
 */
export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  preset,
  customAssetFileName,
}) => {
  // Chuẩn hóa tên file theo preset
  const fileNameMap: Record<string, string> = {
    livingRoomDay: "living-room-day",
    livingRoomNight: "living-room-night",
    gardenDay: "garden-day",
    infographicStripes: "infographic-stripes",
  };

  const assetFileName = customAssetFileName || fileNameMap[preset] || preset;
  // Thêm cache-busting v=20261107_2k để ép trình duyệt luôn nạp đúng file SVG mới nhất
  const assetUrl = staticFile(`assets/backgrounds/${assetFileName}.svg?v=20261107_2k`);

  return (
    <g id={`dynamic-background-${preset}`} data-preset={preset}>
      <image
        href={assetUrl}
        xlinkHref={assetUrl}
        x={0}
        y={0}
        width={2560}
        height={1440}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  );
};
