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
    targetPoint = resolveSemanticSlot(camera.focusSlot, targetPoint);
  } else if (camera?.focusTarget) {
    if (camera.focusTarget === "character" && character) {
      targetPoint = {
        x: character.x,
        y: character.y - 420, // Focus vào ngực/khuôn mặt nhân vật
      };
    } else {
      const foundProp = propsList.find((p) => p.id === camera.focusTarget);
      if (foundProp) {
        targetPoint = {
          x: foundProp.x,
          y: foundProp.y - 150,
        };
      }
    }
  }

  // 2. TÍNH TOÁN ZOOM DỰA TRÊN ZOOMFROM -> ZOOMTO HOẶC ZOOM TĨNH
  const zoomFrom = camera?.zoomFrom ?? (camera?.zoom ?? 1.0);
  const zoomTo = camera?.zoomTo ?? (camera?.zoom ?? 1.0);
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

  // 3. CÔNG THỨC BIẾN ĐỔI CAMERA (GIỮ TÂM TIÊU ĐIỂM TẠI CHÍNH GIỮA MÀN HÌNH)
  // Translate to viewport center -> Scale -> Translate back to negative focal point
  const cameraTransform = `translate(${centerX}, ${centerY}) scale(${currentZoom}) translate(${-currentFocalX}, ${-currentFocalY})`;

  return (
    <g id="camera-rig-viewport" transform={cameraTransform}>
      {children}
    </g>
  );
};
