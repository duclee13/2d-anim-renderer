/**
 * Gemini API Retry & Resilience Engine
 * 
 * Quy chuẩn:
 * 1. Thử lại tối đa 3 lần sau lần gọi đầu tiên (1 initial + 3 retries = 4 lần gọi).
 * 2. Thời gian chờ cơ sở: Lần 1 ~5s, Lần 2 ~15s, Lần 3 ~30s kèm Jitter (±1s đến ±3s).
 * 3. Ưu tiên giá trị 'Retry-After' nếu server trả về trong header hoặc error message.
 * 4. Không retry các lỗi không thể khắc phục: 400 (Bad Request / INVALID_ARGUMENT),
 *    401/403 (API Key không hợp lệ / PERMISSION_DENIED), 404 (NOT_FOUND).
 * 5. Giữ nguyên 100% model đã chọn trong suốt quá trình thử lại.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  onRetry?: (attempt: number, maxRetries: number, delayMs: number, error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Kiểm tra xem một lỗi từ Gemini API có phải là lỗi tạm thời (có thể retry) hay không.
 */
export function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  const status = Number(err.status || err.statusCode || 0);

  // Lỗi không được retry: Sai API key, sai tham số, cấm quyền, model không tồn tại
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    msg.includes("api_key_invalid") ||
    msg.includes("api key not valid") ||
    msg.includes("invalid_argument") ||
    msg.includes("permission_denied") ||
    msg.includes("not found")
  ) {
    return false;
  }

  // Lỗi cần retry: 503 (quá tải), 429 (hết quota tạm thời), 500, 502, 504, timeout, network reset
  if (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    msg.includes("503") ||
    msg.includes("service unavailable") ||
    msg.includes("high demand") ||
    msg.includes("resourceexhausted") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("abort") ||
    msg.includes("fetch failed")
  ) {
    return true;
  }

  return false;
}

/**
 * Trích xuất thời gian chờ (giây) từ Retry-After header hoặc nội dung thông báo lỗi
 */
export function extractRetryAfterSeconds(err: any): number | null {
  if (!err) return null;

  // 1. Kiểm tra thuộc tính retryAfter hoặc response headers
  if (typeof err.retryAfter === "number" && err.retryAfter > 0) {
    return err.retryAfter;
  }

  const msg = String(err.message || "");

  // 2. Tìm cú pháp "retry after X seconds" hoặc "retryAfter: Xs"
  const matchSec = msg.match(/retry(?:-|\s*)after[\s:]*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i);
  if (matchSec && matchSec[1]) {
    const val = parseFloat(matchSec[1]);
    if (!isNaN(val) && val > 0) return Math.ceil(val);
  }

  // 3. Tìm cú pháp "please try again in X seconds"
  const matchIn = msg.match(/(?:try again in|wait)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i);
  if (matchIn && matchIn[1]) {
    const val = parseFloat(matchIn[1]);
    if (!isNaN(val) && val > 0) return Math.ceil(val);
  }

  return null;
}

/**
 * Tính toán độ trễ retry theo phân bổ: Lần 1 ~5s, Lần 2 ~15s, Lần 3 ~30s + Jitter
 */
export function computeBackoffDelay(attempt: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
    // Ưu tiên Retry-After từ server (tối thiểu 2 giây, tối đa 60 giây)
    return Math.min(60000, Math.max(2000, Math.round(retryAfterSeconds * 1000)));
  }

  // Phân bổ thời gian: 5s, 15s, 30s
  const baseScheduleSeconds = [5, 15, 30];
  const baseSec = baseScheduleSeconds[attempt - 1] ?? 30;

  // Jitter ngẫu nhiên để tránh hiện tượng dồn cục (Thundering Herd)
  // Lần 1: ±1s, Lần 2: ±2s, Lần 3: ±3s
  const jitterRange = attempt === 1 ? 1 : attempt === 2 ? 2 : 3;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  const totalSec = Math.max(2, baseSec + jitter);

  return Math.round(totalSec * 1000);
}

/**
 * Hàm sleep có hỗ trợ AbortSignal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException("Yêu cầu đã bị hủy bởi người dùng", "AbortError"));
    }

    const timer = setTimeout(() => {
      resolve();
    }, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Yêu cầu đã bị hủy bởi người dùng", "AbortError"));
    }, { once: true });
  });
}

/**
 * Bộ thực thi tác vụ với cơ chế thử lại tối đa 3 lần sau lần gọi đầu tiên
 */
export async function executeGeminiWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException("Yêu cầu đã bị hủy bởi người dùng", "AbortError");
    }

    try {
      return await operation(attempt);
    } catch (err: any) {
      lastError = err;

      // Nếu người dùng đã chủ động hủy request thì ngừng ngay
      if (err.name === "AbortError" || options.signal?.aborted) {
        throw err;
      }

      // Kiểm tra xem có được phép retry không
      const retryable = isRetryableGeminiError(err);
      const isLastAttempt = attempt > maxRetries;

      if (!retryable || isLastAttempt) {
        console.warn(
          `[GeminiRetry] Không thể retry tiếp (attempt=${attempt}/${maxRetries + 1}, retryable=${retryable}): ${err.message}`
        );
        throw err;
      }

      const retryAfterSec = extractRetryAfterSeconds(err);
      const delayMs = computeBackoffDelay(attempt, retryAfterSec);

      console.warn(
        `[GeminiRetry] Gặp lỗi tạm thời (${err.message}). Đang chờ ${(delayMs / 1000).toFixed(1)}s để thử lại lần ${attempt}/${maxRetries}...`
      );

      if (options.onRetry) {
        options.onRetry(attempt, maxRetries, delayMs, err);
      }

      await sleep(delayMs, options.signal);
    }
  }

  throw lastError;
}
