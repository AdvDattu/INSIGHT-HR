export type AuthMode = "token" | "password";

export interface ERPNextCredentials {
  baseUrl: string;
  authMode: AuthMode;
  // Token mode
  apiKey?: string;
  apiSecret?: string;
  // Password mode
  usr?: string;
  pwd?: string;
  sid?: string; // session id captured after /api/method/login
}

export interface Employee {
  name: string; // Employee ID
  employee_name: string;
  designation?: string;
  department?: string;
  date_of_joining?: string;
  cell_number?: string;
  user_id?: string;
  company?: string;
  image?: string;
  personal_email?: string;
  gender?: string;
}

export interface EmployeeCheckin {
  name?: string;
  employee: string;
  log_type: "IN" | "OUT";
  time: string;
}

export interface LeaveAllocation {
  name?: string;
  leave_type: string;
  total_leaves_allocated: number;
  unused_leaves: number;
  from_date?: string;
  to_date?: string;
}

export interface LeaveType {
  name: string;
}

export interface LeaveApplication {
  name?: string;
  employee?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason?: string;
  description?: string;
  status?: "Open" | "Approved" | "Rejected" | "Cancelled" | "Submitted";
  total_leave_days?: number;
  docstatus?: number;
}

export interface SalarySlipSummary {
  name: string;
  start_date: string;
  end_date: string;
  net_pay: number;
  gross_pay?: number;
  total_deduction?: number;
  posting_date?: string;
}

export interface SalaryComponent {
  salary_component: string;
  amount: number;
}

export interface SalarySlipDetail extends SalarySlipSummary {
  earnings?: SalaryComponent[];
  deductions?: SalaryComponent[];
  company?: string;
  employee_name?: string;
}
