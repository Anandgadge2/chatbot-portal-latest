import { redirect } from "next/navigation";

interface CreateFlowRedirectPageProps {
  params: {
    id: string;
  };
}

export default function CreateFlowRedirectPage({
  params,
}: CreateFlowRedirectPageProps) {
  redirect(`/dashboard?companyId=${params.id}&tab=flows`);
}
