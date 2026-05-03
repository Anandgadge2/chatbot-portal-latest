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
    const record = value as Record<string, any>;
    const rawId = record._id || record.id || record.companyId;
    
    if (typeof rawId === "string") return rawId;
    if (typeof rawId === "object" && rawId !== null) {
      // Handle MongoDB $oid format
      if (rawId.$oid && typeof rawId.$oid === "string") return rawId.$oid;
      // Handle generic toString for other ID objects
      return rawId.toString();
    }
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
}) => {
  if (companyIdParam) return companyIdParam;
  if (company) {
    const id = getCompanyIdFromValue(company);
    if (id) return id;
  }
  return getCompanyIdFromValue(userCompanyId);
};

export const isCollectorateJharsugudaCompany = (companyId?: any | null, companyName?: string | null) => {
  const idStr = typeof companyId === "string" ? companyId : getCompanyIdFromValue(companyId);
  if (idStr === TENANT_IDS.collectorateJharsuguda) return true;
  
  // Fallback check by name in case ID comparison fails due to object structure
  const name = companyName || "";
  return name.toLowerCase().includes("jharsuguda");
};

export const getDashboardTenantConfig = (companyId?: any | null, companyName?: string | null) => {
  const isCollectorateJharsuguda = isCollectorateJharsugudaCompany(companyId, companyName);

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
