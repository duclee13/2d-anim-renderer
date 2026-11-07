import { NextRequest, NextResponse } from "next/server";
import { generateVectorAsset } from "@/lib/vectorAssetGenerator";

export async function POST(req: NextRequest) {
  try {
    const { prompt, propId, provider = "gemini" } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Vui lòng cung cấp mô tả prompt" }, { status: 400 });
    }

    const result = await generateVectorAsset(prompt, propId, provider);

    return NextResponse.json({
      success: true,
      asset: result,
    });
  } catch (error: any) {
    console.error("Generate Asset API Error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi sinh Vector Asset tự động" },
      { status: 500 }
    );
  }
}
