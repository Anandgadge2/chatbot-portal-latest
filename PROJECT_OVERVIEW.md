# Project Overview: Chatbot Portal (CitizenCare)

## 1) What this project is
This repository is a **multi-tenant citizen service platform** that combines:
- a **WhatsApp chatbot backend** for citizen-facing interactions,
- an **admin dashboard** for government/enterprise operators,
- and supporting modules for **grievances, appointments, leads, analytics, audit, and configuration**.

It is designed for role-based operations across Super Admin, Company Admin, Department Admin, Operator, and Analytics Viewer users.

---

## 2) Core architecture

### Backend (Node.js + Express + TypeScript + MongoDB)
The backend exposes APIs and webhooks, handles authentication/authorization, processes chatbot flows, and persists operational data.

Major API groups include:
- Auth and SSO
- Company/Department/User management
- Grievance and Appointment lifecycle
- Assignment/Status updates
- Analytics and dashboards
- Import/Export and audit logs
- WhatsApp and email configuration
- Lead capture and chatbot flow builder APIs

### Frontend (Next.js + React + TypeScript)
The frontend provides:
- role-based login and session UX,
- operational dashboards (company/department/superadmin),
- grievance/appointment handling UI,
- flow-builder UI for chatbot conversation design,
- configuration pages for WhatsApp/email setup.

---

## 3) What it does end-to-end (functional intent)

1. **Citizen sends a WhatsApp message** to a configured company number.
2. Webhook routes process incoming events and hand over to chatbot logic.
3. Chatbot engine runs dynamic/default flow steps (language, menu, input collection, branching, API call, assignment, etc.).
4. The system can create/update **grievances**, **appointments**, and optionally **leads** based on flow/module.
5. Role-based admins manage entities from dashboard pages, assign work, and update statuses.
6. Citizens can receive outbound updates (WhatsApp and/or email based on enabled modules/config).
7. Audit and analytics APIs provide operational visibility.

---

## 4) Feature set and functionalities

### A) Identity, access control, tenancy
- Role system: SUPER_ADMIN, COMPANY_ADMIN, DEPARTMENT_ADMIN, OPERATOR, ANALYTICS_VIEWER.
- Permission matrix for CRUD + assignment + status-change + analytics/export + chatbot config.
- Company-scoped data model and APIs for multi-tenant usage.
- Supports regular login and SSO login flow.

### B) Company and organization setup
- Company model supports type, branding/theme, multilingual display names, and enabled modules.
- Department model and routes provide department hierarchy and management.
- User management includes company/department scoping, role assignment, activation control, and secure password handling.

### C) Citizen service modules
- **Grievance Management**:
  - create/list/detail/update workflows,
  - assignment to users/departments,
  - status lifecycle, status history, timeline, SLA fields, geo/media support.
- **Appointment Management**:
  - appointment creation and updates,
  - date/time/duration/status handling,
  - assignment, timeline, completion/cancel flow.
- **Status Tracking**:
  - APIs for grievance/appointment status transitions with permission checks.
- **Lead Capture**:
  - lead routes/model for enterprise-style lead intake.

### D) Chatbot + WhatsApp capabilities
- Webhook endpoints to integrate WhatsApp messaging.
- Company-level WhatsApp config (token, verify token, number IDs, active flow mapping, limits, bot settings).
- Flow engine supports node/step-based chatbot definitions with:
  - message/buttons/list/input/media/condition/API-call/delay/assignment/dynamic response steps,
  - expected response routing,
  - multilingual support signals,
  - company-specific active flows.
- Session service with Redis + DB fallback for conversation continuity.

### E) Notifications and communications
- Email service supports per-company SMTP configuration and fallback env SMTP.
- Notification service can send lifecycle notifications (assignment/status resolution scenarios).
- WhatsApp status updates can be sent from status management flows.

### F) Analytics, monitoring, and audit
- Dashboard analytics endpoint computes totals, status slices, time-window counts, trends, SLA indicators, etc.
- Dashboard routes expose role-specific summary cards.
- Audit model/routes/logging for user actions and traceability.

### G) Data operations
- Import/export APIs for operational data movement.
- Seed and migration scripts in backend for environment setup and data fixes.

### H) Frontend UX surface
- Login and SSO entry pages.
- Main dashboard for operational users with charts, KPIs, assignment/status dialogs.
- Superadmin dashboards and company-level configuration pages.
- Separate grievance/appointment views.
- Flow builder UI with canvas/node editor and templates/simulator-style components.

---

## 5) Practical interpretation
In practical terms, this project is a **digital governance + service-delivery platform** where WhatsApp acts as the citizen interaction channel and the web dashboard acts as the internal control center.

It is suitable for organizations needing:
- multi-department ticketing/grievance handling,
- appointment coordination,
- controlled access by organizational hierarchy,
- automated conversational intake,
- and operational reporting/auditability.
