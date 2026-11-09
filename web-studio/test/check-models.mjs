import fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;
async function checkModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    const names = data.models
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace(/^models\//, ""));
    console.log("Supported generateContent models on this key:", names);
    fs.writeFileSync("test/available_models.json", JSON.stringify(names, null, 2));
  } else {
    console.log("No models returned:", data);
  }
}
checkModels().catch(console.error);
