import { redirect } from "next/navigation";

interface CompanyRootPageProps {
  params: {
    id: string;
  };
}

export default function CompanyRootPage({ params }: CompanyRootPageProps) {
  redirect(`/dashboard?companyId=${params.id}`);
}
