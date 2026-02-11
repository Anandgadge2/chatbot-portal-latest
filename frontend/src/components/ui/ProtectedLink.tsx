'use client';

import React from 'react';
import Link from 'next/link';
import { Permission, hasPermission, UserRole } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ProtectedLinkProps {
  permission: Permission | Permission[];
  requireAll?: boolean;
  href: string;
  className?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Link component that only renders if user has the required permission(s)
 */
export const ProtectedLink: React.FC<ProtectedLinkProps> = ({
  permission,
  requireAll = false,
  href,
  className,
  children,
  fallback = null
}) => {
  const { user } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  const userRole = user.role as UserRole;
  let hasAccess = false;

  if (Array.isArray(permission)) {
    if (requireAll) {
      hasAccess = permission.every(p => hasPermission(userRole, p));
    } else {
      hasAccess = permission.some(p => hasPermission(userRole, p));
    }
  } else {
    hasAccess = hasPermission(userRole, permission);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return (
    <Link href={href} className={cn(className)}>
      {children}
    </Link>
  );
};
