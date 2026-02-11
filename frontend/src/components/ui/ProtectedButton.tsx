'use client';

import React from 'react';
import { Button, ButtonProps } from './button';
import { Permission, hasPermission, UserRole } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedButtonProps extends ButtonProps {
  permission: Permission | Permission[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY permission
  fallback?: React.ReactNode; // What to show if permission is denied
  children: React.ReactNode;
}

/**
 * Button component that only renders if user has the required permission(s)
 * If user doesn't have permission, renders fallback (or nothing)
 */
export const ProtectedButton: React.FC<ProtectedButtonProps> = ({
  permission,
  requireAll = false,
  fallback = null,
  children,
  disabled,
  ...props
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
    <Button disabled={disabled} {...props}>
      {children}
    </Button>
  );
};

/**
 * Higher-order component to conditionally render any component based on permissions
 */
export const ProtectedComponent: React.FC<{
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permission, requireAll = false, fallback = null, children }) => {
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

  return <>{children}</>;
};
