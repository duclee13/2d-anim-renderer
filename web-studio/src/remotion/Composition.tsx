import React, { useState, useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill, Easing } from "remotion";
import {
  MasterSceneGraph,
  SceneGraphScene,
  SceneKeyframe,
  DynamicLineItem,
} from "./types/sceneGraph";
import { StickmanRig } from "./components/character/StickmanRig";
import { DynamicProp } from "./components/props/DynamicProp";
import { DynamicBackground } from "./components/backgrounds/DynamicBackground";
import { SubtitleBox } from "./components/ui/SubtitleBox";
import { SpeechBubble } from "./components/ui/SpeechBubble";
import { DynamicLine, resolveAnchorRef, AnchorResolverContext } from "./components/lines/DynamicLine";
import { PropAnchorPorts, Point2D, StickmanState } from "./types/character";
import {
  springEnter,
  springMove,
  springScale,
  breathingOscillation,
  shouldBlink,
  talkingMouthCycle,
  idleSway,
  spiderSway,
  squashStretch,
} from "./lib/motionEngine";
import { sampleScriptSceneGraph } from "./data/sampleScript";
import { resolveSemanticSlot, STAGE_CONFIG } from "./utils/slotResolver";
import { SvgDefsLibrary } from "./vfx/SvgDefsLibrary";
import { CameraRig } from "./vfx/CameraRig";
import { EnvironmentVfxLayer } from "./vfx/EnvironmentVfxLayer";
import { normalizePropAssetId } from "./utils/propResolver";

export interface MainCompositionProps {
  sceneGraph?: MasterSceneGraph;
  scenes?: any[];
  totalFrames?: number;
}

// Re-export để tương thích ngược
export const defaultMockSceneGraph = sampleScriptSceneGraph;

export const MainScene: React.FC<MainCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Xác định Scene Graph linh hoạt (hỗ trợ cả props.sceneGraph lẫn root props)
  const effectiveGraph: MasterSceneGraph = useMemo(() => {
    if (props.sceneGraph && props.sceneGraph !== defaultMockSceneGraph) {
      return props.sceneGraph;
    }
    if (props.scenes && Array.isArray(props.scenes) && props.scenes.length > 0) {
      return {
        version: "3.1.0",
        title: "Stickman 2D Explainer Video",
        width: 2560,
        height: 1440,
        fps: 60,
        totalDurationInFrames: props.totalFrames || 480,
        scenes: props.scenes,
      } as MasterSceneGraph;
    }
    return props.sceneGraph || defaultMockSceneGraph;
  }, [props.sceneGraph, props.scenes, props.totalFrames]);

  // Lưu trữ cổng neo của đạo cụ được active để phục vụ Auto-Anchoring IK
  const [activePropAnchors, setActivePropAnchors] = useState<
    Record<string, PropAnchorPorts>
  >({});

  // =========================================================================
  // TÌM SCENE HIỆN TẠI (Đảm bảo an toàn 100% không bị undefined/NaN)
  // =========================================================================
  const safeScenes = Array.isArray(effectiveGraph?.scenes) && effectiveGraph.scenes.length > 0
    ? effectiveGraph.scenes
    : sampleScriptSceneGraph.scenes;

  const currentScene: SceneGraphScene =
    safeScenes.find((s) => {
      const sStart = Number(s?.startFrame) || 0;
      const sDur = Number(s?.durationInFrames) || 120;
      return frame >= sStart && frame < sStart + sDur;
    }) || safeScenes[safeScenes.length - 1];

  const sceneStartFrame = Number(currentScene?.startFrame) || 0;
  const sceneLocalFrame = frame - sceneStartFrame;

  const safeSubtitles = Array.isArray(currentScene?.subtitles) ? currentScene.subtitles : [];
  const safeSpeechBubbles = Array.isArray(currentScene?.speechBubbles) ? currentScene.speechBubbles : [];
  const safeKeyframes = Array.isArray(currentScene?.keyframes) ? currentScene.keyframes : [];

  // =========================================================================
  // TÌM SUBTITLE & SPEECH BUBBLE ACTIVE
  // =========================================================================
  const activeSubtitle = safeSubtitles.find((sub) => {
    const s = Number(sub?.startFrame) || 0;
    const e = Number(sub?.endFrame) || 0;
    return frame >= s && frame <= e;
  });

  const activeSpeechBubbles = safeSpeechBubbles.filter((b) => {
    const s = Number(b?.startFrame) || 0;
    const e = Number(b?.endFrame) || 0;
    return frame >= s && frame <= e;
  });

  // =========================================================================
  // GIẢI QUYẾT KEYFRAMES → Cập nhật props/character state theo thời gian
  // =========================================================================
  const activeKeyframes = useMemo(
    () => safeKeyframes.filter((kf) => sceneLocalFrame >= (Number(kf?.frame) || 0)),
    [safeKeyframes, sceneLocalFrame]
  );

  // =========================================================================
  // TÍNH TOÁN TRẠNG THÁI NHÂN VẬT VỚI MICRO-ANIMATIONS & DYNAMIC MOTION
  // =========================================================================
  const sceneText = `${currentScene.name || ""} ${safeSubtitles.map((s) => s.text).join(" ")}`.toLowerCase();
  const hasHoldAction = /cầm|bê|mang|xách|giữ|nâng|holding|carry/i.test(sceneText);
  const hasWalkAction = /mang ra|bước|đi bộ|chạy|di chuyển|walk|going/i.test(sceneText);

  const isSitting = currentScene.character.pose === "sittingBehindDesk";
  const isHolding =
    currentScene.character.pose === "holdingObject" ||
    (hasHoldAction && currentScene.props.length > 0 && !isSitting);
  const isCharacterVisible =
    currentScene.character.visible !== false && currentScene.character.x > -9000;

  // Phân giải vị trí chuẩn qua Semantic Slot (Zero-Guessing Pixel Engine)
  const baseCharPos = resolveSemanticSlot(currentScene.character.slot, {
    x: currentScene.character.x,
    y: currentScene.character.y ?? STAGE_CONFIG.floorY,
  });

  // Bắt đầu với state ban đầu
  const dynamicCharacterState: StickmanState = {
    ...currentScene.character,
    x: baseCharPos.x,
    y: baseCharPos.y,
  };
  if (isHolding) {
    dynamicCharacterState.pose = "holdingObject";
  }

  // --- Áp dụng keyframe "moveCharacter" hoặc tự động bước đi khi có keyword walk ---
  // TÍNH TOÁN VẬN TỐC THỰC TẾ & CHỈ BƯỚC ĐI KHI ĐANG DI CHUYỂN
  const isWalkingPose = dynamicCharacterState.pose === "walking" || hasWalkAction;
  const moveCharKf: any = activeKeyframes.find(
    (kf: any) =>
      (kf.action === "moveCharacter" || kf.type === "moveCharacter") &&
      (kf.target === "character" || kf.targetId === "stickman_main" || !kf.target)
  );
  let charVelocity = 0;

  if (isCharacterVisible) {
    if (isWalkingPose) {
      // 1. DI CHUYỂN BƯỚC ĐI TỰ NHIÊN: Trải đều êm ái xuyên suốt thời lượng cảnh (không dùng spring giật cục)
      const walkStartFrame = Number(moveCharKf?.frame ?? moveCharKf?.startFrame ?? 0);
      const walkDuration = Math.max(90, Math.min(currentScene.durationInFrames * 0.85, 420));

      const defaultStartX = dynamicCharacterState.facing === "left" ? 1800 : 650;
      const defaultEndX = dynamicCharacterState.facing === "left" ? 750 : 1850;

      const rawFromX = moveCharKf?.params?.fromX ?? moveCharKf?.fromX;
      const rawToX = moveCharKf?.params?.toX ?? moveCharKf?.toX;

      const fromX = rawFromX !== undefined ? Number(rawFromX) : defaultStartX;
      const toX = rawToX !== undefined ? Number(rawToX) : defaultEndX;

      const walkLocalProgress = Math.min(1, Math.max(0, (sceneLocalFrame - walkStartFrame) / walkDuration));

      const easedProgress = interpolate(
        walkLocalProgress,
        [0, 1],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }
      );

      dynamicCharacterState.x = interpolate(easedProgress, [0, 1], [fromX, toX]);

      // Khi đang trong thời gian bước đi: vận tốc ổn định để duy trì walk cycle
      if (sceneLocalFrame >= walkStartFrame && sceneLocalFrame < walkStartFrame + walkDuration) {
        charVelocity = 2.0;
      } else {
        charVelocity = 0;
      }
    } else if (moveCharKf) {
      // 2. Chuyển động khác (bật nảy, phản xạ) dùng springMove
      const rawParams = moveCharKf.params || moveCharKf;
      const { fromX, toX, fromY, toY } = rawParams;
      const cfg = {
        damping: 18,
        stiffness: 70,
        mass: 0.8,
        ...moveCharKf.springConfig,
        overshootClamping: true,
      };
      const kfFrame = Number(moveCharKf.frame ?? moveCharKf.startFrame ?? 0);
      if (fromX !== undefined && toX !== undefined) {
        dynamicCharacterState.x = springMove(
          sceneLocalFrame,
          fps,
          fromX,
          toX,
          kfFrame,
          cfg
        );
        const nextX = springMove(
          sceneLocalFrame + 1,
          fps,
          fromX,
          toX,
          kfFrame,
          cfg
        );
        charVelocity = Math.abs(nextX - dynamicCharacterState.x);
      }
      if (fromY !== undefined && toY !== undefined) {
        dynamicCharacterState.y = springMove(
          sceneLocalFrame,
          fps,
          fromY,
          toY,
          kfFrame,
          cfg
        );
      }
    }
  }

  // Nếu pose là walking nhưng không có keyframe di chuyển: Tự động dạo bước nhịp nhàng qua khung hình
  if (isWalkingPose && charVelocity <= 0.08) {
    const strollDir = dynamicCharacterState.facing === "left" ? -1 : 1;
    const strollSpeed = 2.2 * strollDir;
    const baseX = dynamicCharacterState.x !== undefined ? dynamicCharacterState.x : 1280;
    dynamicCharacterState.x = baseX + sceneLocalFrame * strollSpeed;
    charVelocity = Math.abs(strollSpeed);
  }

  // --- Hiệu ứng bước chân (Walk Cycle Animation) KHI VÀ CHỈ KHI ĐANG DI CHUYỂN ---
  const isWalkingActive = isWalkingPose && charVelocity > 0.08;
  const walkWeight = isWalkingActive ? 1.0 : 0;
  dynamicCharacterState.walkWeight = walkWeight;

  if (isWalkingActive) {
    // Tốc độ bước tự nhiên: ~0.95s cho 1 chu kỳ 2 bước (~55 frames @ 60 FPS)
    dynamicCharacterState.walkCycleProgress = (sceneLocalFrame * 0.018) % 1;
    // Nhấp nhô hông tự nhiên theo bước đi
    const walkBobY = Math.abs(Math.sin(sceneLocalFrame * 0.018 * Math.PI * 2)) * 6.0;
    dynamicCharacterState.y = (dynamicCharacterState.y || STAGE_CONFIG.floorY) - walkBobY;
  } else {
    // Khi đứng yên: CHÂN ĐỨNG IM CHẠM ĐẤT 100%, không đạp chân
    dynamicCharacterState.walkCycleProgress = 0;
    dynamicCharacterState.walkWeight = 0;
  }

  // --- Áp dụng keyframe "changeExpression" ---
  const exprKeyframes = activeKeyframes.filter(
    (kf) => kf.action === "changeExpression" && kf.target === "character"
  );
  if (exprKeyframes.length > 0) {
    const latest = exprKeyframes[exprKeyframes.length - 1];
    if (latest.params.eyes) dynamicCharacterState.eyes = latest.params.eyes;
    if (latest.params.mouth) dynamicCharacterState.mouth = latest.params.mouth;
    if (latest.params.eyebrows) dynamicCharacterState.eyebrows = latest.params.eyebrows;
    if (latest.params.blush !== undefined) dynamicCharacterState.blush = latest.params.blush;
    if (latest.params.sweatDrop !== undefined) dynamicCharacterState.sweatDrop = latest.params.sweatDrop;
    if (latest.params.pupilGaze) dynamicCharacterState.pupilGaze = latest.params.pupilGaze;
  }

  // --- Micro-Animations (breathing, blink, talk, idle sway) ---
  if (isCharacterVisible) {
    if (shouldBlink(frame, fps)) {
      dynamicCharacterState.eyes = "closed";
    }

    if (activeSubtitle && dynamicCharacterState.mouth !== "gasp") {
      if (talkingMouthCycle(frame, fps)) {
        dynamicCharacterState.mouth = "talking";
      }
    }
  }

  // --- Tự động gán holdingTarget từ Auto-Anchoring IK (Ưu tiên vật thể cầm tay di động) ---
  const primaryProp = currentScene.props.find((p) => {
    const id = normalizePropAssetId(p.type);
    return !["sofa", "desk", "desk-front", "desk-back", "tree", "bush", "door", "whiteboard", "tv", "table"].includes(id);
  }) || currentScene.props[0];

  if (isHolding && primaryProp) {
    const propHoldingX = dynamicCharacterState.x + (dynamicCharacterState.facing === "left" ? -140 : 140);
    const propHoldingY = (dynamicCharacterState.y || STAGE_CONFIG.floorY) - 170;

    if (activePropAnchors[primaryProp.id]) {
      const anchors = activePropAnchors[primaryProp.id];
      dynamicCharacterState.holdingTarget = {
        leftGrip: anchors.leftGrip,
        rightGrip: anchors.rightGrip,
      };
    } else {
      dynamicCharacterState.holdingTarget = {
        leftGrip: { x: propHoldingX - 110, y: propHoldingY },
        rightGrip: { x: propHoldingX + 110, y: propHoldingY },
      };
    }
  }

  // =========================================================================
  // ÁNH XẠ PROP ASSET ID (Tự động chuẩn hóa camelCase & alias sang file vector 2K thật)
  // =========================================================================
  const resolvePropAssetId = (type: string) => normalizePropAssetId(type);

  // =========================================================================
  // TÍNH TOÁN VỊ TRÍ PROP VỚI ENTRANCE ANIMATION + KEYFRAMES + SEMANTIC SLOTS + VFX
  // =========================================================================
  const computePropTransform = (
    prop: typeof currentScene.props[0]
  ): {
    x: number;
    y: number;
    scaleVal: number;
    rotation: number;
    squash: { scaleX: number; scaleY: number };
    needleAngle?: number;
  } => {
    const basePos = resolveSemanticSlot(prop.slot, { x: prop.x, y: prop.y });
    let px = basePos.x;
    let py = basePos.y;
    let ps = prop.scale ?? 1;
    let pr = prop.rotation ?? 0;
    let sq = { scaleX: 1, scaleY: 1 };
    let needleAngleVal: number | undefined = undefined;

    // --- Entrance Animation ---
    if (prop.entrance) {
      const { type, delay = 0, from, springConfig: cfg } = prop.entrance;
      const enterProgress = springEnter(sceneLocalFrame, fps, delay, cfg);

      switch (type) {
        case "spring":
        case "slide": {
          const offsetDist = 800;
          if (from === "left") px = interpolate(enterProgress, [0, 1], [basePos.x - offsetDist, basePos.x]);
          else if (from === "right") px = interpolate(enterProgress, [0, 1], [basePos.x + offsetDist, basePos.x]);
          else if (from === "top") py = interpolate(enterProgress, [0, 1], [basePos.y - offsetDist, basePos.y]);
          else if (from === "bottom") py = interpolate(enterProgress, [0, 1], [basePos.y + offsetDist, basePos.y]);
          break;
        }
        case "pop": {
          ps = interpolate(springScale(sceneLocalFrame, fps, delay, cfg), [0, 1], [0, prop.scale ?? 1]);
          break;
        }
        case "drop": {
          const startY = from === "top" ? -200 : basePos.y - 600;
          py = interpolate(enterProgress, [0, 1], [startY, basePos.y]);
          break;
        }
        case "fadeIn": {
          break;
        }
      }
    }

    // --- Keyframe overrides (moveProp, scaleProp, squashImpact, rotateProp) ---
    const propKeyframes = activeKeyframes.filter((kf) => kf.target === prop.id);
    for (const kf of propKeyframes) {
      switch (kf.action) {
        case "moveProp": {
          if (kf.params.fromY !== undefined && kf.params.toY !== undefined) {
            py = springMove(sceneLocalFrame, fps, kf.params.fromY, kf.params.toY, kf.frame, kf.springConfig);
          }
          if (kf.params.fromX !== undefined && kf.params.toX !== undefined) {
            px = springMove(sceneLocalFrame, fps, kf.params.fromX, kf.params.toX, kf.frame, kf.springConfig);
          }
          break;
        }
        case "scaleProp": {
          if (kf.params.fromScale !== undefined && kf.params.toScale !== undefined) {
            ps = springMove(sceneLocalFrame, fps, kf.params.fromScale, kf.params.toScale, kf.frame, kf.springConfig);
          }
          break;
        }
        case "squashImpact": {
          const impactF = kf.params.impactFrame ?? kf.frame;
          sq = squashStretch(sceneLocalFrame, fps, impactF);
          break;
        }
        case "rotateProp": {
          if (kf.params.fromDeg !== undefined && kf.params.toDeg !== undefined) {
            pr = springMove(sceneLocalFrame, fps, kf.params.fromDeg, kf.params.toDeg, kf.frame, kf.springConfig);
          }
          break;
        }
      }
    }

    // --- Prop Animations từ VFX Engine (rotateNeedle, scaleBounce) ---
    if (currentScene.propAnimations) {
      const anim = currentScene.propAnimations.find((a) => a.targetId === prop.id);
      if (anim) {
        if (anim.type === "rotateNeedle" && anim.fromDeg !== undefined && anim.toDeg !== undefined) {
          const needleProgress = interpolate(
            sceneLocalFrame,
            [0, Math.min(60, currentScene.durationInFrames)],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }
          );
          needleAngleVal = interpolate(needleProgress, [0, 1], [anim.fromDeg, anim.toDeg]);
        }
        if (anim.type === "scaleBounce" && anim.fromScale !== undefined && anim.toScale !== undefined) {
          const bounceProgress = springScale(sceneLocalFrame, fps, 0, { damping: 12, stiffness: 140, mass: 0.5 });
          ps = interpolate(bounceProgress, [0, 1], [anim.fromScale, anim.toScale]);
        }
      }
    }

    // Tự động xoay kim sinh động cho gauge-meter nếu chưa có keyframe cụ thể
    if (resolvePropAssetId(prop.type) === "gauge-meter" && needleAngleVal === undefined) {
      const progress = interpolate(sceneLocalFrame, [10, 75], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      needleAngleVal = interpolate(progress, [0, 1], [-70, -25]);
    }

    // Nếu nhân vật đang cầm đạo cụ này, dính chặt theo tay nhân vật
    if (isHolding && primaryProp && prop.id === primaryProp.id) {
      px = dynamicCharacterState.x + (dynamicCharacterState.facing === "left" ? -140 : 140);
      py = (dynamicCharacterState.y || STAGE_CONFIG.floorY) - 170;
    }

    return { x: px, y: py, scaleVal: ps, rotation: pr, squash: sq, needleAngle: needleAngleVal };
  };

  // =========================================================================
  // ENTRANCE OPACITY (cho fadeIn)
  // =========================================================================
  const computeEntranceOpacity = (prop: typeof currentScene.props[0]): number => {
    if (prop.entrance?.type === "fadeIn") {
      return springEnter(sceneLocalFrame, fps, prop.entrance.delay ?? 0, prop.entrance.springConfig);
    }
    return prop.opacity ?? 1;
  };

  // =========================================================================
  // TÍNH TOÁN VỊ TRÍ SPIDER SWAY
  // =========================================================================
  const spiderOffset = spiderSway(frame, fps);

  // =========================================================================
  // BREATHING & IDLE CHU KỲ CON NGƯỜI (ORIGIN = BOTTOM-MID, SCALE Y TỪ 0.98 ĐẾN 1.03)
  // Chu kỳ thở: 1.75s (~105 frames @ 60 FPS), chân cố định 100% trên sàn, KHÔNG trượt ngang
  // =========================================================================
  const breathPhase = (frame * Math.PI * 2) / 105;
  const humanBreathScaleY = isCharacterVisible
    ? 1.005 + Math.sin(breathPhase) * 0.025 // Dao động chuẩn từ 0.98 đến 1.03
    : 1.0;

  // =========================================================================
  // DYNAMIC LINES: Giải quyết anchor refs thành tọa độ
  // =========================================================================
  const activeLines = (currentScene.lines || []).filter(
    (line) => frame >= line.startFrame && frame <= line.endFrame
  );

  // Hệ tọa độ thiết kế chuẩn 2K (2560x1440), tự động scale đồng nhất sang Full HD 1080p (1920x1080) khi render
  const DESIGN_WIDTH = 2560;
  const DESIGN_HEIGHT = 1440;

  const anchorContext: AnchorResolverContext = {
    propAnchors: Object.fromEntries(
      Object.entries(activePropAnchors).map(([id, ports]) => [
        id,
        {
          x: currentScene.props.find((p) => p.id === id)?.x ?? 0,
          y: currentScene.props.find((p) => p.id === id)?.y ?? 0,
          leftGrip: ports.leftGrip,
          rightGrip: ports.rightGrip,
          surfaceDecal: ports.surfaceDecal,
        },
      ])
    ),
    characterAnchors: {},
    canvasHeight: DESIGN_HEIGHT,
  };

  const resolveLineEndpoints = (
    line: DynamicLineItem
  ): { start: Point2D; end: Point2D } => {
    const start = line.startFixed
      ? line.startFixed
      : line.startAnchorRef
        ? resolveAnchorRef(line.startAnchorRef, anchorContext)
        : { x: 0, y: 0 };
    const end = line.endFixed
      ? line.endFixed
      : line.endAnchorRef
        ? resolveAnchorRef(line.endAnchorRef, anchorContext)
        : { x: 0, y: 0 };
    return { start, end };
  };

  // Kiểm tra xem scene có hiệu ứng đung đưa cỏ cây không
  const hasFoliageSway = currentScene.environmentVfx?.includes("foliageSway");

  // =========================================================================
  // RENDER THEO CHIỀU SÂU & HỆ THỐNG CAMERA RIG + VFX SHADERS
  // =========================================================================
  return (
    <AbsoluteFill style={{ width: "100%", height: "100%", backgroundColor: "#F8EFE3", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
        className="w-full h-full select-none"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* ===============================================================
            1. THƯ VIỆN SHADER & GRADIENT ĐIỆN ẢNH (SVG DEFS LIBRARY)
        =============================================================== */}
        <SvgDefsLibrary />

        {/* ===============================================================
            2. CAMERA RIG VIEWPORT (ĐIỀU KHIỂN ZOOM & TARGET TRACKING)
        =============================================================== */}
        <CameraRig
          camera={currentScene.camera}
          sceneLocalFrame={sceneLocalFrame}
          durationInFrames={currentScene.durationInFrames}
          character={dynamicCharacterState}
          propsList={currentScene.props}
          canvasWidth={DESIGN_WIDTH}
          canvasHeight={DESIGN_HEIGHT}
        >
          {/* LAYER 10: DYNAMIC BACKGROUND */}
          <g id="layer-background">
            <DynamicBackground preset={currentScene.background.preset} />
          </g>

          {/* LAYER 15: PROCEDURAL ENVIRONMENT VFX (MÂY TRÔI, MƯA, TIA NẮNG, GIÓ) */}
          <EnvironmentVfxLayer
            effects={currentScene.environmentVfx}
            lighting={currentScene.lighting}
            backgroundPreset={currentScene.background.preset}
            frame={frame}
            fps={fps}
            canvasWidth={DESIGN_WIDTH}
            canvasHeight={DESIGN_HEIGHT}
          />

          {/* LAYER 20: MIDGROUND BACK LAYER (Sofa, Chân sau bàn học) */}
          <g id="layer-midground-back">
            {(() => {
              const hasJarWithSpider = currentScene.props.some((p) => {
                const aid = resolvePropAssetId(p.type);
                return (aid === "glass-jar" || /jar|thuy-tinh|glass/i.test(p.type)) && Boolean(p.properties?.hasSpiderInside);
              });

              return currentScene.props
                .filter((p) => {
                  if (p.visible === false || p.layer !== "midgroundBackLayer") return false;
                  // Chống trùng lặp prop: nếu đã có lọ chứa nhện bên trong, tự động xóa bỏ instance thừa của con nhện ở ngoài sàn
                  if (hasJarWithSpider && resolvePropAssetId(p.type) === "spider") return false;
                  return true;
                })
                .map((prop) => {
                  const t = computePropTransform(prop);
                  const opacity = computeEntranceOpacity(prop);
                  const isScreenSlot = Boolean(prop.slot && prop.slot.startsWith("screen."));
                  const isExplicitCenter = prop.anchorPoint === "center" || prop.pivotPoint === "center" || isScreenSlot;
                  const propAnchor = isExplicitCenter ? "center" : "bottomCenter";
                  return (
                    <g key={prop.id} opacity={opacity}>
                      <DynamicProp
                        id={resolvePropAssetId(prop.type)}
                        x={t.x}
                        y={t.y}
                        scale={t.scaleVal}
                        scaleX={prop.scaleX}
                        scaleY={prop.scaleY}
                        rotation={t.rotation}
                        opacity={prop.opacity}
                        alphaConfig={prop.alphaConfig}
                        frame={sceneLocalFrame}
                        sceneDurationInFrames={currentScene.durationInFrames}
                        anchorPoint={propAnchor}
                        pivotPoint={prop.pivotPoint}
                        pivotX={prop.pivotX}
                        pivotY={prop.pivotY}
                        foliageSway={hasFoliageSway}
                      />
                    </g>
                  );
                });
            })()}

            {isSitting && (
              <DynamicProp
                id="desk-back"
                x={STAGE_CONFIG.deskX}
                y={STAGE_CONFIG.deskY}
                scale={1.0}
                defaultDimensions={{ width: 1100, height: 400 }}
              />
            )}
          </g>

          {/* LAYER 25: DYNAMIC LINES — BEHIND CHARACTER (silk, light cones) */}
          <g id="layer-lines-back">
            {activeLines
              .filter((l) => l.style === "silk" || l.style === "light")
              .map((line) => {
                const { start, end } = resolveLineEndpoints(line);
                return (
                  <DynamicLine
                    key={line.id}
                    start={start}
                    end={end}
                    style={line.style}
                    color={line.color}
                    strokeWidth={line.strokeWidth}
                    animated={line.animated}
                    animationDelay={line.startFrame - currentScene.startFrame}
                    coneAngle={line.coneAngle}
                    coneLength={line.coneLength}
                  />
                );
              })}
          </g>

          {/* LAYER 30: CHARACTER LOWER LAYER KHI NGỒI SAU BÀN (TOÀN BỘ ĐẦU, THÂN VÀ TAY Ở SAU MẶT BÀN) */}
          {isSitting && isCharacterVisible && (
            <g id="layer-character-seated" clipPath="url(#seated-occlusion-mask)">
              <StickmanRig
                state={dynamicCharacterState}
                renderPart="bodyOnly"
                breathScaleY={humanBreathScaleY}
              />
            </g>
          )}

          {/* LAYER 35: MẶT BÀN GỖ (TABLETOP) CHE KHUẤT HÔNG VÀ BỤNG DƯỚI NHÂN VẬT */}
          {isSitting && (
            <g id="layer-desk-front">
              <DynamicProp
                id="desk-front"
                x={STAGE_CONFIG.deskX}
                y={STAGE_CONFIG.deskY}
                scale={1.0}
                defaultDimensions={{ width: 1100, height: 400 }}
              />
            </g>
          )}

          {/* LAYER 36: TAY NGƯỜI ĐẶT TRÊN MẶT BÀN */}
          {isSitting && isCharacterVisible && (
            <g id="layer-character-seated-arms">
              <StickmanRig
                state={dynamicCharacterState}
                renderPart="armsOnly"
                breathScaleY={humanBreathScaleY}
              />
            </g>
          )}

          {/* LAYER 37: VÙNG SÁNG CỦA ĐÈN BÀN NEO THEO TỌA ĐỘ THỰC TẾ CỦA ĐÈN */}
          {(() => {
            const lampProp = currentScene.props.find((p) => resolvePropAssetId(p.type) === "desk-lamp");
            if (!lampProp) return null;
            const lt = computePropTransform(lampProp);
            return (
              <g id="layer-lamp-glow-effect">
                {/* Vệt sáng ấm hình oval tỏa tròn trên mặt bàn gỗ */}
                <ellipse
                  cx={lt.x + 35}
                  cy={lt.y + 5}
                  rx={260 * lt.scaleVal}
                  ry={45 * lt.scaleVal}
                  fill="url(#tableSurfaceGlow)"
                  opacity={0.88 + 0.05 * Math.sin(frame * 0.06)}
                />
                {/* Nón sáng mềm mại tỏa từ đầu chụp đèn xuống mặt bàn */}
                <polygon
                  points={`${lt.x + 20 * lt.scaleVal},${lt.y - 115 * lt.scaleVal} ${lt.x - 180 * lt.scaleVal},${lt.y + 5} ${lt.x + 220 * lt.scaleVal},${lt.y + 5}`}
                  fill="url(#lightConeGradient)"
                  opacity={0.82 + 0.06 * Math.sin(frame * 0.06)}
                />
              </g>
            );
          })()}

          {/* LAYER 40: MIDGROUND FRONT LAYER (Đèn bàn, Lọ thủy tinh trên bàn/sàn) */}
          <g id="layer-midground-front">
            {(() => {
              const hasJarWithSpider = currentScene.props.some((p) => {
                const aid = resolvePropAssetId(p.type);
                return (aid === "glass-jar" || /jar|thuy-tinh|glass/i.test(p.type)) && Boolean(p.properties?.hasSpiderInside);
              });

              return currentScene.props
                .filter((p) => {
                  if (p.visible === false || p.layer === "midgroundBackLayer") return false;
                  // Chống trùng lặp prop: nếu đã có lọ chứa nhện bên trong, tự động xóa bỏ instance thừa của con nhện ở ngoài sàn
                  if (hasJarWithSpider && resolvePropAssetId(p.type) === "spider") return false;
                  return true;
                })
                .map((prop) => {
                  const t = computePropTransform(prop);
                  const opacity = computeEntranceOpacity(prop);
                  const assetId = resolvePropAssetId(prop.type);
                  const hasSpider = prop.properties?.hasSpiderInside;
                  const propLabel =
                    prop.properties?.label ||
                    prop.properties?.labelText ||
                    prop.properties?.title ||
                    (prop as any).label;
                  const isScreenSlot = Boolean(prop.slot && prop.slot.startsWith("screen."));
                  const isExplicitCenter = prop.anchorPoint === "center" || prop.pivotPoint === "center" || isScreenSlot;
                const propAnchor = isExplicitCenter ? "center" : "bottomCenter";

                return (
                  <g key={prop.id} opacity={opacity}>
                    <g transform={`translate(${t.x}, ${t.y}) scale(${t.squash.scaleX}, ${t.squash.scaleY}) translate(${-t.x}, ${-t.y})`}>
                      <DynamicProp
                        id={assetId}
                        x={t.x}
                        y={t.y}
                        scale={t.scaleVal}
                        scaleX={prop.scaleX}
                        scaleY={prop.scaleY}
                        rotation={t.rotation}
                        opacity={prop.opacity}
                        alphaConfig={prop.alphaConfig}
                        frame={sceneLocalFrame}
                        sceneDurationInFrames={currentScene.durationInFrames}
                        anchorPoint={propAnchor}
                        pivotPoint={prop.pivotPoint}
                        pivotX={prop.pivotX}
                        pivotY={prop.pivotY}
                        needleAngle={t.needleAngle}
                        foliageSway={hasFoliageSway}
                        label={propLabel}
                        showPointerCallout={prop.properties?.showPointerCallout}
                        onAnchorsComputed={(anchors) => {
                          setActivePropAnchors((prev) => ({
                            ...prev,
                            [prop.id]: anchors,
                          }));
                        }}
                      >
                        {/* Nhện bên trong lọ thủy tinh */}
                        {hasSpider && (
                          <g transform={`translate(${spiderOffset.offsetX}, ${spiderOffset.offsetY}) rotate(${spiderOffset.rotation})`}>
                            <DynamicProp
                              id="spider"
                              x={0}
                              y={0}
                              scale={(prop.scale ?? 1.0) < 1.0 ? 0.45 : 0.55}
                              anchorPoint="center"
                              defaultDimensions={{ width: 320, height: 240 }}
                            />
                          </g>
                        )}
                      </DynamicProp>
                    </g>
                  </g>
                );
              });
            })()}
          </g>

          {/* LAYER 45: CHARACTER UPPER LAYER (CHỈ VẼ KHI ĐỨNG, TUYỆT ĐỐI KHÔNG VẼ KHI NGỒI SAU BÀN ĐỂ KHÔNG ĐÈ LÊN MẶT BÀN) */}
          {isCharacterVisible && !isSitting && (
            <g id="layer-character-front">
              <StickmanRig
                state={dynamicCharacterState}
                renderPart="all"
                breathScaleY={humanBreathScaleY}
              />
            </g>
          )}

          {/* LAYER 50: DYNAMIC LINES — FRONT (pointer, dashed, glow) */}
          <g id="layer-lines-front">
            {activeLines
              .filter((l) => l.style !== "silk" && l.style !== "light")
              .map((line) => {
                const { start, end } = resolveLineEndpoints(line);
                return (
                  <DynamicLine
                    key={line.id}
                    start={start}
                    end={end}
                    style={line.style}
                    color={line.color}
                    strokeWidth={line.strokeWidth}
                    animated={line.animated}
                    animationDelay={line.startFrame - currentScene.startFrame}
                  />
                );
              })}
          </g>
        </CameraRig>

        {/* VIGNETTE LỚP VIỀN NGOÀI CÙNG (ĐÃ GIẢM TỐI ĐA XUỐNG 0.08 ĐỂ NỀN HOẠT HÌNH TRONG TRẺO) */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#vignetteGradient)"
          opacity={0.08}
          className="pointer-events-none"
        />
      </svg>

      {/* ===============================================================
          LAYER 99999: UI OVERLAY LAYER (BONG BÓNG THOẠI & PHỤ ĐỀ NẰM NGOÀI CAMERARIG ĐỂ KHÔNG BỊ PHÓNG ĐẠI)
      =============================================================== */}
      {(activeSubtitle || activeSpeechBubbles.length > 0) && (
        <AbsoluteFill
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          <svg
            viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
            className="w-full h-full select-none"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Bong bóng lời thoại nổi trên UI */}
            {activeSpeechBubbles.map((bubble) => {
              const bubbleProgress = springScale(
                frame,
                fps,
                bubble.startFrame,
                { damping: 12, stiffness: 150, mass: 0.5 }
              );
              return (
                <g
                  key={bubble.id}
                  transform={`translate(${bubble.position.x}, ${bubble.position.y}) scale(${bubbleProgress}) translate(${-bubble.position.x}, ${-bubble.position.y})`}
                >
                  <SpeechBubble
                    x={bubble.position.x}
                    y={bubble.position.y}
                    text={bubble.text}
                    hasMusicNote={bubble.hasMusicNote}
                    tailAnchor={bubble.tailAnchor}
                  />
                </g>
              );
            })}

            {/* Hộp phụ đề nổi */}
            {activeSubtitle && (
              <SubtitleBox
                text={activeSubtitle.text}
                words={activeSubtitle.words}
                currentFrame={frame}
                fps={fps}
                x={1280}
                y={1320}
              />
            )}
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
