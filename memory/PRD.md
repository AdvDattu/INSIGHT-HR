# ESS HR Mobile App — Product Requirements Document

## Overview
A mobile-first Employee Self-Service (ESS) HR application built with React Native (Expo). The app uses an ERPNext instance as its backend, integrating directly with the standard ERPNext REST API (`/api/resource/`) for all data operations. No custom server is needed — the FastAPI backend in this project is currently unused for ERPNext data.

## Stack
- Expo (React Native) with Expo Router (file-based routing)
- TypeScript
- Bottom Tab Navigation (Dashboard, Leaves, Payslips, Profile)
- Storage: `expo-secure-store` for API credentials; `AsyncStorage` for cached employee
- Design: Corporate professional, Swiss & High-Contrast aesthetic (black/white/zinc)

## Authentication
- User enters ERPNext URL, API Key, and API Secret on the login screen
- App calls `GET /api/method/frappe.auth.get_logged_user` to validate credentials and retrieve the linked user email
- App fetches the linked `Employee` record via `GET /api/resource/Employee?filters=[["user_id","=","<email>"]]`
- The Employee `name` (Employee ID) is persisted in app state and used by all subsequent modules
- All requests include header: `Authorization: token <API_KEY>:<API_SECRET>` and `Content-Type: application/json`

## Modules

### 1. Login & Employee Context (`/login`)
- 3 inputs (URL, API Key, API Secret) with helpful error messages
- Persists credentials securely; on next launch, app auto-routes to the dashboard

### 2. Dashboard & Attendance (`/(tabs)/index`)
- Greeting + employee initials avatar
- Live clock (HH:MM:SS) updating every second
- Status pill: "Checked In" / "Checked Out" derived from latest `Employee Checkin`
- Check In / Check Out actions create new `Employee Checkin` documents
- Quick info bento grid (Employee ID, Department)
- Pull-to-refresh

### 3. Leave Management (`/(tabs)/leave`)
Three pill tabs:
- **Balance**: Aggregated `Leave Allocation` entries with progress bars
- **Apply**: Form with Leave Type picker (bottom-sheet), From/To DatePicker, Reason textarea, Submit button. POSTs `Leave Application` with `docstatus: 0` (draft)
- **History**: List of past `Leave Application` records with colored status pills (Approved/Rejected/Open)

### 4. Payslips (`/(tabs)/payslips`)
- Lists submitted `Salary Slip` documents sorted desc by start_date
- Each item shows Month label, period range, slip ID, and Net Pay
- Tapping opens a bottom-sheet modal that loads the full slip detail and shows Earnings/Deductions breakdown plus totals

### 5. Profile (`/(tabs)/profile`)
- Avatar with initials + name + designation + Employee ID chip
- Personal details card (name, work email, mobile)
- Company details card (department, designation, DOJ, company)
- Connection info (ERPNext URL)
- Log Out destructive button (clears secure storage + redirects to login)

## Cross-cutting
- Pull-to-refresh on all data-driven screens
- Loading and empty states everywhere
- Toast notifications for success/error
- All ERPNext errors surface user-friendly messages (401/403 → "Invalid API key/secret")

## Backend
The FastAPI backend in `/app/backend` is unused. The app talks to ERPNext directly. If CORS is restrictive on the user's ERPNext instance for the web preview, native (Expo Go / iOS / Android) clients will still work.
