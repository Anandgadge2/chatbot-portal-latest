"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useCompany } from "@/lib/query/useCompany";

type CompanyContextValue = {
  company: any;
  isLoading: boolean;
  error: unknown;
  data?: any;
  setCompany: (data: any) => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const query = useCompany(companyId);
  const [localCompany, setLocalCompany] = useState<any>(null);

  // Sync local state when query data changes
  useEffect(() => {
    if (query.company) {
      setLocalCompany(query.company);
    }
  }, [query.company]);

  return (
    <CompanyContext.Provider
      value={{
        company: localCompany,
        isLoading: query.isLoading,
        error: query.error,
        data: localCompany,
        setCompany: setLocalCompany
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompanyContext must be used within a CompanyProvider");
  }
  return context;
}
