import type { Metadata } from "next";

import DashboardPageClient from "@/components/dashboard/DashboardPageClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Operational dashboard for grievances, appointments, departments, users, and analytics.",
};

export default function DashboardPage() {
  return <DashboardPageClient />;

}
