/**
 * Browser API client. Requests go to same-origin `/api/*`, which each Next.js app rewrites to the
 * FastAPI identity/analytics service, so the httpOnly session cookie is first-party.
 * Authorisation is ALWAYS enforced by the API; the frontend only reflects it.
 */
export class ApiError extends Error {
  constructor(public status: number, public detail: string, public body?: unknown) {
    super(detail);
  }
}

export const CSRF_HEADER = { "X-Requested-With": "DigitalReservoir" } as const;

export async function apiFetch<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const method = (rest.method || (json !== undefined ? "POST" : "GET")).toUpperCase();
  const h: Record<string, string> = { Accept: "application/json", ...(headers as Record<string, string>) };
  if (method !== "GET" && method !== "HEAD") Object.assign(h, CSRF_HEADER);
  let body = rest.body;
  if (json !== undefined) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  const res = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, {
    ...rest, method, headers: h, body, credentials: "include", cache: "no-store",
  });
  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    if (payload && typeof payload === "object" && "detail" in payload) {
      const d = (payload as { detail: unknown }).detail;
      detail = typeof d === "string" ? d : Array.isArray(d) ? d.map((x: any) => x.msg || String(x)).join("; ") : JSON.stringify(d);
    }
    throw new ApiError(res.status, detail, payload);
  }
  return payload as T;
}

export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: form });
}

/** Trigger a browser download for an API resource (keeps cookie auth). */
export async function apiDownload(path: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
