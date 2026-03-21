import { redirect } from 'next/navigation';

export default function LegacyDepartmentDashboardRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/portal/department/${params.id}`);
}
