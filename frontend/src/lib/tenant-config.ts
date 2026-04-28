type CompanyLike = {
  _id?: string;
  id?: string;
  name?: string | null;
};

export const TENANT_IDS = {
  collectorateJharsuguda: "69ad4c6eb1ad8e405e6c0858",
} as const;

export const getCompanyIdFromValue = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const id = record._id || record.id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
};

export const getScopedCompanyId = ({
  companyIdParam,
  company,
  userCompanyId,
}: {
  companyIdParam?: string | null;
  company?: CompanyLike | null;
  userCompanyId?: unknown;
}) => companyIdParam || company?._id || company?.id || getCompanyIdFromValue(userCompanyId);

export const isCollectorateJharsugudaCompany = (companyId?: string | null) =>
  companyId === TENANT_IDS.collectorateJharsuguda;

export const getDashboardTenantConfig = (companyId?: string | null) => {
  const isCollectorateJharsuguda = isCollectorateJharsugudaCompany(companyId);

  return {
    isCollectorateJharsuguda,
    brandTitle: isCollectorateJharsuguda ? "SAHAJ" : "Control Panel",
    brandSubtitle: isCollectorateJharsuguda
      ? "Centralised Grievances Command Center"
      : "Control Panel",
    revertAdminLabel: isCollectorateJharsuguda ? "Collector & DM" : "Company Admin",
    revertAdminLabelLower: isCollectorateJharsuguda
      ? "Collector & DM"
      : "company admin",
  };
};
