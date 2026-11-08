import {
  MasterSceneGraph,
  SceneGraphScene,
  EnvironmentVfxType,
  BackgroundPreset,
  SceneKeyframe,
  PropItem,
} from "../types/sceneGraph";
import { normalizePropAssetId } from "./propResolver";

/**
 * Trợ thủ bảo toàn giá trị số (Bảo toàn số 0, không coi 0 là falsy)
 */
export function numOrDef(val: any, defaultVal: number): number {
  if (val !== undefined && val !== null && !isNaN(Number(val))) {
    return Number(val);
  }
  return defaultVal;
}

/**
 * Trợ thủ bảo toàn giá trị số tùy chọn (trả về undefined nếu không có)
 */
export function numOrUndef(val: any): number | undefined {
  if (val !== undefined && val !== null && !isNaN(Number(val))) {
    return Number(val);
  }
  return undefined;
}

/**
 * Chuẩn hóa một Keyframe dựa trên Action phân biệt (Discriminated Action Keyframe Sanitizer)
 * Giữ nguyên 100% tham số đặc thù của từng loại action (eyes, mouth, fromScale, toScale, fromDeg, toDeg...)
 */
export function sanitizeKeyframe(kf: any, defaultFrame: number = 0): SceneKeyframe {
  const action = String(kf?.action || kf?.type || "moveCharacter") as SceneKeyframe["action"];
  const target = String(kf?.target || kf?.targetId || (action === "moveCharacter" || action === "changeExpression" ? "character" : "prop"));
  const frame = numOrDef(kf?.frame !== undefined ? kf.frame : kf?.startFrame, defaultFrame);

  const rawParams = kf?.params && typeof kf.params === "object" ? { ...kf.params } : { ...kf };

  let sanitizedParams: Record<string, any> = {};

  switch (action) {
    case "changeExpression": {
      // Bảo toàn trọn vẹn trạng thái khuôn mặt và biểu cảm
      if (rawParams.eyes) sanitizedParams.eyes = String(rawParams.eyes);
      if (rawParams.mouth) sanitizedParams.mouth = String(rawParams.mouth);
      if (rawParams.eyebrows) sanitizedParams.eyebrows = String(rawParams.eyebrows);
      if (rawParams.blush !== undefined) sanitizedParams.blush = Boolean(rawParams.blush);
      if (rawParams.sweatDrop !== undefined) sanitizedParams.sweatDrop = Boolean(rawParams.sweatDrop);
      if (rawParams.pupilGaze && typeof rawParams.pupilGaze === "object") {
        sanitizedParams.pupilGaze = {
          x: numOrDef(rawParams.pupilGaze.x, 0),
          y: numOrDef(rawParams.pupilGaze.y, 0),
        };
      }
      break;
    }

    case "scaleProp": {
      // Bảo toàn tỷ lệ phóng to/thu nhỏ
      sanitizedParams.fromScale = numOrDef(rawParams.fromScale, 1.0);
      sanitizedParams.toScale = numOrDef(rawParams.toScale, 1.5);
      if (rawParams.target || rawParams.targetId) {
        sanitizedParams.targetId = String(rawParams.target || rawParams.targetId);
      }
      break;
    }

    case "rotateProp": {
      // Bảo toàn góc quay
      sanitizedParams.fromDeg = numOrDef(rawParams.fromDeg, 0);
      sanitizedParams.toDeg = numOrDef(rawParams.toDeg, 45);
      if (rawParams.target || rawParams.targetId) {
        sanitizedParams.targetId = String(rawParams.target || rawParams.targetId);
      }
      break;
    }

    case "moveCharacter":
    case "moveProp": {
      // Bảo toàn tọa độ di chuyển (Bao gồm tọa độ 0)
      if (rawParams.fromX !== undefined) sanitizedParams.fromX = Number(rawParams.fromX);
      if (rawParams.toX !== undefined) sanitizedParams.toX = Number(rawParams.toX);
      if (rawParams.fromY !== undefined) sanitizedParams.fromY = Number(rawParams.fromY);
      if (rawParams.toY !== undefined) sanitizedParams.toY = Number(rawParams.toY);

      // Nếu action là moveCharacter mà thiếu fromX/toX thì gán mặc định an toàn
      if (action === "moveCharacter") {
        if (sanitizedParams.fromX === undefined) sanitizedParams.fromX = 600;
        if (sanitizedParams.toX === undefined) sanitizedParams.toX = 1850;
      }
      break;
    }

    case "squashImpact": {
      sanitizedParams.impactFrame = numOrDef(rawParams.impactFrame, frame);
      break;
    }

    case "cameraZoom": {
      sanitizedParams.zoomFrom = numOrDef(rawParams.zoomFrom, 1.0);
      sanitizedParams.zoomTo = numOrDef(rawParams.zoomTo, 1.5);
      if (rawParams.durationFrames !== undefined) {
        sanitizedParams.durationFrames = numOrDef(rawParams.durationFrames, 30);
      }
      break;
    }

    case "cameraPan": {
      if (rawParams.fromX !== undefined) sanitizedParams.fromX = Number(rawParams.fromX);
      if (rawParams.toX !== undefined) sanitizedParams.toX = Number(rawParams.toX);
      if (rawParams.fromY !== undefined) sanitizedParams.fromY = Number(rawParams.fromY);
      if (rawParams.toY !== undefined) sanitizedParams.toY = Number(rawParams.toY);
      if (rawParams.durationFrames !== undefined) {
        sanitizedParams.durationFrames = numOrDef(rawParams.durationFrames, 30);
      }
      break;
    }

    default: {
      // Giữ lại tất cả các key hợp lệ từ custom action
      for (const [k, v] of Object.entries(rawParams)) {
        if (k !== "action" && k !== "type" && k !== "target" && k !== "frame" && k !== "startFrame") {
          sanitizedParams[k] = v;
        }
      }
      break;
    }
  }

  // Bổ sung các custom key người dùng truyền trong params mà schema cụ thể chưa lấy
  for (const [k, v] of Object.entries(rawParams)) {
    if (sanitizedParams[k] === undefined && k !== "action" && k !== "type" && k !== "target" && k !== "frame" && k !== "startFrame") {
      sanitizedParams[k] = v;
    }
  }

  return {
    action,
    target,
    frame,
    params: sanitizedParams,
    springConfig: kf?.springConfig || undefined,
  };
}

/**
 * Chuẩn hóa và bảo toàn toàn bộ dữ liệu MasterSceneGraph
 */
export function sanitizeSceneGraph(
  raw: any,
  userPrompt?: string
): MasterSceneGraph & { sanitizerAuditLog?: string[] } {
  const scenesRaw = Array.isArray(raw?.scenes) ? raw.scenes : [];
  const auditLog: string[] = [];

  let currentStart = 0;

  // Trích xuất các câu thoại từ prompt
  const promptSceneTexts: string[] = [];
  if (userPrompt && typeof userPrompt === "string") {
    const lines = userPrompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(?:cảnh|scene)\s*\d+[:.-]?\s*(.*)$/i);
      if (match && match[1].trim()) {
        promptSceneTexts.push(match[1].trim());
      } else if (line.length > 5 && !line.startsWith("#")) {
        promptSceneTexts.push(line);
      }
    }
  }

  const cleanScenes: SceneGraphScene[] = scenesRaw.map((s: any, idx: number) => {
    const existingSubs = Array.isArray(s?.subtitles)
      ? s.subtitles.filter((sub: any) => sub?.text && String(sub.text).trim().length > 0)
      : [];

    const fallbackText =
      existingSubs.length > 0
        ? existingSubs.map((sub: any) => sub.text).join(" ")
        : promptSceneTexts[idx] ||
          (s?.name && !/^cảnh\s*\d+$/i.test(s.name) ? s.name : "") ||
          s?.description ||
          "";

    const subTexts = fallbackText;
    const wordCount = subTexts.trim() ? subTexts.trim().split(/\s+/).length : 0;
    const estDialogueFrames = wordCount > 0 ? Math.round((wordCount / 2.8) * 60) + 30 : 120;

    let dur = Math.max(60, Math.round(Number(s?.durationInFrames || s?.duration || estDialogueFrames)));
    if (wordCount > 0 && dur > estDialogueFrames + 60) {
      dur = estDialogueFrames + 30;
    }

    const start = currentStart;
    currentStart = start + dur;

    const sceneCombinedText = `${s?.name || ""} ${subTexts} ${promptSceneTexts[idx] || ""}`.toLowerCase();

    // 1. Phân giải bối cảnh Background Preset chính xác (Hỗ trợ 9 Bối cảnh Động 2K)
    let preset: BackgroundPreset = "livingRoomDay";
    if (/lớp học|trường học|giảng đường|bài giảng|thầy|cô giáo|bảng đen|classroom|school/i.test(sceneCombinedText)) {
      preset = "classroom";
    } else if (/văn phòng|công ty|công sở|họp|doanh nghiệp|office|workplace/i.test(sceneCombinedText)) {
      preset = "office";
    } else if (/đường phố|phố xá|vỉa hè|thành phố|đô thị|street|city/i.test(sceneCombinedText)) {
      preset = "cityStreet";
    } else if (/bãi biển|biển|bờ cát|sóng biển|mùa hè|cây dừa|beach|sea/i.test(sceneCombinedText)) {
      preset = "beachSunny";
    } else if (/bầu trời đêm|ngắm sao|đêm đầy sao|vũ trụ|dải ngân hà|night sky|starry/i.test(sceneCombinedText)) {
      preset = "nightSky";
    } else if (
      /đồng cỏ|bãi cỏ|cỏ xanh|thảo nguyên|vườn|sân vườn|công viên|ngoài trời|thiên nhiên|bầu trời|mây trắng|nắng vàng|cây xanh|rừng|garden|park|meadow|grass|lawn|outdoor|sky/i.test(sceneCombinedText) &&
      !/trong nhà|phòng khách|bàn học|ghế sofa|indoor|living\s*room/i.test(sceneCombinedText)
    ) {
      preset = "gardenDay";
    } else if (/ban đêm|tối|khuya|đêm|trăng|sao|night|moonlight/i.test(sceneCombinedText)) {
      preset = "livingRoomNight";
    } else if (/biểu đồ|số liệu|chỉ số|infographic|thuyết trình/i.test(sceneCombinedText)) {
      preset = "infographicStripes";
    } else if (s?.background?.preset) {
      preset = s.background.preset;
    }

    // Bảo toàn màu nền tùy chỉnh (customColors)
    const customColors =
      s?.background?.customColors && typeof s.background.customColors === "object"
        ? { ...s.background.customColors }
        : undefined;

    // 2. Phân giải tư thế Pose và Hướng nhìn
    let characterPose = s?.character?.pose || "standing";
    const hasWalkKeywords = /bước đi|từ từ bước|dạo bước|đi bộ|bước|đi dạo|chạy|di chuyển|ra vườn|walking|walk|stroll/i.test(sceneCombinedText);

    if (/cầm|bê|mang|xách|giữ|nâng|holding|carry/i.test(sceneCombinedText) && characterPose === "standing") {
      characterPose = "holdingObject";
    } else if (hasWalkKeywords && characterPose === "standing") {
      characterPose = "walking";
    }

    // 3. Chuẩn hóa Keyframes có phân biệt Action (BẢO TOÀN TRỌN VẸN PARAMS)
    let finalKeyframes: SceneKeyframe[] = Array.isArray(s?.keyframes) && s.keyframes.length > 0
      ? s.keyframes.map((kf: any) => sanitizeKeyframe(kf, 0))
      : [];

    if (finalKeyframes.length === 0 && hasWalkKeywords) {
      finalKeyframes = [
        {
          action: "moveCharacter",
          target: "character",
          frame: 0,
          params: {
            fromX: 600,
            toX: 1850,
          },
        },
      ];
    }

    // 4. Environment VFX & Lighting
    let envVfx: EnvironmentVfxType[] = Array.isArray(s?.environmentVfx) ? [...s.environmentVfx] : [];
    const isNight = preset === "livingRoomNight" || preset === "nightSky";
    if (preset === "gardenDay" || preset === "beachSunny") {
      if (!envVfx.includes("cloudDrift")) envVfx.push("cloudDrift");
      if (!envVfx.includes("sunbeams")) envVfx.push("sunbeams");
      if (!envVfx.includes("windBreeze")) envVfx.push("windBreeze");
      if (!envVfx.includes("foliageSway")) envVfx.push("foliageSway");
    } else if (isNight && !envVfx.includes("cloudDrift")) {
      envVfx.push("cloudDrift");
    }

    const lighting = s?.lighting || (preset === "gardenDay" || preset === "beachSunny" ? "sunbeams" : isNight ? "moonlight" : "neutral");

    let charSlot = s?.character?.slot;
    if (!charSlot) {
      if (characterPose === "sittingBehindDesk") {
        charSlot = "desk.seat";
      } else if (s?.character?.x !== undefined) {
        charSlot = undefined;
      } else {
        charSlot = "floor.center";
      }
    }

    // 5. Chuẩn hóa nhân vật (BẢO TOÀN visible, x=0, y=0, blush, sweatDrop)
    const charVisible = s?.character?.visible !== undefined ? Boolean(s.character.visible) : true;
    const charX = numOrDef(s?.character?.x, 1280);
    const charY = numOrDef(s?.character?.y, 1120);
    const charScale = numOrDef(s?.character?.scale, 1.0);

    const character = {
      slot: charSlot,
      visible: charVisible,
      x: charX,
      y: charY,
      scale: charScale,
      facing: s?.character?.facing === "left" ? ("left" as const) : ("right" as const),
      pose: characterPose,
      eyes: s?.character?.eyes || "neutral",
      eyebrows: s?.character?.eyebrows || "neutral",
      mouth: s?.character?.mouth || "smile",
      blush: s?.character?.blush !== undefined ? Boolean(s.character.blush) : undefined,
      sweatDrop: s?.character?.sweatDrop !== undefined ? Boolean(s.character.sweatDrop) : undefined,
      pupilGaze: characterPose === "walking" ? { x: 0.6, y: 0 } : (s?.character?.pupilGaze || { x: 0, y: 0 }),
    };

    // 6. Chuẩn hóa camera (BẢO TOÀN panDurationFrames, easing, zoomFrom/To)
    const camera = {
      x: numOrDef(s?.camera?.x, 1280),
      y: numOrDef(s?.camera?.y, 720),
      zoom: numOrDef(s?.camera?.zoom, 1.0),
      zoomFrom: numOrUndef(s?.camera?.zoomFrom),
      zoomTo: numOrUndef(s?.camera?.zoomTo),
      focusSlot: s?.camera?.focusSlot || undefined,
      focusTarget: s?.camera?.focusTarget || undefined,
      easing: s?.camera?.easing || undefined,
      panDurationFrames: numOrUndef(s?.camera?.panDurationFrames),
    };

    // 7. Chuẩn hóa đạo cụ Props (BẢO TOÀN x=0, y=0, scale tùy chỉnh, visible)
    const props: PropItem[] = Array.isArray(s?.props)
      ? s.props
          .map((p: any, pIdx: number) => {
            const rawPropType = String(p?.type || p?.id || "prop");
            const canonicalType = normalizePropAssetId(rawPropType);

            // Nếu bối cảnh là ngoài trời (gardenDay), loại bỏ đồ nội thất trong nhà nếu không được nhắc tới
            if (preset === "gardenDay" && ["sofa", "desk", "desk-lamp", "desk-front", "desk-back"].includes(canonicalType)) {
              if (!/sofa|bàn học|ghế|đèn bàn/i.test(sceneCombinedText)) {
                return null;
              }
            }

            const isScreenSlot = Boolean(p?.slot && String(p.slot).startsWith("screen."));

            // TỶ LỆ SCALE VẬT THỂ:
            // Nếu người dùng/AI đã cung cấp p.scale thì BẢO TOÀN giá trị đó (không tự ý ghi đè 0.35 thành 0.72)
            let propScale: number;
            if (p?.scale !== undefined && !isNaN(Number(p.scale))) {
              propScale = Number(p.scale);
            } else {
              // Mặc định thực tế khi AI không khai báo
              if (canonicalType === "glass-jar") {
                if (isScreenSlot) {
                  propScale = 1.7;
                } else if (p?.slot === "desk.topRight" || p?.slot === "desk.topLeft") {
                  propScale = 0.35;
                } else {
                  propScale = 0.38; // Tỷ lệ chuẩn thực tế 0.35 - 0.40 theo quy chuẩn 2K
                }
              } else {
                propScale = 1.0;
              }
            }

            const hasSpider =
              canonicalType === "glass-jar" &&
              (/nhện|spider|tám/i.test(sceneCombinedText) || p?.properties?.hasSpiderInside === true);

            const propItem: PropItem = {
              id: String(p?.id || `prop_${idx}_${pIdx}`),
              type: canonicalType,
              slot: p?.slot || undefined,
              layer: p?.layer === "midgroundBackLayer" ? ("midgroundBackLayer" as const) : ("midgroundFrontLayer" as const),
              x: numOrDef(p?.x, 1280),
              y: numOrDef(p?.y, 1120),
              scale: propScale,
              scaleX: numOrDef(p?.scaleX, 1),
              scaleY: numOrDef(p?.scaleY, 1),
              rotation: numOrDef(p?.rotation, 0),
              opacity: numOrDef(p?.opacity, 1),
              visible: p?.visible !== undefined ? Boolean(p.visible) : true,
              alphaConfig: p?.alphaConfig || undefined,
              anchorPoint: p?.anchorPoint || (isScreenSlot ? ("center" as const) : undefined),
              pivotPoint: p?.pivotPoint || (isScreenSlot ? ("center" as const) : undefined),
              pivotX: numOrUndef(p?.pivotX),
              pivotY: numOrUndef(p?.pivotY),
              properties: {
                hasSpiderInside: hasSpider ? true : undefined,
                ...p?.properties,
              },
              entrance: p?.entrance || undefined,
            };

            return propItem;
          })
          .filter(Boolean) as PropItem[]
      : [];

    return {
      id: String(s?.id || `scene_${idx + 1}`),
      name: String(s?.name || `Cảnh ${idx + 1}`),
      startFrame: start,
      durationInFrames: dur,
      background: {
        preset,
        customColors,
      },
      camera,
      character,
      props,
      subtitles:
        existingSubs.length > 0
          ? existingSubs.map((sub: any, subIdx: number) => ({
              id: String(sub?.id || `sub_${idx}_${subIdx}`),
              text: String(sub?.text || ""),
              startFrame: numOrDef(sub?.startFrame, start + 5),
              endFrame: numOrDef(sub?.endFrame, start + dur - 5),
              words: Array.isArray(sub?.words) ? sub.words : [],
            }))
          : fallbackText
          ? [
              {
                id: `sub_${idx}_0`,
                text: fallbackText,
                startFrame: start + 5,
                endFrame: start + dur - 5,
                words: [],
              },
            ]
          : [],
      speechBubbles: Array.isArray(s?.speechBubbles) ? s.speechBubbles : [],
      keyframes: finalKeyframes,
      lines: Array.isArray(s?.lines) ? s.lines : [],
      environmentVfx: envVfx,
      lighting: typeof lighting === "string" ? { preset: lighting } : lighting,
      propAnimations: Array.isArray(s?.propAnimations) ? s.propAnimations : [],
    };
  });

  return {
    version: String(raw?.version || "2.1.0"),
    title: String(raw?.title || "2D Animation Story"),
    width: 2560,
    height: 1440,
    fps: 60,
    totalDurationInFrames: Math.max(60, currentStart),
    audioTrack: raw?.audioTrack || undefined,
    scenes: cleanScenes,
    sanitizerAuditLog: auditLog,
  };
}
