"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function CompanyDrillDownRedirect() {
  const router = useRouter();
  const params = useParams();
  const companyId = (params.id || params.companyId) as string | undefined;

  useEffect(() => {
    if (!companyId) return;
    router.replace(`/dashboard?companyId=${companyId}`);
  }, [companyId, router]);

  return <LoadingSpinner text="Redirecting to shared company dashboard..." />;
}
