import React from "react";
import { staticFile } from "remotion";
import { BackgroundPreset } from "../../types/sceneGraph";

export interface DynamicBackgroundProps {
  preset: BackgroundPreset | string;
  customAssetFileName?: string;
}

/**
 * DynamicBackground: Bộ Nạp Bối Cảnh Động 2K từ Kho Asset Bank
 * Tự động ánh xạ mọi preset và alias (camelCase, kebab-case, tiếng Việt) sang file SVG thật:
 * 1. living-room-day (Phòng khách ban ngày)
 * 2. living-room-night (Phòng khách ban đêm)
 * 3. garden-day (Đồng cỏ xanh, bầu trời mây trắng nắng vàng)
 * 4. infographic-stripes (Sọc infographic trừu tượng)
 * 5. classroom (Lớp học, bảng đen lớn)
 * 6. office (Văn phòng cao ốc, view thành phố)
 * 7. city-street (Đường phố đô thị, vỉa hè)
 * 8. beach-sunny (Bãi biển nhiệt đới, cát vàng, rặng dừa)
 * 9. night-sky (Bầu trời đêm đầy sao lấp lánh, vầng trăng khuyết)
 */
export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  preset,
  customAssetFileName,
}) => {
  const fileNameMap: Record<string, string> = {
    // 1. Phòng khách ban ngày
    livingRoomDay: "living-room-day",
    "living-room-day": "living-room-day",
    livingroom: "living-room-day",
    indoor: "living-room-day",

    // 2. Phòng khách ban đêm
    livingRoomNight: "living-room-night",
    "living-room-night": "living-room-night",

    // 3. Đồng cỏ / Sân vườn
    gardenDay: "garden-day",
    "garden-day": "garden-day",
    garden: "garden-day",
    meadow: "garden-day",
    grass: "garden-day",
    outdoor: "garden-day",

    // 4. Infographic
    infographicStripes: "infographic-stripes",
    "infographic-stripes": "infographic-stripes",
    infographic: "infographic-stripes",

    // 5. Lớp học
    classroom: "classroom",
    school: "classroom",

    // 6. Văn phòng
    office: "office",
    workplace: "office",

    // 7. Đường phố
    cityStreet: "city-street",
    "city-street": "city-street",
    city: "city-street",
    street: "city-street",

    // 8. Bãi biển
    beachSunny: "beach-sunny",
    "beach-sunny": "beach-sunny",
    beach: "beach-sunny",
    sea: "beach-sunny",

    // 9. Bầu trời đêm
    nightSky: "night-sky",
    "night-sky": "night-sky",
    night: "night-sky",
    stars: "night-sky",
  };

  const resolveBackgroundFileName = (rawPreset: string | undefined): string => {
    if (!rawPreset) return "living-room-day";
    const raw = String(rawPreset).trim().toLowerCase();
    if (fileNameMap[rawPreset] || fileNameMap[raw]) return fileNameMap[rawPreset] || fileNameMap[raw];

    if (/meadow|garden|grass|lawn|field|park|forest|nature|outdoor|dong-co|thao-nguyen|vuon|cay-xanh/i.test(raw)) {
      return "garden-day";
    }
    if (/class|school|lecture|teacher|student|lop-hoc|truong-hoc|giang-duong|bang-den/i.test(raw)) {
      return "classroom";
    }
    if (/office|workplace|desk|corp|meeting|business|van-phong|cong-ty|cong-so/i.test(raw)) {
      return "office";
    }
    if (/street|city|road|urban|traffic|car|duong-pho|pho-xa|via-he/i.test(raw)) {
      return "city-street";
    }
    if (/beach|sea|ocean|sand|summer|coast|bai-bien|bien|bo-cat/i.test(raw)) {
      return "beach-sunny";
    }
    if (/night-sky|night_sky|star|galaxy|space|cosmos|ngan-ha|vu-tru|sao/i.test(raw)) {
      return "night-sky";
    }
    if (/night|dark|evening|moon|khuya|toi|dem|trang/i.test(raw)) {
      return "living-room-night";
    }
    if (/info|graph|chart|metric|stripes|bieu-do|infographic/i.test(raw)) {
      return "infographic-stripes";
    }
    return "living-room-day";
  };

  const assetFileName = customAssetFileName || resolveBackgroundFileName(preset as string);
  const baseAssetPath = staticFile(`assets/backgrounds/${assetFileName}.svg`);
  const assetUrl = `${baseAssetPath}?v=20261108_2k`;

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
