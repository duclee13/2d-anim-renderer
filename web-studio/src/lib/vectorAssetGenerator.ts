import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGeminiWithRetry } from "./geminiRetry";

export interface GenerateAssetResult {
  id: string;
  svgContent: string;
  dimensions: {
    width: number;
    height: number;
  };
  filePath?: string;
}

/**
 * Procedural Cartoon SVG Fallback
 * Tự động tạo hình minh họa vector hoạt hình đẹp mắt, mềm mại, viền đậm chuẩn 2K
 * khi offline hoặc không kết nối được Gemini/Recraft.
 */
function createProceduralCartoonSvg(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colorPalettes = [
    { bg: "#F59E0B", inner: "#FEF3C7", accent: "#D97706", stroke: "#141414" },
    { bg: "#3B82F6", inner: "#DBEAFE", accent: "#2563EB", stroke: "#141414" },
    { bg: "#10B981", inner: "#D1FAE5", accent: "#059669", stroke: "#141414" },
    { bg: "#EC4899", inner: "#FCE7F3", accent: "#DB2777", stroke: "#141414" },
    { bg: "#8B5CF6", inner: "#EDE9FE", accent: "#7C3AED", stroke: "#141414" },
    { bg: "#F97316", inner: "#FFEDD5", accent: "#EA580C", stroke: "#141414" },
  ];
  const pal = colorPalettes[hash % colorPalettes.length];
  const cleanLabel = id.replace(/[-_]/g, " ").toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 300 300" width="300" height="300">
  <defs>
    <radialGradient id="shadow_${hash}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0F172A" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grad_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.inner}"/>
      <stop offset="100%" stop-color="${pal.bg}"/>
    </linearGradient>
  </defs>
  <!-- Drop Shadow -->
  <ellipse cx="0" cy="125" rx="110" ry="18" fill="url(#shadow_${hash})"/>
  <!-- Main Cartoon Badge -->
  <rect x="-110" y="-110" width="220" height="220" rx="42" fill="url(#grad_${hash})" stroke="${pal.stroke}" stroke-width="12" stroke-linejoin="round"/>
  <!-- Inner Rim -->
  <rect x="-90" y="-90" width="180" height="180" rx="28" fill="none" stroke="${pal.accent}" stroke-width="6" opacity="0.6"/>
  <!-- Shiny reflection stripe -->
  <path d="M-75 -85 L-20 -85 L-65 40 L-90 40 Z" fill="#FFFFFF" opacity="0.45"/>
  <!-- Cartoon Star / Sparkle Icon -->
  <path d="M0 -45 Q0 -15 30 -15 Q0 -15 0 15 Q0 -15 -30 -15 Q0 -15 0 -45 Z" fill="${pal.accent}" stroke="${pal.stroke}" stroke-width="6" stroke-linejoin="round"/>
  <!-- Label with Be Vietnam Pro font -->
  <rect x="-85" y="45" width="170" height="42" rx="12" fill="#141414"/>
  <text x="0" y="72" text-anchor="middle" font-size="15" font-weight="900" fill="#FFFFFF" font-family="sans-serif" letter-spacing="1">${cleanLabel}</text>
</svg>`;
}

/**
 * Auto AI SVG Generator (Gemini Vector Engine / Procedural Fallback)
 * Tự động tạo asset vector SVG khi Scene Graph yêu cầu một đạo cụ chưa có trong Asset Bank.
 */
export async function generateVectorAsset(
  prompt: string,
  propId?: string,
  provider: "recraft" | "gemini" = "gemini",
  explicitApiKey?: string
): Promise<GenerateAssetResult> {
  const safeId = (propId || `ai_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const geminiApiKey = explicitApiKey || process.env.GEMINI_API_KEY;

  let svgContent = "";
  let width = 300;
  let height = 300;

  // 1. TẠO BẰNG GEMINI FLASH VỚI PROMPT VECTO CHUYÊN DỤNG VÀ RETRY 3 LẦN
  if (geminiApiKey) {
    const targetModel = "gemini-3.8-flash";
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);

      const systemPrompt = `You are a Principal 2D Vector Graphic Illustrator for an animation studio producing high quality 1080p stickman videos.
Generate a valid, beautiful, clean standalone SVG representing the object described.
Strict Rules:
- Output ONLY the raw <svg>...</svg> XML markup. Do NOT use markdown code blocks (\`\`\`xml or \`\`\`).
- Visual Style: Cartoon 2D animation style with thick smooth black outline (#141414, 10-14px width, stroke-linecap="round", stroke-linejoin="round").
- Colors: Soft, vibrant flat colors with cute specular highlights or soft shading.
- Viewport: Perfectly centered around (0, 0), with viewBox="-150 -150 300 300", width="300", height="300".
- Must include xmlns="http://www.w3.org/2000/svg".`;

      svgContent = await executeGeminiWithRetry(
        async (attempt) => {
          console.log(`[VectorAssetGenerator] Đang gọi ${targetModel} cho '${safeId}' (Lần ${attempt}/4)...`);
          const model = genAI.getGenerativeModel({ model: targetModel });
          const result = await model.generateContent(`${systemPrompt}\n\nObject description: ${prompt} (${safeId})`);
          let rawText = result.response.text().trim();
          rawText = rawText.replace(/^```(?:svg|xml|html)?\n?/i, "").replace(/\n?```$/i, "").trim();

          if (rawText && rawText.includes("<svg") && rawText.includes("</svg>")) {
            const startIdx = rawText.indexOf("<svg");
            const endIdx = rawText.lastIndexOf("</svg>") + 6;
            return rawText.substring(startIdx, endIdx);
          }
          throw new Error("Không nhận diện được thẻ <svg> hợp lệ trong phản hồi.");
        },
        {
          maxRetries: 3,
          onRetry: (attempt, maxRetries, delayMs, err) => {
            console.warn(
              `[VectorAssetGenerator] Model ${targetModel} thất bại (${err.message}). Đang chờ ${(delayMs / 1000).toFixed(1)}s để thử lại lần ${attempt}/${maxRetries}...`
            );
          },
        }
      );
    } catch (err: any) {
      console.warn(`[VectorAssetGenerator] Gemini ${targetModel} thất bại sau 3 lần thử lại cho '${safeId}':`, err.message);
    }
  }

  // 2. PROCEDURAL CARTOON FALLBACK NẾU KHÔNG CÓ KẾT NỐI API
  if (!svgContent) {
    svgContent = createProceduralCartoonSvg(safeId);
  }

  // 3. TỰ ĐỘNG GHI FILE VÀO KHO TÀI NGUYÊN public/assets/props/
  try {
    const assetsDir = path.join(process.cwd(), "public", "assets", "props");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const targetFile = path.join(assetsDir, `${safeId}.svg`);
    fs.writeFileSync(targetFile, svgContent, "utf8");

    return {
      id: safeId,
      svgContent,
      dimensions: { width, height },
      filePath: `/assets/props/${safeId}.svg`,
    };
  } catch (err: any) {
    console.warn("[VectorAssetGenerator] Không thể ghi file vào public folder:", err.message);
    return {
      id: safeId,
      svgContent,
      dimensions: { width, height },
    };
  }
}
