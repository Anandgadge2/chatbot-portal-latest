import { apiClient } from './client';
import { PortalBootstrapResponse } from '@/lib/portal';

const CACHE_TTL_MS = 30_000;
const CACHE_KEY = 'portal_bootstrap_cache_v1';

const readCache = (): PortalBootstrapResponse | null => {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { expiresAt: number; payload: PortalBootstrapResponse };
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.payload;
  } catch {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
};

const writeCache = (payload: PortalBootstrapResponse) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    }),
  );
};

export const portalAPI = {
  getBootstrap: async (params?: { companyId?: string; departmentId?: string; force?: boolean }) => {
    if (!params?.companyId && !params?.departmentId && !params?.force) {
      const cached = readCache();
      if (cached) return cached;
    }

    const query = new URLSearchParams();
    if (params?.companyId) query.append('companyId', params.companyId);
    if (params?.departmentId) query.append('departmentId', params.departmentId);

    const response = await apiClient.get<PortalBootstrapResponse>(
      `/portal/bootstrap${query.toString() ? `?${query.toString()}` : ''}`,
    );

    if (response.success && !params?.companyId && !params?.departmentId) {
      writeCache(response);
    }

    return response;
  },
  clearBootstrapCache: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CACHE_KEY);
    }
  },
};
