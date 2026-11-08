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
 * Tách bỏ chỉ dẫn hình ảnh / máy quay khỏi lời đọc (Narration vs Visual Direction Separation)
 * Ví dụ: "Phóng cận cảnh vào chiếc lọ thủy tinh, tôi dán nhãn đặt tên cho nó là 'Tám'."
 *        -> "Tôi dán nhãn đặt tên cho nó là 'Tám'."
 */
export function stripDirectorialInstructions(text: string): string {
  if (!text) return "";
  let clean = String(text).trim();

  // Loại bỏ nhãn cảnh (Cảnh 1:, Scene 2...)
  clean = clean.replace(/^(?:Cảnh|Scene)\s*\d+[\s:.-]*/i, "");

  // Loại bỏ các chỉ dẫn góc máy, bố cục, minh họa đứng ở đầu câu có dấu ngắt
  clean = clean.replace(
    /^(?:Phóng cận cảnh|Cận cảnh|Toàn cảnh|Trung cảnh|Minh họa biểu đồ|Minh họa|Góc quay|Hình ảnh|Quay cận|Cận cảnh vào|Phóng to vào|Phóng to|Chuyển cảnh sang)\s*(?:vào|về|chiếc|con|người|hình|ô|khung|màn hình|phòng)?\s*[^,.:\n]{0,60}[,.:-]\s*/i,
    ""
  );

  // Loại bỏ các cụm chỉ dẫn góc máy ở đầu câu kể cả khi không có dấu phẩy ngăn cách
  clean = clean.replace(
    /^(?:Phóng cận cảnh|Cận cảnh|Toàn cảnh|Trung cảnh|Quay cận|Phóng to vào|Phóng to|Chuyển cảnh sang)\s+(?:vào|về)\s+/i,
    ""
  );
  clean = clean.replace(/^(?:Minh họa biểu đồ|Minh họa)\s+/i, "");

  // Viết hoa lại chữ cái đầu
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  return clean.trim() || text.trim();
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
      sanitizedParams.fromScale = numOrDef(rawParams.fromScale, 1.0);
      sanitizedParams.toScale = numOrDef(rawParams.toScale, 1.5);
      if (rawParams.target || rawParams.targetId) {
        sanitizedParams.targetId = String(rawParams.target || rawParams.targetId);
      }
      break;
    }

    case "rotateProp": {
      sanitizedParams.fromDeg = numOrDef(rawParams.fromDeg, 0);
      sanitizedParams.toDeg = numOrDef(rawParams.toDeg, 45);
      if (rawParams.target || rawParams.targetId) {
        sanitizedParams.targetId = String(rawParams.target || rawParams.targetId);
      }
      break;
    }

    case "moveCharacter":
    case "moveProp": {
      if (rawParams.fromX !== undefined) sanitizedParams.fromX = Number(rawParams.fromX);
      if (rawParams.toX !== undefined) sanitizedParams.toX = Number(rawParams.toX);
      if (rawParams.fromY !== undefined) sanitizedParams.fromY = Number(rawParams.fromY);
      if (rawParams.toY !== undefined) sanitizedParams.toY = Number(rawParams.toY);

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
      for (const [k, v] of Object.entries(rawParams)) {
        if (k !== "action" && k !== "type" && k !== "target" && k !== "frame" && k !== "startFrame") {
          sanitizedParams[k] = v;
        }
      }
      break;
    }
  }

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
    // 1. Thu thập phụ đề: hỗ trợ cả Array s.subtitles, Object s.subtitles, hoặc s.subtitle
    let rawSubs: any[] = [];
    if (Array.isArray(s?.subtitles)) {
      rawSubs = s.subtitles;
    } else if (s?.subtitles && typeof s.subtitles === "object") {
      rawSubs = [s.subtitles];
    } else if (s?.subtitle && typeof s.subtitle === "object") {
      rawSubs = [s.subtitle];
    }

    const existingSubs = rawSubs.filter(
      (sub: any) => sub?.text && String(sub.text).trim().length > 0
    );

    let rawSubText = "";
    if (existingSubs.length > 0) {
      rawSubText = existingSubs.map((sub: any) => sub.text).join(" ");
    } else {
      rawSubText =
        promptSceneTexts[idx] ||
        (s?.name && !/^cảnh\s*\d+$/i.test(s.name) ? s.name : "") ||
        s?.description ||
        "";
    }

    // Tách sạch chỉ dẫn hình ảnh/camera khỏi phụ đề spoken narration
    const cleanSpokenText = stripDirectorialInstructions(rawSubText);
    const wordCount = cleanSpokenText ? cleanSpokenText.split(/\s+/).length : 0;
    const estDialogueFrames = wordCount > 0 ? Math.round((wordCount / 2.8) * 60) + 30 : 120;

    let dur = Math.max(60, Math.round(Number(s?.durationInFrames || s?.durationFrames || s?.duration || estDialogueFrames)));
    if (wordCount > 0 && dur > estDialogueFrames + 60) {
      dur = estDialogueFrames + 30;
    }

    const start = currentStart;
    currentStart = start + dur;

    const sceneCombinedText = `${s?.name || ""} ${rawSubText} ${promptSceneTexts[idx] || ""}`.toLowerCase();

    // 2. Phân giải bối cảnh Background Preset chính xác (Hỗ trợ 9 Bối cảnh Động 2K)
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

    // 3. Phân tích đối tượng nhân vật (Hỗ trợ cả s.character lẫn mảng s.characters)
    const rawChar =
      s?.character ||
      (Array.isArray(s?.characters) && s.characters.length > 0 ? s.characters[0] : undefined);

    const isCloseUpScene =
      /cận cảnh|phóng cận|zoom|macro|closeup|close_up/i.test(sceneCombinedText) ||
      s?.camera?.type === "macro_closeup" ||
      s?.camera?.focusSlot === "screen.centerCloseUp";

    const isDiagramScene =
      /biểu đồ|chỉ số|infographic|trao đổi chất|metabolism/i.test(sceneCombinedText) ||
      preset === "infographicStripes";

    // Xác định visibility:
    // Nếu explicit visible: false, hoặc pose: "offscreen" / "none", hoặc là cảnh cận/biểu đồ không nói về nhân vật
    let charVisible = true;
    if (rawChar?.visible !== undefined) {
      charVisible = Boolean(rawChar.visible);
    } else if (rawChar?.pose === "offscreen" || rawChar?.pose === "none") {
      charVisible = false;
    } else if (isCloseUpScene || isDiagramScene) {
      // Ở cảnh cận cảnh vật thể hoặc biểu đồ infographic: MẶC ĐỊNH ẨN NHÂN VẬT để tránh che khuất tiêu điểm
      charVisible = false;
    }

    // Phân giải tư thế Pose và Hướng nhìn
    let characterPose = "standing";
    const rawPose = String(rawChar?.pose || "").toLowerCase();
    const hasWalkKeywords = /bước đi|từ từ bước|dạo bước|đi bộ|bước|đi dạo|chạy|di chuyển|ra vườn|walking|walk|stroll/i.test(sceneCombinedText);

    if (/sit|ngồi|working|desk|writing/i.test(rawPose) || /ngồi|bàn học|làm việc|desk/i.test(sceneCombinedText)) {
      characterPose = "sittingBehindDesk";
    } else if (/walk|bước|đi/i.test(rawPose) || hasWalkKeywords) {
      characterPose = "walking";
    } else if (/hold|cầm|mang|xách/i.test(rawPose) || /cầm|bê|mang|xách|giữ|nâng|holding|carry/i.test(sceneCombinedText)) {
      characterPose = "holdingObject";
    } else if (/point|chỉ/i.test(rawPose)) {
      characterPose = "pointing";
    } else if (/shrug/i.test(rawPose)) {
      characterPose = "shrugging";
    } else if (rawChar?.pose && typeof rawChar.pose === "string") {
      characterPose = rawChar.pose;
    }

    let charSlot = rawChar?.slot || s?.character?.slot;
    if (!charSlot) {
      if (characterPose === "sittingBehindDesk") {
        charSlot = "desk.seat";
      } else if (rawChar?.x !== undefined) {
        charSlot = undefined;
      } else {
        charSlot = "floor.center";
      }
    }

    const charX = numOrDef(rawChar?.x, 1280);
    const charY = numOrDef(rawChar?.y, 1120);
    const charScale = numOrDef(rawChar?.scale, 1.0);

    const character = {
      slot: charSlot,
      visible: charVisible,
      x: charX,
      y: charY,
      scale: charScale,
      facing: rawChar?.facing === "left" ? ("left" as const) : ("right" as const),
      pose: characterPose,
      eyes: rawChar?.eyes || rawChar?.expression || "neutral",
      eyebrows: rawChar?.eyebrows || "neutral",
      mouth: rawChar?.mouth || "smile",
      blush: rawChar?.blush !== undefined ? Boolean(rawChar.blush) : undefined,
      sweatDrop: rawChar?.sweatDrop !== undefined ? Boolean(rawChar.sweatDrop) : undefined,
      pupilGaze: characterPose === "walking" ? { x: 0.6, y: 0 } : (rawChar?.pupilGaze || { x: 0, y: 0 }),
    };

    // 4. Chuẩn hóa camera
    // CHỐNG PHÓNG ĐẠI QUÁ MỨC (Anti-Overzoom):
    // Đối với cảnh cận (screen.centerCloseUp), prop đã được scale 1.7x; zoom camera chỉ nên từ 1.0 đến 1.15 để không cắt mép
    let rawZoom = numOrDef(s?.camera?.zoom, 1.0);
    if (isCloseUpScene && rawZoom > 1.25) {
      rawZoom = 1.15;
    }

    const cameraFocusSlot =
      s?.camera?.focusSlot ||
      s?.camera?.focalPoint ||
      (isCloseUpScene ? "screen.centerCloseUp" : isDiagramScene ? "screen.center" : characterPose === "sittingBehindDesk" ? "desk.seat" : undefined);

    const camera = {
      x: numOrDef(s?.camera?.x, 1280),
      y: numOrDef(s?.camera?.y, 720),
      zoom: rawZoom,
      zoomFrom: numOrUndef(s?.camera?.zoomFrom),
      zoomTo: isCloseUpScene && s?.camera?.zoomTo && s.camera.zoomTo > 1.25 ? 1.15 : numOrUndef(s?.camera?.zoomTo),
      focusSlot: cameraFocusSlot,
      focusTarget: s?.camera?.focusTarget || undefined,
      easing: s?.camera?.easing || undefined,
      panDurationFrames: numOrUndef(s?.camera?.panDurationFrames),
    };

    // 5. Chuẩn hóa Keyframes có phân biệt Action (BẢO TOÀN TRỌN VẸN PARAMS)
    let finalKeyframes: SceneKeyframe[] = Array.isArray(s?.keyframes) && s.keyframes.length > 0
      ? s.keyframes.map((kf: any) => sanitizeKeyframe(kf, 0))
      : [];

    if (finalKeyframes.length === 0 && hasWalkKeywords && charVisible) {
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

    // 6. Chuẩn hóa đạo cụ Props (BẢO TOÀN x=0, y=0, scale tùy chỉnh, visible, containment)
    const rawProps = Array.isArray(s?.props)
      ? s.props
      : Array.isArray(s?.assets)
      ? s.assets.filter((a: any) => a.type !== "character")
      : [];

    // Kiểm tra xem cảnh có lọ chứa nhện hay vật chứa nào không
    const hasJarInScene = rawProps.some(
      (p: any) =>
        /glass-jar|jar|thuy-tinh|container/i.test(p?.type || "") ||
        /glass_jar|jar/i.test(p?.id || "") ||
        p?.properties?.hasSpiderInside
    );

    const props: PropItem[] = rawProps
      .map((p: any, pIdx: number) => {
        const rawTypeStr = String(p?.type || "");
        const rawIdStr = String(p?.id || "");

        let canonicalType = normalizePropAssetId(rawTypeStr);

        // Nếu type rỗng, không xác định (unknown-prop) hoặc là từ khóa chung chung, tra cứu tiếp từ ID
        if (
          !rawTypeStr ||
          canonicalType === "unknown-prop" ||
          canonicalType === "prop" ||
          rawTypeStr === "container" ||
          rawTypeStr === "furniture" ||
          rawTypeStr === "light_source" ||
          rawTypeStr === "light-source" ||
          rawTypeStr === "infographic_meter" ||
          rawTypeStr === "infographic-meter"
        ) {
          const idResolved = normalizePropAssetId(rawIdStr);
          if (idResolved !== "unknown-prop" && idResolved !== "prop") {
            canonicalType = idResolved;
          } else if (rawTypeStr === "container") {
            canonicalType = "glass-jar";
          } else if (rawTypeStr === "furniture") {
            canonicalType = "desk";
          } else if (rawTypeStr === "light_source" || rawTypeStr === "light-source") {
            canonicalType = "desk-lamp";
          } else if (rawTypeStr === "infographic_meter" || rawTypeStr === "infographic-meter") {
            canonicalType = "gauge-meter";
          }
        }

        // BẢO VỆ CHỐNG DUPLICATE SPIDER (Ngăn nhện lơ lửng ngoài lọ):
        // Nếu đã có lọ thủy tinh trong cảnh và nhện được yêu cầu nằm trong lọ, KHÔNG tạo một prop nhện tự do lơ lửng bên ngoài!
        if (canonicalType === "spider" && hasJarInScene) {
          return null; // Bỏ qua prop nhện độc lập vì nhện đã nằm trong lọ
        }

        // Loại bỏ nội thất trong nhà khi ở cảnh ngoài trời gardenDay
        if (preset === "gardenDay" && ["sofa", "desk", "desk-lamp", "desk-front", "desk-back"].includes(canonicalType)) {
          if (!/sofa|bàn học|ghế|đèn bàn/i.test(sceneCombinedText)) {
            return null;
          }
        }

        const isScreenSlot = Boolean(
          (p?.slot && String(p.slot).startsWith("screen.")) || isCloseUpScene || isDiagramScene
        );

        let propScale: number;
        if (p?.scale !== undefined && !isNaN(Number(p.scale))) {
          propScale = Number(p.scale);
        } else {
          if (canonicalType === "glass-jar") {
            if (isScreenSlot) {
              propScale = 1.7; // Chuẩn 850px-900px cảnh cận 2K
            } else if (p?.slot === "desk.topRight" || p?.slot === "desk.topLeft" || characterPose === "sittingBehindDesk") {
              propScale = 0.35; // ~280px trên mặt bàn
            } else {
              propScale = 0.38; // ~310px trên sàn nhà
            }
          } else if (canonicalType === "gauge-meter") {
            propScale = isScreenSlot ? 1.6 : 1.0;
          } else if (canonicalType === "desk-lamp") {
            propScale = 1.15;
          } else {
            propScale = 1.0;
          }
        }

        // Trích xuất nhãn dán thông minh (label / labelText / title)
        const labelText =
          p?.properties?.label ||
          p?.properties?.labelText ||
          p?.properties?.title ||
          p?.label ||
          p?.labelText ||
          (/đặt tên.*là\s*['"“]?([a-zA-Z0-9À-ỹ]+)['"”]?/i.exec(sceneCombinedText)?.[1]) ||
          (isCloseUpScene && /tám/i.test(sceneCombinedText) ? "TÁM" : undefined);

        const hasSpider =
          canonicalType === "glass-jar" &&
          (/nhện|spider|tám/i.test(sceneCombinedText) ||
            p?.properties?.hasSpiderInside === true ||
            hasJarInScene);

        // Phân giải slot chuẩn
        let propSlot = p?.slot;
        if (!propSlot) {
          if (isCloseUpScene && canonicalType === "glass-jar") propSlot = "screen.centerCloseUp";
          else if (isDiagramScene && canonicalType === "gauge-meter") propSlot = "screen.center";
          else if (canonicalType === "desk-lamp") propSlot = "desk.topLeft";
          else if (canonicalType === "glass-jar" && characterPose === "sittingBehindDesk") propSlot = "desk.topRight";
        }

        const propItem: PropItem = {
          id: String(p?.id || `prop_${idx}_${pIdx}`),
          type: canonicalType,
          slot: propSlot || undefined,
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
            ...p?.properties,
            hasSpiderInside: hasSpider ? true : undefined,
            label: labelText,
          },
          entrance: p?.entrance || undefined,
        };

        return propItem;
      })
      .filter(Boolean) as PropItem[];

    // 7. Environment VFX & Lighting
    let envVfx: EnvironmentVfxType[] = Array.isArray(s?.environmentVfx) ? [...s.environmentVfx] : [];
    const isNight = preset === "livingRoomNight" || preset === "nightSky";
    if (preset === "gardenDay" || preset === "beachSunny") {
      if (!envVfx.includes("cloudDrift")) envVfx.push("cloudDrift");
      if (!envVfx.includes("sunbeams")) envVfx.push("sunbeams");
      if (!envVfx.includes("windBreeze")) envVfx.push("windBreeze");
      if (!envVfx.includes("foliageSway")) envVfx.push("foliageSway");
    } else if (isNight && !envVfx.includes("cloudDrift") && !isCloseUpScene && !isDiagramScene) {
      envVfx.push("cloudDrift");
    }

    // Nếu cảnh ban đêm có đèn bàn (desk-lamp), BẮT BUỘC lighting là warmNightLamp
    const hasDeskLamp = props.some((p) => p.type === "desk-lamp");
    let lightingPreset = "neutral";
    if (hasDeskLamp || /ánh đèn|đèn bàn|đèn ấm|lamp/i.test(sceneCombinedText)) {
      lightingPreset = "warmNightLamp";
    } else if (preset === "gardenDay" || preset === "beachSunny") {
      lightingPreset = "sunbeams";
    } else if (isNight) {
      lightingPreset = "moonlight";
    }

    const lighting = typeof s?.lighting === "object" ? { ...s.lighting, preset: lightingPreset } : { preset: lightingPreset };

    // Subtitles chuẩn xác, đã bóc tách sạch camera notes
    const subtitles = [
      {
        id: `sub_${idx}_0`,
        text: cleanSpokenText,
        startFrame: start + 5,
        endFrame: start + dur - 5,
        words: Array.isArray(existingSubs[0]?.words) ? existingSubs[0].words : [],
      },
    ];

    return {
      id: String(s?.id || s?.sceneId || `scene_${idx + 1}`),
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
      subtitles,
      speechBubbles: Array.isArray(s?.speechBubbles) ? s.speechBubbles : [],
      keyframes: finalKeyframes,
      lines: Array.isArray(s?.lines) ? s.lines : [],
      environmentVfx: envVfx,
      lighting,
      propAnimations: Array.isArray(s?.propAnimations) ? s.propAnimations : [],
    };
  });

  return {
    version: String(raw?.version || "3.1.0"),
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
