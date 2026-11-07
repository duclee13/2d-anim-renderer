import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
 * Auto AI SVG Generator (Recraft.ai / Gemini Vector Engine)
 * Tự động tạo asset vector SVG khi Scene Graph yêu cầu một đạo cụ chưa có trong Asset Bank.
 * 
 * @param prompt Mô tả đạo cụ cần sinh (ví dụ: 'a clean transparent glass jar with orange lid in cartoon stickman style')
 * @param propId Định danh lưu file (ví dụ: 'magic-potion')
 * @param provider 'recraft' | 'gemini' (mặc định thử Recraft, nếu không có key thì fallback sang Gemini)
 */
export async function generateVectorAsset(
  prompt: string,
  propId?: string,
  provider: "recraft" | "gemini" = "gemini"
): Promise<GenerateAssetResult> {
  const safeId = (propId || `ai_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const recraftApiKey = process.env.RECRAFT_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  let svgContent = "";
  let width = 240;
  let height = 240;

  // 1. CẮM API RECRAFT.AI (Nếu có RECRAFT_API_KEY)
  if (provider === "recraft" && recraftApiKey) {
    try {
      const response = await fetch("https://external.api.recraft.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${recraftApiKey}`,
        },
        body: JSON.stringify({
          prompt: `${prompt}, clean vector illustration, isolated on white, cartoon 2D animation style, flat colors, thick black outline`,
          style: "vector_illustration",
          format: "svg",
        }),
      });

      const data = await response.json();
      if (data.data && data.data[0] && data.data[0].url) {
        const svgRes = await fetch(data.data[0].url);
        svgContent = await svgRes.text();
      }
    } catch (err: any) {
      console.warn("[VectorAssetGenerator] Recraft.ai API error, fallback to Gemini:", err.message);
    }
  }

  // 2. FALLBACK SANG GEMINI 3.8 / 2.5 FLASH ĐỂ VIẾT SVG TRỰC TIẾP
  if (!svgContent && geminiApiKey) {
    const candidateModels = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
    for (const modelName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
        });

        const systemPrompt = `
You are a Principal 2D Vector Graphic Illustrator for an animation studio.
Generate a valid, beautiful, clean SVG representing the object described.
Rules:
- Thick black cartoon stroke (#141414, 8-12px width, stroke-linecap="round", stroke-linejoin="round").
- Flat vibrant pastel colors.
- The SVG must be standalone, symmetric or centered around (0, 0), with viewBox="-120 -140 240 280".
- Output ONLY the raw <svg>...</svg> code, no markdown code blocks.
`;
        const result = await model.generateContent(`${systemPrompt}\n\nObject description: ${prompt}`);
        let rawText = result.response.text().trim();
        // Bóc tách nếu bị bọc trong markdown ```xml / ```svg
        rawText = rawText.replace(/^```(?:svg|xml|html)?\n?/i, "").replace(/\n?```$/i, "");
        if (rawText && rawText.includes("<svg")) {
          svgContent = rawText;
          width = 240;
          height = 280;
          break;
        }
      } catch (err: any) {
        console.warn(`[VectorAssetGenerator] Gemini model ${modelName} SVG error:`, err.message);
      }
    }
  }

  // 3. PLACEHOLDER DỰ PHÒNG NẾU KHÔNG CÓ KẾT NỐI API
  if (!svgContent) {
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width="200" height="200">
      <rect x="-90" y="-90" width="180" height="180" rx="20" fill="#E2E8F0" stroke="#141414" stroke-width="8" />
      <text x="0" y="10" text-anchor="middle" font-size="18" font-weight="bold" fill="#475569">${safeId}</text>
    </svg>`;
    width = 200;
    height = 200;
  }

  // 4. TỰ ĐỘNG GHI FILE VÀO KHO TÀI NGUYÊN public/assets/props/
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
