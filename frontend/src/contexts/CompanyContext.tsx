"use client";

import React, { createContext, useContext } from "react";
import { useCompany } from "@/lib/query/useCompany";

type CompanyContextValue = {
  company: any;
  isLoading: boolean;
  error: unknown;
  data?: any;
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

  return (
    <CompanyContext.Provider
      value={{
        company: query.company,
        isLoading: query.isLoading,
        error: query.error,
        data: query.company,
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
