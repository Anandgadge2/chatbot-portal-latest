import { redirect } from "next/navigation";

interface FlowsRedirectPageProps {
  params: {
    id: string;
  };
}

export default function FlowsRedirectPage({ params }: FlowsRedirectPageProps) {
  redirect(`/dashboard?companyId=${params.id}&tab=flows`);
}
