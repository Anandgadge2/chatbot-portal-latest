# Optimization Review (High-Level)

## Verdict
The project is **functional but not fully optimized** yet.

### What is already good
- Core MongoDB models include several helpful single-field and compound indexes for frequent filters (`companyId`, `status`, `departmentId`, `assignedTo`, timestamp fields).
- Backend uses security middleware and request rate-limiting.
- Frontend uses Next.js 14 with strict mode enabled.

## Highest-impact betterments

### 1) Reduce backend request overhead in analytics routes
- The analytics dashboard endpoint runs many sequential `countDocuments` and aggregate queries.
- Betterment:
  - Run independent counts in `Promise.all`.
  - Consider pre-aggregated daily snapshots for dashboard cards.
  - Cache hot dashboard queries in Redis for short TTL (e.g., 30–120s).

### 2) Cut noisy logging in production
- Server logs every incoming request and logs full POST headers.
- Betterment:
  - Disable verbose request-header logging outside debug mode.
  - Move to structured logs with levels and sampling for high-volume endpoints.

### 3) Use `.lean()` in read-heavy Mongoose queries
- Many list/detail endpoints use `.find()` / `.findById()` + `populate()` without `.lean()`.
- Betterment:
  - Add `.lean()` where documents are read-only.
  - Keep full Mongoose documents only where middleware/hooks/methods are needed.

### 4) Prevent oversized payloads and expensive list queries
- Grievance listing accepts user-provided `limit` with no strict cap and returns populated documents.
- Betterment:
  - Enforce max page size (e.g., 100).
  - Return projection-based lightweight list DTOs.
  - Add cursor pagination for very large datasets.

### 5) Break down the large dashboard page in frontend
- Dashboard page is currently very large and state-heavy.
- Betterment:
  - Split into role-specific containers and lazy-load heavy chart sections.
  - Use `next/dynamic` for chart bundles and non-critical dialogs.
  - Move data fetching to SWR/React Query with cache + stale-while-revalidate.

### 6) Improve query/index alignment for analytics time windows
- Dashboard filters often combine `companyId/departmentId + createdAt + status`.
- Betterment:
  - Add compound indexes specifically matching analytics predicates, e.g.:
    - `{ companyId: 1, createdAt: -1 }`
    - `{ companyId: 1, status: 1, createdAt: -1 }`
    - `{ departmentId: 1, status: 1, createdAt: -1 }`
  - Validate with MongoDB `explain()` before/after.

## Suggested implementation order
1. **Quick wins (1–2 days)**: logging gate, `Promise.all` in analytics, page-size caps.
2. **Medium wins (3–5 days)**: `.lean()` rollout + response projection cleanup.
3. **Bigger wins (1–2 sprints)**: dashboard code-splitting + Redis-backed dashboard caching + pre-aggregations.

## How to measure improvement
- API p95 latency for `/api/analytics/dashboard`.
- Mongo query execution time (`explain` stage stats).
- Frontend initial JS bundle size and TTI on dashboard routes.
- Server log volume and log ingestion cost.
