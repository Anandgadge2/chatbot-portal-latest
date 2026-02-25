# Three-Layer Platform Architecture (Single Product)

This platform is one unified multi-tenant system with three logical layers:

## 1) Platform Layer (`/api/platform`, `/platform/*`)
**Who uses it:** PugArch SUPER_ADMIN only.

**What it does:**
- Tenant lifecycle control (create/activate/suspend client orgs).
- Global queue/worker health and failed message visibility.
- Cross-tenant billing operations (plans, subscriptions, invoice generation/payment status).
- Compliance and governance workflows (audited PII access endpoints, global audit views).
- Global observability endpoints (`/monitoring/health`, `/monitoring/metrics`).

**Why it exists:** This is the control tower needed for BSP-style operations.

---

## 2) Client Layer (`/api/*` company-scoped routes, `/dashboard`, `/company/*`)
**Who uses it:** COMPANY_ADMIN, DEPARTMENT_ADMIN, OPERATOR, ANALYTICS_VIEWER.

**What it does:**
- Operational workflows for grievance/appointment/lead/service delivery.
- Company-level user and department management.
- Company-level analytics and SLA-oriented daily operations.
- Company-scoped chatbot and WhatsApp configuration usage.

**Isolation model:** all operational data access is role-scoped and tenant-scoped.

---

## 3) Messaging & Chatbot Core (shared services)
**Who uses it:** internal runtime only (webhook + queue + worker + chatbot engine).

**What it does:**
- Inbound webhook validation and message normalization.
- Queueing for resilient async processing with retry and DLQ fallback.
- Worker execution of chatbot flows.
- Usage tracking and failure capture for billing/monitoring.

**Design principle:** single shared engine, no per-client code forks.

---

## End-to-end flow
Webhook -> Security validation -> Idempotency + consent log -> Queue -> Worker -> Chatbot engine -> WhatsApp outbound API -> Usage + monitoring + audit trails.
