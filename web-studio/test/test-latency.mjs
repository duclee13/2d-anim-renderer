import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  console.log("Testing ping to gemini-3.8-flash...");
  const t0 = Date.now();
  const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
  const res = await model.generateContent("Hello, output 'OK'");
  console.log("Response:", res.response.text().trim(), `in ${Date.now() - t0}ms`);
}

test().catch(console.error);
