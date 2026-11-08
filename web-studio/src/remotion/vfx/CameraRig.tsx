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
    // Nếu slot là vị trí nhân vật (ngồi bàn, sofa hoặc sàn), focus vào phần ngực/khuôn mặt nhân vật thay vì bàn chân
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
        y: character.y - 420, // Focus vào ngực/khuôn mặt nhân vật
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

  // 3. KẸP BIÊN CAMERA (CLAMP CAMERA BOUNDS - BẢO VỆ TUYỆT ĐỐI KHÔNG LỘ ĐÁY & KHÔNG MẤT ĐẦU)
  if (currentZoom <= 1.001) {
    // Khi zoom = 1.0, bắt buộc panX = 0, panY = 0 (tâm cố định chính giữa màn hình)
    currentFocalX = centerX;
    currentFocalY = centerY;
    currentZoom = 1.0;
  } else {
    // Bán kính vùng nhìn thấy theo không gian thế giới (World Space)
    const halfVisibleW = centerX / currentZoom;
    const halfVisibleY = centerY / currentZoom;

    // Kẹp biên trục X: Không hở khoảng trống bên trái hoặc phải canvas
    currentFocalX = Math.max(halfVisibleW, Math.min(canvasWidth - halfVisibleW, currentFocalX));

    // Kẹp biên trục Y:
    // Cạnh dưới màn hình (y = 1440) tuyệt đối không bao giờ bị kéo cao hơn đáy canvas (không lộ đáy trống dưới sàn)
    // Cạnh trên không hở quá y = 0
    const minFocalY = halfVisibleY;
    const maxFocalY = canvasHeight - halfVisibleY;
    currentFocalY = Math.max(minFocalY, Math.min(maxFocalY, currentFocalY));

    // Đảm bảo nếu có nhân vật hiển thị trong cảnh, đỉnh đầu nhân vật luôn >= 150px trong viewport
    if (character && character.visible !== false && character.x > -9000) {
      const charHeadWorldY = character.y - 755; // Đỉnh đầu nhân vật
      const charHeadViewportY = (charHeadWorldY - currentFocalY) * currentZoom + centerY;
      if (charHeadViewportY < 150) {
        // Đẩy tiêu cự Y lên để đầu nhân vật lùi xuống đạt tối thiểu 150px
        const neededFocalY = charHeadWorldY - (150 - centerY) / currentZoom;
        currentFocalY = Math.max(minFocalY, Math.min(maxFocalY, neededFocalY));
      }
    }
  }

  // 4. CÔNG THỨC BIẾN ĐỔI CAMERA (GIỮ TÂM TIÊU ĐIỂM TẠI CHÍNH GIỮA MÀN HÌNH)
  // Translate to viewport center -> Scale -> Translate back to negative focal point
  const cameraTransform = `translate(${centerX}, ${centerY}) scale(${currentZoom}) translate(${-currentFocalX}, ${-currentFocalY})`;

  return (
    <g id="camera-rig-viewport" transform={cameraTransform}>
      {children}
    </g>
  );
};
