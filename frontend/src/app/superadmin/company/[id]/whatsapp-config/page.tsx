import { redirect } from "next/navigation";

interface WhatsAppConfigRedirectPageProps {
  params: {
    id: string;
  };
}

export default function WhatsAppConfigRedirectPage({
  params,
}: WhatsAppConfigRedirectPageProps) {
  redirect(`/dashboard?companyId=${params.id}&tab=whatsapp`);
}
