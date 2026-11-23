export class ApiError extends Error {
  status: number;
  isHtmlResponse: boolean;

  constructor(message: string, status = 0, isHtmlResponse = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isHtmlResponse = isHtmlResponse;
  }
}

export async function parseJsonResponse<T = any>(
  res: Response,
  fallbackError = 'Không thể xử lý phản hồi từ máy chủ.'
): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const trimmed = rawText.trim();

  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  if (looksLikeHtml) {
    throw new ApiError(
      'Máy chủ đang khởi động lại hoặc phản hồi không đúng định dạng dữ liệu. Vui lòng thử lại sau giây lát.',
      res.status,
      true
    );
  }

  let parsed: any = null;
  if (trimmed.length > 0) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new ApiError(
        res.ok
          ? 'Dữ liệu phản hồi từ máy chủ không hợp lệ. Vui lòng tải lại.'
          : `${fallbackError} (Mã ${res.status})`,
        res.status,
        false
      );
    }
  }

  if (!res.ok) {
    const serverMessage =
      parsed && typeof parsed === 'object' && typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error.trim()
        : `${fallbackError} (Mã ${res.status})`;
    throw new ApiError(serverMessage, res.status, false);
  }

  return parsed as T;
}

interface FetchJsonOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  fallbackError?: string;
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchJson<T = any>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const {
    retries,
    retryDelayMs = 450,
    fallbackError = 'Không thể kết nối đến máy chủ.',
    ...fetchInit
  } = options;

  const method = (fetchInit.method || 'GET').toUpperCase();
  const isSafeRetryMethod = method === 'GET' || method === 'HEAD';
  const maxRetries = typeof retries === 'number' ? retries : isSafeRetryMethod ? 2 : 0;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers = new Headers(fetchInit.headers);
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }

      const res = await fetch(url, {
        ...fetchInit,
        headers,
      });

      const isTransientStatus = res.status === 502 || res.status === 503 || res.status === 504;
      if (isTransientStatus && attempt < maxRetries) {
        await sleep(retryDelayMs * (attempt + 1), fetchInit.signal);
        continue;
      }

      return await parseJsonResponse<T>(res, fallbackError);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      lastError = err;

      const isRetryable =
        attempt < maxRetries &&
        ((err instanceof ApiError && (err.isHtmlResponse || err.status >= 500 || err.status === 0)) ||
          err instanceof TypeError);

      if (isRetryable) {
        await sleep(retryDelayMs * (attempt + 1), fetchInit.signal);
        continue;
      }

      if (err instanceof ApiError) {
        throw err;
      }

      throw new ApiError(
        'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
        0,
        false
      );
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new ApiError(fallbackError, 0, false);
}
