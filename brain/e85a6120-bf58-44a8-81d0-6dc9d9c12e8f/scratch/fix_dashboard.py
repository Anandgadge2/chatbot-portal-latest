import sys

file_path = r"d:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\app\dashboard\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the duplicated sections
indices = [i for i, line in enumerate(lines) if "// 2. Specialized effects" in line]
print(f"Found headers at: {indices}")

if len(indices) >= 2:
    # We want to keep the first one (starting at index indices[0])
    # And delete everything from the second one (indices[1]) up to the start of handleSort
    
    start_delete = indices[1]
    end_delete = -1
    for i in range(start_delete, len(lines)):
        if "const handleSort =" in lines[i]:
            end_delete = i
            break
    
    if end_delete != -1:
        print(f"Deleting lines from {start_delete+1} to {end_delete}")
        
        # We need to preserve the polling logic though, if it was there.
        # But wait, it was deleted. So we should RE-INSERT it.
        
        polling_logic = """
  // 3. Polling isolated from initial load triggers
  useEffect(() => {
    // Skip polling if in SuperAdmin overview mode
    if (isSuperAdminUser && !companyIdParam) return;

    if (mounted && user) {
      const pollInterval = setInterval(async () => {
        // 🛡️ Guard against execution after unmount
        if (!mounted) return;

        try {
          // Perform silent, background refreshes of the current active views
          if (
            isSuperAdminUser ||
            (hasModule(Module.GRIEVANCE) &&
              hasPermission(user, Permission.READ_GRIEVANCE))
          ) {
            fetchGrievances(grievancePage, true);
          }

          if (canShowAppointmentsInView) {
            fetchAppointments(appointmentPage, true);
          }

          // Also keep KPI stats fresh
          fetchDashboardData(true);
        } catch (error: any) {
          // 🤫 Background polling errors should be silent
          if (
            error.code === "ERR_NETWORK" ||
            error.message === "Network Error"
          ) {
            return;
          }
          console.error("High-sync polling error:", error);
        }
      }, 15000); // 15 seconds for a near-instant feel without overloading the server

      return () => clearInterval(pollInterval);
    }
  }, [
    mounted,
    user,
    grievancePage,
    appointmentPage,
    canShowAppointmentsInView,
    fetchGrievances,
    fetchAppointments,
    fetchDashboardData,
    hasModule,
    companyIdParam,
    isSuperAdminUser,
  ]);

  useEffect(() => {
    if (mounted && user && activeTab === "analytics") {
      fetchPerformanceData();
      fetchDepartmentData();
    }
  }, [mounted, user, activeTab, fetchPerformanceData, fetchDepartmentData]);

"""
        
        new_lines = lines[:start_delete] + [polling_logic] + lines[end_delete:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("File fixed successfully.")
    else:
        print("Could not find end of deletion area.")
else:
    print("No duplication found or only one header found.")
