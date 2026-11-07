import { Point2D } from "../types/character";

export const STAGE_CONFIG = {
  canvasWidth: 2560,
  canvasHeight: 1440,
  floorY: 1120, // 2K Floor Baseline
  deskX: 1150,
  deskY: 1120,
  deskSurfaceY: 760, // Top surface of the desk
  screenCenterX: 1280,
  screenCenterY: 720,
};

/**
 * SEMANTIC SLOTS (Chuẩn hóa tọa độ ngữ nghĩa cho AI Scriptwriting)
 * Giúp AI (Gemini) không bao giờ phải đoán pixel (x, y).
 * Tất cả các tọa độ đều tuân thủ nguyên tắc ORIGIN = BOTTOM-CENTER.
 */
export const SEMANTIC_SLOTS: Record<string, Point2D> = {
  // --- 1. SLOTS TRÊN SÀN NHÀ (floorY = 1120) ---
  "floor.farLeft": { x: 380, y: STAGE_CONFIG.floorY },
  "floor.left": { x: 780, y: STAGE_CONFIG.floorY },
  "floor.centerLeft": { x: 1050, y: STAGE_CONFIG.floorY },
  "floor.center": { x: 1280, y: STAGE_CONFIG.floorY },
  "floor.centerRight": { x: 1510, y: STAGE_CONFIG.floorY },
  "floor.right": { x: 1850, y: STAGE_CONFIG.floorY },
  "floor.farRight": { x: 2200, y: STAGE_CONFIG.floorY },

  // --- 2. SLOTS BÀN HỌC & LÀM VIỆC (Desk at x=1150, tabletop at y=760) ---
  // Vị trí người que ngồi chuẩn sau bàn
  "desk.seat": { x: STAGE_CONFIG.deskX, y: STAGE_CONFIG.floorY },
  // Đèn bàn đặt sát mặt phẳng bàn bên trái
  "desk.topLeft": { x: 800, y: STAGE_CONFIG.deskSurfaceY },
  // Laptop / Đạo cụ giữa bàn
  "desk.topCenter": { x: STAGE_CONFIG.deskX, y: STAGE_CONFIG.deskSurfaceY },
  // Lọ thủy tinh / Cốc cà phê đặt trên bàn bên phải
  "desk.topRight": { x: 1480, y: STAGE_CONFIG.deskSurfaceY },

  // --- 3. SLOTS CẢNH CẬN & INFOGRAPHIC (Giữa màn hình) ---
  "screen.center": { x: STAGE_CONFIG.screenCenterX, y: STAGE_CONFIG.screenCenterY },
  "screen.centerCloseUp": { x: STAGE_CONFIG.screenCenterX, y: STAGE_CONFIG.screenCenterY },
  "screen.gaugeCenter": { x: STAGE_CONFIG.screenCenterX, y: 720 },

  // --- 4. SLOTS SOFA PHÒNG KHÁCH ---
  "sofa.seat": { x: 2050, y: STAGE_CONFIG.floorY },
  "sofa.left": { x: 1850, y: STAGE_CONFIG.floorY },
  "sofa.right": { x: 2250, y: STAGE_CONFIG.floorY },
};

/**
 * Phân giải slot ngữ nghĩa thành tọa độ Point2D { x, y }
 * Nếu không tìm thấy slot, fallback về tọa độ thủ công hoặc tâm màn hình.
 */
export function resolveSemanticSlot(
  slot?: string,
  fallback?: { x?: number; y?: number }
): Point2D {
  if (slot && SEMANTIC_SLOTS[slot]) {
    return SEMANTIC_SLOTS[slot];
  }

  // Thử tra cứu linh hoạt (bỏ khoảng trắng, case-insensitive)
  if (slot) {
    const normalized = slot.trim().toLowerCase();
    for (const [key, val] of Object.entries(SEMANTIC_SLOTS)) {
      if (key.toLowerCase() === normalized) {
        return val;
      }
    }
  }

  return {
    x: fallback?.x ?? STAGE_CONFIG.screenCenterX,
    y: fallback?.y ?? STAGE_CONFIG.floorY,
  };
}
