import { getToken } from "@/lib/auth";
import type {
  AuthUser,
  Consent,
  EvaluateResponse,
  LangCode,
  Me,
  Profile,
  Scheme,
} from "@/lib/types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function detailOf(body: unknown, fallback: string): string {
  const d = (body as { detail?: unknown } | null)?.detail;
  if (typeof d === "string") return d;
  if (d !== undefined && d !== null) return JSON.stringify(d);
  return fallback;
}

async function raw(path: string, init: RequestInit = {}, auth = false): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network");
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, detailOf(body, res.statusText || `HTTP ${res.status}`));
  }
  return res;
}

async function json<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const res = await raw(path, init, auth);
  return (await res.json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) });

/** Profile fields named in a 422 response (FastAPI puts them in `loc`: ["body","profile","<field>"]). */
export function invalidFields(e: unknown): string[] {
  if (!(e instanceof ApiError) || e.status !== 422) return [];
  try {
    const list = JSON.parse(e.detail) as { loc?: unknown[] }[];
    const out = new Set<string>();
    for (const item of Array.isArray(list) ? list : []) {
      const loc = item?.loc ?? [];
      const i = loc.indexOf("profile");
      if (i >= 0 && typeof loc[i + 1] === "string") out.add(loc[i + 1] as string);
    }
    return [...out];
  } catch {
    return [];
  }
}

export function evaluate(profile: Profile, interests?: string[]): Promise<EvaluateResponse> {
  return json<EvaluateResponse>("/evaluate", post({ profile, ...(interests ? { interests } : {}) }));
}

let schemesCache: Promise<Scheme[]> | null = null;

export function getSchemes(): Promise<Scheme[]> {
  if (!schemesCache) {
    schemesCache = json<{ schemes: Scheme[] }>("/schemes")
      .then((r) => r.schemes)
      .catch((e) => {
        schemesCache = null;
        throw e;
      });
  }
  return schemesCache;
}

export function getScheme(id: string): Promise<Scheme> {
  return json<Scheme>(`/schemes/${encodeURIComponent(id)}`);
}

export async function search(q: string): Promise<string[]> {
  const r = await json<{ ids: string[] }>(`/search?q=${encodeURIComponent(q)}`);
  return r.ids;
}

export function requestOtp(phone: string): Promise<{ sent: boolean }> {
  return json("/auth/otp", post({ phone }));
}

export function verifyOtp(
  phone: string,
  code: string,
  consent: Consent,
): Promise<{ token: string; user: AuthUser }> {
  return json("/auth/verify", post({ phone, code, consent }));
}

export function getMe(): Promise<Me> {
  return json<Me>("/me", {}, true);
}

export function putMe(profile: Profile, language?: LangCode): Promise<unknown> {
  return json("/me", put({ profile, ...(language ? { language } : {}) }), true);
}

export async function deleteMe(): Promise<void> {
  await raw("/me", { method: "DELETE" }, true);
}

export function exportMe(): Promise<unknown> {
  return json("/me/export", {}, true);
}

export async function getSaved(): Promise<string[]> {
  const r = await json<{ scheme_ids: string[] }>("/me/saved", {}, true);
  return r.scheme_ids;
}

export async function saveScheme(id: string): Promise<void> {
  await raw(`/me/saved/${encodeURIComponent(id)}`, { method: "PUT" }, true);
}

export async function unsaveScheme(id: string): Promise<void> {
  await raw(`/me/saved/${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}

export async function downloadKit(id: string, lang?: LangCode): Promise<Blob> {
  const res = await raw(`/kit/${encodeURIComponent(id)}`, post(lang ? { lang } : {}), true);
  return res.blob();
}

export async function downloadIcs(id: string): Promise<Blob> {
  const res = await raw(`/reminder/${encodeURIComponent(id)}.ics`, {}, true);
  return res.blob();
}
