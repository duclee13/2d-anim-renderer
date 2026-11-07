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
  const effectiveGraph: MasterSceneGraph =
    props.sceneGraph || (props.scenes ? (props as unknown as MasterSceneGraph) : defaultMockSceneGraph);

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
  const isCharacterVisible = currentScene.character.x > -9000;

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
  const moveCharKf = activeKeyframes.find(
    (kf) => kf.action === "moveCharacter" && kf.target === "character"
  );
  let isCurrentlyTranslating = false;

  if (moveCharKf && isCharacterVisible) {
    const { fromX, toX, fromY, toY } = moveCharKf.params;
    const cfg = moveCharKf.springConfig;
    if (fromX !== undefined && toX !== undefined) {
      dynamicCharacterState.x = springMove(
        sceneLocalFrame,
        fps,
        fromX,
        toX,
        moveCharKf.frame,
        cfg
      );
      // Tính độ chênh lệch vị trí giữa 2 frame liên tiếp để xác định vận tốc thực
      const nextX = springMove(
        sceneLocalFrame + 1,
        fps,
        fromX,
        toX,
        moveCharKf.frame,
        cfg
      );
      if (Math.abs(nextX - dynamicCharacterState.x) > 0.4) {
        isCurrentlyTranslating = true;
      }
    }
    if (fromY !== undefined && toY !== undefined) {
      dynamicCharacterState.y = springMove(
        sceneLocalFrame,
        fps,
        fromY,
        toY,
        moveCharKf.frame,
        cfg
      );
    }
  } else if (hasWalkAction && isCharacterVisible && currentScene.durationInFrames > 60) {
    const walkDuration = currentScene.durationInFrames * 0.85;
    if (sceneLocalFrame < walkDuration) {
      isCurrentlyTranslating = true;
    }
    const startX = currentScene.character.facing === "left" ? 1700 : 700;
    const endX = currentScene.character.facing === "left" ? 900 : 1700;
    const walkProgress = Math.min(1, sceneLocalFrame / walkDuration);
    dynamicCharacterState.x = interpolate(walkProgress, [0, 1], [startX, endX]);
  }

  // --- Hiệu ứng bước chân (Walk Cycle Animation) KHI VÀ CHỈ KHI ĐANG DI CHUYỂN ---
  const isWalkingActive =
    dynamicCharacterState.pose === "walking" || isCurrentlyTranslating;

  if (isWalkingActive) {
    // Tốc độ bước tự nhiên: ~0.95s cho 1 chu kỳ 2 bước (~57 frames @ 60 FPS = multiplier 0.0175)
    dynamicCharacterState.walkCycleProgress = (sceneLocalFrame * 0.0175) % 1;
    // Nhấp nhô hông tự nhiên 5.5px (không nảy 14px thô bạo)
    const walkBobY = Math.abs(Math.sin(sceneLocalFrame * 0.0175 * Math.PI * 2)) * 5.5;
    dynamicCharacterState.y = (dynamicCharacterState.y || STAGE_CONFIG.floorY) - walkBobY;
  } else {
    // Khi đứng yên: CHÂN ĐỨNG IM CHẠM ĐẤT 100%, không đạp chân
    dynamicCharacterState.walkCycleProgress = 0;
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

  // --- Tự động gán holdingTarget từ Auto-Anchoring IK ---
  const primaryProp = currentScene.props[0];
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
  const resolvePropAssetId = (type: string) => {
    const normalized = type
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");

    const aliasMap: Record<string, string> = {
      glassjar: "glass-jar",
      desklamp: "desk-lamp",
      gaugemeter: "gauge-meter",
      pottedplant: "potted-plant",
      deskback: "desk-back",
      deskfront: "desk-front",
      alarmclock: "alarm-clock",
      coffeecup: "coffee-cup",
      teacup: "coffee-cup",
      cup: "coffee-cup",
      plant: "potted-plant",
      lamp: "desk-lamp",
      meter: "gauge-meter",
      jar: "glass-jar",
      whiteboard: "whiteboard",
      television: "tv",
      smarttv: "tv",
      screen: "tv",
      mobilephone: "phone",
      cellphone: "phone",
      smartphone: "phone",
      coffeemug: "coffee-cup",
      diningtable: "table",
      deskchair: "chair",
      armchair: "chair",
      petcat: "cat",
      kitten: "cat",
      bush: "bush",
      shrub: "bush",
      hedge: "bush",
    };

    return aliasMap[normalized] || aliasMap[type.toLowerCase()] || normalized;
  };

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
    canvasHeight: height,
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
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full select-none"
        style={{ width: "100%", height: "100%" }}
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
          canvasWidth={width}
          canvasHeight={height}
        >
          {/* LAYER 10: DYNAMIC BACKGROUND */}
          <g id="layer-background">
            <DynamicBackground preset={currentScene.background.preset} />
          </g>

          {/* LAYER 15: PROCEDURAL ENVIRONMENT VFX (MÂY TRÔI, MƯA, TIA NẮNG, GIÓ) */}
          <EnvironmentVfxLayer
            effects={currentScene.environmentVfx}
            lighting={currentScene.lighting}
            frame={frame}
            fps={fps}
            canvasWidth={width}
            canvasHeight={height}
          />

          {/* LAYER 20: MIDGROUND BACK LAYER (Sofa, Chân sau bàn học) */}
          <g id="layer-midground-back">
            {currentScene.props
              .filter((p) => p.layer === "midgroundBackLayer")
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
              })}

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

          {/* LAYER 30: CHARACTER LOWER LAYER KHI NGỒI SAU BÀN (THÂN & ĐẦU) */}
          {isSitting && isCharacterVisible && (
            <g id="layer-character-seated-body">
              <StickmanRig
                state={dynamicCharacterState}
                renderPart="bodyOnly"
                breathScaleY={humanBreathScaleY}
              />
            </g>
          )}

          {/* LAYER 35: MẶT BÀN GỖ (TABLETOP) CHE KHUẤT HÔNG NHÂN VẬT */}
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

          {/* LAYER 40: MIDGROUND FRONT LAYER (Đèn bàn, Lọ thủy tinh trên bàn/sàn) */}
          <g id="layer-midground-front">
            {currentScene.props
              .filter((p) => p.layer !== "midgroundBackLayer")
              .map((prop) => {
                const t = computePropTransform(prop);
                const opacity = computeEntranceOpacity(prop);
                const assetId = resolvePropAssetId(prop.type);
                const hasSpider = prop.properties?.hasSpiderInside;
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
                        label={prop.properties?.label}
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
                              scale={0.8}
                              anchorPoint="center"
                              defaultDimensions={{ width: 320, height: 240 }}
                            />
                          </g>
                        )}
                      </DynamicProp>
                    </g>
                  </g>
                );
              })}
          </g>

          {/* LAYER 45: CHARACTER UPPER LAYER (TAY TỰA MẶT BÀN HOẶC TOÀN THÂN ĐỨNG) */}
          {isCharacterVisible && (
            <g id="layer-character-front">
              {isSitting ? (
                <StickmanRig
                  state={dynamicCharacterState}
                  renderPart="armsOnly"
                  breathScaleY={humanBreathScaleY}
                />
              ) : (
                <StickmanRig
                  state={dynamicCharacterState}
                  renderPart="all"
                  breathScaleY={humanBreathScaleY}
                />
              )}
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

          {/* LAYER 60: SPEECH BUBBLES TRONG KHÔNG GIAN SÂN KHẤU */}
          <g id="layer-speech-bubbles">
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
          </g>
        </CameraRig>

        {/* VIGNETTE LỚP VIỀN NGOÀI CÙNG CHO ĐỘ SÂU ĐIỆN ẢNH */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#vignetteGradient)"
          className="pointer-events-none"
        />
      </svg>

      {/* ===============================================================
          LAYER 9999: SUBTITLE BOX (LUÔN LUÔN NẰM TRÊN MỌI VẬT THỂ & KHÔNG BỊ ZOOM THEO CAMERA)
      =============================================================== */}
      {activeSubtitle && (
        <AbsoluteFill style={{ zIndex: 9999, pointerEvents: "none" }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
            <SubtitleBox
              text={activeSubtitle.text}
              words={activeSubtitle.words}
              currentFrame={frame}
              fps={fps}
              x={1280}
              y={1340}
            />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
