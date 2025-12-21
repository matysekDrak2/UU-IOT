import { getToken, clearToken } from "../auth/tokenStorage";
import { API_URL, USE_MOCKS } from "./config";
import { mockHandler } from "./mocks";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

function buildAuthHeader(token?: string): Record<string, string> {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";

  if (USE_MOCKS) {
    const data = await mockHandler(path, method);
    return data as T;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeader(options.token),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    if (res.status === 401) clearToken();

    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "Request failed";

    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : undefined;

    throw new ApiError(message, res.status, code, data);
  }

  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
