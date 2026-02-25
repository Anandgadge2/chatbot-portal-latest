# BSP Readiness Roadmap (PugArch Platform)

This document aligns CitizenCare to a BSP-ready architecture while keeping a single multi-tenant platform.

## Implemented in this iteration

### Security & compliance baseline
- Added webhook signature verification middleware (`X-Hub-Signature-256`) using `WHATSAPP_APP_SECRET`.
- Added optional Meta IP allowlisting using `META_IP_ALLOWLIST` (comma-separated).
- Added consent logging model for citizen WhatsApp interactions (`ConsentLog`) and webhook persistence.

### Multi-tenant control hardening
- Added tenant-aware rate limiter middleware with Redis-first and memory fallback.
- Applied tenant limiter to key client-layer routes (users, departments, companies, grievances, appointments).
- Added pagination utility with enforced upper cap to prevent unbounded tenant queries.

### Query efficiency
- Introduced capped pagination helper and applied to major list endpoints.
- Added `.lean()` to high-volume read paths in grievance, appointment, and user list endpoints.

### Data governance
- Added per-tenant data retention settings in company model (`retentionDays`, `purgeEnabled`).

### Frontend route shape (single codebase)
- Added role-layer route namespaces:
  - `/platform/*` entry route (redirects to superadmin dashboard)
  - `/company/*` entry route (redirects to company dashboard)

## Remaining roadmap (recommended order)
1. Queue + workers with retry + DLQ for webhook processing.
2. Refresh token rotation + token family invalidation.
3. Field-level encryption for sensitive PII.
4. Platform panel expansion (quality rating, abuse monitoring, billing).
5. Observability stack (Prometheus/Grafana/Sentry + alerting).

## Environment variables introduced
- `WHATSAPP_APP_SECRET`
- `META_IP_ALLOWLIST`
- `VERBOSE_REQUEST_LOGGING` (already supported in logging behavior)
