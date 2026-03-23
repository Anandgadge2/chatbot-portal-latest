"use client";

import { CompanyProvider } from "@/contexts/CompanyContext";

export default function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { companyId: string };
}) {
  return <CompanyProvider companyId={params.companyId}>{children}</CompanyProvider>;
}
