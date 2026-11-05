import type { components } from "@/types/api";

/** OpenAPI 스펙에서 생성한 스키마 타입. 예: Schemas["ReportDetail"] */
export type Schemas = components["schemas"];

/** 백엔드 에러 형식: { error: { code, message, request_id, detail? } } */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** 재시도해도 한 번만 처리되도록 Idempotency-Key 헤더를 붙인다. */
  idempotent?: boolean;
  signal?: AbortSignal;
};

/**
 * Metaphor API 호출. 브라우저 전용.
 * 세션 쿠키(sid, Path=/api)가 붙도록 같은 출처의 /api/v1 로 요청하고,
 * Next.js가 API_ORIGIN 으로 프록시한다.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, idempotent, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotent) headers["Idempotency-Key"] = crypto.randomUUID();

  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-Id");
  try {
    const data = (await response.json()) as { error?: { code?: string; message?: string; request_id?: string } };
    if (data.error?.code) {
      return new ApiError(
        response.status,
        data.error.code,
        data.error.message ?? data.error.code,
        data.error.request_id ?? requestId,
      );
    }
  } catch {
    // JSON이 아닌 응답(프록시 오류 등)
  }
  return new ApiError(response.status, `HTTP_${response.status}`, response.statusText || "요청 실패", requestId);
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
