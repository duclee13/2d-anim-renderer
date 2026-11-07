import React, { useState, useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
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

export interface MainCompositionProps {
  sceneGraph?: MasterSceneGraph;
}

// Re-export để tương thích ngược
export const defaultMockSceneGraph = sampleScriptSceneGraph;

export const MainScene: React.FC<MainCompositionProps> = ({
  sceneGraph = sampleScriptSceneGraph,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Lưu trữ cổng neo của đạo cụ được active để phục vụ Auto-Anchoring IK
  const [activePropAnchors, setActivePropAnchors] = useState<
    Record<string, PropAnchorPorts>
  >({});

  // =========================================================================
  // TÌM SCENE HIỆN TẠI (Đảm bảo an toàn 100% không bị undefined/NaN)
  // =========================================================================
  const safeScenes = Array.isArray(sceneGraph?.scenes) && sceneGraph.scenes.length > 0
    ? sceneGraph.scenes
    : sampleScriptSceneGraph.scenes;

  const currentScene: SceneGraphScene =
    safeScenes.find((s) => {
      const sStart = Number(s?.startFrame) || 0;
      const sDur = Number(s?.durationInFrames) || 120;
      return frame >= sStart && frame < sStart + sDur;
    }) || safeScenes[0];

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
  // TÍNH TOÁN TRẠNG THÁI NHÂN VẬT VỚI MICRO-ANIMATIONS
  // =========================================================================
  const isSitting = currentScene.character.pose === "sittingBehindDesk";
  const isHolding = currentScene.character.pose === "holdingObject";
  const isCharacterVisible = currentScene.character.x > -9000;

  // Bắt đầu với state ban đầu
  const dynamicCharacterState: StickmanState = { ...currentScene.character };

  // --- Áp dụng keyframe "moveCharacter" nếu có ---
  const moveCharKf = activeKeyframes.find(
    (kf) => kf.action === "moveCharacter" && kf.target === "character"
  );
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
    // Nháy mắt ngẫu nhiên
    if (shouldBlink(frame, fps)) {
      dynamicCharacterState.eyes = "closed";
    }

    // Mở miệng khi đang phát thoại
    if (activeSubtitle && dynamicCharacterState.mouth !== "gasp") {
      if (talkingMouthCycle(frame, fps)) {
        dynamicCharacterState.mouth = "talking";
      }
    }
  }

  // --- Tự động gán holdingTarget từ Auto-Anchoring ---
  if (isHolding && !dynamicCharacterState.holdingTarget) {
    const primaryProp = currentScene.props[0];
    if (primaryProp && activePropAnchors[primaryProp.id]) {
      const anchors = activePropAnchors[primaryProp.id];
      dynamicCharacterState.holdingTarget = {
        leftGrip: anchors.leftGrip,
        rightGrip: anchors.rightGrip,
      };
    }
  }

  // =========================================================================
  // ÁNH XẠ PROP ASSET ID
  // =========================================================================
  const resolvePropAssetId = (type: string) => {
    switch (type) {
      case "glassJar":
        return "glass-jar";
      case "deskLamp":
        return "desk-lamp";
      case "gaugeMeter":
        return "gauge-meter";
      case "pottedPlant":
        return "potted-plant";
      default:
        return type;
    }
  };

  // =========================================================================
  // TÍNH TOÁN VỊ TRÍ PROP VỚI ENTRANCE ANIMATION + KEYFRAMES
  // =========================================================================
  const computePropTransform = (
    prop: typeof currentScene.props[0]
  ): { x: number; y: number; scaleVal: number; rotation: number; squash: { scaleX: number; scaleY: number } } => {
    let px = prop.x;
    let py = prop.y;
    let ps = prop.scale ?? 1;
    let pr = prop.rotation ?? 0;
    let sq = { scaleX: 1, scaleY: 1 };

    // --- Entrance Animation ---
    if (prop.entrance) {
      const { type, delay = 0, from, springConfig: cfg } = prop.entrance;
      const enterProgress = springEnter(sceneLocalFrame, fps, delay, cfg);

      switch (type) {
        case "spring":
        case "slide": {
          const offsetDist = 800;
          if (from === "left") px = interpolate(enterProgress, [0, 1], [prop.x - offsetDist, prop.x]);
          else if (from === "right") px = interpolate(enterProgress, [0, 1], [prop.x + offsetDist, prop.x]);
          else if (from === "top") py = interpolate(enterProgress, [0, 1], [prop.y - offsetDist, prop.y]);
          else if (from === "bottom") py = interpolate(enterProgress, [0, 1], [prop.y + offsetDist, prop.y]);
          break;
        }
        case "pop": {
          ps = interpolate(springScale(sceneLocalFrame, fps, delay, cfg), [0, 1], [0, prop.scale ?? 1]);
          break;
        }
        case "drop": {
          const startY = from === "top" ? -200 : prop.y - 600;
          py = interpolate(enterProgress, [0, 1], [startY, prop.y]);
          break;
        }
        case "fadeIn": {
          // Opacity handled separately; position stays
          break;
        }
      }
    }

    // --- Keyframe overrides (moveProp, scaleProp, squashImpact) ---
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

    return { x: px, y: py, scaleVal: ps, rotation: pr, squash: sq };
  };

  // =========================================================================
  // ENTRANCE OPACITY (cho fadeIn)
  // =========================================================================
  const computeEntranceOpacity = (prop: typeof currentScene.props[0]): number => {
    if (prop.entrance?.type === "fadeIn") {
      return springEnter(sceneLocalFrame, fps, prop.entrance.delay ?? 0, prop.entrance.springConfig);
    }
    return 1;
  };

  // =========================================================================
  // TÍNH TOÁN VỊ TRÍ SPIDER SWAY
  // =========================================================================
  const spiderOffset = spiderSway(frame, fps);

  // =========================================================================
  // BREATHING & IDLE SWAY CHO NHÂN VẬT
  // =========================================================================
  const breathScale = isCharacterVisible ? breathingOscillation(frame, fps) : 1;
  const swayX = isCharacterVisible ? idleSway(frame, fps) : 0;

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

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full select-none"
      style={{ backgroundColor: "#F8EFE3" }}
    >
      {/* ===============================================================
          LAYER 1: DYNAMIC BACKGROUND (Nạp từ public/assets/backgrounds/)
      =============================================================== */}
      <g id="layer-background">
        <DynamicBackground preset={currentScene.background.preset} />
      </g>

      {/* ===============================================================
          LAYER 2: MIDGROUND BACK LAYER (Sofa, Chân sau bàn học)
      =============================================================== */}
      <g id="layer-midground-back">
        {currentScene.props
          .filter((p) => p.layer === "midgroundBackLayer")
          .map((prop) => {
            const t = computePropTransform(prop);
            const opacity = computeEntranceOpacity(prop);
            return (
              <g key={prop.id} opacity={opacity}>
                <DynamicProp
                  id={resolvePropAssetId(prop.type)}
                  x={t.x}
                  y={t.y}
                  scale={t.scaleVal}
                  rotation={t.rotation}
                />
              </g>
            );
          })}

        {isSitting && (
          <DynamicProp
            id="desk-back"
            x={1150}
            y={1120}
            scale={1.0}
            defaultDimensions={{ width: 1100, height: 400 }}
          />
        )}
      </g>

      {/* ===============================================================
          LAYER 2.5: DYNAMIC LINES — BEHIND CHARACTER (silk, light cones)
      =============================================================== */}
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

      {/* ===============================================================
          LAYER 3: CHARACTER LOWER LAYER (Thân & Đầu Stickman khi ngồi sau bàn)
          + Micro-Animations: breathing, idle sway
      =============================================================== */}
      <g id="layer-character-base">
        {isCharacterVisible && (
          <g
            transform={`translate(${swayX}, 0)`}
            data-micro-anim="idle-sway"
          >
            {isSitting ? (
              <StickmanRig
                state={dynamicCharacterState}
                renderPart="bodyOnly"
                breathScale={breathScale}
              />
            ) : (
              <StickmanRig
                state={dynamicCharacterState}
                renderPart="all"
                breathScale={breathScale}
              />
            )}
          </g>
        )}
      </g>

      {/* ===============================================================
          LAYER 4: MIDGROUND FRONT LAYER (Mặt bàn, Đèn bàn, Lọ thủy tinh)
          + Entrance Animations + Squash/Stretch
      =============================================================== */}
      <g id="layer-midground-front">
        {isSitting && (
          <DynamicProp
            id="desk-front"
            x={1150}
            y={1120}
            scale={1.0}
            defaultDimensions={{ width: 1100, height: 400 }}
          />
        )}

        {currentScene.props
          .filter((p) => p.layer === "midgroundFrontLayer")
          .map((prop) => {
            const t = computePropTransform(prop);
            const opacity = computeEntranceOpacity(prop);
            const assetId = resolvePropAssetId(prop.type);
            const hasSpider = prop.properties?.hasSpiderInside;

            return (
              <g key={prop.id} opacity={opacity}>
                <g transform={`translate(${t.x}, ${t.y}) scale(${t.squash.scaleX}, ${t.squash.scaleY}) translate(${-t.x}, ${-t.y})`}>
                  <DynamicProp
                    id={assetId}
                    x={t.x}
                    y={t.y}
                    scale={t.scaleVal}
                    rotation={t.rotation}
                    label={prop.properties?.label}
                    showPointerCallout={prop.properties?.showPointerCallout}
                    onAnchorsComputed={(anchors) => {
                      setActivePropAnchors((prev) => ({
                        ...prev,
                        [prop.id]: anchors,
                      }));
                    }}
                  >
                    {/* Nhện bên trong lọ thủy tinh — kích thước chiếm 65-75% lòng lọ chuẩn 2K */}
                    {hasSpider && (
                      <g transform={`translate(${spiderOffset.offsetX}, ${spiderOffset.offsetY}) rotate(${spiderOffset.rotation})`}>
                        <DynamicProp
                          id="spider"
                          x={0}
                          y={40}
                          scale={0.8}
                          defaultDimensions={{ width: 320, height: 240 }}
                        />
                      </g>
                    )}
                    {/* Nhện treo tự do (không trong lọ) */}
                    {prop.type === "spider" && !hasSpider && (
                      <g transform={`translate(${spiderOffset.offsetX}, ${spiderOffset.offsetY}) rotate(${spiderOffset.rotation})`} />
                    )}
                  </DynamicProp>
                </g>
              </g>
            );
          })}
      </g>

      {/* ===============================================================
          LAYER 5: CHARACTER UPPER LAYER (Tay tựa lên mặt bàn khi ngồi)
      =============================================================== */}
      {isSitting && isCharacterVisible && (
        <g id="layer-character-arms-front">
          <g transform={`translate(${swayX}, 0)`}>
            <StickmanRig
              state={dynamicCharacterState}
              renderPart="armsOnly"
              breathScale={breathScale}
            />
          </g>
        </g>
      )}

      {/* ===============================================================
          LAYER 5.5: DYNAMIC LINES — FRONT (pointer, dashed, glow)
      =============================================================== */}
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

      {/* ===============================================================
          LAYER 6: FOREGROUND UI & SUBTITLES (Bong bóng thoại & Phụ đề 2K)
          + Spring entrance cho speech bubbles
      =============================================================== */}
      <g id="layer-foreground-ui">
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

        {activeSubtitle && (
          <SubtitleBox
            text={activeSubtitle.text}
            words={activeSubtitle.words}
            currentFrame={frame}
            fps={fps}
            x={1280}
            y={1340}
          />
        )}
      </g>
    </svg>
  );
};
