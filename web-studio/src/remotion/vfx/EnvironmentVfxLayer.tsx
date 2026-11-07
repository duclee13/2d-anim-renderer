import React from "react";
import { EnvironmentVfxType, LightingConfig } from "../types/sceneGraph";
import { STAGE_CONFIG } from "../utils/slotResolver";

export interface EnvironmentVfxLayerProps {
  effects?: EnvironmentVfxType[];
  lighting?: LightingConfig;
  frame: number;
  fps?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

// Mảng hạt mưa cố định theo thuật toán PRNG (đảm bảo deterministic và mượt mà 60fps)
const RAIN_DROPS = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  seedX: (i * 137.5) % 2560,
  seedY: (i * 83.3) % 1440,
  speed: 24 + (i % 5) * 4,
  length: 28 + (i % 4) * 6,
  opacity: 0.25 + (i % 4) * 0.12,
  strokeWidth: 2.5 + (i % 3) * 0.8,
}));

// Mảng gợn sóng nước khi mưa chạm sàn
const RAIN_SPLASHES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: 200 + i * 190,
  y: STAGE_CONFIG.floorY,
  period: 30 + (i % 4) * 5,
  phase: i * 7,
}));

// Đám mây trôi ngang qua bầu trời
const CLOUDS = [
  { id: 1, seedX: 100, y: 120, width: 340, height: 140, speed: 1.1, opacity: 0.85 },
  { id: 2, seedX: 900, y: 220, width: 420, height: 160, speed: 0.8, opacity: 0.70 },
  { id: 3, seedX: 1750, y: 100, width: 300, height: 120, speed: 1.3, opacity: 0.80 },
  { id: 4, seedX: 2350, y: 260, width: 380, height: 150, speed: 0.9, opacity: 0.65 },
];

/**
 * EnvironmentVfxLayer: Hệ thống Môi trường Chuyển động Lặp Tự Động (Procedural Environment Loops)
 * 
 * 1. rainLoop: Mưa rơi nghiêng theo chiều sâu (Parallax) kèm gợn nước lăn tăn trên mặt sàn.
 * 2. cloudDrift: Mây trôi ngang liên tục bằng phép chia lấy dư không giật khựng.
 * 3. windBreeze: Làn gió uốn lượn mềm mại chuyển động bằng strokeDashoffset.
 * 4. sunbeams & warmNightLamp: Luồng sáng Volumetric Light Falloff điện ảnh.
 */
export const EnvironmentVfxLayer: React.FC<EnvironmentVfxLayerProps> = ({
  effects = [],
  lighting,
  frame,
  canvasWidth = 2560,
  canvasHeight = 1440,
}) => {
  const hasRain = effects.includes("rainLoop");
  const hasClouds = effects.includes("cloudDrift");
  const hasWind = effects.includes("windBreeze");
  const hasSunbeams = effects.includes("sunbeams") || lighting?.preset === "sunbeams" || lighting?.sunbeams;
  const hasWarmNightLamp = lighting?.preset === "warmNightLamp";

  return (
    <g id="environment-vfx-layer" className="pointer-events-none select-none">
      {/* =========================================================================
          1. CLOUD DRIFT (MÂY TRÔI NGANG BẦU TRỜI TUYẾN TÍNH)
         ========================================================================= */}
      {hasClouds && (
        <g id="vfx-cloud-drift">
          {CLOUDS.map((c) => {
            const currentX =
              ((c.seedX + frame * c.speed) % (canvasWidth + c.width + 100)) - c.width;
            return (
              <g
                key={c.id}
                transform={`translate(${currentX}, ${c.y})`}
                opacity={c.opacity}
              >
                {/* Fluffy Cartoon Cloud Shape */}
                <ellipse cx={c.width * 0.5} cy={c.height * 0.6} rx={c.width * 0.45} ry={c.height * 0.35} fill="#FFFFFF" />
                <circle cx={c.width * 0.32} cy={c.height * 0.45} r={c.height * 0.35} fill="#FFFFFF" />
                <circle cx={c.width * 0.58} cy={c.height * 0.35} r={c.height * 0.42} fill="#FFFFFF" />
                <circle cx={c.width * 0.78} cy={c.height * 0.50} r={c.height * 0.30} fill="#FFFFFF" />
              </g>
            );
          })}
        </g>
      )}

      {/* =========================================================================
          2. SUNBEAMS & ROTATING TWINKLING SUN (MẶT TRỜI TIA NẮNG XOAY & NHẤP NHÁY NHẸ)
         ========================================================================= */}
      {hasSunbeams && (
        <g id="vfx-sunbeams-system">
          {/* A. MẶT TRỜI HOẠT HỌA 2K (Tâm sáng rực & các tia nắng xoay tròn nhẹ nhàng) */}
          <g id="vfx-sun-actor" transform={`translate(280, 180)`}>
            {/* Quầng sáng tỏa rộng */}
            <circle cx={0} cy={0} r={180} fill="url(#sunGlow)" opacity={0.85 + 0.15 * Math.sin(frame * 0.04)} />

            {/* Các tia nắng hoạt họa xoay quanh tâm (0.22 deg/frame ~13 deg/giây) */}
            <g
              id="vfx-sun-rays"
              transform={`rotate(${frame * 0.22}, 0, 0)`}
              opacity={0.82 + 0.18 * Math.sin(frame * 0.05)}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 360) / 12;
                return (
                  <polygon
                    key={i}
                    points="-14,-105 14,-105 0,-155"
                    fill="#FBBF24"
                    stroke="#F59E0B"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    transform={`rotate(${angle}, 0, 0)`}
                  />
                );
              })}
            </g>

            {/* Đĩa tròn mặt trời trung tâm */}
            <circle
              cx={0}
              cy={0}
              r={78}
              fill="url(#sunCenter)"
              stroke="#F59E0B"
              strokeWidth={8}
            />
          </g>

          {/* B. CÁC DẢI GOD RAYS CHIẾU CHÉO ĐA TẦNG ALPHA */}
          <g id="vfx-god-rays" opacity={0.70 + 0.15 * Math.sin(frame * 0.035)}>
            {/* Chùm tia nắng 1 */}
            <polygon
              points="180,0 360,0 1250,1440 850,1440"
              fill="url(#sunbeamsGradient)"
            />
            {/* Chùm tia nắng 2 */}
            <polygon
              points="620,0 820,0 1950,1440 1600,1440"
              fill="url(#sunbeamsGradient)"
            />
            {/* Chùm tia nắng 3 */}
            <polygon
              points="1150,0 1280,0 2480,1440 2200,1440"
              fill="url(#sunbeamsGradient)"
            />
          </g>
        </g>
      )}

      {/* =========================================================================
          3. WARM NIGHT LAMP (CHÓP SÁNG VÀNG ẤM VỚI FALLOFF MỀM MẠI TRÊN BÀN)
         ========================================================================= */}
      {hasWarmNightLamp && (
        <g id="vfx-warm-night-lamp">
          {/* Chóp nón ánh sáng tỏa từ đầu đèn bàn (x=800, y=560) xuống mặt bàn (y=760) */}
          <polygon
            points="810,540 830,540 1350,1120 480,1120"
            fill="url(#lightConeGradient)"
            opacity={0.88 + 0.06 * Math.sin(frame * 0.06)}
          />
          {/* Vệt sáng ấm hình oval tỏa tròn trên mặt bàn gỗ */}
          <ellipse
            cx={850}
            cy={765}
            rx={280}
            ry={45}
            fill="url(#tableSurfaceGlow)"
            opacity={0.9}
          />
        </g>
      )}

      {/* =========================================================================
          4. WIND BREEZE (LÀN GIÓ UỐN LƯỢN MỀM MẠI DÙNG STROKEDASHOFFSET)
         ========================================================================= */}
      {hasWind && (
        <g id="vfx-wind-breeze" stroke="#FFFFFF" strokeLinecap="round" fill="none">
          {/* Làn gió 1 (tầng cao) */}
          <path
            d="M 100,320 Q 550,220 950,300 T 1750,260 T 2500,290"
            strokeWidth={5}
            strokeDasharray="180 340"
            strokeDashoffset={-frame * 14}
            opacity={0.45}
          />
          {/* Làn gió 2 (tầng trung) */}
          <path
            d="M 200,680 Q 700,580 1200,650 T 2000,620 T 2600,660"
            strokeWidth={4.5}
            strokeDasharray="140 280"
            strokeDashoffset={-frame * 12}
            opacity={0.35}
          />
          {/* Làn gió 3 (sát mặt đất) */}
          <path
            d="M 50,1050 Q 500,980 1000,1030 T 1800,1010 T 2550,1040"
            strokeWidth={4}
            strokeDasharray="120 310"
            strokeDashoffset={-frame * 16}
            opacity={0.40}
          />
        </g>
      )}

      {/* =========================================================================
          5. RAIN LOOP & GROUND SPLASHES (MƯA RƠI CHÉO PARALLAX VÀ GỢN SÓNG NƯỚC)
         ========================================================================= */}
      {hasRain && (
        <g id="vfx-rain-loop">
          {/* Các vệt mưa rơi xiên góc -14 độ */}
          <g stroke="#93C5FD" strokeLinecap="round">
            {RAIN_DROPS.map((drop) => {
              const currentY = (drop.seedY + frame * drop.speed) % canvasHeight;
              const currentX =
                (drop.seedX - (currentY / canvasHeight) * 220 + canvasWidth) % canvasWidth;
              return (
                <line
                  key={drop.id}
                  x1={currentX}
                  y1={currentY}
                  x2={currentX - 7}
                  y2={currentY + drop.length}
                  strokeWidth={drop.strokeWidth}
                  opacity={drop.opacity}
                />
              );
            })}
          </g>

          {/* Gợn nước lăn tăn trên mặt sàn (y = floorY) */}
          <g id="vfx-rain-splashes" stroke="#93C5FD" fill="none">
            {RAIN_SPLASHES.map((splash) => {
              const life = (frame + splash.phase) % splash.period;
              const progress = life / splash.period;
              const rx = progress * 24;
              const ry = rx * 0.35;
              const splashOpacity = (1 - progress) * 0.65;
              return (
                <ellipse
                  key={splash.id}
                  cx={splash.x}
                  cy={splash.y}
                  rx={rx}
                  ry={ry}
                  strokeWidth={2}
                  opacity={splashOpacity}
                />
              );
            })}
          </g>
        </g>
      )}
    </g>
  );
};
