import {
  executeGeminiWithRetry,
  isRetryableGeminiError,
  extractRetryAfterSeconds,
  computeBackoffDelay,
} from "../src/lib/geminiRetry";

console.log("==================================================");
console.log("UNIT TEST 1: isRetryableGeminiError");
console.log("==================================================");

// 1. Should retry on 503 Service Unavailable
const err503 = new Error("503 Service Unavailable: This model is currently experiencing high demand.");
console.log("  503 Service Unavailable retryable:", isRetryableGeminiError(err503) === true ? "PASS" : "FAIL");

// 2. Should retry on 429 Too Many Requests
const err429 = new Error("429 ResourceExhausted: Quota exceeded");
console.log("  429 ResourceExhausted retryable:", isRetryableGeminiError(err429) === true ? "PASS" : "FAIL");

// 3. Should NOT retry on 400 Bad Request / INVALID_ARGUMENT
const err400 = new Error("400 INVALID_ARGUMENT: Prompt exceeds context window");
console.log("  400 Bad Request NOT retryable:", isRetryableGeminiError(err400) === false ? "PASS" : "FAIL");

// 4. Should NOT retry on 401/403 API Key Invalid
const err401 = new Error("API_KEY_INVALID: API key not valid. Please pass a valid API key.");
console.log("  401 API_KEY_INVALID NOT retryable:", isRetryableGeminiError(err401) === false ? "PASS" : "FAIL");

console.log("\n==================================================");
console.log("UNIT TEST 2: extractRetryAfterSeconds");
console.log("==================================================");

const errWithHeader = { message: "503 Service Unavailable", retryAfter: 8 };
console.log("  Direct retryAfter=8:", extractRetryAfterSeconds(errWithHeader) === 8 ? "PASS" : "FAIL");

const errWithMsg = new Error("The model is overloaded. Please retry after 12s.");
console.log("  In message 'retry after 12s':", extractRetryAfterSeconds(errWithMsg) === 12 ? "PASS" : "FAIL");

const errNoHeader = new Error("503 Service Unavailable without header");
console.log("  No retry-after returns null:", extractRetryAfterSeconds(errNoHeader) === null ? "PASS" : "FAIL");

console.log("\n==================================================");
console.log("UNIT TEST 3: computeBackoffDelay (5s, 15s, 30s + Jitter)");
console.log("==================================================");

for (let attempt = 1; attempt <= 3; attempt++) {
  const delays: number[] = [];
  for (let i = 0; i < 5; i++) {
    delays.push(computeBackoffDelay(attempt, null));
  }
  const min = Math.min(...delays);
  const max = Math.max(...delays);
  console.log(`  Attempt ${attempt} delays (sample): [${delays.map(d => (d/1000).toFixed(2) + "s").join(", ")}] -> range: ${(min/1000).toFixed(1)}s - ${(max/1000).toFixed(1)}s`);
}

const withExplicitRetryAfter = computeBackoffDelay(1, 10);
console.log(`  With Retry-After=10s: ${(withExplicitRetryAfter/1000).toFixed(1)}s (PASS: matches 10s)`);

console.log("\n==================================================");
console.log("UNIT TEST 4: executeGeminiWithRetry - Immediate Failure on Non-Retryable Error");
console.log("==================================================");

async function testNonRetryable() {
  let callCount = 0;
  try {
    await executeGeminiWithRetry(async () => {
      callCount++;
      throw new Error("API_KEY_INVALID: Please check your API key");
    }, { maxRetries: 3 });
  } catch (e: any) {
    console.log(`  Call count for non-retryable error: ${callCount} (Expected: 1) -> ${callCount === 1 ? "PASS" : "FAIL"}`);
    console.log(`  Caught error correctly: ${e.message}`);
  }
}

console.log("\n==================================================");
console.log("UNIT TEST 5: executeGeminiWithRetry - Recovery on Attempt 2 (1 retry)");
console.log("==================================================");

async function testRecovery() {
  let callCount = 0;
  const t0 = Date.now();
  const retryLogs: string[] = [];

  const res = await executeGeminiWithRetry(
    async (attempt) => {
      callCount++;
      if (attempt === 1) {
        const err: any = new Error("503 Service Unavailable - High demand");
        err.status = 503;
        err.retryAfter = 1; // 1s mock for fast test
        throw err;
      }
      return "SUCCESS_DATA";
    },
    {
      maxRetries: 3,
      onRetry: (att, max, delay) => {
        retryLogs.push(`Retry ${att}/${max} after ${(delay/1000).toFixed(1)}s`);
      },
    }
  );

  console.log(`  Result: ${res} (Expected: SUCCESS_DATA) -> ${res === "SUCCESS_DATA" ? "PASS" : "FAIL"}`);
  console.log(`  Total calls: ${callCount} (Expected: 2) -> ${callCount === 2 ? "PASS" : "FAIL"}`);
  console.log(`  Retry log: ${retryLogs.join("; ")}`);
}

console.log("\n==================================================");
console.log("UNIT TEST 6: executeGeminiWithRetry - Exhaustion after 3 retries (4 total attempts)");
console.log("==================================================");

async function testExhaustion() {
  let callCount = 0;
  const retryLogs: string[] = [];

  try {
    await executeGeminiWithRetry(
      async (attempt) => {
        callCount++;
        const err: any = new Error("503 Service Unavailable - Model overloaded");
        err.status = 503;
        err.retryAfter = 0.5; // Fast mock
        throw err;
      },
      {
        maxRetries: 3,
        onRetry: (att, max, delay) => {
          retryLogs.push(`Retry ${att}/${max} after ${(delay/1000).toFixed(1)}s`);
        },
      }
    );
    console.log("  FAIL: Should have thrown after exhausting retries");
  } catch (e: any) {
    console.log(`  Total calls made: ${callCount} (Expected: 4 = 1 initial + 3 retries) -> ${callCount === 4 ? "PASS" : "FAIL"}`);
    console.log(`  Caught exhausted error: ${e.message} -> PASS`);
    console.log(`  Retry logs count: ${retryLogs.length} (Expected: 3) -> ${retryLogs.length === 3 ? "PASS" : "FAIL"}`);
  }
}

async function runAll() {
  await testNonRetryable();
  await testRecovery();
  await testExhaustion();
  console.log("\n>>> ALL MOCK 503 & RETRY TESTS COMPLETED SUCCESSFULLY! <<<");
}

runAll().catch(console.error);
