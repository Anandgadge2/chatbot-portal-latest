/**
 * Standardised WhatsApp Notification Templates
 * These are the baseline "perfect" defaults migrated from the frontend configuration.
 * Any company can override these in the database (CompanyWhatsAppTemplate model).
 */
export const DEFAULT_WA_MESSAGES: Record<string, string> = {
  grievance_created_admin: `*{companyName}*
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
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_assigned_admin: `*{companyName}*
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

  grievance_resolved_admin: `*{companyName}*
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
⏱️ *Time Taken:* {resolutionTimeText}{resolutionLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance System`,

  grievance_rejected_admin: `*{companyName}*
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
*{companyName}*`,

  grievance_confirmation: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE SUBMITTED SUCCESSFULLY*

Respected {citizenName},
Your grievance has been registered.
*Details:*
🎫 *Reference ID:* {grievanceId}{deptLabel}{subDeptLabel}{descriptionLabel}
📅 *Submitted On:* {formattedDate}

You can track your status using the Reference ID: *{grievanceId}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your grievance, our priority.`,

  grievance_status_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *GRIEVANCE STATUS UPDATE*

Respected {citizenName},

Your grievance status has been updated.

*Details:*
🎫 *Ref No:* {grievanceId}{deptLabel}{subDeptLabel}{descriptionLabel}
📊 *New Status:* {newStatus}{remarksLabel}

You will receive further updates via WhatsApp.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System`,

  grievance_resolved: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE RESOLVED*

Respected {citizenName},

🎫 *Reference ID:* {grievanceId}{deptLabel}{subDeptLabel}
📊 *Status:* RESOLVED
👨‍💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedResolvedDate}{resolutionLabel}

Thank you for your patience.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Grievance Redressal System`,

  grievance_rejected: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *GRIEVANCE REJECTED*

Respected {citizenName},

We regret to inform you that your grievance has been rejected.

*Details:*
🎫 *Ref No:* {grievanceId}{deptLabel}
📊 *Status:* REJECTED{reasonLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*`,

  appointment_created_admin: `*{companyName}*
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

  appointment_confirmed_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT CONFIRMED*

Respected {recipientName},

Details:
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}{purposeLabel}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*`,

  appointment_cancelled_admin: `*{companyName}*
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

  appointment_completed_admin: `*{companyName}*
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

  appointment_confirmation: `*{companyName}*
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

  appointment_scheduled_update: `*{companyName}*
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

  appointment_confirmed_update: `*{companyName}*
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

  appointment_cancelled_update: `*{companyName}*
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

  appointment_completed_update: `*{companyName}*
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

  appointment_status_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *APPOINTMENT STATUS UPDATE*

Respected {citizenName},

Your appointment status has been updated.

*Details:*
🎫 *Ref No:* {appointmentId}
📊 *New Status:* {newStatus}{remarksLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digital Appointment System`,

  cmd_stop:
    "🛑 Conversation ended. Thank you for using our service. You can type 'hi' at any time to start again.",
  cmd_restart: "🔄 Restarting the conversation... please wait.",
  cmd_menu: "🏠 Returning to the main menu.",
  cmd_back: "🔙 Going back to the previous step.",
};
