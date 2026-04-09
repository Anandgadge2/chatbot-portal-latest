/**
 * Standardised WhatsApp Notification Templates
 * These are the baseline "perfect" defaults migrated from the frontend configuration.
 * Any company can override these in the database (CompanyWhatsAppTemplate model).
 */
export const DEFAULT_WA_MESSAGES: Record<string, string> = {
  grievance_created_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━
📋 *NEW GRIEVANCE RECEIVED*

Respected {recipientName},
A new grievance has been submitted by a citizen.

*Details:*
🎫 *Reference ID:* {grievanceId}
👤 *Citizen Name:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
📅 *Received On:* {formattedDate}

*Action Required:*
Please review this grievance promptly. Resolution should be provided as per SLA.
━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System`,

  grievance_assigned_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *GRIEVANCE ASSIGNED TO YOU*

Respected {recipientName},

Details:
🎫 *Reference ID:* {grievanceId}
👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
📊 *Status:* ASSIGNED
👨‍💼 *Assigned By:* {assignedByName}
📅 *Assigned On:* {formattedDate}

Please investigate and take required action.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System`,

  grievance_reassigned_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *GRIEVANCE REASSIGNED TO YOU*

Respected {recipientName},

Details:
🎫 *Reference ID:* {grievanceId}
👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
👨‍💼 *Reassigned By:* {assignedByName}
📅 *Reassigned On:* {formattedDate}

Please investigate and take required action.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System`,

  grievance_reverted_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 *GRIEVANCE REVERTED*

Respected {recipientName},

The following grievance has been *REVERTED* for further action/review.

*Details:*
🎫 *Reference ID:* {grievanceId}
👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}
📊 *Status:* REVERTED
👨‍💼 *Reverted By:* {revertedByName}
📅 *Reverted On:* {formattedRevertedDate}{remarksLabel}

*Action Required:*
Please review the updates and take necessary corrective action to ensure timely resolution as per SLA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System`,

  grievance_resolved_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE RESOLVED*

Respected {recipientName},

The following grievance has been marked as *RESOLVED*.

*Details:*
🎫 *Reference ID:* {grievanceId}
👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}
📊 *Status:* RESOLVED
👨‍💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedResolvedDate}
⏱️ *Time Taken:* {resolutionTimeText}
📝 *Resolution Remarks:*
{remarks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance System`,

  grievance_rejected_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *GRIEVANCE REJECTED*

Respected {recipientName},

The following grievance has been *REJECTED*.

*Details:*
🎫 *Ref No:* {grievanceId}
👤 *Citizen:* {citizenName}{deptLabel}
📊 *Status:* REJECTED
👨‍💼 *Action By:* {resolvedByName}{reasonLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{localizedCompanyBrand}*`,

  grievance_confirmation: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE SUBMITTED SUCCESSFULLY*

Respected {citizenName},
Thank you for reaching out. Your grievance has been registered.
*Details:*
🎫 *Reference ID:* {grievanceId}
🏢 *Department:* {departmentName}
{subDeptLabel}
📝 *Description:* {description}
📅 *Submitted On:* {formattedDate}

You can track your status using the Reference ID: *{grievanceId}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your grievance, our priority.
– District Administration, Jharsuguda,`,

  grievance_confirmation_hi_localized: `*{localizedCompanyBrand}*
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
âœ… *शिकायत सफलतापूर्वक दर्ज हो गई*

आदरणीय {citizenName},
आपके संपर्क के लिए धन्यवाद। आपकी शिकायत दर्ज कर ली गई है।
*विवरण:*
🎫 *संदर्भ संख्या:* {grievanceId}
🏢 *विभाग:* {departmentName}
{subDeptLabel}
📝 *विवरण:* {description}
📅 *जमा करने की तिथि:* {formattedDate}

आप *{grievanceId}* संदर्भ संख्या के माध्यम से अपनी शिकायत की स्थिति ट्रैक कर सकते हैं।
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
आपकी शिकायत, हमारी प्राथमिकता।
â€“ जिला प्रशासन, झारसुगुडा`,

  grievance_confirmation_or_localized: `*{localizedCompanyBrand}*
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
âœ… *ଅଭିଯୋଗ ସଫଳଭାବେ ଦାଖଲ ହେଲା*

ଆଦରଣୀୟ {citizenName},
ଆପଣଙ୍କର ଯୋଗାଯୋଗ ପାଇଁ ଧନ୍ୟବାଦ। ଆପଣଙ୍କର ଅଭିଯୋଗ ଦାଖଲ କରାଯାଇଛି।
*ବିବରଣୀ:*
🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}
🏢 *ବିଭାଗ:* {departmentName}
{subDeptLabel}
📝 *ବିବରଣୀ:* {description}
📅 *ଦାଖଲ ତାରିଖ:* {formattedDate}

ଆପଣ *{grievanceId}* ରେଫରେନ୍ସ ନମ୍ବର ବ୍ୟବହାର କରି ଆପଣଙ୍କର ଅଭିଯୋଗର ସ୍ଥିତି ଟ୍ରାକ୍ କରିପାରିବେ।
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ଆପଣଙ୍କର ଅଭିଯୋଗ, ଆମର ଅଗ୍ରାଧିକାର।
â€“ ଜିଲ୍ଲା ପ୍ରଶାସନ, ଝାରସୁଗୁଡା`,

  grievance_status_update: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *GRIEVANCE STATUS UPDATE*

Respected {citizenName},

Your grievance status has been updated.

*Details:*
🎫 *Ref No:* {grievanceId}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📊 *New Status:* {newStatus}{remarksLabel}

You will receive further updates via WhatsApp.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{localizedCompanyBrand}*
Digital Grievance Redressal System`,

  grievance_resolved: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE RESOLVED*

Respected {citizenName},

🎫 *Reference ID:* {grievanceId}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📊 *Status:* RESOLVED
👨‍💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedResolvedDate}{remarksLabel}

Thank you for your patience.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{localizedCompanyBrand}*
Digital Grievance Redressal System`,

  grievance_rejected: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *GRIEVANCE REJECTED*

Respected {citizenName},

We regret to inform you that your grievance has been rejected.

*Details:*
🎫 *Ref No:* {grievanceId}{deptLabel}
📊 *Status:* REJECTED{reasonLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{localizedCompanyBrand}*`,

  appointment_created_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *NEW APPOINTMENT RECEIVED*

Respected {recipientName},

Details:
🎫 *Reference ID:* {appointmentId}
👤 *Citizen Name:* {citizenName}
📞 *Contact Number:* {citizenPhone}{purposeLabel}
📅 *Received On:* {formattedDate}

*Action Required:*
Please review this appointment promptly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_confirmed_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT CONFIRMED*

Respected {recipientName},

Details:
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}{purposeLabel}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{localizedCompanyBrand}*`,

  appointment_cancelled_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *APPOINTMENT CANCELLED*

Respected {recipientName},

The following appointment has been *CANCELLED*.

*Details:*
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}{purposeLabel}
📊 *Status:* CANCELLED
👨‍💼 *Updated By:* {resolvedByName}
📅 *Updated On:* {formattedResolvedDate}{reasonLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_completed_admin: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT COMPLETED*

Respected {recipientName},

The following appointment has been marked as *COMPLETED*.

*Details:*
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}{purposeLabel}
📊 *Status:* COMPLETED
👨‍💼 *Completed By:* {resolvedByName}
📅 *Completed On:* {formattedResolvedDate}{resolutionLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_confirmation: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT REQUESTED SUCCESSFULLY*

Respected {citizenName},

Your appointment request has been received.

*Details:*
🎫 *Reference ID:* {appointmentId}{purposeLabel}
📅 *Booked On:* {formattedDate}

Please note your Reference ID: *{appointmentId}*
We will notify you once it's scheduled/confirmed.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_scheduled_update: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *APPOINTMENT SCHEDULED*

Respected {citizenName},

Your appointment has been scheduled.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}{purposeLabel}
📊 *Status:* SCHEDULED{remarksLabel}

Please wait for final confirmation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_confirmed_update: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT CONFIRMED*

Respected {citizenName},

Your appointment has been confirmed.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}{purposeLabel}
📊 *Status:* CONFIRMED{remarksLabel}

Please arrive 15 minutes early with valid ID.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_cancelled_update: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *APPOINTMENT CANCELLED*

Respected {citizenName},

We regret to inform you that your appointment has been cancelled.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}{purposeLabel}{reasonLabel}

We apologize for any inconvenience caused.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_completed_update: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT COMPLETED*

Respected {citizenName},

Your appointment has been marked as completed.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}{resolutionLabel}

Thank you for visiting us.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  appointment_status_update: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *APPOINTMENT STATUS UPDATE*

Respected {citizenName},

Your appointment status has been updated.

*Details:*
🎫 *Ref No:* {appointmentId}
📊 *New Status:* {newStatus}{remarksLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  grievance_created_admin_hi: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *नई शिकायत प्राप्त हुई*

आदरणीय {recipientName},
एक नई शिकायत नागरिक द्वारा दर्ज की गई है।

🎫 *संदर्भ संख्या:* {grievanceId}
👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
📅 *प्राप्ति दिनांक:* {formattedDate}

*आवश्यक कार्रवाई:*
कृपया इस शिकायत की शीघ्र समीक्षा करें। सेवा स्तर समझौते के अनुसार समाधान प्रदान किया जाना चाहिए।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_created_admin_or: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ନୂତନ ଅଭିଯୋଗ ପ୍ରାପ୍ତ ହେଲା*

ଆଦରଣୀୟ {recipientName},
ଜଣେ ନାଗରିକଙ୍କ ଠାରୁ ଏକ ନୂତନ ଅଭିଯୋଗ ଦାଖଲ ହୋଇଛି।

🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}
👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
📅 *ପ୍ରାପ୍ତି ତାରିଖ:* {formattedDate}

*ଆବଶ୍ୟକ କାର୍ଯ୍ୟବାହୀ:*
ଦୟାକରି ଏହି ଅଭିଯୋଗକୁ ଶୀଘ୍ର ସମୀକ୍ଷା କରନ୍ତୁ। ସେବା ସ୍ତର ଚୁକ୍ତି ଅନୁଯାୟୀ ସମାଧାନ ପ୍ରଦାନ କରାଯିବା ଉଚିତ।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_assigned_admin_hi: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *शिकायत आपको सौंपी गई है*

आदरणीय {recipientName},

🎫 *संदर्भ संख्या:* {grievanceId}
👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
👨‍💼 *सौंपने वाले अधिकारी:* {assignedByName}
📅 *सौंपने की तिथि:* {formattedDate}

*आवश्यक कार्रवाई:*
कृपया जांच करें और आवश्यक कार्रवाई करें।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_assigned_admin_or: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *ଅଭିଯୋଗ ଆପଣଙ୍କୁ ଅବଣ୍ଟନ ହେଲା*

ଆଦରଣୀୟ {recipientName},

🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}
👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
👨‍💼 *ଅବଣ୍ଟନ କରିଥିବା ଅଧିକାରୀ:* {assignedByName}
📅 *ଅବଣ୍ଟନ ତାରିଖ:* {formattedDate}

*ଆବଶ୍ୟକ କାର୍ଯ୍ୟବାହୀ:*
ଦୟାକରି ଯାଞ୍ଚ କରନ୍ତୁ ଏବଂ ଆବଶ୍ୟକ ପଦକ୍ଷେପ ନିଅନ୍ତୁ।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_reassigned_admin_hi: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 *शिकायत पुनः आवंटित की गई है*

आदरणीय {recipientName},

🎫 *संदर्भ संख्या:* {grievanceId}
👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
👨‍💼 *पुनः आवंटित करने वाले अधिकारी:* {assignedByName}
📅 *पुनः आवंटन तिथि:* {formattedDate}

*आवश्यक कार्रवाई:*
कृपया जांच करें और आवश्यक कार्रवाई करें।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_reassigned_admin_or: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 *ଅଭିଯୋଗ ପୁଣିଥରେ ଅବଣ୍ଟନ ହେଲା*

ଆଦରଣୀୟ {recipientName},

🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}
👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}
👨‍💼 *ପୁନଃ ଅବଣ୍ଟନ କରିଥିବା ଅଧିକାରୀ:* {assignedByName}
📅 *ପୁନଃ ଅବଣ୍ଟନ ତାରିଖ:* {formattedDate}

*ଆବଶ୍ୟକ କାର୍ଯ୍ୟବାହୀ:*
ଦୟାକରି ଯାଞ୍ଚ କରନ୍ତୁ ଏବଂ ଆବଶ୍ୟକ ପଦକ୍ଷେପ ନିଅନ୍ତୁ।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_confirmation_hi: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *शिकायत सफलतापूर्वक दर्ज हो गई है*

आदरणीय {citizenName},
आपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है।

🎫 *संदर्भ संख्या:* {grievanceId}
🏢 *विभाग:* {departmentName}
{subDeptLabel}
📝 *विवरण:* {description}
📅 *दर्ज करने की तिथि:* {formattedDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,

  grievance_confirmation_or: `*{localizedCompanyBrand}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *ଅଭିଯୋଗ ସଫଳଭାବେ ଦାଖଲ ହେଲା*

ଆଦରଣୀୟ {citizenName},
ଆପଣଙ୍କ ଅଭିଯୋଗ ସଫଳଭାବେ ଦାଖଲ ହୋଇଛି।

🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}
🏢 *ବିଭାଗ:* {departmentName}
{subDeptLabel}
📝 *ବିବରଣୀ:* {description}
📅 *ଦାଖଲ ତାରିଖ:* {formattedDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,

  cmd_stop:
    "🛑 Conversation ended. Thank you for using our service. You can type 'hi' at any time to start again.",
  cmd_restart: "🔄 Restarting the conversation... please wait.",
  cmd_menu: "🏠 Returning to the main menu.",
  cmd_back: "🔙 Going back to the previous step.",
};
