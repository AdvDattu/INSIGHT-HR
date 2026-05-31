import { Platform } from "react-native";

import { ERPNextCredentials, Employee } from "@/src/types/erpnext";

const APP_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export class ERPNextApiError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function buildHeaders(creds: ERPNextCredentials): Record<string, string> {
  // Note: we deliberately avoid custom X-* headers here. Adding non-standard
  // headers (like X-Frappe-Site-Name) triggers a CORS preflight that many
  // ERPNext deployments don't whitelist, blocking the request entirely.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (creds.authMode === "token") {
    headers.Authorization = `token ${creds.apiKey}:${creds.apiSecret}`;
  } else if (creds.sid && Platform.OS !== "web") {
    // On native (iOS / Android / Expo Go) we can set the Cookie header
    // directly. Browsers forbid setting `Cookie` from JS — there we rely on
    // the backend proxy.
    headers.Cookie = `sid=${creds.sid}`;
  }
  return headers;
}

async function rawFetch(
  creds: ERPNextCredentials,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = normalizeBaseUrl(creds.baseUrl);
  const url = `${baseUrl}${path}`;
  return fetch(url, {
    ...init,
    // 'include' lets the browser cookie jar carry the sid captured on
    // /api/method/login across subsequent requests. On native it's a no-op.
    credentials: "include",
    headers: {
      ...buildHeaders(creds),
      ...(init.headers || {}),
    },
  });
}

// Password-mode requests on the web preview cannot capture or send the
// session cookie due to browser security (Set-Cookie is hidden from JS, and
// the `Cookie` header is a forbidden header for fetch). For that case we
// route the request through our own backend, which calls ERPNext server-side
// and returns the response. The backend will also lazily re-login if the
// sid expires, transparently to the caller.
async function proxyRequest<T>(
  creds: ERPNextCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!APP_BACKEND_URL) {
    throw new ERPNextApiError(
      "App backend URL is not configured. Cannot route password-mode requests on web.",
      0,
    );
  }
  let parsedBody: any = undefined;
  if (init.body && typeof init.body === "string") {
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      parsedBody = init.body;
    }
  }
  let res: Response;
  try {
    res = await fetch(`${APP_BACKEND_URL}/api/erpnext/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        base_url: creds.baseUrl,
        method: (init.method || "GET").toUpperCase(),
        path,
        body: parsedBody,
        sid: creds.sid || null,
        usr: creds.usr || null,
        pwd: creds.pwd || null,
      }),
    });
  } catch {
    throw new ERPNextApiError(
      "Could not reach the app backend. Please check your network.",
      0,
    );
  }
  const text = await res.text();
  let payload: any = {};
  try {
    payload = JSON.parse(text);
  } catch {
    // ignore
  }
  if (!res.ok) {
    // FastAPI surfaces HTTPException as { detail: "..." }
    const msg =
      payload?.detail || payload?.message || text || `Proxy error (${res.status})`;
    throw new ERPNextApiError(
      typeof msg === "string" ? msg : "Proxy request failed",
      res.status,
      text,
    );
  }
  // payload shape: { status: number, body: any, sid: string|null }
  const upstreamStatus: number = payload?.status ?? 0;
  const upstreamBody = payload?.body;
  // Persist refreshed sid back to the credentials object for the in-memory
  // session (caller may also choose to save to storage).
  if (payload?.sid && payload.sid !== creds.sid) {
    creds.sid = payload.sid;
  }
  if (upstreamStatus < 200 || upstreamStatus >= 300) {
    let msg: any = upstreamBody;
    if (upstreamBody && typeof upstreamBody === "object") {
      msg =
        upstreamBody.exception ||
        upstreamBody._server_messages ||
        upstreamBody.message ||
        upstreamBody.exc ||
        JSON.stringify(upstreamBody);
    }
    throw new ERPNextApiError(
      typeof msg === "string" ? msg : "Request failed",
      upstreamStatus,
      typeof upstreamBody === "string" ? upstreamBody : JSON.stringify(upstreamBody),
    );
  }
  return (upstreamBody ?? {}) as T;
}

async function request<T>(
  creds: ERPNextCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Password mode goes through the backend proxy. This bypasses browser
  // Set-Cookie / forbidden-header / CORS restrictions and also gives us
  // server-side session refresh on 401.
  if (creds.authMode === "password") {
    return proxyRequest<T>(creds, path, init);
  }

  let res: Response;
  try {
    res = await rawFetch(creds, path, init);
  } catch {
    throw new ERPNextApiError(
      "Could not reach your ERPNext server. Please check the URL and your internet connection.",
      0,
    );
  }

  const text = await res.text();
  if (!res.ok) {
    let parsedMessage = text;
    try {
      const json = JSON.parse(text);
      parsedMessage =
        json?.exception ||
        json?._server_messages ||
        json?.message ||
        json?.exc ||
        text;
    } catch {
      // keep text
    }
    throw new ERPNextApiError(
      typeof parsedMessage === "string"
        ? parsedMessage
        : "Request failed",
      res.status,
      text,
    );
  }

  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function encodeFilters(filters: any[]): string {
  return encodeURIComponent(JSON.stringify(filters));
}

function encodeFields(fields: string[]): string {
  return encodeURIComponent(JSON.stringify(fields));
}

export const ERPNext = {
  // Establish a Frappe session by calling /api/method/login. Captures the
  // `sid` from Set-Cookie (works on native). On web, browsers hide Set-Cookie
  // from JS but the cookie is still stored in the browser jar; subsequent
  // fetches with credentials: 'include' will carry it automatically — IF the
  // ERPNext deployment has CORS configured with Allow-Credentials: true and
  // a specific Allow-Origin. Most ERPNext sites do not, so password login on
  // the web preview may fail with CORS even when native works perfectly.
  async loginWithPassword(
    creds: ERPNextCredentials,
  ): Promise<{ sid: string | null; user: string }> {
    const body = `usr=${encodeURIComponent(creds.usr || "")}&pwd=${encodeURIComponent(creds.pwd || "")}`;
    let res: Response;
    try {
      res = await rawFetch(creds, "/api/method/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    } catch {
      throw new ERPNextApiError(
        "Could not reach your ERPNext server. Please check the URL.",
        0,
      );
    }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j?.message || j?.exception || j?.exc || text;
      } catch {
        // keep text
      }
      throw new ERPNextApiError(
        typeof msg === "string" ? msg : "Login failed",
        res.status,
        text,
      );
    }
    // Try to capture sid from Set-Cookie (native exposes this; browsers don't)
    const setCookie =
      res.headers.get("set-cookie") || res.headers.get("Set-Cookie") || "";
    let sid: string | null = null;
    const m = /(?:^|[,\s;])sid=([^;,\s]+)/.exec(setCookie);
    if (m) sid = m[1];

    let body2: any = {};
    try {
      body2 = JSON.parse(text);
    } catch {
      // ignore
    }
    const user =
      body2?.full_name || body2?.message || creds.usr || "";
    // Note: if sid is null on native, that's a real problem. On web it's
    // expected — we rely on the browser cookie jar.
    return { sid, user };
  },

  // Validate credentials by fetching the user record.
  // ERPNext returns `{ message: "user@example.com" }` for this endpoint.
  // IMPORTANT: Frappe silently falls back to the "Guest" user (HTTP 200) when
  // the API key/secret pair is invalid instead of returning 401. We have to
  // detect that case explicitly.
  async validateCredentials(creds: ERPNextCredentials): Promise<string> {
    const data = await request<{ message: unknown }>(
      creds,
      "/api/method/frappe.auth.get_logged_user",
    );
    const message = (data as any)?.message;
    let resolvedUser: string | null = null;
    if (typeof message === "string" && message.length > 0) {
      resolvedUser = message;
    } else if (message && typeof message === "object") {
      const candidate =
        (message as any).email ||
        (message as any).user_id ||
        (message as any).name;
      if (typeof candidate === "string" && candidate.length > 0) {
        resolvedUser = candidate;
      }
    }
    if (!resolvedUser) {
      throw new ERPNextApiError("Unable to determine logged-in user", 401);
    }
    // Treat "Guest" as authentication failure — Frappe returns this when the
    // token is unrecognized rather than emitting a 401.
    if (resolvedUser.toLowerCase() === "guest") {
      throw new ERPNextApiError(
        "ERPNext did not recognize your API Key/Secret (it returned the Guest user). " +
          "Open your ERPNext User → API Access page and regenerate the keys, " +
          "then paste the new values exactly (no spaces). Note: the API Secret is shown only once at generation time.",
        401,
      );
    }
    return resolvedUser;
  },

  // Fetch the active employee record using user_id (email)
  async getEmployeeByUserId(
    creds: ERPNextCredentials,
    userId: string,
  ): Promise<Employee | null> {
    const fields = encodeFields([
      "name",
      "employee_name",
      "designation",
      "department",
      "date_of_joining",
      "cell_number",
      "user_id",
      "company",
      "image",
      "personal_email",
      "gender",
    ]);
    const filters = encodeFilters([["user_id", "=", userId]]);
    const path = `/api/resource/Employee?filters=${filters}&fields=${fields}&limit_page_length=1`;
    const data = await request<{ data: Employee[] }>(creds, path);
    const list = data?.data || [];
    return list.length ? list[0] : null;
  },

  // Create check-in/out
  async createCheckin(
    creds: ERPNextCredentials,
    employee: string,
    logType: "IN" | "OUT",
    time: string,
  ): Promise<any> {
    return request(creds, "/api/resource/Employee Checkin", {
      method: "POST",
      body: JSON.stringify({ employee, log_type: logType, time }),
    });
  },

  // Get latest checkin to determine status
  async getLatestCheckin(
    creds: ERPNextCredentials,
    employee: string,
  ): Promise<{ log_type: "IN" | "OUT"; time: string } | null> {
    const fields = encodeFields(["name", "log_type", "time"]);
    const filters = encodeFilters([["employee", "=", employee]]);
    const path = `/api/resource/Employee Checkin?filters=${filters}&fields=${fields}&order_by=time desc&limit_page_length=1`;
    const data = await request<{ data: { log_type: "IN" | "OUT"; time: string }[] }>(
      creds,
      path,
    );
    return data?.data?.[0] || null;
  },

  // Leave Allocations
  async getLeaveAllocations(creds: ERPNextCredentials, employee: string) {
    const fields = encodeFields([
      "name",
      "leave_type",
      "total_leaves_allocated",
      "unused_leaves",
      "from_date",
      "to_date",
    ]);
    const filters = encodeFilters([["employee", "=", employee]]);
    const path = `/api/resource/Leave Allocation?filters=${filters}&fields=${fields}&limit_page_length=100`;
    const data = await request<{ data: any[] }>(creds, path);
    return data?.data || [];
  },

  // Leave Types (for dropdown)
  async getLeaveTypes(creds: ERPNextCredentials) {
    const fields = encodeFields(["name"]);
    const path = `/api/resource/Leave Type?fields=${fields}&limit_page_length=100`;
    const data = await request<{ data: { name: string }[] }>(creds, path);
    return data?.data || [];
  },

  // Leave Applications history
  async getLeaveApplications(creds: ERPNextCredentials, employee: string) {
    const fields = encodeFields([
      "name",
      "leave_type",
      "from_date",
      "to_date",
      "status",
      "total_leave_days",
      "description",
    ]);
    const filters = encodeFilters([["employee", "=", employee]]);
    const path = `/api/resource/Leave Application?filters=${filters}&fields=${fields}&order_by=from_date desc&limit_page_length=100`;
    const data = await request<{ data: any[] }>(creds, path);
    return data?.data || [];
  },

  // Apply for leave
  async applyLeave(
    creds: ERPNextCredentials,
    payload: {
      employee: string;
      leave_type: string;
      from_date: string;
      to_date: string;
      reason?: string;
    },
  ) {
    return request(creds, "/api/resource/Leave Application", {
      method: "POST",
      body: JSON.stringify({
        employee: payload.employee,
        leave_type: payload.leave_type,
        from_date: payload.from_date,
        to_date: payload.to_date,
        description: payload.reason || "",
        docstatus: 0,
      }),
    });
  },

  // Salary Slips list (submitted)
  async getSalarySlips(creds: ERPNextCredentials, employee: string) {
    const fields = encodeFields([
      "name",
      "start_date",
      "end_date",
      "net_pay",
      "gross_pay",
      "total_deduction",
      "posting_date",
    ]);
    const filters = encodeFilters([
      ["employee", "=", employee],
      ["docstatus", "=", 1],
    ]);
    const path = `/api/resource/Salary Slip?filters=${filters}&fields=${fields}&order_by=start_date desc&limit_page_length=100`;
    const data = await request<{ data: any[] }>(creds, path);
    return data?.data || [];
  },

  // Salary slip detail
  async getSalarySlipDetail(creds: ERPNextCredentials, slipName: string) {
    const path = `/api/resource/Salary Slip/${encodeURIComponent(slipName)}`;
    const data = await request<{ data: any }>(creds, path);
    return data?.data || null;
  },
};
