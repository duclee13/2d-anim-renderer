import { spring, interpolate } from "remotion";

/**
 * Remotion Spring Physics Motion Engine
 * Cung cấp các hàm chuyển động hữu cơ (organic motion) thay thế hoàn toàn linear interpolation.
 */

export interface SpringConfig {
  damping?: number;
  stiffness?: number;
  mass?: number;
  overshootClamping?: boolean;
}

const SOFT_SPRING: SpringConfig = { damping: 14, stiffness: 80, mass: 0.8 };
const BOUNCY_SPRING: SpringConfig = { damping: 10, stiffness: 120, mass: 0.6 };
const SNAPPY_SPRING: SpringConfig = { damping: 20, stiffness: 200, mass: 0.5 };
const GENTLE_SPRING: SpringConfig = { damping: 18, stiffness: 60, mass: 1.0 };

export const springPresets = {
  soft: SOFT_SPRING,
  bouncy: BOUNCY_SPRING,
  snappy: SNAPPY_SPRING,
  gentle: GENTLE_SPRING,
} as const;

/**
 * Tạo giá trị spring 0→1 bắt đầu tại một frame cụ thể.
 */
export function springEnter(
  frame: number,
  fps: number,
  delay: number = 0,
  config: SpringConfig = SOFT_SPRING
): number {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: config.damping ?? 14,
      stiffness: config.stiffness ?? 80,
      mass: config.mass ?? 0.8,
      overshootClamping: config.overshootClamping ?? false,
    },
  });
}

/**
 * Spring scale cho hiệu ứng xuất hiện "pop-in" (0→1 với overshoot nhẹ).
 */
export function springScale(
  frame: number,
  fps: number,
  delay: number = 0,
  config: SpringConfig = BOUNCY_SPRING
): number {
  return springEnter(frame, fps, delay, config);
}

/**
 * Spring dịch chuyển từ vị trí A sang vị trí B.
 */
export function springMove(
  frame: number,
  fps: number,
  from: number,
  to: number,
  delay: number = 0,
  config: SpringConfig = SOFT_SPRING
): number {
  const progress = springEnter(frame, fps, delay, config);
  return interpolate(progress, [0, 1], [from, to]);
}

// =========================================================================
// MICRO-ANIMATIONS (Chuyển động vi mô cho nhân vật sống động)
// =========================================================================

/**
 * Hiệu ứng thở phập phồng cho lồng ngực (Sine wave oscillation).
 * Trả về giá trị scale Y dao động trong khoảng [1 - amplitude, 1 + amplitude].
 */
export function breathingOscillation(
  frame: number,
  fps: number,
  cycleSeconds: number = 3.0,
  amplitude: number = 0.038
): number {
  const phase = (frame / fps) * (Math.PI * 2) / cycleSeconds;
  return 1.0 + Math.sin(phase) * amplitude;
}

/**
 * Nhịp nháy mắt ngẫu nhiên (blink) trả về boolean.
 * Nháy khoảng 3-5 lần mỗi 60 giây, mỗi lần nháy kéo dài ~6 frames.
 */
export function shouldBlink(frame: number, fps: number, seed: number = 42): boolean {
  const blinkDuration = 6; // frames
  // Sử dụng hàm toán chia phần dư để tạo blink pattern giả ngẫu nhiên
  const blinkIntervals = [
    Math.floor(1.2 * fps),
    Math.floor(3.7 * fps),
    Math.floor(5.1 * fps),
    Math.floor(7.8 * fps),
    Math.floor(9.4 * fps),
    Math.floor(12.0 * fps),
    Math.floor(14.5 * fps),
    Math.floor(16.3 * fps),
  ];

  for (const interval of blinkIntervals) {
    const offset = ((interval + seed * 7) % (Math.floor(fps * 4))) + Math.floor(fps * 2);
    const cycleFrame = frame % offset;
    if (cycleFrame >= 0 && cycleFrame < blinkDuration) {
      return true;
    }
  }
  return false;
}

/**
 * Hiệu ứng nói miệng mở-đóng nhịp nhàng (lip-sync đơn giản).
 * Khoảng 4-5 lần mở miệng mỗi giây.
 */
export function talkingMouthCycle(frame: number, fps: number): boolean {
  const frequency = 5; // syllables per second
  const phase = (frame / fps) * frequency * Math.PI * 2;
  return Math.sin(phase) > 0.2;
}

/**
 * Hiệu ứng lắc lư nhẹ (idle sway) theo trục X cho nhân vật đứng yên.
 */
export function idleSway(
  frame: number,
  fps: number,
  amplitudeX: number = 14,
  cycleSeconds: number = 3.6
): number {
  const phase = (frame / fps) * (Math.PI * 2) / cycleSeconds;
  return Math.sin(phase) * amplitudeX;
}

/**
 * Hiệu ứng dao động lắc lư cho con nhện trong lọ.
 */
export function spiderSway(
  frame: number,
  fps: number,
  amplitudeX: number = 6,
  amplitudeY: number = 3
): { offsetX: number; offsetY: number; rotation: number } {
  const phaseX = (frame / fps) * Math.PI * 2 / 2.8; // ~2.8s cycle
  const phaseY = (frame / fps) * Math.PI * 2 / 1.6; // ~1.6s cycle
  return {
    offsetX: Math.sin(phaseX) * amplitudeX,
    offsetY: Math.sin(phaseY) * amplitudeY,
    rotation: Math.sin(phaseX * 0.7) * 5, // subtle rotation ±5 degrees
  };
}

/**
 * Hiệu ứng Squash & Stretch (Nén/Giãn) khi vật thể rơi chạm đất.
 * @param frame Frame hiện tại (tương đối so với thời điểm chạm đất)
 * @param fps FPS
 * @param impactFrame Frame xảy ra va chạm (tương đối)
 * @returns {{ scaleX: number; scaleY: number }}
 */
export function squashStretch(
  frame: number,
  fps: number,
  impactFrame: number = 0
): { scaleX: number; scaleY: number } {
  const elapsed = frame - impactFrame;
  if (elapsed < 0) {
    // Pre-impact: Stretch khi rơi xuống
    const stretchFactor = 1.0 + Math.min(0.15, Math.abs(elapsed) / fps * 0.4);
    return { scaleX: 1.0 / stretchFactor, scaleY: stretchFactor };
  }

  // Post-impact: Squash rồi nảy lại
  const recovery = spring({
    frame: elapsed,
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });

  const squashPeak = 0.25;
  const squashAmount = interpolate(recovery, [0, 1], [squashPeak, 0]);
  return {
    scaleX: 1.0 + squashAmount,
    scaleY: 1.0 - squashAmount,
  };
}

/**
 * Hiệu ứng sợi tơ nhện thả từ trần nhà xuống (spring dangle).
 * Trả về tọa độ Y đáy dây tơ.
 */
export function spiderSilkDangle(
  frame: number,
  fps: number,
  ceilingY: number,
  targetY: number,
  delay: number = 0
): number {
  const progress = springEnter(frame, fps, delay, {
    damping: 6,
    stiffness: 40,
    mass: 1.2,
  });
  return interpolate(progress, [0, 1], [ceilingY, targetY]);
}
