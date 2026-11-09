import React from "react";
import { interpolate, Easing } from "remotion";
import { CameraConfig, PropItem } from "../types/sceneGraph";
import { StickmanState, Point2D } from "../types/character";
import { resolveSemanticSlot, STAGE_CONFIG } from "../utils/slotResolver";

export interface CameraRigProps {
  children: React.ReactNode;
  camera?: CameraConfig;
  sceneLocalFrame: number;
  durationInFrames: number;
  character?: StickmanState;
  propsList?: PropItem[];
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ClampedCameraTransform {
  zoom: number;
  focalX: number;
  focalY: number;
  transformString: string;
}

/**
 * Hàm toán học clampCameraTransform khóa cứng không gian thế giới vào viewport 2K:
 * - Ở mọi mức zoom, mép khung hình không bao giờ bị hở mép ngoài của Background (0 <= left, right <= 2560, 0 <= top, bottom <= 1440).
 * - Không bao giờ cắt mất phần đầu của nhân vật chính (đỉnh đầu luôn >= 150px trong viewport).
 */
export function clampCameraTransform(
  rawZoom: number,
  rawFocalX: number,
  rawFocalY: number,
  canvasWidth: number = 2560,
  canvasHeight: number = 1440,
  characterHeadY?: number
): ClampedCameraTransform {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  let zoom = Math.max(1.0, rawZoom);
  let focalX = rawFocalX;
  let focalY = rawFocalY;

  if (zoom <= 1.001) {
    zoom = 1.0;
    focalX = centerX;
    focalY = centerY;
  } else {
    const halfVisibleW = centerX / zoom;
    const halfVisibleH = centerY / zoom;

    // Kẹp biên trục X: Không hở khoảng trống bên trái hoặc phải canvas
    focalX = Math.max(halfVisibleW, Math.min(canvasWidth - halfVisibleW, focalX));

    // Kẹp biên trục Y: Không hở trên (y=0) và không lộ đáy sàn dưới (y=1440)
    const minFocalY = halfVisibleH;
    const maxFocalY = canvasHeight - halfVisibleH;
    focalY = Math.max(minFocalY, Math.min(maxFocalY, focalY));

    // Đảm bảo đỉnh đầu nhân vật luôn >= 150px trong viewport
    if (characterHeadY !== undefined) {
      const charHeadViewportY = (characterHeadY - focalY) * zoom + centerY;
      if (charHeadViewportY < 150) {
        const neededFocalY = characterHeadY - (150 - centerY) / zoom;
        focalY = Math.max(minFocalY, Math.min(maxFocalY, neededFocalY));
      }
    }
  }

  const transformString = `translate(${centerX}, ${centerY}) scale(${zoom}) translate(${-focalX}, ${-focalY})`;
  return { zoom, focalX, focalY, transformString };
}

/**
 * CameraRig: Hệ thống Camera Điện ảnh 2K (Cinematography Camera Engine)
 * 
 * 1. Zoom In / Zoom Out mượt mà theo hàm Easing.bezier(0.25, 0.1, 0.25, 1).
 * 2. Pan & Focal Tracking: Bám theo slot ngữ nghĩa ('focusSlot') hoặc ID đối tượng ('focusTarget').
 * 3. Đảm bảo SubtitleBox và UI Overlay nằm ngoài CameraRig để luôn sắc nét, không bị phóng to theo cảnh.
 */
export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  camera,
  sceneLocalFrame,
  durationInFrames,
  character,
  propsList = [],
  canvasWidth = 2560,
  canvasHeight = 1440,
}) => {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // 1. TÍNH TOÁN ĐIỂM FOCAL TARGET (TÂM TIÊU CỰ CỦA CAMERA)
  let targetPoint: Point2D = {
    x: camera?.x ?? centerX,
    y: camera?.y ?? centerY,
  };

  if (camera?.focusSlot) {
    const slotPoint = resolveSemanticSlot(camera.focusSlot, targetPoint);
    if (
      camera.focusSlot === "desk.seat" ||
      camera.focusSlot.startsWith("floor.") ||
      camera.focusSlot.startsWith("sofa.")
    ) {
      targetPoint = {
        x: slotPoint.x,
        y: Math.min(centerY, slotPoint.y - 420),
      };
    } else {
      targetPoint = slotPoint;
    }
  } else if (camera?.focusTarget) {
    if (camera.focusTarget === "character" && character && character.visible !== false) {
      targetPoint = {
        x: character.x,
        y: character.y - 420,
      };
    } else {
      const foundProp = propsList.find(
        (p) => p.id === camera.focusTarget || p.type === camera.focusTarget
      );
      if (foundProp) {
        const propPos = resolveSemanticSlot(foundProp.slot, { x: foundProp.x, y: foundProp.y });
        targetPoint = {
          x: propPos.x,
          y: propPos.y - (foundProp.anchorPoint === "center" ? 0 : 150),
        };
      }
    }
  }

  // 2. TÍNH TOÁN ZOOM DỰA TRÊN ZOOMFROM -> ZOOMTO HOẶC ZOOM TĨNH
  const isCloseUpFocus =
    camera?.focusSlot === "screen.centerCloseUp" ||
    camera?.focusSlot === "screen.center" ||
    propsList.some((p) => p.slot === "screen.centerCloseUp" || p.slot === "screen.center");

  let rawZoomFrom = camera?.zoomFrom ?? (camera?.zoom ?? 1.0);
  let rawZoomTo = camera?.zoomTo ?? (camera?.zoom ?? 1.0);

  // CHỐNG PHÓNG ĐẠI QUÁ MỨC (Anti-Overzoom): Cảnh cận đạo cụ đã scale 1.7x nên zoom camera tối đa 1.15x
  if (isCloseUpFocus) {
    if (rawZoomFrom > 1.25) rawZoomFrom = 1.15;
    if (rawZoomTo > 1.25) rawZoomTo = 1.15;
  }

  const zoomFrom = rawZoomFrom;
  const zoomTo = rawZoomTo;
  const isZooming = camera?.zoomFrom !== undefined && camera?.zoomTo !== undefined;

  let currentZoom = zoomTo;
  let currentFocalX = targetPoint.x;
  let currentFocalY = targetPoint.y;

  if (isZooming) {
    const panDuration = camera?.panDurationFrames ?? Math.min(60, durationInFrames);
    const progress = interpolate(sceneLocalFrame, [0, panDuration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    currentZoom = interpolate(progress, [0, 1], [zoomFrom, zoomTo]);
    currentFocalX = interpolate(progress, [0, 1], [centerX, targetPoint.x]);
    currentFocalY = interpolate(progress, [0, 1], [centerY, targetPoint.y]);
  }

  // 3. KẸP BIÊN CAMERA BẰNG HÀM TOÁN HỌC CHUẨN
  const charHeadY =
    character && character.visible !== false && character.x > -9000
      ? character.y - 755
      : undefined;

  const clamped = clampCameraTransform(
    currentZoom,
    currentFocalX,
    currentFocalY,
    canvasWidth,
    canvasHeight,
    charHeadY
  );

  return (
    <g id="camera-rig-viewport" transform={clamped.transformString}>
      {children}
    </g>
  );
};
