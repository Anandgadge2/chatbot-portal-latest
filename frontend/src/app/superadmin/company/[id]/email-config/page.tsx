import { redirect } from "next/navigation";

interface EmailConfigRedirectPageProps {
  params: {
    id: string;
  };
}

export default function EmailConfigRedirectPage({
  params,
}: EmailConfigRedirectPageProps) {
  redirect(`/dashboard?companyId=${params.id}&tab=email`);
}
