import { redirect } from "next/navigation";

interface ChatbotFlowsRedirectPageProps {
  params: {
    id: string;
  };
}

export default function ChatbotFlowsRedirectPage({
  params,
}: ChatbotFlowsRedirectPageProps) {
  redirect(`/dashboard?companyId=${params.id}&tab=flows`);
}
