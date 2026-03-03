'use client';

import RoleManagement from '@/components/roles/RoleManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RolesPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    // Only SUPER_ADMIN and COMPANY_ADMIN can manage roles
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN' && user.role !== 'DEPT_ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const companyId =
    user?.companyId && typeof user.companyId === 'object'
      ? (user.companyId as any)._id
      : (user?.companyId as string) ?? '';

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No company context. Please contact the administrator.
      </div>
    );
  }

  return (
    <div className="p-6">
      <RoleManagement companyId={companyId} />
    </div>
  );
}
