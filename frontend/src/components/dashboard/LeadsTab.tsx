"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import LeadList from "./LeadList";

interface LeadsTabProps {
  leads: any[];
  loadingLeads: boolean;
  fetchLeads: () => void;
}

export default function LeadsTab({ leads, loadingLeads, fetchLeads }: LeadsTabProps) {
  return (
    <TabsContent value="leads" className="space-y-6">
      <LeadList leads={leads} loadingLeads={loadingLeads} fetchLeads={fetchLeads} />
    </TabsContent>
  );
}
