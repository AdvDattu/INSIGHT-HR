import { ERPNextCredentials, Employee } from "@/src/types/erpnext";

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
  return {
    Authorization: `token ${creds.apiKey}:${creds.apiSecret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Frappe-Site-Name": new URL(normalizeBaseUrl(creds.baseUrl)).host,
  };
}

async function request<T>(
  creds: ERPNextCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = normalizeBaseUrl(creds.baseUrl);
  const url = `${baseUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...buildHeaders(creds),
        ...(init.headers || {}),
      },
    });
  } catch (e: any) {
    throw new ERPNextApiError(
      `Network error: ${e?.message || "Unable to reach ERPNext"}`,
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
  // Validate credentials by fetching the user record
  async validateCredentials(creds: ERPNextCredentials): Promise<string> {
    const data = await request<{ message: { email?: string; full_name?: string } }>(
      creds,
      "/api/method/frappe.auth.get_logged_user",
    );
    // returns the email/user_id of the api-key holder
    const user = (data as any)?.message;
    if (!user || typeof user !== "string") {
      // Some versions return { message: "user@example.com" }
      if (typeof (data as any)?.message === "string") {
        return (data as any).message;
      }
      throw new ERPNextApiError("Unable to determine logged-in user", 401);
    }
    return user;
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
