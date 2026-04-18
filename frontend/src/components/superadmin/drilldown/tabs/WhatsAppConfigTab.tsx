"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
  Save,
  Phone,
  MessageSquare,
  FileText,
  RotateCcw,
  Plus,
  Trash2,
  HelpCircle,
  Bell,
  Info,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  CheckCheck,
  Search,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  getPhoneNumberFormats,
  isValidPhoneNumber,
} from "@/lib/utils/phoneNumber";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Template Definitions
   Built-in system keys + any custom ones the company can create.
------------------------------------------------------------------ */
const TEMPLATE_GROUPS = [
  {
    label: "🏛️ Grievance Notifications (Admin)",
    description: "Sent to admin staff and department hierarchy",
    keys: [
      {
        key: "grievance_created_admin",
        label: "Grievance Received (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A citizen submits a new grievance through the chatbot",
      },
      {
        key: "grievance_assigned_admin",
        label: "Grievance Assigned (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is assigned to a department officer",
      },
      {
        key: "grievance_reassigned_admin",
        label: "Grievance Reassigned (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is reassigned to your department by another admin",
      },
      {
        key: "grievance_resolved_admin",
        label: "Grievance Resolved (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is marked as RESOLVED by an officer",
      },
      {
        key: "grievance_rejected_admin",
        label: "Grievance Rejected (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is marked as REJECTED",
      },
    ],
  },
  {
    label: "👤 Grievance Notifications (Citizen)",
    description: "Sent to citizens about their grievance status",
    keys: [
      {
        key: "grievance_confirmation",
        label: "Grievance Confirmation (Citizen)",
        to: "Citizen (submitter)",
        when: "Immediately after a grievance is submitted",
      },
      {
        key: "grievance_status_update",
        label: "Grievance Status Update (Citizen)",
        to: "Citizen (submitter)",
        when: "Grievance status changes (e.g. Assigned, Forwarded, Pending)",
      },
      {
        key: "grievance_resolved",
        label: "Grievance Resolved (Citizen)",
        to: "Citizen (submitter)",
        when: "The grievance is successfully resolved",
      },
      {
        key: "grievance_rejected",
        label: "Grievance Rejected (Citizen)",
        to: "Citizen (submitter)",
        when: "The grievance is rejected/closed without resolution",
      },
    ],
  },
  {
    label: "📅 Appointment Notification (Company Admin)",
    description: "Sent to company admin for appointment events",
    keys: [
      {
        key: "appointment_created_admin",
        label: "Appointment Received (Company Admin)",
        to: "Company Admin",
        when: "A citizen books an appointment through the chatbot",
      },
      {
        key: "appointment_confirmed_admin",
        label: "Appointment Confirmed (Company Admin)",
        to: "Company Admin",
        when: "An appointment is confirmed/scheduled",
      },
      {
        key: "appointment_cancelled_admin",
        label: "Appointment Cancelled (Company Admin)",
        to: "Company Admin",
        when: "An appointment is cancelled",
      },
      {
        key: "appointment_completed_admin",
        label: "Appointment Completed (Company Admin)",
        to: "Company Admin",
        when: "An appointment is marked as completed",
      },
    ],
  },
  {
    label: "👤 Appointment Notification (Citizen)",
    description: "Sent to citizens about their appointment status",
    keys: [
      {
        key: "appointment_confirmation",
        label: "Appointment Requested (Citizen)",
        to: "Citizen (submitter)",
        when: "Immediately after an appointment is booked",
      },
      {
        key: "appointment_scheduled_update",
        label: "Appointment Scheduled (Citizen)",
        to: "Citizen (submitter)",
        when: "Admin schedules a date & time for the appointment",
      },
      {
        key: "appointment_cancelled_update",
        label: "Appointment Cancelled (Citizen)",
        to: "Citizen (submitter)",
        when: "Appointment is cancelled by the admin",
      },
      {
        key: "appointment_completed_update",
        label: "Appointment Completed (Citizen)",
        to: "Citizen (submitter)",
        when: "Appointment is successfully completed",
      },
    ],
  },
  {
    label: "⌨️ Chatbot Command Responses",
    description: "Instant replies when a user types a command word",
    keys: [
      {
        key: "cmd_stop",
        label: "Stop / End Conversation",
        to: "Citizen (submitter)",
        when: 'User types "stop", "quit", "exit", etc.',
      },
      {
        key: "cmd_restart",
        label: "Restart Conversation",
        to: "Citizen (submitter)",
        when: 'User types "restart", "start over", etc.',
      },
      {
        key: "cmd_menu",
        label: "Main Menu",
        to: "Citizen (submitter)",
        when: 'User types "menu", "home", "main", etc.',
      },
      {
        key: "cmd_back",
        label: "Go Back",
        to: "Citizen (submitter)",
        when: 'User types "back", "previous", etc.',
      },
    ],
  },
];

const BUILTIN_KEYS = TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => k.key));

const KEY_META: Record<string, { label: string; to: string; when: string }> =
  Object.fromEntries(
    TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => [k.key, k])),
  );

const WA_PLACEHOLDERS: Array<{
  ph: string;
  desc: string;
  relevance: string[];
}> = [
  { ph: "{localizedCompanyBrand}", desc: "Localized brand header for citizen templates", relevance: ["grievance"] },
  { ph: "{recipientName}", desc: "Recipient name", relevance: ["all"] },
  { ph: "{citizenName}", desc: "Citizen name", relevance: ["all"] },
  { ph: "{citizenPhone}", desc: "Citizen phone number", relevance: ["all"] },
  { ph: "{grievanceId}", desc: "Grievance ID", relevance: ["grievance"] },
  { ph: "{appointmentId}", desc: "Appointment ID", relevance: ["appointment"] },
  { ph: "{departmentName}", desc: "Department name", relevance: ["all"] },
  { ph: "{subDepartmentName}", desc: "Sub-department name", relevance: ["all"] },
  { ph: "{deptLabel}", desc: "Smart Dept (hides if empty)", relevance: ["all"] },
  { ph: "{subDeptLabel}", desc: "Smart Sub-Dept (hides if empty)", relevance: ["all"] },
  { ph: "{descriptionLabel}", desc: "Smart Description (hides if empty)", relevance: ["grievance"] },
  { ph: "{remarksLabel}", desc: "Smart Remarks (hides if empty)", relevance: ["all"] },
  { ph: "{reasonLabel}", desc: "Smart Reason (hides if empty)", relevance: ["all"] },
  { ph: "{resolutionLabel}", desc: "Smart Resolution (hides if empty)", relevance: ["all"] },
  { ph: "{purposeLabel}", desc: "Smart Purpose (hides if empty)", relevance: ["appointment"] },
  { ph: "{description}", desc: "Grievance description", relevance: ["grievance"] },
  { ph: "{purpose}", desc: "Appointment purpose", relevance: ["appointment"] },
  { ph: "{assignedByName}", desc: "Assigned by name", relevance: ["assigned"] },
  { ph: "{formattedDate}", desc: "Date & time", relevance: ["all"] },
  { ph: "{resolvedByName}", desc: "Resolved by name", relevance: ["resolved"] },
  { ph: "{formattedResolvedDate}", desc: "Resolved date", relevance: ["resolved"] },
  { ph: "{resolutionTimeText}", desc: "Resolution duration", relevance: ["resolved"] },
  { ph: "{remarks}", desc: "Remarks / Notes", relevance: ["resolved", "cancelled"] },
  { ph: "{appointmentDate}", desc: "Appointment date", relevance: ["appointment"] },
  { ph: "{appointmentTime}", desc: "Appointment time", relevance: ["appointment"] },
  { ph: "{newStatus}", desc: "Updated status", relevance: ["status"] },
  { ph: "{oldStatus}", desc: "Previous status", relevance: ["status"] },
];

const DEFAULT_WA_MESSAGES: Record<string, string> = {
  grievance_created_admin: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *NEW GRIEVANCE RECEIVED*\n\nRespected {recipientName},\nA new grievance has been submitted.\n\n🎫 *ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n📅 *On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  grievance_assigned_admin: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *GRIEVANCE ASSIGNED*\n\nRespected {recipientName},\n\n🎫 *ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨💼 *Assigned By:* {assignedByName}\n📅 *On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  grievance_reassigned_admin: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *GRIEVANCE REASSIGNED*\n\nRespected {recipientName},\n\n🎫 *ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n📊 *Status:* REASSIGNED\n👨💼 *Reassigned By:* {assignedByName}\n📅 *On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  grievance_confirmation: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *GRIEVANCE SUBMITTED*\n\nRespected {citizenName},\nYour grievance is registered.\n\n🎫 *Ref ID:* {grievanceId}{deptLabel}{subDeptLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  appointment_created_admin: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *NEW APPOINTMENT*\n\nRespected {recipientName},\n\n🎫 *ID:* {appointmentId}\n👤 *Citizen:* {citizenName}{purposeLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  appointment_confirmation: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *APPOINTMENT REQUESTED*\n\nRespected {citizenName},\nYour request is received.\n\n🎫 *Ref ID:* {appointmentId}{purposeLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  cmd_stop: "🛑 Conversation ended. Type 'hi' to restart.",
  cmd_restart: "🔄 Restarting...",
  cmd_menu: "🏠 Returning to menu.",
  cmd_back: "🔙 Going back.",
};

const TEMPLATE_LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "or", label: "Odia" },
] as const;

const DEFAULT_WA_TRANSLATIONS: Record<string, Record<string, string>> = {
  grievance_created_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *NEW GRIEVANCE RECEIVED*\n\nRespected {recipientName},\nA new grievance has been submitted by a citizen.\n\n🎫 *Reference ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n📅 *Received On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *नई शिकायत प्राप्त हुई*\n\nआदरणीय {recipientName},\nएक नई शिकायत नागरिक द्वारा दर्ज की गई है।\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n📅 *प्राप्ति दिनांक:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *ନୂତନ ଅଭିଯୋଗ ପ୍ରାପ୍ତ ହେଲା*\n\nଆଦରଣୀୟ {recipientName},\nଜଣେ ନାଗରିକଙ୍କ ଠାରୁ ଏକ ନୂତନ ଅଭିଯୋଗ ଦାଖଲ ହୋଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n📅 *ପ୍ରାପ୍ତି ତାରିଖ:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_assigned_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *GRIEVANCE ASSIGNED TO YOU*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨‍💼 *Assigned By:* {assignedByName}\n📅 *Assigned On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *शिकायत आपको सौंपी गई है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨‍💼 *सौंपने वाले अधिकारी:* {assignedByName}\n📅 *सौंपने की तिथि:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *ଅଭିଯୋଗ ଆପଣଙ୍କୁ ଅବଣ୍ଟନ ହେଲା*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨‍💼 *ଅବଣ୍ଟନ କରିଥିବା ଅଧିକାରୀ:* {assignedByName}\n📅 *ଅବଣ୍ଟନ ତାରିଖ:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_reassigned_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔁 *GRIEVANCE REASSIGNED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨‍💼 *Reassigned By:* {assignedByName}\n📅 *Reassigned On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔁 *शिकायत पुनः आवंटित की गई है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨‍💼 *पुनः आवंटित करने वाले अधिकारी:* {assignedByName}\n📅 *पुनः आवंटन तिथि:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔁 *ଅଭିଯୋଗ ପୁଣିଥରେ ଅବଣ୍ଟନ ହେଲା*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨‍💼 *ପୁନଃ ଅବଣ୍ଟନ କରିଥିବା ଅଧିକାରୀ:* {assignedByName}\n📅 *ପୁନଃ ଅବଣ୍ଟନ ତାରିଖ:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_confirmation: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *GRIEVANCE SUBMITTED SUCCESSFULLY*\n\nRespected {citizenName},\nYour grievance has been registered successfully.\n\n🎫 *Reference ID:* {grievanceId}\n🏢 *Department:* {departmentName}\n{subDeptLabel}\n📝 *Description:* {description}\n📅 *Submitted On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *शिकायत सफलतापूर्वक दर्ज हो गई है*\n\nआदरणीय {citizenName},\nआपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है।\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n🏢 *विभाग:* {departmentName}\n{subDeptLabel}\n📝 *विवरण:* {description}\n📅 *दर्ज करने की तिथि:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ଅଭିଯୋଗ ସଫଳଭାବେ ଦାଖଲ ହେଲା*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ଅଭିଯୋଗ ସଫଳଭାବେ ଦାଖଲ ହୋଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n🏢 *ବିଭାଗ:* {departmentName}\n{subDeptLabel}\n📝 *ବିବରଣୀ:* {description}\n📅 *ଦାଖଲ ତାରିଖ:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_status_update: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *GRIEVANCE STATUS UPDATE*\n\nRespected {citizenName},\nYour grievance status has been updated.\n\n🎫 *Reference ID:* {grievanceId}\n🏢 *Department:* {departmentName}\n🏢 *Office:* {subDepartmentName}\n📊 *New Status:* {newStatus}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *शिकायत स्थिति अपडेट*\n\nआदरणीय {citizenName},\nआपकी शिकायत की स्थिति अपडेट कर दी गई है।\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n🏢 *विभाग:* {departmentName}\n🏢 *कार्यालय:* {subDepartmentName}\n📊 *नई स्थिति:* {newStatus}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *ଅଭିଯୋଗ ସ୍ଥିତି ଅଦ୍ୟତନ*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ଅଭିଯୋଗର ସ୍ଥିତି ଅଦ୍ୟତନ କରାଯାଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n🏢 *ବିଭାଗ:* {departmentName}\n🏢 *କାର୍ଯ୍ୟାଳୟ:* {subDepartmentName}\n📊 *ନୂତନ ସ୍ଥିତି:* {newStatus}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_resolved_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *GRIEVANCE RESOLVED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}\n👨‍💼 *Resolved By:* {resolvedByName}\n📅 *Resolved On:* {formattedResolvedDate}\n⏱️ *Time Taken:* {resolutionTimeText}\n📝 *Remarks:*\n{remarks}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *शिकायत का समाधान हो गया है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n👤 *नागरिक:* {citizenName}{deptLabel}{subDeptLabel}\n👨‍💼 *समाधान करने वाले अधिकारी:* {resolvedByName}\n📅 *समाधान तिथि:* {formattedResolvedDate}\n⏱️ *लगा समय:* {resolutionTimeText}\n📝 *टिप्पणी:*\n{remarks}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ଅଭିଯୋଗର ସମାଧାନ ହୋଇଛି*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n👤 *ନାଗରିକ:* {citizenName}{deptLabel}{subDeptLabel}\n👨‍💼 *ସମାଧାନ କରିଥିବା ଅଧିକାରୀ:* {resolvedByName}\n📅 *ସମାଧାନ ତାରିଖ:* {formattedResolvedDate}\n⏱️ *ଲାଗିଥିବା ସମୟ:* {resolutionTimeText}\n📝 *ଟିପ୍ପଣୀ:*\n{remarks}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_rejected_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *GRIEVANCE REJECTED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}\n👨‍💼 *Action By:* {resolvedByName}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *शिकायत अस्वीकृत की गई है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n👤 *नागरिक:* {citizenName}{deptLabel}\n👨‍💼 *कार्रवाई करने वाले अधिकारी:* {resolvedByName}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *ଅଭିଯୋଗ ଖାରଜ ହୋଇଛି*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n👤 *ନାଗରିକ:* {citizenName}{deptLabel}\n👨‍💼 *କାର୍ଯ୍ୟକରିଥିବା ଅଧିକାରୀ:* {resolvedByName}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_resolved: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *GRIEVANCE RESOLVED*\n\nRespected {citizenName},\nYour grievance has been resolved.\n\n🎫 *Reference ID:* {grievanceId}\n🏢 *Department:* {departmentName}\n🏢 *Office:* {subDepartmentName}\n👨‍💼 *Resolved By:* {resolvedByName}\n📅 *Resolved On:* {formattedResolvedDate}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *शिकायत का समाधान हो गया है*\n\nआदरणीय {citizenName},\nआपकी शिकायत का समाधान कर दिया गया है।\n\n🎫 *संदर्भ संख्या:* {grievanceId}\n🏢 *विभाग:* {departmentName}\n🏢 *कार्यालय:* {subDepartmentName}\n👨‍💼 *समाधान करने वाले अधिकारी:* {resolvedByName}\n📅 *समाधान तिथि:* {formattedResolvedDate}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ଅଭିଯୋଗର ସମାଧାନ ହୋଇଛି*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ଅଭିଯୋଗର ସମାଧାନ କରାଯାଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}\n🏢 *ବିଭାଗ:* {departmentName}\n🏢 *କାର୍ଯ୍ୟାଳୟ:* {subDepartmentName}\n👨‍💼 *ସମାଧାନ କରିଥିବା ଅଧିକାରୀ:* {resolvedByName}\n📅 *ସମାଧାନ ତାରିଖ:* {formattedResolvedDate}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  grievance_rejected: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *GRIEVANCE REJECTED*\n\nRespected {citizenName},\nWe regret to inform you that your grievance has been rejected.\n\n🎫 *Reference ID:* {grievanceId}{deptLabel}\n📊 *Status:* REJECTED{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *शिकायत अस्वीकृत कर दी गई है*\n\nआदरणीय {citizenName},\nहमें खेद है कि आपकी शिकायत अस्वीकृत कर दी गई है।\n\n🎫 *संदर्भ संख्या:* {grievanceId}{deptLabel}\n📊 *स्थिति:* अस्वीकृत{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *ଅଭିଯୋଗ ଖାରଜ ହୋଇଛି*\n\nଆଦରଣୀୟ {citizenName},\nଦୁଃଖ ସହିତ ଜଣାଉଛୁ ଯେ ଆପଣଙ୍କ ଅଭିଯୋଗ ଖାରଜ ହୋଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {grievanceId}{deptLabel}\n📊 *ସ୍ଥିତି:* ଖାରଜ{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_created_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *NEW APPOINTMENT RECEIVED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {appointmentId}\n👤 *Citizen:* {citizenName}{purposeLabel}\n📅 *Received On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *नई नियुक्ति अनुरोध प्राप्त हुआ*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n👤 *नागरिक:* {citizenName}{purposeLabel}\n📅 *प्राप्ति तिथि:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *ନୂତନ ନିଯୁକ୍ତି ଅନୁରୋଧ ପ୍ରାପ୍ତ ହେଲା*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n👤 *ନାଗରିକ:* {citizenName}{purposeLabel}\n📅 *ପ୍ରାପ୍ତି ତାରିଖ:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_confirmed_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *APPOINTMENT CONFIRMED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {appointmentId}\n👤 *Citizen:* {citizenName}{purposeLabel}\n📅 *Date:* {appointmentDate}\n⏰ *Time:* {appointmentTime}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *नियुक्ति पुष्टि की गई है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n👤 *नागरिक:* {citizenName}{purposeLabel}\n📅 *तिथि:* {appointmentDate}\n⏰ *समय:* {appointmentTime}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ନିଯୁକ୍ତି ନିଶ୍ଚିତ ହୋଇଛି*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n👤 *ନାଗରିକ:* {citizenName}{purposeLabel}\n📅 *ତାରିଖ:* {appointmentDate}\n⏰ *ସମୟ:* {appointmentTime}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_cancelled_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *APPOINTMENT CANCELLED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {appointmentId}\n👤 *Citizen:* {citizenName}{purposeLabel}\n👨‍💼 *Updated By:* {resolvedByName}\n📅 *Updated On:* {formattedResolvedDate}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *नियुक्ति रद्द की गई है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n👤 *नागरिक:* {citizenName}{purposeLabel}\n👨‍💼 *अपडेट करने वाले अधिकारी:* {resolvedByName}\n📅 *अपडेट तिथि:* {formattedResolvedDate}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *ନିଯୁକ୍ତି ବାତିଲ୍ ହୋଇଛି*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n👤 *ନାଗରିକ:* {citizenName}{purposeLabel}\n👨‍💼 *ଅଦ୍ୟତନ କରିଥିବା ଅଧିକାରୀ:* {resolvedByName}\n📅 *ଅଦ୍ୟତନ ତାରିଖ:* {formattedResolvedDate}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_completed_admin: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *APPOINTMENT COMPLETED*\n\nRespected {recipientName},\n\n🎫 *Reference ID:* {appointmentId}\n👤 *Citizen:* {citizenName}{purposeLabel}\n👨‍💼 *Completed By:* {resolvedByName}\n📅 *Completed On:* {formattedResolvedDate}{resolutionLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *नियुक्ति पूर्ण हो गई है*\n\nआदरणीय {recipientName},\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n👤 *नागरिक:* {citizenName}{purposeLabel}\n👨‍💼 *पूर्ण करने वाले अधिकारी:* {resolvedByName}\n📅 *पूर्णता तिथि:* {formattedResolvedDate}{resolutionLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ନିଯୁକ୍ତି ସମାପ୍ତ ହୋଇଛି*\n\nଆଦରଣୀୟ {recipientName},\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n👤 *ନାଗରିକ:* {citizenName}{purposeLabel}\n👨‍💼 *ସମାପ୍ତ କରିଥିବା ଅଧିକାରୀ:* {resolvedByName}\n📅 *ସମାପ୍ତି ତାରିଖ:* {formattedResolvedDate}{resolutionLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_confirmation: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *APPOINTMENT REQUESTED SUCCESSFULLY*\n\nRespected {citizenName},\nYour appointment request has been received.\n\n🎫 *Reference ID:* {appointmentId}{purposeLabel}\n📅 *Booked On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *नियुक्ति अनुरोध सफलतापूर्वक प्राप्त हुआ*\n\nआदरणीय {citizenName},\nआपका नियुक्ति अनुरोध प्राप्त हो गया है।\n\n🎫 *संदर्भ संख्या:* {appointmentId}{purposeLabel}\n📅 *बुकिंग तिथि:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ନିଯୁକ୍ତି ଅନୁରୋଧ ସଫଳଭାବେ ପ୍ରାପ୍ତ ହେଲା*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ନିଯୁକ୍ତି ଅନୁରୋଧ ପ୍ରାପ୍ତ ହୋଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}{purposeLabel}\n📅 *ବୁକିଂ ତାରିଖ:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_scheduled_update: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *APPOINTMENT SCHEDULED*\n\nRespected {citizenName},\nYour appointment has been scheduled.\n\n🎫 *Reference ID:* {appointmentId}\n📅 *Date:* {appointmentDate}\n⏰ *Time:* {appointmentTime}{purposeLabel}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *नियुक्ति निर्धारित की गई है*\n\nआदरणीय {citizenName},\nआपकी नियुक्ति निर्धारित कर दी गई है।\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n📅 *तिथि:* {appointmentDate}\n⏰ *समय:* {appointmentTime}{purposeLabel}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *ନିଯୁକ୍ତି ସୂଚିଭୁକ୍ତ ହୋଇଛି*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ନିଯୁକ୍ତି ସୂଚିଭୁକ୍ତ କରାଯାଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n📅 *ତାରିଖ:* {appointmentDate}\n⏰ *ସମୟ:* {appointmentTime}{purposeLabel}{remarksLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_cancelled_update: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *APPOINTMENT CANCELLED*\n\nRespected {citizenName},\nYour appointment has been cancelled.\n\n🎫 *Reference ID:* {appointmentId}\n📅 *Date:* {appointmentDate}\n⏰ *Time:* {appointmentTime}{purposeLabel}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *नियुक्ति रद्द कर दी गई है*\n\nआदरणीय {citizenName},\nआपकी नियुक्ति रद्द कर दी गई है।\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n📅 *तिथि:* {appointmentDate}\n⏰ *समय:* {appointmentTime}{purposeLabel}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *ନିଯୁକ୍ତି ବାତିଲ୍ ହୋଇଛି*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ନିଯୁକ୍ତି ବାତିଲ୍ କରାଯାଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n📅 *ତାରିଖ:* {appointmentDate}\n⏰ *ସମୟ:* {appointmentTime}{purposeLabel}{reasonLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  appointment_completed_update: {
    en: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *APPOINTMENT COMPLETED*\n\nRespected {citizenName},\nYour appointment has been completed.\n\n🎫 *Reference ID:* {appointmentId}\n📅 *Date:* {appointmentDate}\n⏰ *Time:* {appointmentTime}{resolutionLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hi: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *नियुक्ति पूर्ण हो गई है*\n\nआदरणीय {citizenName},\nआपकी नियुक्ति पूर्ण हो गई है।\n\n🎫 *संदर्भ संख्या:* {appointmentId}\n📅 *तिथि:* {appointmentDate}\n⏰ *समय:* {appointmentTime}{resolutionLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    or: `*{localizedCompanyBrand}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *ନିଯୁକ୍ତି ସମାପ୍ତ ହୋଇଛି*\n\nଆଦରଣୀୟ {citizenName},\nଆପଣଙ୍କ ନିଯୁକ୍ତି ସମାପ୍ତ ହୋଇଛି।\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {appointmentId}\n📅 *ତାରିଖ:* {appointmentDate}\n⏰ *ସମୟ:* {appointmentTime}{resolutionLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },
  cmd_stop: {
    en: "🛑 Conversation ended. Type 'hi' anytime to start again.",
    hi: "🛑 बातचीत समाप्त हो गई है। दोबारा शुरू करने के लिए कभी भी 'hi' टाइप करें।",
    or: "🛑 ଆଲୋଚନା ସମାପ୍ତ ହୋଇଛି। ପୁଣି ଆରମ୍ଭ କରିବାକୁ ଯେକେହିବେଳେ 'hi' ଟାଇପ୍ କରନ୍ତୁ।",
  },
  cmd_restart: {
    en: "🔄 Restarting the conversation. Please wait.",
    hi: "🔄 बातचीत पुनः शुरू की जा रही है। कृपया प्रतीक्षा करें।",
    or: "🔄 ଆଲୋଚନା ପୁଣି ଆରମ୍ଭ କରାଯାଉଛି। ଦୟାକରି ଅପେକ୍ଷା କରନ୍ତୁ।",
  },
  cmd_menu: {
    en: "🏠 Returning to the main menu.",
    hi: "🏠 मुख्य मेनू पर वापस जा रहे हैं।",
    or: "🏠 ମୁଖ୍ୟ ମେନୁକୁ ଫେରାଯାଉଛି।",
  },
  cmd_back: {
    en: "🔙 Going back to the previous step.",
    hi: "🔙 पिछले चरण पर वापस जा रहे हैं।",
    or: "🔙 ପୂର୍ବ ପଦକ୍ଷେପକୁ ଫେରାଯାଉଛି।",
  },
};

const getDefaultTranslations = (templateKey: string) => {
  const englishDefault =
    DEFAULT_WA_TRANSLATIONS[templateKey]?.en || DEFAULT_WA_MESSAGES[templateKey] || "";

  return {
    en: englishDefault,
    hi: DEFAULT_WA_TRANSLATIONS[templateKey]?.hi || englishDefault,
    or: DEFAULT_WA_TRANSLATIONS[templateKey]?.or || englishDefault,
  };
};

const pickNonEmptyText = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
};

const TEMPLATE_FOOTER_BY_LANG = {
  grievance: {
    en: "Digital Grievance Redressal System",
    hi: "डिजिटल शिकायत निवारण प्रणाली",
    or: "ଡିଜିଟାଲ ଅଭିଯୋଗ ନିବାରଣ ପ୍ରଣାଳୀ",
  },
  appointment: {
    en: "Digital Appointment System",
    hi: "डिजिटल नियुक्ति प्रबंधन प्रणाली",
    or: "ଡିଜିଟାଲ ନିଯୁକ୍ତି ପରିଚାଳନା ପ୍ରଣାଳୀ",
  },
  generic: {
    en: "Digital Notification System",
    hi: "डिजिटल सूचना प्रणाली",
    or: "ଡିଜିଟାଲ ସୂଚନା ପ୍ରଣାଳୀ",
  },
} as const;

const STATUS_UPDATE_NOTICE_BY_LANG = {
  en: "You will receive further updates via WhatsApp.",
  hi: "आपको आगे की जानकारी व्हाट्सएप के माध्यम से प्राप्त होगी।",
  or: "ଆପଣ ହ୍ୱାଟସଅ୍ୟାପ୍ ମାଧ୍ୟମରେ ପରବର୍ତ୍ତୀ ଅଦ୍ୟତନ ପାଇବେ।",
} as const;

const getTemplateFooterType = (templateKey: string) => {
  if (templateKey.startsWith("appointment")) {
    return "appointment";
  }
  if (templateKey.startsWith("grievance")) {
    return "grievance";
  }
  return "generic";
};

const ensureTemplateFooter = (
  templateKey: string,
  lang: "en" | "hi" | "or",
  text: string,
) => {
  if (templateKey.startsWith("cmd_")) {
    return text;
  }

  const normalized = String(text || "").trim();
  if (!normalized) {
    return normalized;
  }

  const footerType = getTemplateFooterType(templateKey);
  const systemLine = TEMPLATE_FOOTER_BY_LANG[footerType][lang];
  const statusNotice =
    templateKey === "grievance_status_update"
      ? STATUS_UPDATE_NOTICE_BY_LANG[lang]
      : "";
  const hasNotice = !statusNotice || normalized.includes(statusNotice);
  const hasSystem = normalized.includes(systemLine);

  if (hasNotice && hasSystem) {
    return normalized;
  }

  const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  const appendedParts = [
    !hasNotice ? statusNotice : "",
    divider,
    "*{localizedCompanyBrand}*",
    !hasSystem ? systemLine : "",
  ].filter(Boolean);

  return `${normalized}\n\n${appendedParts.join("\n")}`.trim();
};

const buildTemplateTranslations = (templateKey: string, template?: any) => {
  const defaults = getDefaultTranslations(templateKey);
  const english = ensureTemplateFooter(
    templateKey,
    "en",
    pickNonEmptyText(
      template?.messageTranslations?.en,
      template?.message,
      defaults.en,
    ),
  );

  return {
    en: english,
    hi: ensureTemplateFooter(
      templateKey,
      "hi",
      pickNonEmptyText(template?.messageTranslations?.hi, defaults.hi, english),
    ),
    or: ensureTemplateFooter(
      templateKey,
      "or",
      pickNonEmptyText(template?.messageTranslations?.or, defaults.or, english),
    ),
  };
};

const JHARSUGUDA_BRAND_BY_LANG = {
  en: "SAHAJ-Swift Access & Help by Administration, Jharsuguda",
  hi: "सहज-प्रशासन द्वारा त्वरित पहुँच एवं सहायता, झारसुगुड़ा",
  or: "ସହଜ-ପ୍ରଶାସନ ଦ୍ୱାରା ତ୍ୱରିତ ପହଞ୍ଚ ଏବଂ ସହାୟତା, ଝାରସୁଗୁଡା",
} as const;

const isJharsugudaCompanyName = (name?: string) => {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized.includes("collectorate") && normalized.includes("jharsuguda");
};

const injectJharsugudaBrand = (
  template: string,
  lang: "en" | "hi" | "or",
  enabled: boolean,
) => {
  if (!enabled) return template;

  const brand = JHARSUGUDA_BRAND_BY_LANG[lang];
  return String(template || "")
    .replaceAll("{localizedCompanyBrand}", brand)
    .replaceAll("{companyName}", brand);
};

const normalizeJharsugudaTemplate = (
  template: any,
  isJharsugudaCompany: boolean,
) => {
  const translations = {
    en: injectJharsugudaBrand(template.messageTranslations?.en ?? template.message ?? "", "en", isJharsugudaCompany),
    hi: injectJharsugudaBrand(template.messageTranslations?.hi ?? template.message ?? "", "hi", isJharsugudaCompany),
    or: injectJharsugudaBrand(template.messageTranslations?.or ?? template.message ?? "", "or", isJharsugudaCompany),
  };

  return {
    ...template,
    message: translations.en,
    messageTranslations: translations,
  };
};

export interface WhatsAppConfigTabProps {
  companyId: string;
}

export default function WhatsAppConfigTab({ companyId }: WhatsAppConfigTabProps) {
  const { user } = useAuth();
  const currentUserId = (user as any)?._id || (user as any)?.id;
  const { company } = useCompanyContext();
  const { data: cachedConfig } = useWhatsappConfig(companyId);
  const isJharsugudaCompany = isJharsugudaCompanyName(company?.name);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<string>("grievance_created_admin");
  const [activeTemplateLanguage, setActiveTemplateLanguage] = useState<"en" | "hi" | "or">("en");
  const [savingTemplates, setSavingTemplates] = useState(false);

  const [newTemplateKey, setNewTemplateKey] = useState("");
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    TEMPLATE_GROUPS.reduce((acc, g) => ({ ...acc, [g.label]: true }), {}),
  );
  const [isCustomCollapsed, setIsCustomCollapsed] = useState(true);

  const buildEmptyConfig = useCallback(() => ({
    companyId,
    phoneNumber: "",
    displayPhoneNumber: "",
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    verifyToken: "",
    webhookUrl: "",
    webhookSecret: "",
    appSecret: "",

    isActive: true,
    chatbotSettings: {
      isEnabled: true,
      defaultLanguage: "en",
      supportedLanguages: ["en"],
      welcomeMessage: "Welcome! How can we help you today?",
      offlineMessage: "",
    },
    activeFlows: [],
    rateLimits: {
      messagesPerMinute: 60,
      messagesPerHour: 1000,
      messagesPerDay: 10000,
    },
    createdBy: currentUserId,
  }), [companyId, currentUserId]);

  const updateConfigField = (field: string, value: any) => {
    setConfig((prev: any) => ({
      ...(prev || buildEmptyConfig()),
      [field]: value,
    }));
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/whatsapp-config/company/${companyId}/templates`);
      const list = res?.data ?? [];

      const mergedTemplates = BUILTIN_KEYS.map(key => {
        const existing = Array.isArray(list) ? list.find((t: any) => t.templateKey === key) : null;
        if (existing) {
          const messageTranslations = buildTemplateTranslations(key, existing);
          return normalizeJharsugudaTemplate({
            ...existing,
            message: messageTranslations.en,
            messageTranslations,
          }, isJharsugudaCompany);
        }

        const defaults = buildTemplateTranslations(key);
        return normalizeJharsugudaTemplate({
          templateKey: key,
          label: KEY_META[key]?.label ?? key,
          message: defaults.en,
          messageTranslations: defaults,
          keywords: [],
          isActive: true
        }, isJharsugudaCompany);
      });

      if (Array.isArray(list)) {
        list.forEach((t: any) => {
          if (!BUILTIN_KEYS.includes(t.templateKey)) {
            const messageTranslations = buildTemplateTranslations(t.templateKey, t);
            mergedTemplates.push(normalizeJharsugudaTemplate({
              ...t,
              message: messageTranslations.en,
              messageTranslations,
            }, isJharsugudaCompany));
          }
        });
      }
      setWaTemplates(mergedTemplates);
    } catch (error) {
      console.error(error);
      toast.error("Template synchronization failure");
    } finally {
      setLoading(false);
    }
  }, [companyId, isJharsugudaCompany]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setIsEditing(false);
    } else {
      setConfig(buildEmptyConfig());
    }
  }, [buildEmptyConfig, cachedConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...(config || buildEmptyConfig()),
        companyId,
        displayPhoneNumber:
          config?.displayPhoneNumber?.trim() || config?.phoneNumber?.trim() || "",
      };
      const method = payload?._id ? "put" : "post";
      const url = payload?._id ? `/whatsapp-config/${payload._id}` : "/whatsapp-config";
      await apiClient[method](url, payload);
      toast.success("Connection matrix updated");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to commit changes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsAppTemplates = async () => {
    try {
      setSavingTemplates(true);
      await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
        templates: waTemplates.map(t => {
          const normalized = normalizeJharsugudaTemplate(t, isJharsugudaCompany);
          return {
            ...normalized,
            message: normalized.messageTranslations?.en ?? normalized.message ?? "",
            messageTranslations: normalized.messageTranslations,
            isActive: normalized.isActive !== false
          };
        })
      });
      toast.success("Logic updated successfully");
      fetchData();
    } catch (error) {
      toast.error("Save failure");
    } finally {
      setSavingTemplates(false);
    }
  };

  const currentWaTemplate = waTemplates.find(t => t.templateKey === selectedWaTemplate) || {
    templateKey: selectedWaTemplate,
    message: getDefaultTranslations(selectedWaTemplate).en,
    messageTranslations: getDefaultTranslations(selectedWaTemplate),
    keywords: [],
    isActive: true
  };

  const normalizedCurrentTemplate = normalizeJharsugudaTemplate(
    {
      ...currentWaTemplate,
      messageTranslations: buildTemplateTranslations(selectedWaTemplate, currentWaTemplate),
    },
    isJharsugudaCompany,
  );

  const updateSelectedField = (field: string, value: any) => {
    setWaTemplates(prev => {
      const idx = prev.findIndex(t => t.templateKey === selectedWaTemplate);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: value };
        if (field === "messageTranslations") {
          next[idx].message = value?.en || "";
        }
        return next;
      }
      return [...prev, {
        templateKey: selectedWaTemplate,
        [field]: value,
        message: field === "messageTranslations" ? value?.en || "" : "",
        isActive: true
      }];
    });
  };

  const addPlaceholder = (ph: string) => {
    updateSelectedField("messageTranslations", {
      ...(normalizedCurrentTemplate.messageTranslations || {}),
      [activeTemplateLanguage]:
        ((normalizedCurrentTemplate.messageTranslations || {})[activeTemplateLanguage] || "") + ph,
    });
  };

  const handleAddTemplate = () => {
    if (!newTemplateKey || !newTemplateLabel) return toast.error("Required fields missing");
    const slug = newTemplateKey.toLowerCase().replace(/\s+/g, "_");
    setWaTemplates(prev => [...prev, {
      templateKey: slug,
      label: newTemplateLabel,
      keywords: [],
      message: "",
      messageTranslations: { en: "", hi: "", or: "" },
      isActive: true,
    }]);
    setSelectedWaTemplate(slug);
    setIsAddingTemplate(false);
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  if (loading) return <LoadingSpinner text="Retrieving matrix..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">WhatsApp API Config</h2>
          <p className="text-[10px] text-slate-500 font-medium">Meta Business Integration</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="w-full font-bold text-[10px] uppercase sm:w-auto">
              Edit Params
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button onClick={handleSave} disabled={saving} size="sm" className="w-full bg-indigo-600 font-bold text-[10px] uppercase sm:w-auto">
                {saving ? "Deploying..." : "Commit Changes"}
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm" className="w-full text-[10px] uppercase sm:w-auto">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Connection Params */}
        <div className="space-y-6">
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardHeader className="bg-slate-900 py-3">
              <CardTitle className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <Phone className="w-3 h-3 text-indigo-400" /> Connection Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Official Phone Number</Label>
                <Input 
                  value={config?.phoneNumber || ""} 
                  onChange={e => updateConfigField("phoneNumber", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="e.g. 918999999999"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Display Phone Number</Label>
                <Input
                  value={config?.displayPhoneNumber || ""}
                  onChange={e => updateConfigField("displayPhoneNumber", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="e.g. +91 89999 99999"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Phone Number ID</Label>
                <Input
                  value={config?.phoneNumberId || ""}
                  onChange={e => updateConfigField("phoneNumberId", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="Meta phone_number_id"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Business Account ID</Label>
                <Input
                  value={config?.businessAccountId || ""}
                  onChange={e => updateConfigField("businessAccountId", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="Meta business account ID"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Access Token</Label>
                <Input
                  type="password"
                  value={config?.accessToken || ""}
                  onChange={e => updateConfigField("accessToken", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="Permanent/system access token"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Verify Token</Label>
                <Input
                  value={config?.verifyToken || ""}
                  onChange={e => updateConfigField("verifyToken", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="Webhook verify token"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">App Secret (Primary)</Label>
                <Input
                  type="password"
                  value={config?.appSecret || ""}
                  onChange={e => updateConfigField("appSecret", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="Meta App Secret"
                />
                <p className="text-[8px] text-slate-400 leading-tight">
                  Found at: Meta Developer Dashboard → Your App → Settings → Basic → App Secret. Required for secure webhook validation.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Webhook Secret (Legacy/Fallback)</Label>
                <Input
                  type="password"
                  value={config?.webhookSecret || ""}
                  onChange={e => updateConfigField("webhookSecret", e.target.value)}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                  placeholder="Legacy Webhook Secret"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[9px] font-black uppercase text-slate-500">Messenger pipeline</Label>
                <Switch 
                  checked={config?.chatbotSettings?.isEnabled}
                  onCheckedChange={checked => setConfig((prev: any) => ({
                    ...(prev || buildEmptyConfig()),
                    chatbotSettings: {
                      ...((prev || buildEmptyConfig()).chatbotSettings || {}),
                      isEnabled: checked,
                    },
                  }))}
                  disabled={!isEditing}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[9px] font-black uppercase text-slate-500">WhatsApp config active</Label>
                <Switch
                  checked={config?.isActive !== false}
                  onCheckedChange={checked => updateConfigField("isActive", checked)}
                  disabled={!isEditing}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Notification Designer */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="rounded-xl shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-900 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <Bell className="w-3 h-3 text-emerald-400" /> Outbound Designer
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[500px] flex-col p-0 lg:flex-row">
              {/* Sidebar */}
              <div className="w-full border-b bg-slate-50/30 max-h-[280px] overflow-y-auto lg:max-h-[700px] lg:w-72 lg:border-b-0 lg:border-r">
                 {TEMPLATE_GROUPS.map(group => (
                   <div key={group.label} className="border-b">
                     <div onClick={() => toggleGroup(group.label)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{group.label}</span>
                        {collapsedGroups[group.label] ? <ChevronRight className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                     </div>
                     {!collapsedGroups[group.label] && (
                       <div className="pb-1 bg-white">
                          {group.keys.map(k => {
                            const template = waTemplates?.find((t: any) => t.templateKey === k.key);
                            const isActive = template?.isActive !== false;
                            
                            return (
                              <div 
                                key={k.key} 
                                onClick={() => setSelectedWaTemplate(k.key)}
                                className={cn(
                                  "px-4 py-3 cursor-pointer border-l-2 text-[11px] font-bold flex items-center justify-between", 
                                  selectedWaTemplate === k.key 
                                    ? "bg-indigo-50 border-indigo-500 text-indigo-700" 
                                    : "border-transparent hover:bg-slate-50 text-slate-700"
                                )}
                              >
                                 <span>{k.label}</span>
                                 {!isActive && (
                                   <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Disabled" />
                                 )}
                              </div>
                            );
                          })}
                       </div>
                     )}
                   </div>
                 ))}
                 <div className="p-3">
                   <Button onClick={() => setIsAddingTemplate(true)} variant="outline" className="w-full h-8 text-[9px] font-black uppercase border-dashed">
                      Add Custom Scenario
                   </Button>
                 </div>
              </div>

              {/* Editor */}
              <div className="relative flex-1 space-y-4 bg-white p-4 sm:p-6">
                 <div className="flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                       <div className="min-w-0">
                          <h3 className="text-xs font-black uppercase text-slate-800">{normalizedCurrentTemplate.label || selectedWaTemplate}</h3>
                          <p className="text-[10px] text-slate-500 mt-1 italic">{KEY_META[selectedWaTemplate]?.when || "Manual Trigger"}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {TEMPLATE_LANGS.map((lang) => (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => setActiveTemplateLanguage(lang.code)}
                                className={cn(
                                  "px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-wide",
                                  activeTemplateLanguage === lang.code
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                                )}
                              >
                                {lang.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                           <Label htmlFor="template-active-switch" className="text-[9px] font-black uppercase text-emerald-700 cursor-pointer select-none">
                              {normalizedCurrentTemplate.isActive !== false ? "Active" : "Inactive"}
                           </Label>
                           <Switch 
                              id="template-active-switch"
                              checked={normalizedCurrentTemplate.isActive !== false}
                              onCheckedChange={async (checked) => {
                                // 🔄 UPDATE: Instant save on toggle to ensure it's "automatically used in the flow"
                                updateSelectedField("isActive", checked);
                                
                                // We need the updated list to send to backend, but setWaTemplates is async. 
                                // So we manually construct the updated list for the immediate save call.
                                const updatedTemplates = waTemplates.map(t => 
                                  t.templateKey === selectedWaTemplate ? { ...t, isActive: checked } : t
                                );
                                
                                try {
                                  setSavingTemplates(true);
                                  await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
                                    templates: updatedTemplates.map(t => {
                                      const normalized = normalizeJharsugudaTemplate(t, isJharsugudaCompany);
                                      return {
                                        ...normalized,
                                        message: normalized.messageTranslations?.en ?? normalized.message ?? "",
                                        messageTranslations: normalized.messageTranslations,
                                        isActive: normalized.isActive !== false
                                      };
                                    })
                                  });
                                  toast.success(`Template ${checked ? 'activated' : 'deactivated'}`);
                                } catch (error) {
                                  toast.error("Failed to update status");
                                } finally {
                                  setSavingTemplates(false);
                                }
                              }}
                              className="scale-75 data-[state=checked]:bg-emerald-600"
                           />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      <Button onClick={() => setIsPreviewOpen(true)} variant="outline" size="sm" className="h-8 text-[10px] font-bold border-indigo-200 text-indigo-600">
                         <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                      <Button
                         onClick={handleSaveWhatsAppTemplates}
                         disabled={savingTemplates}
                         size="sm"
                         className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase px-4 shadow-sm transition-all"
                      >
                         {savingTemplates ? (
                           <LoadingSpinner className="w-3 h-3 mr-1" />
                         ) : (
                           <Save className="w-3 h-3 mr-1" />
                         )}
                         {savingTemplates ? "Updating..." : "Save Logic"}
                      </Button>
                    </div>
                 </div>

                 <textarea 
                    value={normalizedCurrentTemplate.messageTranslations?.[activeTemplateLanguage] || ""} 
                    onChange={e => updateSelectedField("messageTranslations", {
                      ...(normalizedCurrentTemplate.messageTranslations || {}),
                      [activeTemplateLanguage]: e.target.value,
                    })}
                    className="min-h-[320px] w-full rounded-xl border bg-slate-50 p-4 text-xs font-bold font-mono outline-none resize-none sm:min-h-[400px]"
                 />

                 <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Placeholders</Label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 rounded-lg border">
                       {WA_PLACEHOLDERS.map(ph => (
                         <button key={ph.ph} onClick={() => addPlaceholder(ph.ph)} className="px-2 py-0.5 bg-white border rounded text-[9px] font-bold hover:border-indigo-500">{ph.ph}</button>
                       ))}
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WhatsApp Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative w-full max-w-[320px] h-[650px] bg-white rounded-[2.5rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden flex flex-col scale-90 sm:scale-100">
            {/* Top Bar / Notch */}
            <div className="h-6 w-32 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-20" />
            
            {/* WhatsApp Header */}
            <div className="bg-[#075E54] pt-8 pb-3 px-4 flex items-center gap-3 text-white">
               <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center overflow-hidden">
                  <Phone className="w-6 h-6 text-slate-500 translate-y-1" />
               </div>
               <div>
                 <h4 className="text-sm font-bold truncate leading-tight">{company?.name || "Official Support"}</h4>
                 <p className="text-[10px] opacity-80 font-medium">Online</p>
               </div>
               <div className="ml-auto flex gap-4 opacity-80">
                  <Eye className="w-4 h-4" />
                  <Search className="w-4 h-4" />
               </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 bg-[#E5DDD5] p-4 relative overflow-y-auto no-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain' }}>
               <div className="flex flex-col gap-2">
                  <div className="self-start max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none shadow-sm relative group animate-in slide-in-from-left-2">
                     <div className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap text-slate-800">
                        {(normalizedCurrentTemplate.messageTranslations?.[activeTemplateLanguage] || "")
                          .replace(/{(\w+)}/g, (_: string, k: string) => `*${k}*`) || "No content configured."}
                     </div>
                     <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                        <span className="text-[9px] font-bold">12:00 PM</span>
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                     </div>
                  </div>
               </div>
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white flex items-center gap-2">
               <div className="flex-1 h-10 bg-slate-100 rounded-full px-4 flex items-center text-slate-400 text-sm">
                  Type a message
               </div>
               <div className="h-10 w-10 rounded-full bg-[#128C7E] flex items-center justify-center shadow-md">
                  <MessageSquare className="w-5 h-5 text-white" />
               </div>
            </div>

            <Button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 h-9 w-9 p-0 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md border-0 z-[110]"
            >
                <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {isAddingTemplate && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center p-6">
            <Card className="w-full max-w-sm rounded-2xl shadow-xl">
               <CardHeader className="py-4 flex flex-row items-center justify-between border-b">
                  <CardTitle className="text-xs font-black uppercase">Initialize Scenario Node</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingTemplate(false)}><X className="w-4 h-4"/></Button>
               </CardHeader>
               <CardContent className="p-5 space-y-4">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Node Key</Label>
                     <Input value={newTemplateKey} onChange={e => setNewTemplateKey(e.target.value)} placeholder="feedback_node" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Label</Label>
                     <Input value={newTemplateLabel} onChange={e => setNewTemplateLabel(e.target.value)} placeholder="Citizen Feedback" />
                  </div>
                  <Button onClick={handleAddTemplate} className="w-full bg-indigo-600 font-bold text-[11px] uppercase p-3 h-auto rounded-xl">Initialize Node</Button>
               </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
}
