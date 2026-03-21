"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";

type PermissionGateProps = {
  perm: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGate({
  perm,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { user } = useAuth();
  const permissions = (user as any)?.permissions;
  const allowed =
    permissions?.includes?.("*") ||
    permissions?.includes?.(perm);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
