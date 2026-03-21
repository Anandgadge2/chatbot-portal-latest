"use client";

import { CompanyProvider } from "@/contexts/CompanyContext";

export default function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return <CompanyProvider companyId={params.id}>{children}</CompanyProvider>;
}
