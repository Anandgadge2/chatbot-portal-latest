import { redirect } from 'next/navigation'

export default function OldCompanyPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  redirect(`/dashboard/company/${params.id}`)
}
