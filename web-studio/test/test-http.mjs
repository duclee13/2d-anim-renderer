const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("No key");
  process.exit(1);
}

async function testModel(modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  console.log(`Testing ${modelName}...`);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Respond with only 'PONG'" }] }]
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json();
    console.log(`[${modelName}] status=${res.status} (${Date.now() - t0}ms):`, data.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || data);
  } catch (err) {
    console.log(`[${modelName}] error (${Date.now() - t0}ms):`, err.name, err.message);
  }
}

async function run() {
  await testModel("gemini-3.8-flash");
  await testModel("gemini-3.5-flash");
  await testModel("gemini-3.1-flash-lite");
}

run();
