// Consolidated Enterprise-Level Government Chatbot Engine
// Features: Professional language, button-based interactions, voice note support, and unified module routing
import mongoose from 'mongoose';
import Company from '../models/Company';
import Department from '../models/Department';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import AppointmentAvailability, { IAppointmentAvailability, IDayAvailability } from '../models/AppointmentAvailability';
import ChatbotFlow from '../models/ChatbotFlow';
import { GrievanceStatus, AppointmentStatus, Module } from '../config/constants';
import { sendWhatsAppMessage, sendWhatsAppButtons, sendWhatsAppList } from './whatsappService';
import { findDepartmentByCategory, getAvailableCategories } from './departmentMapper';
import { notifyDepartmentAdminOnCreation } from './notificationService';
import { uploadWhatsAppMediaToCloudinary } from './mediaService';
import { getSession, getSessionFromMongo, updateSession, clearSession, UserSession } from './sessionService';
import { loadFlowForTrigger, DynamicFlowEngine, getStartStepForTrigger } from './dynamicFlowEngine';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import { createAuditLog } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
// Note: ID generation is handled by pre-save hooks in Grievance and Appointment models

export interface ChatbotMessage {
  companyId: string;
  from: string;
  messageText: string;
  messageType: string;
  messageId: string;
  mediaUrl?: string;
  metadata?: any;
  buttonId?: string;
}

// UserSession interface is now imported from sessionService

// Professional Government Language Translations
const translations = {
  en: {
    welcome: '🇮🇳 *Collectorate Jharsuguda - Official Digital Portal*\n\nNamaskar! Welcome to the official WhatsApp service of Collectorate Jharsuguda.\n\nWe are dedicated to providing transparent and efficient services to all citizens.\n\n👇 *Please select your preferred language:*',
    serviceUnavailable: '⚠️ *Service Notice*\n\nThe requested service is currently under maintenance. We apologize for the inconvenience.\n\nPlease try again later or visit our official website.',
    mainMenu: '🏛️ *Citizen Services Menu*\n\nWelcome to the Collectorate Jharsuguda Digital Helpdesk.\n\n👇 *Please select a service from the options below:*',
    grievanceRaise: '📝 *Register a Grievance*\n\nYou can file a formal complaint regarding any department.\n\nTo begin, please provide the details as requested.',
    appointmentBook: '📅 *Book an Official Appointment*\n\nSchedule a meeting with the District Magistrate / Collector.\n\nPlease provide the required details to proceed with your appointment request.',
    appointmentBookCEO: '📅 *New Appointment Request*\n\nPlease enter your Full Name (as per official records):',
    aptRequested: '✅ *Appointment Request Submitted*\n\nYour appointment request has been received.\n\n🎫 *Ref No:* `{id}`\n👤 *Name:* {name}\n📅 *Requested Date:* {date}\n⏰ *Requested Time:* {time}\n🎯 *Purpose:* {purpose}\n\n⏳ *Status:* Your request is pending approval. You will receive a confirmation message once the appointment is scheduled.\n\nThank you for your patience.',
    aptScheduled: '✅ *Appointment Confirmed*\n\nYour appointment has been scheduled.\n\n🎫 *Ref No:* `{id}`\n👤 *Name:* {name}\n📅 *Date:* {date}\n⏰ *Time:* {time}\n🎯 *Purpose:* {purpose}\n\nPlease arrive 15 minutes early with valid ID.\n\n📝 *Remarks:* {remarks}',
    aptCancelled: '❌ *Appointment Cancelled*\n\nYour appointment request has been cancelled.\n\n🎫 *Ref No:* `{id}`\n📅 *Date:* {date}\n⏰ *Time:* {time}\n\n📝 *Reason:* {remarks}\n\nIf you have any questions, please contact us.',
    status_REQUESTED: 'Requested',
    rtsServices: '⚖️ *Right to Service (RTS) Portal*\n\nAccess various government services under the Right to Service Act.\n\n👇 *Select a service:*',
    trackStatus: '🔍 *Track Application Status*\n\nCheck the status of your Grievance or Appointment.\n\nPlease enter your *Reference Number* (e.g., GRV... or APT...):',
    grievanceName: '👤 *Citizen Identification*\n\nPlease enter your *Full Name* as it appears on official documents:',
    grievanceCategory: '📂 *Select Category*\n\nChoose the department or category tailored to your issue:',
    grievanceDescription: '✍️ *Grievance Details*\n\nPlease type a detailed description of your issue.\n\n_Tip: Include dates, location, and specific details for faster resolution._',
    grievanceLocation: '📍 *Location Details*\n\nPlease provide the location associated with this issue.\n\n👇 *Select an option:*',
    grievancePhoto: '📷 *Supporting Evidence*\n\nUpload a photo or document to support your claim (Optional).\n\n👇 *Select an option:*',
    grievanceConfirm: '📋 *Confirm Submission*\n\nPlease verify your details:\n\n👤 *Name:* {name}\n🏢 *Dept:* {category}\n📝 *Issue:* {description}\n\n👇 *Is this correct?*',
    grievanceSuccess: '✅ *Grievance Registered Successfully*\n\nYour complaint has been logged in our system.\n\n🎫 *Ref No:* `{id}`\n🏢 *Dept:* {department}\n📅 *Date:* {date}\n\nYou will receive updates via WhatsApp.',
    grievanceResolvedNotify: '✅ *Resolution Update*\n\nYour grievance (Ref: `{id}`) has been addressed.\n\n📝 *Officer Remarks:* {remarks}\n\nThank you for helping us improve our services.',
    label_no_remarks: 'Case closed as per protocol.',
    grievanceError: '❌ *System Error*\n\nWe could not process your request at this moment. Please try again later.',
    backToMenu: '↩️ Main Menu',
    help: 'ℹ️ *Helpdesk & Support*\n\nFor further assistance:\n📞 *Helpline:* 06645-270007\n🌐 *Website:* jharsuguda.nic.in\n📍 *Office:* Collectorate, Jharsuguda\n\n_Office Hours: 10:00 AM - 5:30 PM (Mon-Sat)_',
    invalidOption: '⚠️ *Invalid Input*\n\nPlease select a valid option from the buttons provided.',
    sessionExpired: '⏳ *Session Timed Out*\n\nYour session has expired. Please type "Hi" to start again.',
    menu_grievance: '📝 File Grievance',
    menu_appointment: '📅 Book Appointment',
    menu_rts: '⚖️ RTS Services',
    menu_track: '🔍 Track Status',
    menu_help: 'ℹ️ Help & Contact',
    nav_track_another: '🔍 Track Another',
    nav_main_menu: '↩️ Main Menu',
    trackStatusPortal: '🔍 *Status Inquiry*\n\nEnter your Reference Number below to check the current status.',
    label_date: '📅 Date',
    label_ref_no: '🎫 Ref No',
    label_department: '🏢 Dept',
    label_category: '📂 Category',
    label_status: '📊 Status',
    label_description: '📝 Details',
    label_purpose: '🎯 Purpose',
    label_citizen: '👤 Name',
    label_time: '⏰ Time',
    selection_department: '🏢 *Department Selection*\n\nSelect the relevant department:',
    btn_select_dept: 'View Departments',
    btn_load_more: 'Load More Departments',
    err_name_invalid: '⚠️ *Invalid Name*\n\nPlease enter a valid full name (min 2 chars).',
    err_description_short: '⚠️ *Insufficient Details*\n\nPlease provide more details (min 10 chars) to help us understand the issue.',
    err_purpose_short: '⚠️ *Purpose Required*\n\nPlease specify the purpose of the visit (min 5 chars).',
    msg_type_address: '📍 Please type the address:',
    msg_upload_photo: '📷 Please upload the image/document now:',
    btn_skip_location: '⏭️ Skip',
    btn_manual_location: '✍️ Type Address',
    btn_skip_photo: '⏭️ Skip',
    btn_upload_photo: '📤 Upload',
    btn_confirm_submit: '✅ Submit Grievance',
    btn_cancel: '❌ Cancel',
    btn_confirm_book: '✅ Confirm Booking',
    label_placeholder_dept: 'General Administration',
    
    label_apt_header: '📅 *New Appointment Request*\n\nPlease enter your Full Name (as per official records):',
    label_select_date: '🗓️ *Select Date*\n\nChoose a convenient date:',
    label_select_time: '⏰ *Select Time Slot*\n\nChoose a time for your visit:',
     // Department names (for dynamic translation)
    'dept_Health Department': 'Health Department',
    'dept_Education Department': 'Education Department',
    'dept_Water Supply Department': 'Water Supply Department',
    'dept_Public Works Department': 'Public Works Department',
    'dept_Urban Development Department': 'Urban Development Department',
    'dept_Revenue Department': 'Revenue Department',
    'dept_Agriculture Department': 'Agriculture Department',
    'dept_Social Welfare Department': 'Social Welfare Department',
    'desc_Health Department': 'Hospitals, primary health centers, and medical services',
    'desc_Education Department': 'Schools, scholarships, and educational schemes',
    'desc_Water Supply Department': 'Drinking water supply and sanitation projects',
    'desc_Public Works Department': 'Roads, bridges, and government buildings',
    'desc_Urban Development Department': 'Town planning and municipal services',
    'desc_Revenue Department': 'Land records, taxes, and certificates',
    'desc_Agriculture Department': 'Farming schemes, seeds, and subsidies',
    'desc_Social Welfare Department': 'Pension schemes and disability assistance',
    'dept_Water Supply and Sanitation Department': 'Water Supply and Sanitation Department',
    'dept_Works Department': 'Works Department',
    'dept_DRDA department': 'DRDA Department',
    'dept_Panchayat Department': 'Panchayat Department',
    'dept_Women and Child Development Department': 'Women and Child Development Department',
    'dept_MNREGA Department': 'MNREGA Department',
    'dept_Finance Department': 'Finance Department',
    'dept_Rural Water Supply Department': 'Rural Water Supply Department',
    'dept_Water Conservation Department': 'Water Conservation Department',
    'dept_Animal Husbandry Department': 'Animal Husbandry Department',
    'dept_IT Cell': 'IT Cell',
    'desc_Water Supply and Sanitation Department': 'Water supply and sanitation services',
    'desc_Works Department': 'Construction and maintenance works',
    'desc_DRDA department': 'Rural development programs',
    'desc_Panchayat Department': 'Panchayat administration and development',
    'desc_Women and Child Development Department': 'Women and child welfare schemes',
    'desc_MNREGA Department': 'Employment guarantee scheme',
    'desc_Finance Department': 'Financial management and accounts',
    'desc_Rural Water Supply Department': 'Water supply in rural areas',
    'desc_Water Conservation Department': 'Water conservation and management',
    'desc_Animal Husbandry Department': 'Animal husbandry and dairy development',
    'desc_IT Cell': 'Information technology services',
    appointmentConfirm: '📋 *Verify Appointment*\n\nPlease confirm your booking details:',
    err_no_record_found: '❌ *No Records Found*\n\nWe could not find any record matching that reference number.',
    grievanceCancel: '🚫 *Cancelled*\n\nThe grievance registration has been cancelled.',
    aptCancel: '🚫 *Cancelled*\n\nThe appointment booking has been cancelled.',
    aptSuccess: '✅ *Appointment Confirmed*\n\nYour meeting has been scheduled.\n\n🎫 *Ref No:* `{id}`\n🏢 *Dept:* {dept}\n📅 *Date:* {date}\n⏰ *Time:* {time}\n\nPlease arrive 15 mins early with valid ID.',
    aptError: '❌ *Booking Failed*\n\nPlease try again later.',
    nextActionPrompt: '🔄 *Next Step*\n\nWhat would you like to do?',
    msg_apt_enhanced: 'ℹ️ Appointment system is being upgraded.',
    msg_no_dept: '⚠️ No departments currently accepting appointments.',
    msg_no_dept_grv: '⚠️ *No Departments Available*\n\nCurrently, there are no departments configured for grievance registration.\n\nPlease contact the administration or try again later.',
    header_grv_status: '📄 Grievance Status',
    header_apt_status: '🗓️ Appointment Status',
    status_PENDING: 'Pending Review',
    status_ASSIGNED: 'Assigned to Officer',
    status_RESOLVED: 'Resolved',
    status_SCHEDULED: 'Scheduled',
    status_CANCELLED: 'Cancelled',
    status_COMPLETED: 'Completed',
    footer_grv_guidance: 'For case escalation, please contact the department head.',
    footer_apt_guidance: 'Carry this digital receipt for entry.',
    err_no_record_guidance: 'Please double-check the number or contact support.',
    goodbye: '👋 *Thank You*\n\nThank you for contacting Collectorate Jharsuguda. We are always ready to serve you.\n\n📞 *For Support:*\n• Type "Hi" anytime for assistance\n• Type "Help" for helpdesk information\n• Type "Menu" to see all services\n\n🌐 *Website:* jharsuguda.nic.in\n📍 *Office:* Collectorate, Jharsuguda\n\n_Office Hours: 10:00 AM - 5:30 PM (Mon-Sat)_',
    err_no_record_guidance: 'Please double-check the number or contact support.'
  },
  hi: {
    welcome: '🇮🇳 *कलेक्टर कार्यालय झारसुगुड़ा - आधिकारिक डिजिटल पोर्टल*\n\nनमस्कार! कलेक्टर कार्यालय झारसुगुड़ा की आधिकारिक व्हाट्सएप सेवा में आपका स्वागत है।\n\nहम सभी नागरिकों को पारदर्शी और कुशल सेवाएं प्रदान करने के लिए प्रतिबद्ध हैं।\n\n👇 *कृपया अपनी पसंदीदा भाषा चुनें:*\n\n💡 *सुझाव:* किसी भी मामले में यदि आप पिछले मेनू पर जाना चाहते हैं, तो *back* टाइप करें',
    serviceUnavailable: '⚠️ *सेवा सूचना*\n\nअनुरोधित सेवा वर्तमान में रखरखाव के अधीन है। असुविधा के लिए हमें खेद है।\n\nकृपया बाद में प्रयास करें या हमारी आधिकारिक वेबसाइट पर जाएं।',
    mainMenu: '🏛️ *नागरिक सेवा मेनू*\n\nकलेक्टर कार्यालय झारसुगुड़ा डिजिटल हेल्पडेस्क में आपका स्वागत है।\n\n👇 *कृपया नीचे दिए गए विकल्पों में से एक सेवा चुनें:*',
    grievanceRaise: '📝 *शिकायत दर्ज करें*\n\nआप किसी भी विभाग के संबंध में औपचारिक शिकायत दर्ज कर सकते हैं।\n\nशुरू करने के लिए, कृपया मांगी गई जानकारी प्रदान करें।',
    appointmentBook: '📅 *अधिकारी नियुक्ति (Appointment)*\n\nसरकारी अधिकारियों के साथ बैठक निर्धारित करें।\n\n👇 *विभाग चुनें:*',
    rtsServices: '⚖️ *सेवा का अधिकार (RTS) पोर्टल*\n\nसेवा का अधिकार अधिनियम के तहत विभिन्न सरकारी सेवाओं तक पहुंचें।\n\n👇 *एक सेवा चुनें:*',
    trackStatus: '🔍 *आवेदन की स्थिति देखें*\n\nअपनी शिकायत या नियुक्ति की स्थिति की जाँच करें।\n\nकृपया अपना *संदर्भ संख्या* दर्ज करें (उदा., GRV... या APT...):',
    grievanceName: '👤 *नागरिक पहचान*\n\nकृपया अपना *पूरा नाम* दर्ज करें जैसा कि आधिकारिक दस्तावेजों में है:',
    grievanceCategory: '📂 *श्रेणी चुनें*\n\nअपनी समस्या के लिए उपयुक्त विभाग या श्रेणी चुनें:',
    grievanceDescription: '✍️ *शिकायत विवरण*\n\nकृपया अपनी समस्या का विस्तृत विवरण लिखें।\n\n_सुझाव: त्वरित समाधान के लिए दिनांक, स्थान और विशिष्ट विवरण शामिल करें।_',
    grievanceLocation: '📍 *स्थान विवरण*\n\nकृपया इस समस्या से संबंधित स्थान प्रदान करें।\n\n👇 *एक विकल्प चुनें:*',
    grievancePhoto: '📷 *सहायक साक्ष्य*\n\nअपने दावे के समर्थन में फोटो या दस्तावेज़ अपलोड करें (वैकल्पिक)।\n\n👇 *एक विकल्प चुनें:*',
    grievanceConfirm: '📋 *जमा करने की पुष्टि करें*\n\nकृपया अपने विवरण की जाँच करें:\n\n👤 *नाम:* {name}\n🏢 *विभाग:* {category}\n📝 *मुद्दा:* {description}\n\n👇 *क्या यह सही है?*',
    grievanceSuccess: '✅ *शिकायत सफलतापूर्वक दर्ज की गई*\n\nआपकी शिकायत हमारे सिस्टम में दर्ज कर ली गई है।\n\n🎫 *संदर्भ सं:* `{id}`\n🏢 *विभाग:* {department}\n📅 *दिनांक:* {date}\n\nआपको एसएमएस/व्हाट्सएप के माध्यम से अपडेट प्राप्त होंगे।',
    grievanceResolvedNotify: '✅ *समाधान अपडेट*\n\nआपकी शिकायत (संदर्भ: `{id}`) का समाधान कर दिया गया है।\n\n📝 *अधिकारी की टिप्पणी:* {remarks}\n\nहमारी सेवाओं को बेहतर बनाने में मदद करने के लिए धन्यवाद।',
    label_no_remarks: 'प्रोटोकॉल के अनुसार मामला बंद।',
    grievanceError: '❌ *सिस्टम त्रुटि*\n\nहम इस समय आपके अनुरोध को संसाधित नहीं कर सके। कृपया बाद में पुनः प्रयास करें।',
    voiceReceived: '🎤 *वॉयस मैसेज प्राप्त हुआ*\n\nहमें आपका वॉयस मैसेज मिला है। बेहतर सहायता के लिए, कृपया अपना संदेश टाइप करें।',
    backToMenu: '↩️ मुख्य मेनू',
    menu_grievance: '📝 शिकायत दर्ज करें',
    menu_appointment: '📅 अपॉइंटमेंट बुक करें',
    menu_track: '🔍 स्थिति ट्रैक करें',
    menu_help: 'ℹ️ सहायता और संपर्क',
    nav_track_another: '🔍 दूसरी स्थिति देखें',
    nav_main_menu: '↩️ मुख्य मेनू',
    trackStatusPortal: '🔍 *स्थिति पूछताछ*\n\nवर्तमान स्थिति की जाँच करने के लिए नीचे अपना संदर्भ संख्या दर्ज करें।',
    label_date: '📅 दिनांक',
    label_ref_no: '🎫 संदर्भ सं',
    label_department: '🏢 विभाग',
    label_category: '📂 श्रेणी',
    label_status: '📊 स्थिति',
    label_description: '📝 विवरण',
    label_purpose: '🎯 उद्देश्य',
    label_citizen: '👤 नाम',
    label_time: '⏰ समय',
    selection_department: '🏢 *विभाग चयन*\n\nसंबंधित विभाग का चयन करें:',
    btn_select_dept: 'विभाग देखें',
    btn_load_more: 'और विभाग देखें',
    err_name_invalid: '⚠️ *अमान्य नाम*\n\nकृपया एक मान्य पूरा नाम दर्ज करें (न्यूनतम 2 अक्षर)।',
    err_description_short: '⚠️ *अपर्याप्त विवरण*\n\nकृपया समस्या को समझने में हमारी सहायता के लिए अधिक विवरण (न्यूनतम 10 अक्षर) प्रदान करें।',
    err_purpose_short: '⚠️ *उद्देश्य आवश्यक*\n\nकृपया यात्रा का उद्देश्य निर्दिष्ट करें (न्यूनतम 5 अक्षर)।',
    msg_type_address: '📍 कृपया पता टाइप करें:',
    msg_upload_photo: '📷 कृपया अभी छवि/दस्तावेज़ अपलोड करें:',
    btn_skip_location: '⏭️ छोड़ें',
    btn_manual_location: '✍️ पता टाइप करें',
    btn_skip_photo: '⏭️ छोड़ें',
    btn_upload_photo: '📤 अपलोड करें',
    btn_confirm_submit: '✅ शिकायत जमा करें',
    btn_cancel: '❌ रद्द करें',
    btn_confirm_book: '✅ बुकिंग की पुष्टि करें',
    label_placeholder_dept: 'सामान्य प्रशासन',
   
    label_apt_header: '📅 *नई नियुक्ति*\n\nविभाग: *{dept}*\n\nकृपया अपना पूरा नाम दर्ज करें:',
    label_select_date: '🗓️ *दिनांक चुनें*\n\nएक सुविधाजनक तारीख चुनें:',
    label_select_time: '⏰ *समय स्लॉट चुनें*\n\nअपनी यात्रा के लिए एक समय चुनें:',

    // Department names in Hindi
    'dept_Health Department': 'स्वास्थ्य विभाग',
    'dept_Education Department': 'शिक्षा विभाग',
    'dept_Water Supply Department': 'जलापूर्ति विभाग',
    'dept_Public Works Department': 'लोक निर्माण विभाग',
    'dept_Urban Development Department': 'नगर विकास विभाग',
    'dept_Revenue Department': 'राजस्व विभाग',
    'dept_Agriculture Department': 'कृषि विभाग',
    'dept_Social Welfare Department': 'समाज कल्याण विभाग',
    'desc_Health Department': 'अस्पताल, प्राथमिक स्वास्थ्य केंद्र और चिकित्सा सेवाएं',
    'desc_Education Department': 'स्कूल, छात्रवृत्ति और शैक्षिक योजनाएं',
    'desc_Water Supply Department': 'पेयजल आपूर्ति और स्वच्छता परियोजनाएं',
    'desc_Public Works Department': 'सड़कें, पुल और सरकारी इमारतें',
    'desc_Urban Development Department': 'नगर नियोजन और नगरपालिका सेवाएं',
    'desc_Revenue Department': 'भूमि रिकॉर्ड, कर और प्रमाण पत्र',
    'desc_Agriculture Department': 'खेती योजनाएं, बीज और सब्सिडी',
    'desc_Social Welfare Department': 'पेंशन योजनाएं और विकलांगता सहायता',
    'dept_Water Supply and Sanitation Department': 'जलापूर्ति और स्वच्छता विभाग',
    'dept_Works Department': 'निर्माण कार्य विभाग',
    'dept_DRDA department': 'जिला ग्रामीण विकास एजेंसी',
    'dept_Panchayat Department': 'पंचायत विभाग',
    'dept_Women and Child Development Department': 'महिला एवं बाल विकास विभाग',
    'dept_MNREGA Department': 'मनरेगा विभाग',
    'dept_Finance Department': 'वित्त विभाग',
    'dept_Rural Water Supply Department': 'ग्रामीण जलापूर्ति विभाग',
    'dept_Water Conservation Department': 'जल संरक्षण विभाग',
    'dept_Animal Husbandry Department': 'पशुपालन विभाग',
    'dept_IT Cell': 'आईटी प्रकोष्ठ',
    'desc_Water Supply and Sanitation Department': 'जलापूर्ति और स्वच्छता सेवाएं',
    'desc_Works Department': 'निर्माण और रखरखाव कार्य',
    'desc_DRDA department': 'ग्रामीण विकास कार्यक्रम',
    'desc_Panchayat Department': 'पंचायत प्रशासन और विकास',
    'desc_Women and Child Development Department': 'महिला और बाल कल्याण योजनाएं',
    'desc_MNREGA Department': 'रोजगार गारंटी योजना',
    'desc_Finance Department': 'वित्तीय प्रबंधन और लेखा',
    'desc_Rural Water Supply Department': 'ग्रामीण क्षेत्रों में जलापूर्ति',
    'desc_Water Conservation Department': 'जल संरक्षण और प्रबंधन',
    'desc_Animal Husbandry Department': 'पशुपालन और डेयरी विकास',
    'desc_IT Cell': 'सूचना प्रौद्योगिकी सेवाएं',
    goodbye: '👋 *धन्यवाद*\n\nकलेक्टर कार्यालय झारसुगुड़ा से संपर्क करने के लिए धन्यवाद। हम आपकी सेवा में हमेशा तत्पर हैं।\n\n📞 *सहायता के लिए:*\n• कभी भी "Hi" टाइप करें\n• "Help" टाइप करें हेल्पडेस्क जानकारी के लिए\n• "Menu" टाइप करें सभी सेवाएं देखने के लिए\n\n🌐 *वेबसाइट:* jharsuguda.nic.in\n📍 *कार्यालय:* कलेक्टर कार्यालय, झारसुगुड़ा\n\n_कार्यालय समय: सुबह 10:00 - शाम 5:30 (सोम-शनि)_',
    appointmentConfirm: '📋 *नियुक्ति की पुष्टि करें*\n\nकृपया अपने बुकिंग विवरण की पुष्टि करें:',
    err_no_record_found: '❌ *कोई रिकॉर्ड नहीं मिला*\n\nहमें उस संदर्भ संख्या से मेल खाने वाला कोई रिकॉर्ड नहीं मिला।',
    grievanceCancel: '🚫 *रद्द किया गया*\n\nशिकायत पंजीकरण रद्द कर दिया गया है।',
    aptCancel: '🚫 *रद्द किया गया*\n\nनियुक्ति बुकिंग रद्द कर दी गई है।',
    aptSuccess: '✅ *नियुक्ति की पुष्टि हुई*\n\nआपकी बैठक निर्धारित कर दी गई है।\n\n🎫 *संदर्भ सं:* `{id}`\n🏢 *विभाग:* {dept}\n📅 *दिनांक:* {date}\n⏰ *समय:* {time}\n\nकृपया मान्य आईडी के साथ 15 मिनट पहले पहुंचें।',
    aptError: '❌ *बुकिंग विफल*\n\nकृपया बाद में पुनः प्रयास करें।',
    nextActionPrompt: '🔄 *अगला कदम*\n\nआप क्या करना चाहेंगे?',
    msg_apt_enhanced: 'ℹ️ नियुक्ति प्रणाली को अपग्रेड किया जा रहा है।',
    msg_no_dept: '⚠️ कोई भी विभाग वर्तमान में नियुक्तियाँ स्वीकार नहीं कर रहा है।',
    msg_no_dept_grv: '⚠️ *कोई विभाग उपलब्ध नहीं*\n\nवर्तमान में, शिकायत पंजीकरण के लिए कोई विभाग कॉन्फ़िगर नहीं है।\n\nकृपया प्रशासन से संपर्क करें या बाद में पुनः प्रयास करें।',
    header_grv_status: '📄 शिकायत स्थिति',
    header_apt_status: '🗓️ नियुक्ति स्थिति',
    status_PENDING: 'समीक्षा लंबित',
    status_ASSIGNED: 'अधिकारी को सौंपा गया',
    status_RESOLVED: 'हल किया गया',
    status_SCHEDULED: 'निर्धारित',
    status_CANCELLED: 'रद्द',
    status_COMPLETED: 'पूर्ण',
    footer_grv_guidance: 'मामले को आगे बढ़ाने के लिए, कृपया विभागाध्यक्ष से संपर्क करें।',
    footer_apt_guidance: 'प्रवेश के लिए यह डिजिटल रसीद साथ रखें।',
    err_no_record_guidance: 'कृपया संख्या की दोबारा जाँच करें या सहायता से संपर्क करें।',
    help: 'ℹ️ *हेल्पडेस्क और समर्थन*\n\nअधिक सहायता के लिए:\n📞 *हेल्पलाइन:* 06645-270007\n🌐 *वेबसाइट:* jharsuguda.nic.in\n📍 *कार्यालय:* कलेक्टर कार्यालय, झारसुगुड़ा\n\n_कार्यालय समय: सुबह 10:00 - शाम 5:30 (सोम-शनि)_',
    invalidOption: '⚠️ *अमान्य इनपुट*\n\nकृपया दिए गए बटनों में से एक वैध विकल्प चुनें।',
    sessionExpired: '⏳ *सत्र समाप्त*\n\nआपका सत्र समाप्त हो गया है। कृपया फिर से शुरू करने के लिए "Hi" टाइप करें।'
  },
  mr: {
    welcome: '🇮🇳 *कलेक्टर कार्यालय झारसुगुड़ा - अधिकृत डिजिटल पोर्टल*\n\nनमस्कार! कलेक्टर कार्यालय झारसुगुड़ाच्या अधिकृत व्हॉट्सॲप सेवेमध्ये आपले स्वागत आहे.\n\nआम्ही सर्व नागरिकांना पारदर्शक आणि कार्यक्षम सेवा देण्यासाठी कटिबद्ध आहोत.\n\n👇 *कृपया आपली पसंतीची भाषा निवडा:*\n\n💡 *टीप:* कोणत्याही बाबतीत जर तुम्हाला मागील मेनूवर जायचे असेल, तर *back* टाइप करा',
    serviceUnavailable: '⚠️ *सेवा सूचना*\n\nविनंती केलेली सेवा सध्या देखभालीखाली आहे. गैरसोयीबद्दल क्षमस्व.\n\nकृपया नंतर प्रयत्न करा किंवा आमच्या अधिकृत वेबसाइटला भेट द्या.',
    mainMenu: '🏛️ *नागरिक सेवा मेनू*\n\nकलेक्टर कार्यालय झारसुगुड़ा डिजिटल हेल्पडेस्कमध्ये आपले स्वागत आहे.\n\n👇 *कृपया खालील पर्यायांमधून सेवा निवडा:*',
    grievanceRaise: '📝 *तक्रार नोंदवा*\n\nआपण कोणत्याही विभागाशी संबंधित अधिकृत तक्रार नोंदवू शकता.\n\nसुरू करण्यासाठी, कृपया विचारलेली माहिती द्या.',
    appointmentBook: '📅 *अधिकारी भेट (Appointment)*\n\nसरकारी अधिकाऱ्यांशी भेट निश्चित करा.\n\n👇 *विभाग निवडा:*',
    rtsServices: '⚖️ *सेवेचा अधिकार (RTS) पोर्टल*\n\nसेवेचा अधिकार कायद्याखाली विविध सरकारी सेवांमध्ये प्रवेश करा.\n\n👇 *एक सेवा निवडा:*',
    trackStatus: '🔍 *अर्जाची स्थिती तपासा*\n\nतुमच्या तक्रारीची किंवा भेटीची स्थिती तपासा.\n\nकृपया तुमचा *संदर्भ क्रमांक* प्रविष्ट करा (उदा., GRV... किंवा APT...):',
    grievanceName: '👤 *नागरिकाची ओळख*\n\nकृपया अधिकृत कागदपत्रांवर असल्याप्रमाणे तुमचे *पूर्ण नाव* प्रविष्ट करा:',
    grievanceCategory: '📂 *श्रेणी निवडा*\n\nतुमच्या समस्येसाठी योग्य विभाग किंवा श्रेणी निवडा:',
    grievanceDescription: '✍️ *तक्रार तपशील*\n\nकृपया तुमच्या समस्येचे सविस्तर वर्णन करा.\n\n_टीप: जलद निराकरणासाठी दिनांक, ठिकाण आणि विशिष्ट तपशील समाविष्ट करा._',
    grievanceLocation: '📍 *स्थान तपशील*\n\nकृपया या समस्येशी संबंधित स्थान द्या.\n\n👇 *एक पर्याय निवडा:*',
    grievancePhoto: '📷 *पुरावा दस्तऐवज*\n\nतुमच्या दाव्याच्या समर्थनार्थ फोटो किंवा दस्तऐवज अपलोड करा (वैकल्पिक).\n\n👇 *एक पर्याय निवडा:*',
    grievanceConfirm: '📋 *सबमिशनची पुष्टी करा*\n\nकृपया तुमचे तपशील तपासा:\n\n👤 *नाव:* {name}\n🏢 *विभाग:* {category}\n📝 *समस्या:* {description}\n\n👇 *हे बरोबर आहे का?*',
    grievanceSuccess: '✅ *तक्रार यशस्वीरित्या नोंदवली गेली*\n\nतुमची तक्रार आमच्या सिस्टममध्ये लॉग केली गेली आहे.\n\n🎫 *संदर्भ क्र:* `{id}`\n🏢 *विभाग:* {department}\n📅 *दिनांक:* {date}\n\nतुम्हाला व्हॉट्सॲपद्वारे अपडेट्स मिळतील.',
    grievanceResolvedNotify: '✅ *निराकरण अपडेट*\n\nतुमच्या तक्रारीचे (संदर्भ: `{id}`) निराकरण झाले आहे.\n\n📝 *अधिकारी शेरा:* {remarks}\n\nआमच्या सेवा सुधारण्यास मदत केल्याबद्दल धन्यवाद.',
    label_no_remarks: 'प्रोटोकॉलनुसार प्रकरण बंद.',
    grievanceError: '❌ *सिस्टम त्रुटी*\n\nआम्ही यावेळी तुमच्या विनंतीवर प्रक्रिया करू शकलो नाही. कृपया नंतर पुन्हा प्रयत्न करा.',
    voiceReceived: '🎤 *व्हॉइस मेसेज प्राप्त झाला*\n\nआम्हाला तुमचा व्हॉइस मेसेज मिळाला आहे. चांगल्या मदतीसाठी, कृपया तुमचा संदेश टाइप करा.',
    backToMenu: '↩️ मुख्य मेनू',
    menu_grievance: '📝 तक्रार नोंदवा',
    menu_appointment: '📅 अपॉइंटमेंट बुक करा',
    menu_track: '🔍 स्थिती ट्रॅक करा',
    menu_help: 'ℹ️ मदत आणि संपर्क',
    nav_track_another: '🔍 दुसरी स्थिती पहा',
    nav_main_menu: '↩️ मुख्य मेनू',
    trackStatusPortal: '🔍 *स्थिती चौकशी*\n\nसध्याची स्थिती तपासण्यासाठी खाली आपला संदर्भ क्रमांक प्रविष्ट करा.',
    label_date: '📅 दिनांक',
    label_ref_no: '🎫 संदर्भ क्र',
    label_department: '🏢 विभाग',
    label_category: '📂 श्रेणी',
    label_status: '📊 स्थिती',
    label_description: '📝 तपशील',
    label_purpose: '🎯 उद्देश',
    label_citizen: '👤 नाव',
    label_time: '⏰ वेळ',
    selection_department: '🏢 *विभाग निवड*\n\nसंबंधित विभाग निवडा:',
    btn_select_dept: 'विभाग पहा',
    btn_load_more: 'अधिक विभाग पहा',
    err_name_invalid: '⚠️ *अवैध नाव*\n\nकृपया वैध पूर्ण नाव प्रविष्ट करा (किमान २ अक्षरे).',
    err_description_short: '⚠️ *अपुरा तपशील*\n\nकृपया समस्या समजून घेण्यात आम्हाला मदत करण्यासाठी अधिक तपशील (किमान १० अक्षरे) द्या.',
    err_purpose_short: '⚠️ *उद्देश आवश्यक*\n\nकृपया भेटीचा उद्देश नमूद करा (किमान ५ अक्षरे).',
    msg_type_address: '📍 कृपया पत्ता टाइप करा:',
    msg_upload_photo: '📷 कृपया आता प्रतिमा/दस्तऐवज अपलोड करा:',
    btn_skip_location: '⏭️ वगळा',
    btn_manual_location: '✍️ पत्ता टाइप करा',
    btn_skip_photo: '⏭️ वगळा',
    btn_upload_photo: '📤 अपलोड करा',
    btn_confirm_submit: '✅ तक्रार जमा करा',
    btn_cancel: '❌ रद्द करा',
    btn_confirm_book: '✅ बुकिंगची पुष्टी करा',
    label_placeholder_dept: 'सामान्य प्रशासन',
   
    label_apt_header: '📅 *नवीन अपॉइंटमेंट*\n\nविभाग: *{dept}*\n\nकृपया तुमचे पूर्ण नाव प्रविष्ट करा:',
    label_select_date: '🗓️ *दिनांक निवडा*\n\nसोयीस्कर तारीख निवडा:',
    label_select_time: '⏰ *वेळ स्लॉट निवडा*\n\nतुमच्या भेटीसाठी वेळ निवडा:',
    // Department names in Marathi
    'dept_Health Department': 'आरोग्य विभाग',
    'dept_Education Department': 'शिक्षण विभाग',
    'dept_Water Supply Department': 'पाणी पुरवठा विभाग',
    'dept_Public Works Department': 'सार्वजनिक बांधकाम विभाग',
    'dept_Urban Development Department': 'नगर विकास विभाग',
    'dept_Revenue Department': 'महसूल विभाग',
    'dept_Agriculture Department': 'कृषी विभाग',
    'dept_Social Welfare Department': 'समाज कल्याण विभाग',
    'desc_Health Department': 'रुग्णालये, प्राथमिक आरोग्य केंद्रे आणि वैद्यकीय सेवा',
    'desc_Education Department': 'शाळा, शिष्यवृत्ती आणि शैक्षणिक योजना',
    'desc_Water Supply Department': 'पिण्याचे पाणी पुरवठा आणि स्वच्छता प्रकल्प',
    'desc_Public Works Department': 'रस्ते, पूल आणि सरकारी इमारती',
    'desc_Urban Development Department': 'नगर नियोजन आणि नगरपालिका सेवा',
    'desc_Revenue Department': 'जमीन रेकॉर्ड, कर आणि प्रमाणपत्रे',
    'desc_Agriculture Department': 'शेती योजना, बियाणे आणि सबसिडी',
    'desc_Social Welfare Department': 'पेन्शन योजना आणि अपंगत्व सहाय्य',
    'dept_Water Supply and Sanitation Department': 'पाणी पुरवठा आणि स्वच्छता विभाग',
    'dept_Works Department': 'बांधकाम विभाग',
    'dept_DRDA department': 'जिल्हा ग्रामीण विकास संस्था',
    'dept_Panchayat Department': 'पंचायत विभाग',
    'dept_Women and Child Development Department': 'महिला आणि बाल विकास विभाग',
    'dept_MNREGA Department': 'मनरेगा विभाग',
    'dept_Finance Department': 'वित्त विभाग',
    'dept_Rural Water Supply Department': 'ग्रामीण पाणी पुरवठा विभाग',
    'dept_Water Conservation Department': 'जल संधारण विभाग',
    'dept_Animal Husbandry Department': 'पशुसंवर्धन विभाग',
    'dept_IT Cell': 'आयटी प्रकोष्ठ',
    'desc_Water Supply and Sanitation Department': 'पाणी पुरवठा आणि स्वच्छता सेवा',
    'desc_Works Department': 'बांधकाम आणि देखभाल कामे',
    'desc_DRDA department': 'ग्रामीण विकास कार्यक्रम',
    'desc_Panchayat Department': 'पंचायत प्रशासन आणि विकास',
    'desc_Women and Child Development Department': 'महिला आणि बाल कल्याण योजना',
    'desc_MNREGA Department': 'रोजगार हमी योजना',
    'desc_Finance Department': 'आर्थिक व्यवस्थापन आणि लेखा',
    'desc_Rural Water Supply Department': 'ग्रामीण भागात पाणी पुरवठा',
    'desc_Water Conservation Department': 'जल संधारण आणि व्यवस्थापन',
    'desc_Animal Husbandry Department': 'पशुपालन आणि दुग्धव्यवसाय विकास',
    'desc_IT Cell': 'माहिती तंत्रज्ञान सेवा',
    goodbye: '👋 *धन्यवाद*\n\nकलेक्टर कार्यालय झारसुगुड़ाशी संपर्क साधल्याबद्दल धन्यवाद. आम्ही नेहमी तुमच्या सेवेसाठी तत्पर आहोत.\n\n📞 *मदतीसाठी:*\n• कधीही "Hi" टाइप करा\n• "Help" टाइप करा हेल्पडेस्क माहितीसाठी\n• "Menu" टाइप करा सर्व सेवा पाहण्यासाठी\n\n🌐 *वेबसाइट:* jharsuguda.nic.in\n📍 *कार्यालय:* कलेक्टर कार्यालय, झारसुगुड़ा\n\n_कार्यालय वेळ: सकाळी १०:०० - संध्याकाळी ५:३० (सोम-शनि)_',
    appointmentConfirm: '📋 *अपॉइंटमेंटची पुष्टी करा*\n\nकृपया तुमच्या बुकिंग तपशीलाची पुष्टी करा:',
    err_no_record_found: '❌ *कोणताही रेकॉर्ड सापडला नाही*\n\nआम्हाला त्या संदर्भ क्रमांकाशी जुळणारा कोणताही रेकॉर्ड सापडला नाही.',
    grievanceCancel: '🚫 *रद्द केले*\n\nतक्रार नोंदणी रद्द केली आहे.',
    aptCancel: '🚫 *रद्द केले*\n\nअपॉइंटमेंट बुकिंग रद्द केली आहे.',
    aptSuccess: '✅ *अपॉइंटमेंट पुष्टी झाली*\n\nतुमची बैठक निश्चित केली आहे.\n\n🎫 *संदर्भ क्र:* `{id}`\n🏢 *विभाग:* {dept}\n📅 *दिनांक:* {date}\n⏰ *वेळ:* {time}\n\nकृपया वैध आयडीसह १५ मिनिटे लवकर पोहोचा.',
    aptError: '❌ *बुकिंग अयशस्वी*\n\nकृपया नंतर पुन्हा प्रयत्न करा.',
    nextActionPrompt: '🔄 *पुढील स्टेप*\n\nतुम्ही काय करू इच्छिता?',
    msg_apt_enhanced: 'ℹ️ अपॉइंटमेंट सिस्टम अपग्रेड केली जात आहे.',
    msg_no_dept: '⚠️ सध्या कोणताही विभाग अपॉइंटमेंट स्वीकारत नाही.',
    msg_no_dept_grv: '⚠️ *कोणतेही विभाग उपलब्ध नाहीत*\n\nसध्या, तक्रार नोंदणीसाठी कोणतेही विभाग कॉन्फ़िगर केलेले नाहीत.\n\nकृपया प्रशासनाशी संपर्क साधा किंवा नंतर पुन्हा प्रयत्न करा.',
    header_grv_status: '📄 तक्रार स्थिती',
    header_apt_status: '🗓️ अपॉइंटमेंट स्थिती',
    status_PENDING: 'पुनरावलोकन प्रलंबित',
    status_ASSIGNED: 'अधिकाऱ्याकडे सोपवले',
    status_RESOLVED: 'निराकरण झाले',
    status_SCHEDULED: 'शेड्युल केले',
    status_CANCELLED: 'रद्द',
    status_COMPLETED: 'पूर्ण',
    footer_grv_guidance: 'प्रकरण पुढे नेण्यासाठी, कृपया विभाग प्रमुखांशी संपर्क साधा.',
    footer_apt_guidance: 'प्रवेशासाठी ही डिजिटल पावती सोबत ठेवा.',
    err_no_record_guidance: 'कृपया नंबर पुन्हा तपासा किंवा मदतीसाठी संपर्क साधा.',
    help: 'ℹ️ *हेल्पडेस्क आणि समर्थन*\n\nअधिक मदतीसाठी:\n📞 *हेल्पलाईन:* 06645-270007\n🌐 *वेबसाइट:* jharsuguda.nic.in\n📍 *कार्यालय:* कलेक्टर कार्यालय, झारसुगुड़ा\n\n_कार्यालय वेळ: सकाळी १०:०० - संध्याकाळी ५:३୦ (सोम-शनि)_',
    invalidOption: '⚠️ *अवैध इनपुट*\n\nकृपया दिलेल्या बटणांमधून वैध पर्याय निवडा.',
    sessionExpired: '⏳ *सत्र समाप्त*\n\nतुमचे सत्र समाप्त झाले आहे. कृपया पुन्हा सुरू करण्यासाठी "Hi" टाइप करा.'
  },
  or: {
    welcome: '🇮🇳 *ଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାର - ଅଧିକାରିକ ଡିଜିଟାଲ ପୋର୍ଟାଲ*\n\nନମସ୍କାର! ଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାରର ଅଧିକାରିକ ୱହାଟସଆପ ସେବାରେ ସ୍ୱାଗତ।\n\nଆମେ ସମସ୍ତ ନାଗରିକଙ୍କୁ ସ୍ୱଚ୍ଛ ଏବଂ କାର୍ଯ୍ୟକ୍ଷମ ସେବା ପ୍ରଦାନ କରିବାକୁ ପ୍ରତିବଦ୍ଧ।\n\n👇 *ଦୟାକରି ଆପଣଙ୍କର ପସନ୍ଦିତ ଭାଷା ବାଛନ୍ତୁ:*',
    serviceUnavailable: '⚠️ *ସେବା ସୂଚନା*\n\nଅନୁରୋଧିତ ସେବା ବର୍ତ୍ତମାନ ରଖରଖାବିରେ ଅଛି। ଅସୁବିଧା ପାଇଁ ଆମେ କ୍ଷମା ପ୍ରାର୍ଥନା କରୁଛୁ।\n\nଦୟାକରି ପରେ ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ କିମ୍ବା ଆମର ଅଧିକାରିକ ୱେବସାଇଟ୍ ପରିଦର୍ଶନ କରନ୍ତୁ।',
    mainMenu: '🏛️ *ନାଗରିକ ସେବା ମେନୁ*\n\nଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାର ଡିଜିଟାଲ ସାହାଯ୍ୟକେନ୍ଦ୍ରରେ ସ୍ୱାଗତ।\n\n👇 *ଦୟାକରି ନିମ୍ନଲିଖିତ ବିକଳ୍ପଗୁଡ଼ିକରୁ ଏକ ସେବା ବାଛନ୍ତୁ:*',
    grievanceRaise: '📝 *ଅଭିଯୋଗ ଦାଖଲ କରନ୍ତୁ*\n\nଆପଣ ଯେକୌଣସି ବିଭାଗ ସମ୍ବନ୍ଧରେ ଏକ ଆନୁଷ୍ଠାନିକ ଅଭିଯୋଗ ଦାଖଲ କରିପାରିବେ।\n\nଆରମ୍ଭ କରିବାକୁ, ଦୟାକରି ଅନୁରୋଧିତ ବିବରଣୀ ପ୍ରଦାନ କରନ୍ତୁ।',
    appointmentBook: '📅 *ଏକ ଆନୁଷ୍ଠାନିକ ନିଯୁକ୍ତି ବୁକ୍ କରନ୍ତୁ*\n\nମୁଖ୍ୟ କାର୍ଯ୍ୟନିର୍ବାହୀ ଅଧିକାରୀ (CEO), ଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାର ସହିତ ଏକ ସଭା ନିର୍ଦ୍ଧାରଣ କରନ୍ତୁ।\n\nଦୟାକରି ଆପଣଙ୍କର ନିଯୁକ୍ତି ଅନୁରୋଧ ପାଇଁ ଆବଶ୍ୟକ ବିବରଣୀ ପ୍ରଦାନ କରନ୍ତୁ।',
    appointmentBookCEO: '📅 *ନୂତନ ନିଯୁକ୍ତି ଅନୁରୋଧ*\n\nଦୟାକରି ଆପଣଙ୍କର ସମ୍ପୂର୍ଣ୍ଣ ନାମ ପ୍ରବେଶ କରନ୍ତୁ (ଆନୁଷ୍ଠାନିକ ରେକର୍ଡ ଅନୁଯାୟୀ):',
    rtsServices: '⚖️ *ସେବାର ଅଧିକାର (RTS) ପୋର୍ଟାଲ*\n\nସେବାର ଅଧିକାର ଅଧିନିୟମ ଅଧୀନରେ ବିଭିନ୍ନ ସରକାରୀ ସେବା ପ୍ରବେଶ କରନ୍ତୁ।\n\n👇 *ଏକ ସେବା ବାଛନ୍ତୁ:*',
    trackStatus: '🔍 *ଆବେଦନ ସ୍ଥିତି ଟ୍ରାକ୍ କରନ୍ତୁ*\n\nଆପଣଙ୍କର ଅଭିଯୋଗ କିମ୍ବା ନିଯୁକ୍ତିର ସ୍ଥିତି ଯାଞ୍ଚ କରନ୍ତୁ।\n\nଦୟାକରି ଆପଣଙ୍କର *ରେଫରେନ୍ସ ନମ୍ବର* ପ୍ରବେଶ କରନ୍ତୁ (ଉଦାହରଣ, GRV... କିମ୍ବା APT...):',
    grievanceName: '👤 *ନାଗରିକ ପରିଚୟ*\n\nଦୟାକରି ଆପଣଙ୍କର *ସମ୍ପୂର୍ଣ୍ଣ ନାମ* ପ୍ରବେଶ କରନ୍ତୁ ଯେପରି ଆନୁଷ୍ଠାନିକ ଦସ୍ତାବିଜରେ ଦେଖାଯାଏ:',
    grievanceCategory: '📂 *ବର୍ଗ ବାଛନ୍ତୁ*\n\nଆପଣଙ୍କର ସମସ୍ୟା ପାଇଁ ଉପଯୁକ୍ତ ବିଭାଗ କିମ୍ବା ବର୍ଗ ବାଛନ୍ତୁ:',
    grievanceDescription: '✍️ *ଅଭିଯୋଗ ବିବରଣୀ*\n\nଦୟାକରି ଆପଣଙ୍କର ସମସ୍ୟାର ବିସ୍ତୃତ ବିବରଣୀ ଟାଇପ୍ କରନ୍ତୁ।\n\n_ଟିପ୍: ଶୀଘ୍ର ସମାଧାନ ପାଇଁ ତାରିଖ, ସ୍ଥାନ, ଏବଂ ନିର୍ଦ୍ଦିଷ୍ଟ ବିବରଣୀ ଅନ୍ତର୍ଭୁକ୍ତ କରନ୍ତୁ।_',
    grievancePhoto: '📷 *ସହାୟକ ପ୍ରମାଣ*\n\nଆପଣଙ୍କର ଦାବିର ସମର୍ଥନରେ ଏକ ଫଟୋ କିମ୍ବା ଦସ୍ତାବିଜ୍ ଅପଲୋଡ୍ କରନ୍ତୁ (ବିକଳ୍ପ)।\n\n👇 *ଏକ ବିକଳ୍ପ ବାଛନ୍ତୁ:*',
    grievanceConfirm: '📋 *ଦାଖଲ ନିଶ୍ଚିତ କରନ୍ତୁ*\n\nଦୟାକରି ଆପଣଙ୍କର ବିବରଣୀ ଯାଞ୍ଚ କରନ୍ତୁ:\n\n👤 *ନାମ:* {name}\n🏢 *ବିଭାଗ:* {category}\n📝 *ସମସ୍ୟା:* {description}\n\n👇 *ଏହା ସଠିକ୍ କି?*',
    grievanceSuccess: '✅ *ଅଭିଯୋଗ ସଫଳତାପୂର୍ବକ ରେଜିଷ୍ଟର ହେଲା*\n\nଆପଣଙ୍କର ଅଭିଯୋଗ ଆମର ସିଷ୍ଟମରେ ଲଗ୍ ହୋଇଛି।\n\n🎫 *ରେଫ୍ ନମ୍ବର:* `{id}`\n🏢 *ବିଭାଗ:* {department}\n📅 *ତାରିଖ:* {date}\n\nଆପଣଙ୍କୁ ୱହାଟସଆପ ମାଧ୍ୟମରେ ଅପଡେଟ୍ ମିଳିବ।',
    grievanceError: '❌ *ସିଷ୍ଟମ୍ ତ୍ରୁଟି*\n\nଆମେ ବର୍ତ୍ତମାନ ଆପଣଙ୍କର ଅନୁରୋଧକୁ ପ୍ରକ୍ରିୟାକରଣ କରିପାରିଲୁ ନାହିଁ। ଦୟାକରି ପରେ ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ।',
    backToMenu: '↩️ ମୁଖ୍ୟ ମେନୁ',
    help: 'ℹ️ *ସାହାଯ୍ୟକେନ୍ଦ୍ର ଏବଂ ସମର୍ଥନ*\n\nଅଧିକ ସାହାଯ୍ୟ ପାଇଁ:\n📞 *ହେଲ୍ପଲାଇନ୍:* 1800-123-4567\n🌐 *ୱେବସାଇଟ୍:* jharsuguda.gov.in\n📍 *କାର୍ଯ୍ୟାଳୟ:* ଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାର, ଝାରସୁଗୁଡା\n\n_କାର୍ଯ୍ୟାଳୟ ସମୟ: ସକାଳ 10:00 - ସନ୍ଧ୍ୟା 6:00 (ସୋମ-ଶନି)_',
    invalidOption: '⚠️ *ଅବୈଧ ଇନପୁଟ୍*\n\nଦୟାକରି ପ୍ରଦାନ କରାଯାଇଥିବା ବଟନ୍ ମଧ୍ୟରୁ ଏକ ବୈଧ ବିକଳ୍ପ ବାଛନ୍ତୁ।',
    sessionExpired: '⏳ *ସେସନ୍ ସମୟ ସମାପ୍ତ*\n\nଆପଣଙ୍କର ସେସନ୍ ସମାପ୍ତ ହୋଇଛି। ଦୟାକରି ପୁନର୍ବାର ଆରମ୍ଭ କରିବାକୁ "Hi" ଟାଇପ୍ କରନ୍ତୁ।',
    menu_grievance: '📝 ଅଭିଯୋଗ ଦାଖଲ କରନ୍ତୁ',
    menu_appointment: '📅 ନିଯୁକ୍ତି ବୁକ୍ କରନ୍ତୁ',
    menu_rts: '⚖️ RTS ସେବା',
    menu_track: '🔍 ସ୍ଥିତି ଟ୍ରାକ୍ କରନ୍ତୁ',
    menu_help: 'ℹ️ ସାହାଯ୍ୟ ଏବଂ ଯୋଗାଯୋଗ',
    nav_track_another: '🔍 ଅନ୍ୟଟି ଟ୍ରାକ୍ କରନ୍ତୁ',
    nav_main_menu: '↩️ ମୁଖ୍ୟ ମେନୁ',
    trackStatusPortal: '🔍 *ସ୍ଥିତି ପ୍ରଶ୍ନ*\n\nବର୍ତ୍ତମାନର ସ୍ଥିତି ଯାଞ୍ଚ କରିବାକୁ ନିମ୍ନରେ ଆପଣଙ୍କର ରେଫରେନ୍ସ୍ ନମ୍ବର୍ ପ୍ରବେଶ କରନ୍ତୁ।',
    label_date: '📅 ତାରିଖ',
    label_ref_no: '🎫 ରେଫ୍ ନମ୍ବର',
    label_department: '🏢 ବିଭାଗ',
    label_category: '📂 ବର୍ଗ',
    label_status: '📊 ସ୍ଥିତି',
    label_description: '📝 ବିବରଣୀ',
    label_purpose: '🎯 ଉଦ୍ଦେଶ୍ୟ',
    label_citizen: '👤 ନାମ',
    label_time: '⏰ ସମୟ',
    selection_department: '🏢 *ବିଭାଗ ବାଛନ୍ତୁ*\n\nସମ୍ବନ୍ଧିତ ବିଭାଗ ବାଛନ୍ତୁ:',
    btn_select_dept: 'ବିଭାଗ ଦେଖନ୍ତୁ',
    btn_load_more: 'ଅଧିକ ବିଭାଗ ଦେଖନ୍ତୁ',
    err_name_invalid: '⚠️ *ଅବୈଧ ନାମ*\n\nଦୟାକରି ଏକ ବୈଧ ସମ୍ପୂର୍ଣ୍ଣ ନାମ ପ୍ରବେଶ କରନ୍ତୁ (ନ୍ୟୂନତମ 2 ଅକ୍ଷର)।',
    err_description_short: '⚠️ *ଅପର୍ଯ୍ୟାପ୍ତ ବିବରଣୀ*\n\nଦୟାକରି ସମସ୍ୟା ବୁଝିବାରେ ସାହାଯ୍ୟ କରିବାକୁ ଅଧିକ ବିବରଣୀ (ନ୍ୟୂନତମ 10 ଅକ୍ଷର) ପ୍ରଦାନ କରନ୍ତୁ।',
    err_purpose_short: '⚠️ *ଉଦ୍ଦେଶ୍ୟ ଆବଶ୍ୟକ*\n\nଦୟାକରି ଭ୍ରମଣର ଉଦ୍ଦେଶ୍ୟ ନିର୍ଦ୍ଦିଷ୍ଟ କରନ୍ତୁ (ନ୍ୟୂନତମ 5 ଅକ୍ଷର)।',
    msg_type_address: '📍 ଦୟାକରି ଠିକଣା ଟାଇପ୍ କରନ୍ତୁ:',
    msg_upload_photo: '📷 ଦୟାକରି ବର୍ତ୍ତମାନ ଛବି/ଦସ୍ତାବିଜ୍ ଅପଲୋଡ୍ କରନ୍ତୁ:',
    btn_skip_location: '⏭️ ଛାଡ଼ନ୍ତୁ',
    btn_manual_location: '✍️ ଠିକଣା ଟାଇପ୍ କରନ୍ତୁ',
    btn_skip_photo: '⏭️ ଛାଡ଼ନ୍ତୁ',
    btn_upload_photo: '📤 ଅପଲୋଡ୍ କରନ୍ତୁ',
    btn_confirm_submit: '✅ ଅଭିଯୋଗ ଦାଖଲ କରନ୍ତୁ',
    btn_cancel: '❌ ବାତିଲ୍ କରନ୍ତୁ',
    btn_confirm_book: '✅ ବୁକିଂ ନିଶ୍ଚିତ କରନ୍ତୁ',
    label_placeholder_dept: 'ସାଧାରଣ ପ୍ରଶାସନ',
    label_apt_header: '📅 *ନୂତନ ନିଯୁକ୍ତି ଅନୁରୋଧ*\n\nଦୟାକରି ଆପଣଙ୍କର ସମ୍ପୂର୍ଣ୍ଣ ନାମ ପ୍ରବେଶ କରନ୍ତୁ:',
    label_select_date: '🗓️ *ତାରିଖ ବାଛନ୍ତୁ*\n\nଏକ ସୁବିଧାଜନକ ତାରିଖ ବାଛନ୍ତୁ:',
    label_select_time: '⏰ *ସମୟ ସ୍ଲଟ୍ ବାଛନ୍ତୁ*\n\nଆପଣଙ୍କର ଭ୍ରମଣ ପାଇଁ ଏକ ସମୟ ବାଛନ୍ତୁ:',
    goodbye: '👋 *ଧନ୍ୟବାଦ*\n\nଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାର ସହିତ ଯୋଗାଯୋଗ କରିବା ପାଇଁ ଧନ୍ୟବାଦ। ଆମେ ସର୍ବଦା ଆପଣଙ୍କର ସେବା ପାଇଁ ପ୍ରସ୍ତୁତ।\n\n📞 *ସାହାଯ୍ୟ ପାଇଁ:*\n• ଯେକୌଣସି ସମୟରେ "Hi" ଟାଇପ୍ କରନ୍ତୁ\n• "Help" ଟାଇପ୍ କରନ୍ତୁ ସାହାଯ୍ୟକେନ୍ଦ୍ର ସୂଚନା ପାଇଁ\n• "Menu" ଟାଇପ୍ କରନ୍ତୁ ସମସ୍ତ ସେବା ଦେଖିବାକୁ\n\n🌐 *ୱେବସାଇଟ୍:* jharsuguda.gov.in\n📍 *କାର୍ଯ୍ୟାଳୟ:* ଝାରସୁଗୁଡା ଓଡ଼ିଶା ସରକାର, ଝାରସୁଗୁଡା\n\n_କାର୍ଯ୍ୟାଳୟ ସମୟ: ସକାଳ 10:00 - ସନ୍ଧ୍ୟା 6:00 (ସୋମ-ଶନି)_',
    appointmentConfirm: '📋 *ନିଯୁକ୍ତି ଯାଞ୍ଚ କରନ୍ତୁ*\n\nଦୟାକରି ଆପଣଙ୍କର ବୁକିଂ ବିବରଣୀ ନିଶ୍ଚିତ କରନ୍ତୁ:',
    err_no_record_found: '❌ *କୌଣସି ରେକର୍ଡ୍ ମିଳିଲା ନାହିଁ*\n\nଆମେ ସେହି ରେଫରେନ୍ସ୍ ନମ୍ବର୍ ସହିତ ମେଳ ଖାଉଥିବା କୌଣସି ରେକର୍ଡ୍ ପାଇଲୁ ନାହିଁ।',
    grievanceCancel: '🚫 *ବାତିଲ୍*\n\nଅଭିଯୋଗ ରେଜିଷ୍ଟ୍ରେସନ୍ ବାତିଲ୍ ହୋଇଛି।',
    aptCancel: '🚫 *ବାତିଲ୍*\n\nନିଯୁକ୍ତି ବୁକିଂ ବାତିଲ୍ ହୋଇଛି।',
    aptSuccess: '✅ *ନିଯୁକ୍ତି ନିଶ୍ଚିତ*\n\nଆପଣଙ୍କର ସଭା ନିର୍ଦ୍ଧାରଣ କରାଯାଇଛି।\n\n🎫 *ରେଫ୍ ନମ୍ବର:* `{id}`\n🏢 *ବିଭାଗ:* {dept}\n📅 *ତାରିଖ:* {date}\n⏰ *ସମୟ:* {time}\n\nଦୟାକରି ବୈଧ ଆଇଡି ସହିତ 15 ମିନିଟ୍ ପୂର୍ବରୁ ପହଞ୍ଚନ୍ତୁ।',
    aptError: '❌ *ବୁକିଂ ବିଫଳ*\n\nଦୟାକରି ପରେ ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ।',
    nextActionPrompt: '🔄 *ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ*\n\nଆପଣ କଣ କରିବାକୁ ଚାହାନ୍ତି?',
    msg_apt_enhanced: 'ℹ️ ନିଯୁକ୍ତି ସିଷ୍ଟମ୍ ଅପଗ୍ରେଡ୍ କରାଯାଉଛି।',
    msg_no_dept: '⚠️ ବର୍ତ୍ତମାନ କୌଣସି ବିଭାଗ ନିଯୁକ୍ତି ସ୍ୱୀକାର କରୁନାହିଁ।',
    msg_no_dept_grv: '⚠️ *କୌଣସି ବିଭାଗ ଉପଲବ୍ଧ ନାହିଁ*\n\nବର୍ତ୍ତମାନ, ଅଭିଯୋଗ ରେଜିଷ୍ଟ୍ରେସନ୍ ପାଇଁ କୌଣସି ବିଭାଗ କନଫିଗର୍ କରାଯାଇନାହିଁ।\n\nଦୟାକରି ପ୍ରଶାସନ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ କିମ୍ବା ପରେ ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ।',
    header_grv_status: '📄 ଅଭିଯୋଗ ସ୍ଥିତି',
    header_apt_status: '🗓️ ନିଯୁକ୍ତି ସ୍ଥିତି',
    status_PENDING: 'ସମୀକ୍ଷା ବିଳମ୍ବିତ',
    status_ASSIGNED: 'ଅଧିକାରୀଙ୍କୁ ଦାୟିତ୍ୱ ଦିଆଯାଇଛି',
    status_RESOLVED: 'ସମାଧାନ ହୋଇଛି',
    status_SCHEDULED: 'ନିର୍ଦ୍ଧାରିତ',
    status_CANCELLED: 'ବାତିଲ୍',
    status_COMPLETED: 'ସମାପ୍ତ',
    footer_grv_guidance: 'କେସ୍ ଏସ୍କାଲେସନ୍ ପାଇଁ, ଦୟାକରି ବିଭାଗ ମୁଖ୍ୟ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।',
    footer_apt_guidance: 'ପ୍ରବେଶ ପାଇଁ ଏହି ଡିଜିଟାଲ୍ ରସିଦ୍ ସହିତ ରଖନ୍ତୁ।',
    err_no_record_guidance: 'ଦୟାକରି ନମ୍ବର୍ ପୁନର୍ବାର ଯାଞ୍ଚ କରନ୍ତୁ କିମ୍ବା ସାହାଯ୍ୟ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।',
    label_no_remarks: 'ପ୍ରୋଟୋକଲ୍ ଅନୁଯାୟୀ କେସ୍ ବନ୍ଦ।',
    voiceReceived: '🎤 *ଭଏସ୍ ମେସେଜ୍ ଗ୍ରହଣ କରାଯାଇଛି*\n\nଆମେ ଆପଣଙ୍କର ଭଏସ୍ ମେସେଜ୍ ଗ୍ରହଣ କରିଛୁ। ଉନ୍ନତ ସାହାଯ୍ୟ ପାଇଁ, ଦୟାକରି ଆପଣଙ୍କର ମେସେଜ୍ ଟାଇପ୍ କରନ୍ତୁ କିମ୍ବା ପ୍ରଦାନ କରାଯାଇଥିବା ବଟନ୍ ବ୍ୟବହାର କରନ୍ତୁ।',
    // Department names in Odia (basic translations - can be expanded)
    'dept_Health Department': 'ସ୍ୱାସ୍ଥ୍ୟ ବିଭାଗ',
    'dept_Education Department': 'ଶିକ୍ଷା ବିଭାଗ',
    'dept_Water Supply Department': 'ଜଳ ସରବରାହ ବିଭାଗ',
    'dept_Public Works Department': 'ଜନସାଧାରଣ କାର୍ଯ୍ୟ ବିଭାଗ',
    'dept_Urban Development Department': 'ନଗର ବିକାଶ ବିଭାଗ',
    'dept_Revenue Department': 'ରାଜସ୍ୱ ବିଭାଗ',
    'dept_Agriculture Department': 'କୃଷି ବିଭାଗ',
    'dept_Social Welfare Department': 'ସାମାଜିକ କଲ୍ୟାଣ ବିଭାଗ'
  }
};

export function getTranslation(key: string, language: 'en' | 'hi' | 'mr' | 'or' = 'en'): string {
  const langData = translations[language] as any;
  const enData = translations.en as any;
  return langData?.[key] || enData[key] || key;
}

// Session management functions are now imported from sessionService

// Main message processor with voice note support
export async function processWhatsAppMessage(message: ChatbotMessage): Promise<any> {
  const { companyId, from, messageText, messageType, mediaUrl, buttonId, metadata } = message;

  console.log('🔍 Processing WhatsApp message:', { companyId, from, messageType, messageText: messageText?.substring(0, 50) });

  const company = await Company.findOne({ companyId });
  if (!company) {
    console.error('❌ Company not found:', companyId);
    return;
  }

  // ✅ LOG INCOMING WHATSAPP MESSAGE (for SuperAdmin Terminal)
  await createAuditLog({
    action: AuditAction.WHATSAPP_MSG,
    resource: 'INCOMING',
    resourceId: from,
    companyId: company._id.toString(),
    details: {
      from,
      messageText,
      messageType,
      buttonId,
      description: `Citizen from ${from} sent: ${buttonId || messageText || 'Media message'}`
    }
  });

  // Fetch WhatsApp configuration from separate model (SOURCE OF TRUTH: Database)
  let whatsappConfig = await CompanyWhatsAppConfig.findOne({ 
    companyId: company._id,
    isActive: true 
  });

  if (whatsappConfig) {
    console.log(`✅ Using company WhatsApp config from database: ${whatsappConfig.phoneNumberId}`);
    
    // If metadata phone number ID is provided, verify it matches
    // This ensures we're using the correct phone number that received the message
    if (metadata?.phone_number_id) {
      const metadataPhoneId = metadata.phone_number_id as string;
      
      if (whatsappConfig.phoneNumberId !== metadataPhoneId) {
        console.warn(`⚠️ Phone Number ID mismatch! Database: ${whatsappConfig.phoneNumberId}, Metadata: ${metadataPhoneId}`);
        console.warn(`🔧 Using database Phone Number ID: ${whatsappConfig.phoneNumberId}`);
        // Keep using database config - it's the source of truth for this company
        // The access token in the database should match the phone number ID
      } else {
        console.log(`✅ Phone Number ID matches metadata: ${metadataPhoneId}`);
      }
    }
  } else {
    // No DB config => we cannot send replies safely
    console.error(`❌ No WhatsApp config found in DB for company ${company.name} (${company.companyId}). Cannot process messages.`);
    return;
  }

  // Attach config to company object for backward compatibility with whatsappService
  (company as any).whatsappConfig = whatsappConfig;

  console.log('✅ Company found:', { name: company.name, _id: company._id, companyId: company.companyId });

  // Ensure enabledModules is set - if not, default to GRIEVANCE and APPOINTMENT for ZP Amravati
  if (!company.enabledModules || company.enabledModules.length === 0) {
    console.warn('⚠️ Company has no enabledModules configured. Setting defaults: GRIEVANCE, APPOINTMENT');
    company.enabledModules = [Module.GRIEVANCE, Module.APPOINTMENT] as any;
  }

  const session = await getSession(from, companyId);
  let userInput = (buttonId || messageText || '').trim().toLowerCase();

  console.log('📋 Session state:', { step: session.step, language: session.language, hasFlowId: !!session.data?.flowId, hasAwaitingInput: !!session.data?.awaitingInput, userInput });

  // Handle voice notes/audio messages
  // Voice transcription is currently disabled - voiceTranscriptionService not available
  if (messageType === 'audio') {
    await sendWhatsAppMessage(
      company,
      from,
      '🎤 *Voice Message Received*\n\nWe received your voice message. For better assistance, please type your message or use the buttons provided.\n\nThank you for your understanding.'
    );
    return;
  }
  
 
  console.log('🔄 Processing message:', { from, step: session.step, input: userInput, type: messageType });

  // Handle exit/end commands
  const exitCommands = ['exit', 'end', 'quit', 'stop', 'bye', 'goodbye', 'समाप्त', 'बंद', 'अलविदा', 'संपवा', 'बाय'];
  if (!buttonId && exitCommands.includes(userInput)) {
    console.log('👋 Exit command received:', userInput);
    await sendWhatsAppMessage(company, from, getTranslation('goodbye', session.language));
    await clearSession(from, companyId);
    return;
  }

  // Handle global reset on greetings (like "Hi", "Hello", "Start")
  const greetings = ['hi', 'hii','hello', 'start', 'namaste', 'नमस्ते', 'restart', 'menu'];
  if (!buttonId && greetings.includes(userInput)) {
    console.log('🔄 Global reset triggered by greeting:', userInput);
    console.log(`   Company ID: ${company._id.toString()}, Company Name: ${company.name}`);
    
    // ✅ NEW: Check for custom dynamic flow first
    const customFlow = await loadFlowForTrigger(company._id.toString(), userInput);
    if (customFlow && customFlow.isActive) {
      console.log(`✅ Custom flow found: ${customFlow.flowName} (${customFlow.flowId})`);
      console.log(`   Flow startStepId: ${customFlow.startStepId}`);
      
      // Get start step from trigger config, but validate it exists
      let startStepId = getStartStepForTrigger(customFlow, userInput) || customFlow.startStepId;
      
      // Verify the start step exists - if not, use flow's default startStepId
      const startStep = customFlow.steps.find(s => s.stepId === startStepId);
      if (!startStep) {
        console.warn(`⚠️ Trigger startStepId "${startStepId}" not found in flow ${customFlow.flowId}!`);
        console.log(`   Available steps: ${customFlow.steps.map(s => s.stepId).join(', ')}`);
        console.log(`   Falling back to flow's startStepId: ${customFlow.startStepId}`);
        
        // Use flow's default startStepId instead
        startStepId = customFlow.startStepId;
        
        // Verify the fallback step exists
        const fallbackStep = customFlow.steps.find(s => s.stepId === startStepId);
        if (!fallbackStep) {
          console.error(`❌ Flow's startStepId "${startStepId}" also not found in flow ${customFlow.flowId}!`);
          await sendWhatsAppMessage(company, from, '⚠️ Flow configuration error. Please contact support.');
          return;
        }
      }
      
      console.log(`   Will start from step: ${startStepId}`);
      
      if (!startStepId) {
        console.error(`❌ Flow ${customFlow.flowId} has no startStepId configured!`);
        await sendWhatsAppMessage(company, from, '⚠️ Flow configuration error. Please contact support.');
        return;
      }
      
      // Verify the start step exists one more time (after fallback)
      const finalStartStep = customFlow.steps.find(s => s.stepId === startStepId);
      if (!finalStartStep) {
        console.error(`❌ Final start step "${startStepId}" not found in flow ${customFlow.flowId}!`);
        console.log(`   Available steps: ${customFlow.steps.map(s => s.stepId).join(', ')}`);
        await sendWhatsAppMessage(company, from, '⚠️ Flow configuration error. Please contact support.');
        return;
      }
      
      // Clear session and start custom flow (do NOT set currentStepId yet – first step will set it)
      await clearSession(from, companyId);
      const newSession = await getSession(from, companyId);
      
      // Store only flowId so executeStep(startStepId) runs the first step (e.g. language_selection)
      newSession.data = { flowId: customFlow.flowId };
      await updateSession(newSession);
      
      console.log(`🚀 Executing flow step: ${startStepId} (${finalStartStep.stepType})`);
      
      // Execute the custom flow
      try {
        const flowEngine = new DynamicFlowEngine(customFlow, newSession, company, from);
        await flowEngine.executeStep(startStepId);
        console.log(`✅ Flow step executed successfully`);
      } catch (flowError: any) {
        console.error(`❌ Error executing flow step:`, flowError);
        console.error(`   Error stack:`, flowError.stack);
        
        // Try to send error message to user
        try {
          await sendWhatsAppMessage(company, from, '⚠️ We encountered an error. Please try again later.');
        } catch (sendError: any) {
          console.error(`❌ Failed to send error message:`, sendError);
        }
      }
      return;
    }
    
    console.log(`⚠️ No custom flow found for trigger "${userInput}", using default language selection`);
    
    // Fallback to default language selection if no custom flow
    await clearSession(from, companyId);
    const newSession = await getSession(from, companyId);
    await showLanguageSelection(newSession, message, company);
    return;
  }

  // ✅ Recovery: if session has no flow context but user sent text (not a greeting), try restoring from MongoDB (Redis may have lost sessionData)
  if (
    session.step === 'start' &&
    !session.data?.flowId &&
    !buttonId &&
    userInput &&
    !greetings.includes(userInput)
  ) {
    const mongoSession = await getSessionFromMongo(from, companyId);
    if (mongoSession?.data?.flowId && (mongoSession.data.currentStepId || mongoSession.data.awaitingInput)) {
      console.log('🔄 Recovered session from MongoDB (flowId + currentStepId/awaitingInput)');
      session.data = mongoSession.data;
      session.step = mongoSession.step;
      session.language = mongoSession.language;
      // Fall through to "if (session.data?.flowId)" below to handle the input
    }
  }

  // Initial greeting/auto-start only when session has no flow context (skip when we have flowId so "continuing flow" or recovered flow handles it)
  if (session.step === 'start' && !session.data?.flowId) {
    // ✅ NEW: Check for custom flow with default trigger
    const defaultTrigger = 'hi';
    const customFlow = await loadFlowForTrigger(company._id.toString(), defaultTrigger);
    if (customFlow && customFlow.isActive) {
      let startStepId = getStartStepForTrigger(customFlow, defaultTrigger) || customFlow.startStepId;
      const startStep = customFlow.steps.find(s => s.stepId === startStepId);
      if (!startStep) {
        console.warn(`⚠️ Trigger startStepId "${startStepId}" not found in flow ${customFlow.flowId}! Falling back to flow's startStepId: ${customFlow.startStepId}`);
        startStepId = customFlow.startStepId;
      }

      // ✅ If user sent a button/list click (e.g. lang_en) but session has no flowId, treat as "continue flow" and handle the click
      if (buttonId) {
        console.log(`✅ Custom flow found for new session: ${customFlow.flowName} (${customFlow.flowId}) – treating button/list click as flow continuation`);
        session.data = {
          flowId: customFlow.flowId,
          currentStepId: startStepId,
          buttonMapping: {},
          listMapping: {}
        };
        customFlow.steps.forEach((s: any) => {
          if (s.buttons) {
            s.buttons.forEach((btn: any) => {
              if (btn.nextStepId) (session.data as any).buttonMapping[btn.id] = btn.nextStepId;
            });
          }
          if (s.listConfig?.sections) {
            s.listConfig.sections.forEach((sec: any) => {
              (sec.rows || []).forEach((row: any) => {
                if (row.nextStepId) (session.data as any).listMapping[row.id] = row.nextStepId;
              });
            });
          }
        });
        if (customFlow.steps.some((s: any) => s.expectedResponses?.length)) {
          const langStep = customFlow.steps.find((s: any) => s.stepId === startStepId);
          if (langStep?.expectedResponses) {
            langStep.expectedResponses.forEach((r: any) => {
              if (r.type === 'button_click' && r.nextStepId) (session.data as any).buttonMapping[r.value] = r.nextStepId;
            });
          }
        }
        await updateSession(session);
        const flowEngine = new DynamicFlowEngine(customFlow, session, company, from);
        if ((session.data as any).listMapping?.[buttonId]) {
          await flowEngine.handleListSelection(buttonId);
        } else {
          await flowEngine.handleButtonClick(buttonId);
        }
        return;
      }

      console.log(`✅ Custom flow found for new session: ${customFlow.flowName} (${customFlow.flowId})`);
      session.data = { flowId: customFlow.flowId };
      await updateSession(session);
      const flowEngine = new DynamicFlowEngine(customFlow, session, company, from);
      await flowEngine.executeStep(startStepId);
      return;
    }
    
    // Fallback to default language selection
    await showLanguageSelection(session, message, company);
    return;
  }
  
  // ✅ NEW: Check if user is in a custom flow
  if (session.data?.flowId) {
    let customFlow = await ChatbotFlow.findOne({ 
      flowId: session.data.flowId, 
      isActive: true 
    });
    // Fallback: session may store flow _id instead of flowId string
    if (!customFlow && session.data.flowId && mongoose.Types.ObjectId.isValid(String(session.data.flowId))) {
      customFlow = await ChatbotFlow.findOne({ _id: session.data.flowId, isActive: true });
      if (customFlow) {
        console.log(`   Flow resolved by _id (session had ObjectId)`);
        session.data.flowId = (customFlow as any).flowId;
        await updateSession(session);
      }
    }
    
    if (customFlow) {
      console.log(`🔄 Continuing custom flow: ${customFlow.flowName} (${(customFlow as any).flowId})`);
      const flowEngine = new DynamicFlowEngine(customFlow, session, company, from);
      
      // Handle date selections from availability API
      if (buttonId && buttonId.startsWith('date_') && session.data.dateMapping) {
        const selectedDate = session.data.dateMapping[buttonId];
        if (selectedDate) {
          session.data.selectedDate = selectedDate;
          session.data.appointmentDate = selectedDate; // for placeholders and time-step API
          await updateSession(session);
          const nextStepId = session.data.availabilityNextStepId;
          if (nextStepId) {
            await flowEngine.executeStep(nextStepId);
          } else if (session.data.currentStepId) {
            await flowEngine.executeStep(session.data.currentStepId);
          }
        }
        return;
      }
      
      // Handle time selections from availability API
      if (buttonId && buttonId.startsWith('time_') && session.data.timeMapping) {
        const selectedTime = session.data.timeMapping[buttonId];
        if (selectedTime) {
          session.data.selectedTime = selectedTime;
          session.data.appointmentTime = selectedTime; // for placeholders
          await updateSession(session);
          const nextStepId = session.data.availabilityNextStepId;
          if (nextStepId) {
            await flowEngine.executeStep(nextStepId);
          } else if (session.data.currentStepId) {
            await flowEngine.executeStep(session.data.currentStepId);
          }
        }
        return;
      }
      
      // Handle list selections first (grv_dept_*, etc.) – list row ids must go to handleListSelection
      if (buttonId && session.data.listMapping && session.data.listMapping[buttonId] !== undefined) {
        await flowEngine.handleListSelection(buttonId);
        return;
      }
      
      // ✅ Handle button clicks in custom flow (language, menu, etc.)
      if (buttonId) {
        await flowEngine.handleButtonClick(buttonId);
        return;
      }
      
      // ✅ Handle media upload in custom flow (e.g. user sent image after "Please send a photo or document")
      if (session.data.awaitingMedia && (messageType === 'image' || messageType === 'document' || messageType === 'video') && mediaUrl) {
        const nextStepId = session.data.awaitingMedia.nextStepId;
        const saveToField = session.data.awaitingMedia.saveToField || 'media';
        try {
          const accessToken = (company as any)?.whatsappConfig?.accessToken;
          if (accessToken) {
            const folder = (company?.name || (company as any)?._id?.toString() || 'chatbot').replace(/\s+/g, '_');
            const cloudinaryUrl = await uploadWhatsAppMediaToCloudinary(mediaUrl, accessToken, folder);
            if (saveToField === 'media') {
              session.data.media = session.data.media || [];
              session.data.media.push({
                url: cloudinaryUrl || mediaUrl,
                type: messageType,
                uploadedAt: new Date(),
                isCloudinary: !!cloudinaryUrl
              });
            } else {
              session.data[saveToField] = cloudinaryUrl || mediaUrl;
            }
          } else {
            if (saveToField === 'media') {
              session.data.media = session.data.media || [];
              session.data.media.push({ url: mediaUrl, type: messageType });
            } else {
              session.data[saveToField] = mediaUrl;
            }
          }
        } catch (err: any) {
          console.error('❌ Error uploading media in flow:', err);
          if (saveToField === 'media') {
            session.data.media = session.data.media || [];
            session.data.media.push({ url: mediaUrl, type: messageType });
          } else {
            session.data[saveToField] = mediaUrl;
          }
        }
        delete session.data.awaitingMedia;
        await updateSession(session);
        if (nextStepId) {
          console.log(`📎 Media received for step; advancing to: ${nextStepId}`);
          await flowEngine.executeStep(nextStepId);
        }
        return;
      }

      // When awaiting media but user sent text: treat skip keywords as skip and advance; otherwise remind
      if (session.data.awaitingMedia) {
        const skipKeywords = ['back', 'skip', 'cancel', 'no', 'no thanks', 'continue without', 'without photo', 'na', 'n/a'];
        const userText = (messageText || '').trim().toLowerCase();
        const isSkip = skipKeywords.some(k => userText === k || userText.includes(k));
        if (isSkip) {
          const nextStepId = session.data.awaitingMedia.nextStepId;
          delete session.data.awaitingMedia;
          await updateSession(session);
          if (nextStepId) {
            await flowEngine.executeStep(nextStepId);
          }
          return;
        }
        const reminder = (getTranslation('msg_upload_photo', session.language || 'en') as string) + '\n\n_Type *back* or *skip* to continue without uploading._';
        await sendWhatsAppMessage(company, from, reminder);
        return;
      }
      
      // When awaiting media-type input (image/document/video), do not advance on text – only on media or skip
      const awaitingMediaInput = session.data.awaitingInput?.type === 'image' || session.data.awaitingInput?.type === 'document' || session.data.awaitingInput?.type === 'video';
      if (awaitingMediaInput && session.data.awaitingInput) {
        const skipKeywords = ['back', 'skip', 'cancel', 'no', 'no thanks', 'continue without', 'without photo', 'na', 'n/a'];
        const userText = (messageText || '').trim().toLowerCase();
        const isSkip = skipKeywords.some(k => userText === k || userText.includes(k));
        if (isSkip) {
          const nextStepId = session.data.awaitingInput.nextStepId;
          delete session.data.awaitingInput;
          await updateSession(session);
          if (nextStepId) await flowEngine.executeStep(nextStepId);
        } else {
          const reminder = (getTranslation('msg_upload_photo', session.language || 'en') as string) + '\n\n_Type *back* or *skip* to continue without uploading._';
          await sendWhatsAppMessage(company, from, reminder);
        }
        return;
      }

      // Handle input in custom flow (e.g. user sent name after "Please enter your Full Name")
      if (session.data.awaitingInput) {
        console.log(`📥 Handling user input for step: ${session.data.currentStepId}, input length: ${(userInput || '').length}`);
        await flowEngine.executeStep(session.data.currentStepId, userInput);
        return;
      }
      
      // Get current step or next step based on user input
      const currentStepId = session.data.currentStepId || customFlow.startStepId;
      console.log(`🔄 No awaitingInput; running step: ${currentStepId} with userInput`);
      await flowEngine.executeStep(currentStepId, userInput);
      return;
    } else {
      // Flow was deactivated, clear it
      console.log('⚠️ Custom flow not found or inactive, clearing session');
      session.data = {};
      await updateSession(session);
    }
  }

  // Language selection
  if (session.step === 'language_selection') {
    console.log('🌍 Language selection:', { userInput, buttonId });
    
    if (userInput === 'english' || buttonId === 'lang_en' || userInput === '1') {
      session.language = 'en';
      console.log('✅ Language set to English');
      await showMainMenu(session, message, company);
    } else if (userInput === 'hindi' || buttonId === 'lang_hi' || userInput === '2' || userInput === 'हिंदी') {
      session.language = 'hi';
      console.log('✅ Language set to Hindi');
      await showMainMenu(session, message, company);
    } else if (userInput === 'marathi' || buttonId === 'lang_mr' || userInput === '3' || userInput === 'मराठी') {
      session.language = 'mr';
      console.log('✅ Language set to Marathi');
      await showMainMenu(session, message, company);
    } else if (userInput === 'odia' || buttonId === 'lang_or' || userInput === '4' || userInput === 'ଓଡ଼ିଆ') {
      session.language = 'or';
      console.log('✅ Language set to Odia');
      await showMainMenu(session, message, company);
    } else {
      console.log('⚠️ Invalid language selection');
      await sendWhatsAppMessage(company, from, getTranslation('invalidOption', session.language));
      await showLanguageSelection(session, message, company);
    }
    return;
  }

  // Handle "back" or "menu" commands
  if (userInput === 'back' || userInput === 'menu' || userInput === 'main menu' || buttonId === 'back_menu') {
    await showMainMenu(session, message, company);
    return;
  }

  // Handle "help" command
  if (userInput === 'help' || buttonId === 'help') {
    await sendWhatsAppMessage(company, from, getTranslation('help', session.language));
    await showMainMenu(session, message, company);
    return;
  }

  // Main menu handling
  if (session.step === 'main_menu') {
    await handleMainMenuSelection(session, message, company, buttonId || userInput);
    return;
  }

  // Grievance flow
  if (session.step.startsWith('grievance_')) {
    await continueGrievanceFlow(session, userInput, message, company);
    return;
  }

  // Appointment flow
  if (session.step.startsWith('appointment_')) {
    await continueAppointmentFlow(session, userInput, message, company);
    return;
  }

  // RTS flow
  if (session.step.startsWith('rts_')) {
    await continueRTSFlow(session, userInput, message, company);
    return;
  }

  // Track status flow
  if (session.step === 'track_status') {
    await handleStatusTracking(session, userInput, message, company);
    return;
  }
  
  // Handle "Back to Main Menu" button - only if explicitly clicked
  if (buttonId === 'menu_back') {
    console.log('↩️ User clicked Back to Main Menu');
    await clearSession(message.from, company._id.toString());
    const newSession = await getSession(message.from, company._id.toString());
    newSession.language = session.language || 'en';
    await showMainMenu(newSession, message, company);
    return;
  }
  
  // If in awaiting_menu state, process the menu selection
  if (session.step === 'awaiting_menu') {
    console.log('📋 Processing menu selection from awaiting_menu state');
    session.step = 'main_menu';
    await updateSession(session);
    await handleMainMenuSelection(session, message, company, buttonId || userInput);
    return;
  }

  // Handle unrecognized text messages with helpful response
  if (messageType === 'text' && messageText && !buttonId) {
    const unrecognizedResponses = {
      en: '⚠️ *Unrecognized Input*\n\nI didn\'t understand that. Please use the buttons provided or type one of these commands:\n\n• "Hi" or "Hello" - Start over\n• "Menu" - Show main menu\n• "Help" - Get assistance\n• "Track" - Track status\n\nOr select an option from the buttons above.',
      hi: '⚠️ *अमान्य इनपुट*\n\nमैं इसे समझ नहीं पाया। कृपया प्रदान किए गए बटन का उपयोग करें या इनमें से कोई एक कमांड टाइप करें:\n\n• "Hi" या "Hello" - फिर से शुरू करें\n• "Menu" - मुख्य मेनू दिखाएं\n• "Help" - सहायता प्राप्त करें\n• "Track" - स्थिति ट्रैक करें\n\nया ऊपर दिए गए बटन से एक विकल्प चुनें।',
      mr: '⚠️ *अमान्य इनपुट*\n\nमला ते समजले नाही. कृपया प्रदान केलेले बटण वापरा किंवा यापैकी एक आदेश टाइप करा:\n\n• "Hi" किंवा "Hello" - पुन्हा सुरू करा\n• "Menu" - मुख्य मेनू दाखवा\n• "Help" - मदत मिळवा\n• "Track" - स्थिती ट्रॅक करा\n\nकिंवा वर दिलेल्या बटणातून एक पर्याय निवडा.',
      or: '⚠️ *ଅଚିହ୍ନିତ ଇନପୁଟ୍*\n\nମୁଁ ତାହା ବୁଝିପାରିଲି ନାହିଁ। ଦୟାକରି ପ୍ରଦାନ କରାଯାଇଥିବା ବଟନ୍ ବ୍ୟବହାର କରନ୍ତୁ କିମ୍ବା ଏହି କମାଣ୍ଡଗୁଡ଼ିକ ମଧ୍ୟରୁ ଗୋଟିଏ ଟାଇପ୍ କରନ୍ତୁ:\n\n• "Hi" କିମ୍ବା "Hello" - ପୁନର୍ବାର ଆରମ୍ଭ କରନ୍ତୁ\n• "Menu" - ମୁଖ୍ୟ ମେନୁ ଦେଖାନ୍ତୁ\n• "Help" - ସାହାଯ୍ୟ ପାଆନ୍ତୁ\n• "Track" - ସ୍ଥିତି ଟ୍ରାକ୍ କରନ୍ତୁ\n\nକିମ୍ବା ଉପରେ ଥିବା ବଟନ୍ ମଧ୍ୟରୁ ଏକ ବିକଳ୍ପ ବାଛନ୍ତୁ।'
    };

    await sendWhatsAppMessage(
      company,
      from,
      unrecognizedResponses[session.language] || unrecognizedResponses.en
    );
    await showMainMenu(session, message, company);
    return;
  }

  // Default: show main menu
  await showMainMenu(session, message, company);
}

// Show language selection with professional greeting
async function showLanguageSelection(session: UserSession, message: ChatbotMessage, company: any) {
  console.log('🌐 Showing language selection to:', message.from);
  
  if (!company.enabledModules || company.enabledModules.length === 0) {
    await sendWhatsAppMessage(company, message.from, getTranslation('serviceUnavailable', session.language));
    await clearSession(message.from, company._id.toString());
    return;
  }

  await sendWhatsAppButtons(
    company,
    message.from,
    getTranslation('welcome', session.language),
    [
      { id: 'lang_en', title: '🇬🇧 English' },
      { id: 'lang_hi', title: '🇮🇳 हिंदी' },
      { id: 'lang_or', title: '🇮🇳 ଓଡ଼ିଆ' },
      { id: 'lang_mr', title: '🇮🇳 मराठी' }
    ]
  );
  session.step = 'language_selection';
  await updateSession(session);
}

// Show main menu with all available services
async function showMainMenu(session: UserSession, message: ChatbotMessage, company: any) {
  console.log('📋 Showing main menu to:', message.from, 'Language:', session.language);
  
  const buttons = [];
  
  if (company.enabledModules.includes('GRIEVANCE')) {
    buttons.push({ id: 'grievance', title: getTranslation('menu_grievance', session.language) });
  }
  
  if (company.enabledModules.includes('APPOINTMENT')) {
    buttons.push({ id: 'appointment', title: getTranslation('menu_appointment', session.language) });
  }
  
  if (company.enabledModules.includes('RTS')) {
    buttons.push({ id: 'rts', title: getTranslation('menu_rts', session.language) });
  }
  
  if (buttons.length > 0) {
    buttons.push({ id: 'track', title: getTranslation('menu_track', session.language) });
  }

  buttons.push({ id: 'help', title: getTranslation('menu_help', session.language) });

  if (buttons.length === 0) {
    await sendWhatsAppMessage(company, message.from, getTranslation('serviceUnavailable', session.language));
    await clearSession(message.from, company._id.toString());
    return;
  }

  await sendWhatsAppButtons(
    company,
    message.from,
    getTranslation('mainMenu', session.language),
    buttons
  );

  session.step = 'main_menu';
  await updateSession(session);
}

// Handle main menu selection
async function handleMainMenuSelection(
  session: UserSession,
  message: ChatbotMessage,
  company: any,
  selection: string
) {
  switch (selection) {
    case 'grievance':
      if (!company.enabledModules.includes('GRIEVANCE')) {
        await sendWhatsAppMessage(company, message.from, getTranslation('serviceUnavailable', session.language));
        await showMainMenu(session, message, company);
        return;
      }
      
      // OTP verification removed - directly start grievance flow
      await startGrievanceFlow(session, message, company);
      break;

    case 'appointment':
      if (!company.enabledModules.includes('APPOINTMENT')) {
        await sendWhatsAppMessage(company, message.from, getTranslation('serviceUnavailable', session.language));
        await showMainMenu(session, message, company);
        return;
      }
      
      // OTP verification removed - directly start appointment flow
      await startAppointmentFlow(session, message, company);
      break;

    case 'rts':
      if (!company.enabledModules.includes('RTS')) {
        await sendWhatsAppMessage(company, message.from, getTranslation('serviceUnavailable', session.language));
        await showMainMenu(session, message, company);
        return;
      }
      
      await startRTSFlow(session, message, company);
      break;

    case 'track':
      await sendWhatsAppMessage(
        company,
        message.from,
        getTranslation('trackStatusPortal', session.language)
      );
      session.step = 'track_status';
      await updateSession(session);
      break;

    case 'help':
      await sendWhatsAppMessage(company, message.from, getTranslation('help', session.language));
      await showMainMenu(session, message, company);
      break;

    default:
      await sendWhatsAppMessage(company, message.from, getTranslation('invalidOption', session.language));
      await showMainMenu(session, message, company);
  }
}

// Start grievance flow with button-based interactions
async function startGrievanceFlow(session: UserSession, message: ChatbotMessage, company: any) {
  await sendWhatsAppMessage(
    company,
    message.from,
    getTranslation('grievanceRaise', session.language)
  );
  
  await sendWhatsAppMessage(
    company,
    message.from,
    getTranslation('grievanceName', session.language)
  );
  
  session.step = 'grievance_name';
  session.data = {};
  await updateSession(session);
}

// Continue grievance flow with enhanced button interactions
async function continueGrievanceFlow(
  session: UserSession,
  userInput: string,
  message: ChatbotMessage,
  company: any
) {
  const { buttonId } = message;
  switch (session.step) {
    case 'grievance_name':
      if (!userInput || userInput.length < 2) {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('err_name_invalid', session.language)
        );
        return;
      }
      session.data.citizenName = userInput;
      
      // Get all departments directly instead of categories
      let departments = await Department.find({ 
        companyId: company._id, 
        isActive: true 
      });

      if (departments.length === 0) {
        console.warn(`⚠️ No departments found for ObjectId companyId: ${company._id}. Trying string comparison...`);
        departments = await Department.find({
          companyId: company._id.toString(),
          isActive: true
        });
      }
      
      console.log('🏬 All departments:', departments.map(d => ({ name: d.name, id: d._id })));
      
      if (departments.length > 0) {
        // Initialize department offset if not set
        if (!session.data.deptOffset) {
          session.data.deptOffset = 0;
        }
        
        const offset = session.data.deptOffset || 0;
        const showLoadMore = departments.length > offset + 9;
        const deptRows = departments.slice(offset, offset + 9).map(dept => {
          // Try to translate department name
          const translatedName = getTranslation(`dept_${dept.name}`, session.language);
          const displayName = translatedName !== `dept_${dept.name}` ? translatedName : dept.name;
          
          return {
            id: `grv_dept_${dept._id}`,
            title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
            description: getTranslation(`desc_${dept.name}`, session.language) || dept.description?.substring(0, 72) || ''
          };
        });
        
        // Add "Load More" button if there are more departments
        if (showLoadMore) {
          deptRows.push({
            id: 'grv_load_more',
            title: getTranslation('btn_load_more', session.language),
            description: `${departments.length - offset - 9} more departments available`
          });
        }
        
        // Create sections (WhatsApp requires at least 1 section with 1-10 rows)
        const sections = [{
          title: getTranslation('btn_select_dept', session.language),
          rows: deptRows
        }];
        
        console.log('📋 Sending department list with', deptRows.length, 'items (offset:', offset, ')');
        
        try {
          await sendWhatsAppList(
            company,
            message.from,
            getTranslation('selection_department', session.language),
            getTranslation('btn_select_dept', session.language),
            sections
          );
        } catch (error) {
          console.error('❌ Failed to send list, falling back to buttons');
          // If list fails, use buttons for first 3 departments
          if (departments.length <= 3) {
            await sendWhatsAppButtons(
              company,
              message.from,
              getTranslation('selection_department', session.language),
              departments.map(dept => {
                const translatedName = getTranslation(`dept_${dept.name}`, session.language);
                const displayName = translatedName !== `dept_${dept.name}` ? translatedName : dept.name;
                return {
                  id: `grv_dept_${dept._id}`,
                  title: displayName.substring(0, 20)
                };
              })
            );
          }
        }
      } else {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('msg_no_dept_grv', session.language)
        );
        await showMainMenu(session, message, company);
        return;
      }
      
      session.step = 'grievance_category';
      await updateSession(session);
      break;

    case 'grievance_category':
      // Handle "Load More" button
      if (buttonId === 'grv_load_more' || userInput === 'load_more' || userInput.includes('load more')) {
        // Increment offset and show next batch
        session.data.deptOffset = (session.data.deptOffset || 0) + 9;
        
        // Get all departments again
        const departments = await Department.find({ 
          companyId: company._id, 
          isActive: true 
        });
        
        if (departments.length > 0) {
          const offset = session.data.deptOffset || 0;
          const showLoadMore = departments.length > offset + 9;
          const deptRows = departments.slice(offset, offset + 9).map(dept => {
            const translatedName = getTranslation(`dept_${dept.name}`, session.language);
            const displayName = translatedName !== `dept_${dept.name}` ? translatedName : dept.name;
            
            return {
              id: `grv_dept_${dept._id}`,
              title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
              description: getTranslation(`desc_${dept.name}`, session.language) || dept.description?.substring(0, 72) || ''
            };
          });
          
          if (showLoadMore) {
            deptRows.push({
              id: 'grv_load_more',
              title: getTranslation('btn_load_more', session.language),
              description: `${departments.length - offset - 9} more departments available`
            });
          }
          
          const sections = [{
            title: getTranslation('btn_select_dept', session.language),
            rows: deptRows
          }];
          
          await sendWhatsAppList(
            company,
            message.from,
            getTranslation('selection_department', session.language),
            getTranslation('btn_select_dept', session.language),
            sections
          );
        }
        return;
      }
      
      // Extract department ID from selection
      let selectedDeptId = userInput.replace('grv_dept_', '').trim();
      if (buttonId && buttonId.startsWith('grv_dept_')) {
        selectedDeptId = buttonId.replace('grv_dept_', '');
      }
      
      console.log('🏬 Department selected for grievance:', selectedDeptId);
      
      // Get department details
      const selectedDept = await Department.findById(selectedDeptId);
      if (selectedDept) {
        session.data.departmentId = selectedDeptId;
        session.data.departmentName = selectedDept.name;
        session.data.category = selectedDept.name; // Use department name as category
        
        console.log('✅ Department found:', { name: selectedDept.name, id: selectedDeptId });
      } else {
        // Fallback if department not found
        session.data.category = userInput || 'General';
        console.log('⚠️ Department not found, using fallback');
      }
      

      
    
      // Go directly to description
      await sendWhatsAppMessage(
        company,
        message.from,
        getTranslation('grievanceDescription', session.language)
      );
      session.step = 'grievance_description';
      await updateSession(session);
      break;

    case 'grievance_description':
      if (!userInput || userInput.length < 10) {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('err_description_short', session.language)
        );
        return;
      }
      session.data.description = userInput;
      

      
      // Skip location and go directly to photo
      await sendWhatsAppButtons(
        company,
        message.from,
        getTranslation('grievancePhoto', session.language),
        [
          { id: 'photo_skip', title: getTranslation('btn_skip_photo', session.language) },
          { id: 'photo_upload', title: getTranslation('btn_upload_photo', session.language) }
        ]
      );
      
      session.step = 'grievance_photo';
      await updateSession(session);
      break;



    case 'grievance_photo':
      if (buttonId === 'photo_skip' || userInput === 'skip') {
        session.data.media = [];
      } else if (message.mediaUrl && (message.messageType === 'image' || message.messageType === 'document')) {
        // Professional media handling: Download from WhatsApp and upload to Cloudinary
        const accessToken = company?.whatsappConfig?.accessToken;
        if (!accessToken) {
          throw new Error('WhatsApp access token missing for company (cannot download media)');
        }
        const folder = (company?.name || company?._id?.toString() || 'chatbot').replace(/\s+/g, '_');
        const cloudinaryUrl = await uploadWhatsAppMediaToCloudinary(message.mediaUrl, accessToken as string, folder);
        
        session.data.media = [{ 
          url: cloudinaryUrl || message.mediaUrl, // Fallback to ID if upload fails
          type: message.messageType, 
          uploadedAt: new Date(),
          isCloudinary: !!cloudinaryUrl
        }];
      } else if (buttonId === 'photo_upload') {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('msg_upload_photo', session.language)
        );
        session.step = 'grievance_photo_upload';
        await updateSession(session);
        return;
      }
      
      // Show confirmation with buttons
      const translatedCategory = getTranslation(`dept_${session.data.category}`, session.language);
   
      const confirmMessage = getTranslation('grievanceConfirm', session.language)
        .replace('{name}', session.data.citizenName)
        .replace('{category}', translatedCategory)
        .replace('{description}', session.data.description.substring(0, 100) + '...');
      
      await sendWhatsAppButtons(
        company,
        message.from,
        confirmMessage,
        [
          { id: 'confirm_yes', title: getTranslation('btn_confirm_submit', session.language) },
          { id: 'confirm_no', title: getTranslation('btn_cancel', session.language) }
        ]
      );
      
      session.step = 'grievance_confirm';
      await updateSession(session);
      break;

    case 'grievance_photo_upload': {
      // Only proceed to confirmation after media is uploaded or user explicitly skips
      const skipKeywords = ['back', 'skip', 'cancel', 'no', 'no thanks', 'continue without', 'without photo', 'na', 'n/a'];
      const userText = (message.messageText || '').trim().toLowerCase();
      const isSkip = skipKeywords.some(k => userText === k || userText.includes(k));
      const hasMedia = message.mediaUrl && (message.messageType === 'image' || message.messageType === 'document');

      if (hasMedia) {
        const mediaUrl = message.mediaUrl;
        const accessToken = company?.whatsappConfig?.accessToken;
        if (!mediaUrl || !accessToken) {
          throw new Error('WhatsApp access token or media URL missing for company (cannot download media)');
        }
        const folder = (company?.name || company?._id?.toString() || 'chatbot').replace(/\s+/g, '_');
        const cloudinaryUrl = await uploadWhatsAppMediaToCloudinary(mediaUrl, accessToken, folder);
        session.data.media = [{
          url: cloudinaryUrl || message.mediaUrl,
          type: message.messageType,
          uploadedAt: new Date(),
          isCloudinary: !!cloudinaryUrl
        }];
      } else if (!isSkip) {
        const reminder = getTranslation('msg_upload_photo', session.language) + '\n\n_Type *back* or *skip* to continue without uploading._';
        await sendWhatsAppMessage(company, message.from, reminder);
        await updateSession(session);
        break;
      }

      const translatedCat = getTranslation(`dept_${session.data.category}`, session.language);
      const confirmMsg = getTranslation('grievanceConfirm', session.language)
        .replace('{name}', session.data.citizenName)
        .replace('{category}', translatedCat)
        .replace('{description}', (session.data.description || 'N/A').substring(0, 100) + (session.data.description && session.data.description.length > 100 ? '...' : ''));
      await sendWhatsAppButtons(
        company,
        message.from,
        confirmMsg,
        [
          { id: 'confirm_yes', title: getTranslation('btn_confirm_submit', session.language) },
          { id: 'confirm_no', title: getTranslation('btn_cancel', session.language) }
        ]
      );
      session.step = 'grievance_confirm';
      await updateSession(session);
      break;
    }

    case 'grievance_confirm':
      console.log('✅ Grievance confirmation received:', { 
        buttonId, 
        userInput, 
        messageText: message.messageText,
        messageType: message.messageType 
      });
      
      // Check if user cancelled first (explicit check)
      const isCancelled = 
        buttonId === 'confirm_no' ||
        buttonId === 'cancel' ||
        userInput === 'no' ||
        userInput === 'cancel' ||
        userInput.includes('cancel');
      
      if (isCancelled) {
        console.log('❌ User cancelled grievance');
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('grievanceCancel', session.language)
        );
        // Clear session completely when cancelled - delete all conversation data
        await clearSession(message.from, company._id.toString());
        // Show goodbye message with help instructions
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('goodbye', session.language)
        );
        return;
      }
      
      // Check if user confirmed (only if not cancelled)
      const isConfirmed = 
        buttonId === 'confirm_yes' || 
        userInput === 'yes' || 
        userInput === 'confirm';
      
      if (isConfirmed) {
        console.log('✅ User confirmed grievance, creating...');
        await createGrievanceWithDepartment(session, message, company);
      } else {
        // Invalid input - ask again
        console.log('⚠️ Invalid confirmation input, asking again');
        const confirmMessage = getTranslation('grievanceConfirm', session.language)
          .replace('{name}', session.data.citizenName)
          .replace('{category}', session.data.category)
          .replace('{description}', (session.data.description || 'N/A').substring(0, 100) + (session.data.description && session.data.description.length > 100 ? '...' : ''));
        
        await sendWhatsAppButtons(
          company,
          message.from,
          confirmMessage,
          [
            { id: 'confirm_yes', title: getTranslation('btn_confirm_submit', session.language) },
            { id: 'confirm_no', title: getTranslation('btn_cancel', session.language) }
          ]
        );
      }
      break;
  }
}

// Create grievance with automatic department routing
async function createGrievanceWithDepartment(
  session: UserSession,
  message: ChatbotMessage,
  company: any
) {
  try {
    console.log('💾 Creating grievance:', { category: session.data.category, citizenName: session.data.citizenName });
    
    // Use the department ID that was already selected by the user
    let departmentId = null;
    if (session.data.departmentId) {
      try {
        // Convert string ID to ObjectId if it's a valid string
        if (typeof session.data.departmentId === 'string') {
          departmentId = new mongoose.Types.ObjectId(session.data.departmentId);
        } else {
          departmentId = session.data.departmentId;
        }
      } catch (error) {
        console.error('❌ Error converting department ID:', error);
        // Fallback to finding by category
        departmentId = await findDepartmentByCategory(company._id, session.data.category);
      }
    }
    
    // If no department was pre-selected, try to find one by category (fallback)
    if (!departmentId) {
      console.log('⚠️ No department ID in session, searching by category...');
      departmentId = await findDepartmentByCategory(company._id, session.data.category);
    }
    
    console.log('🏬 Department for grievance:', { 
      departmentId: departmentId,
      departmentName: session.data.departmentName,
      category: session.data.category
    });
    
    const grievanceData = {
      // Don't set grievanceId here - let the pre-save hook generate it automatically
      companyId: company._id,
      departmentId: departmentId || undefined,
      citizenName: session.data.citizenName,
      citizenPhone: message.from,
      citizenWhatsApp: message.from,
      description: session.data.description,
      category: session.data.category,
      location: session.data.address ? {
        type: 'Point',
        coordinates: [0, 0], // Placeholder - can be enhanced with geocoding
        address: session.data.address
      } : undefined,
      media: session.data.media || [],
      status: GrievanceStatus.PENDING,
      language: session.language
    };

    console.log('📝 Grievance data:', JSON.stringify(grievanceData, null, 2));

    // Use new + save instead of create to trigger pre-save hook for grievanceId generation
    const grievance = new Grievance(grievanceData);
    await grievance.save();
    
    console.log('✅ Grievance created:', { grievanceId: grievance.grievanceId, _id: grievance._id });
    
    // Notify department admin about new grievance
    if (departmentId) {
      await notifyDepartmentAdminOnCreation({
        type: 'grievance',
        action: 'created',
        grievanceId: grievance.grievanceId,
        citizenName: session.data.citizenName,
        citizenPhone: message.from,
        citizenWhatsApp: message.from,
        departmentId: departmentId,
        companyId: company._id,
        description: session.data.description,
        category: session.data.category,
        location: session.data.address,
        createdAt: grievance.createdAt,
        timeline: grievance.timeline
      });
    }
    
    const department = departmentId ? await Department.findById(departmentId) : null;
    let deptName = department ? department.name : getTranslation('label_placeholder_dept', session.language);
    
    // Translate department name for success message
    const translatedDeptName = department ? getTranslation(`dept_${department.name}`, session.language) : deptName;
    if (translatedDeptName !== `dept_${department?.name}`) {
      deptName = translatedDeptName;
    }

    const successMessage = getTranslation('grievanceSuccess', session.language)
      .replace('{id}', grievance.grievanceId)
      .replace('{category}', getTranslation(`dept_${session.data.category}`, session.language) !== `dept_${session.data.category}` ? getTranslation(`dept_${session.data.category}`, session.language) : session.data.category)
      .replace('{department}', deptName)
      .replace('{date}', new Date().toLocaleDateString('en-IN'));

    await sendWhatsAppMessage(company, message.from, successMessage);

    // End chat after successful submission
    await sendWhatsAppMessage(company, message.from, getTranslation('goodbye', session.language));
    await clearSession(message.from, company._id.toString());


  } catch (error: any) {
    console.error('❌ Error creating grievance:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    await sendWhatsAppMessage(company, message.from, getTranslation('grievanceError', session.language));
    await clearSession(message.from, company._id.toString());
  }
}

// Start appointment flow - Only for CEO (no department selection)
async function startAppointmentFlow(session: UserSession, message: ChatbotMessage, company: any) {
  // Appointment is only for CEO/Head of Zilla Parishad - no department selection
  // Directly ask for citizen name
  await sendWhatsAppMessage(
    company,
    message.from,
    getTranslation('appointmentBookCEO', session.language)
  );
  
  session.step = 'appointment_name';
  if (!session.data) {
    session.data = {};
  }
  await updateSession(session);
}

// Start RTS (Right to Service) flow
async function startRTSFlow(session: UserSession, message: ChatbotMessage, company: any) {
  // RTS services list - you can customize this based on your requirements
  const rtsServices = [
    { id: 'rts_certificate', title: '📜 Certificate Services', description: 'Birth, Death, Income, Caste certificates' },
    { id: 'rts_license', title: '📋 License Services', description: 'Trade, Driving, Professional licenses' },
    { id: 'rts_document', title: '📄 Document Services', description: 'Document verification and attestation' },
    { id: 'rts_pension', title: '💰 Pension Services', description: 'Old age, widow, disability pensions' },
    { id: 'rts_scheme', title: '🎯 Scheme Services', description: 'Government scheme applications' }
  ];

  if (rtsServices.length <= 3) {
    const buttons = rtsServices.map(service => ({
      id: service.id,
      title: service.title
    }));
    
    await sendWhatsAppButtons(
      company,
      message.from,
      getTranslation('rtsServices', session.language),
      buttons
    );
  } else {
    const sections = [{
      title: 'RTS Services',
      rows: rtsServices.slice(0, 10).map(service => ({
        id: service.id,
        title: service.title.length > 24 ? service.title.substring(0, 21) + '...' : service.title,
        description: service.description || ''
      }))
    }];
    
    await sendWhatsAppList(
      company,
      message.from,
      getTranslation('rtsServices', session.language),
      'Select Service',
      sections
    );
  }
  
  session.step = 'rts_service_selection';
  session.data = {};
  await updateSession(session);
}

// Continue RTS flow
async function continueRTSFlow(
  session: UserSession,
  userInput: string,
  message: ChatbotMessage,
  company: any
) {
  const { buttonId } = message;
  
  switch (session.step) {
    case 'rts_service_selection':
      // Handle RTS service selection
      const selectedService = buttonId || userInput;
      
      // For now, redirect to main menu with a message
      // You can implement specific RTS service flows here
      await sendWhatsAppMessage(
        company,
        message.from,
        `✅ *RTS Service Selected*\n\nYou selected: ${selectedService}\n\nThis service is currently being configured. Please contact the department for assistance.\n\nFor more information, visit: zpamravati.gov.in/rts`
      );
      
      await showMainMenu(session, message, company);
      break;

    default:
      await sendWhatsAppMessage(company, message.from, getTranslation('invalidOption', session.language));
      await showMainMenu(session, message, company);
  }
}

// Helper function to get availability settings for a company/department
async function getAvailabilitySettings(companyId: string, departmentId?: string): Promise<IAppointmentAvailability | null> {
  try {
    const query: any = { companyId, isActive: true };
    
    // First try to get department-specific settings
    if (departmentId) {
      query.departmentId = departmentId;
      const deptSettings = await AppointmentAvailability.findOne(query);
      if (deptSettings) return deptSettings;
    }
    
    // Fall back to company-level settings
    const companyQuery: any = { companyId, isActive: true, departmentId: { $exists: false } };
    return await AppointmentAvailability.findOne(companyQuery);
  } catch (error) {
    console.error('Error fetching availability settings:', error);
    return null;
  }
}

// Helper function to check if a specific date is available for booking
async function isDateAvailableForBooking(date: Date, availability: IAppointmentAvailability | null): Promise<boolean> {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayOfWeek = date.getDay();
  const dayName = dayNames[dayOfWeek];
  
  // Check for special dates (holidays)
  if (availability?.specialDates) {
    const specialDate = availability.specialDates.find(sd => {
      const sdDate = new Date(sd.date);
      return sdDate.getFullYear() === date.getFullYear() &&
             sdDate.getMonth() === date.getMonth() &&
             sdDate.getDate() === date.getDate();
    });
    
    if (specialDate) {
      return specialDate.isAvailable;
    }
  }
  
  // Check weekly schedule
  if (availability?.weeklySchedule) {
    const daySchedule = availability.weeklySchedule[dayName];
    return daySchedule?.isAvailable || false;
  }
  
  // Default: weekdays only (Monday-Friday)
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

// Helper function to get available time slots for a specific date
async function getAvailableTimeSlots(
  date: Date, 
  availability: IAppointmentAvailability | null
): Promise<Array<{ id: string; title: string }>> {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayOfWeek = date.getDay();
  const dayName = dayNames[dayOfWeek];
  
  const timeSlots: Array<{ id: string; title: string }> = [];
  
  // Helper to format time for display
  const formatTimeDisplay = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
  };
  
  // Check for special date with custom times
  if (availability?.specialDates) {
    const specialDate = availability.specialDates.find(sd => {
      const sdDate = new Date(sd.date);
      return sdDate.getFullYear() === date.getFullYear() &&
             sdDate.getMonth() === date.getMonth() &&
             sdDate.getDate() === date.getDate();
    });
    
    if (specialDate && specialDate.isAvailable) {
      // Use special date times
      if (specialDate.morning?.enabled) {
        timeSlots.push({
          id: `time_${specialDate.morning.startTime}`,
          title: `🌅 ${formatTimeDisplay(specialDate.morning.startTime)}`
        });
      }
      if (specialDate.afternoon?.enabled) {
        timeSlots.push({
          id: `time_${specialDate.afternoon.startTime}`,
          title: `☀️ ${formatTimeDisplay(specialDate.afternoon.startTime)}`
        });
      }
      if (specialDate.evening?.enabled) {
        timeSlots.push({
          id: `time_${specialDate.evening.startTime}`,
          title: `🌙 ${formatTimeDisplay(specialDate.evening.startTime)}`
        });
      }
      
      if (timeSlots.length > 0) return timeSlots;
    }
  }
  
  // Use weekly schedule
  if (availability?.weeklySchedule) {
    const daySchedule = availability.weeklySchedule[dayName];
    
    if (daySchedule?.isAvailable) {
      if (daySchedule.morning?.enabled) {
        timeSlots.push({
          id: `time_${daySchedule.morning.startTime}`,
          title: `🌅 ${formatTimeDisplay(daySchedule.morning.startTime)}`
        });
      }
      if (daySchedule.afternoon?.enabled) {
        timeSlots.push({
          id: `time_${daySchedule.afternoon.startTime}`,
          title: `☀️ ${formatTimeDisplay(daySchedule.afternoon.startTime)}`
        });
      }
      if (daySchedule.evening?.enabled) {
        timeSlots.push({
          id: `time_${daySchedule.evening.startTime}`,
          title: `🌙 ${formatTimeDisplay(daySchedule.evening.startTime)}`
        });
      }
    }
  }
  
  // Default time slots if nothing configured
  if (timeSlots.length === 0) {
    return [
      { id: 'time_10:00', title: '🕙 10:00 AM' },
      { id: 'time_14:00', title: '🕑 2:00 PM' },
      { id: 'time_16:00', title: '🕓 4:00 PM' }
    ];
  }
  
  // WhatsApp buttons limit to 3
  return timeSlots.slice(0, 3);
}

// Continue appointment flow
async function continueAppointmentFlow(
  session: UserSession,
  userInput: string,
  message: ChatbotMessage,
  company: any
) {
  const { buttonId } = message;
  
  switch (session.step) {

    case 'appointment_name':
      if (!userInput || userInput.length < 2) {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('err_name_invalid', session.language)
        );
        return;
      }
      
      session.data.citizenName = userInput;
      
      // Ask for purpose
      await sendWhatsAppMessage(
        company,
        message.from,
        'Please briefly describe the purpose of your meeting with the CEO:'
      );
      
      session.step = 'appointment_purpose';
      await updateSession(session);
      break;

    case 'appointment_purpose':
      if (!userInput || userInput.length < 5) {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('err_purpose_short', session.language)
        );
        return;
      }
      
      session.data.purpose = userInput;
      
      // Get availability settings for CEO (company-level, no department)
      const availabilitySettings = await getAvailabilitySettings(company._id, undefined);
      
      // Show date selection based on availability
      const today = new Date();
      const dateButtons = [];
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const maxDays = availabilitySettings?.maxAdvanceBookingDays || 30;
      const minHours = availabilitySettings?.minAdvanceBookingHours || 24;
      
      // Start from tomorrow or after minimum booking hours
      const minDate = new Date(today.getTime() + minHours * 60 * 60 * 1000);
      minDate.setHours(0, 0, 0, 0);
      
      let datesFound = 0;
      for (let i = 0; i <= maxDays && datesFound < 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        date.setHours(0, 0, 0, 0);
        
        // Skip dates before minimum advance booking
        if (date < minDate) continue;
        
        // Check if date is available
        const isAvailable = await isDateAvailableForBooking(date, availabilitySettings);
        
        if (isAvailable) {
          const locale = session.language === 'en' ? 'en-IN' : session.language === 'hi' ? 'hi-IN' : session.language === 'or' ? 'or-IN' : 'mr-IN';
          const dateStr = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
          dateButtons.push({
            id: `date_${date.toISOString().split('T')[0]}`,
            title: dateStr
          });
          datesFound++;
        }
      }
      
      if (dateButtons.length === 0) {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('msg_no_dates', session.language) || 'No available dates for appointment booking. Please try again later.'
        );
        await showMainMenu(session, message, company);
        return;
      }
      
      // Store availability settings for time slot selection
      session.data.availabilitySettings = availabilitySettings;
      
      await sendWhatsAppButtons(
        company,
        message.from,
        getTranslation('label_select_date', session.language),
        dateButtons
      );
      
      session.step = 'appointment_date';
      await updateSession(session);
      break;

    case 'appointment_date':
      let selectedDate = userInput.replace('date_', '');
      if (buttonId && buttonId.startsWith('date_')) {
        selectedDate = buttonId.replace('date_', '');
      }
      
      session.data.appointmentDate = selectedDate;
      
      // Get time slots based on availability settings
      const timeButtons = await getAvailableTimeSlots(
        new Date(selectedDate), 
        session.data.availabilitySettings
      );
      
      // Show time slots as clickable buttons
      // Note: WhatsApp button titles have 20-character limit
      await sendWhatsAppButtons(
        company,
        message.from,
        getTranslation('label_select_time', session.language),
        timeButtons
      );
      
      session.step = 'appointment_time';
      await updateSession(session);
      break;

    case 'appointment_time':
      // Handle button click or text input
      let selectedTime = '';
      if (buttonId && buttonId.startsWith('time_')) {
        // User clicked a button
        selectedTime = buttonId.replace('time_', '');
        console.log('⏰ Time selected via button:', selectedTime);
      } else if (userInput) {
        // Fallback: user typed the time
        selectedTime = userInput.replace('time_', '').trim();
        console.log('⏰ Time selected via text:', selectedTime);
      } else {
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('invalidOption', session.language)
        );
        // Resend time slot buttons
        await sendWhatsAppButtons(
          company,
          message.from,
          getTranslation('label_select_time', session.language),
          [
            { id: 'time_10:00', title: '🕙 10:00-11:00 AM' },
            { id: 'time_14:00', title: '🕑 2:00-3:00 PM' },
            { id: 'time_16:00', title: '🕓 4:00-5:00 PM' }
          ]
        );
        return;
      }
      
      console.log('⏰ Time selected:', { buttonId, userInput, selectedTime });
      
      session.data.appointmentTime = selectedTime;
      
      // Show confirmation
      const confirmDate = new Date(session.data.appointmentDate);
      const dateDisplay = confirmDate.toLocaleDateString(session.language === 'en' ? 'en-IN' : session.language === 'hi' ? 'hi-IN' : 'mr-IN', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Format time for display in 12-hour format
      const formatTimeForDisplay = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
      };
      const timeDisplay = formatTimeForDisplay(selectedTime);
      
      const confirmMessage = `${getTranslation('appointmentConfirm', session.language)}\n\n` +
        `*${getTranslation('label_citizen', session.language)}:* ${session.data.citizenName}\n` +
        `*${getTranslation('label_department', session.language)}:* CEO - Zilla Parishad Amravati\n` +
        `*${getTranslation('label_purpose', session.language)}:* ${session.data.purpose}\n` +
        `*${getTranslation('label_date', session.language)}:* ${dateDisplay}\n` +
        `*${getTranslation('label_time', session.language)}:* ${timeDisplay}\n\n` +
        `*${getTranslation('grievanceConfirm', session.language).split('\n').pop()}*`;
      
      await sendWhatsAppButtons(
        company,
        message.from,
        confirmMessage,
        [
          { id: 'appt_confirm_yes', title: getTranslation('btn_confirm_book', session.language) },
          { id: 'appt_confirm_no', title: getTranslation('btn_cancel', session.language) }
        ]
      );
      
      session.step = 'appointment_confirm';
      await updateSession(session);
      break;

    case 'appointment_confirm':
      console.log('✅ Appointment confirmation received:', { 
        buttonId, 
        userInput,
        messageText: message.messageText,
        messageType: message.messageType
      });
      
      // Check if user cancelled first (explicit check)
      const isAppointmentCancelled = 
        buttonId === 'appt_confirm_no' ||
        buttonId === 'cancel' ||
        userInput === 'no' ||
        userInput === 'cancel' ||
        userInput.includes('cancel');
      
      if (isAppointmentCancelled) {
        console.log('❌ User cancelled appointment');
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('aptCancel', session.language)
        );
        // Clear session completely when cancelled - delete all conversation data
        await clearSession(message.from, company._id.toString());
        // Show goodbye message with help instructions
        await sendWhatsAppMessage(
          company,
          message.from,
          getTranslation('goodbye', session.language)
        );
        return;
      }
      
      // Check if user confirmed (only if not cancelled)
      const isAppointmentConfirmed = 
        buttonId === 'appt_confirm_yes' || 
        userInput === 'yes' || 
        userInput === 'confirm';
      
      if (isAppointmentConfirmed) {
        console.log('✅ User confirmed appointment, creating...');
        await createAppointment(session, message, company);
      } else {
        // Invalid input - ask again
        console.log('⚠️ Invalid confirmation input, asking again');
        const confirmDate = new Date(session.data.appointmentDate);
        const dateDisplay = confirmDate.toLocaleDateString(session.language === 'en' ? 'en-IN' : session.language === 'hi' ? 'hi-IN' : 'mr-IN', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        // Format time for display in 12-hour format
        const formatTime12Hr = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
        };
        const timeDisplay = formatTime12Hr(session.data.appointmentTime);
        
        const confirmMessage = `${getTranslation('appointmentConfirm', session.language)}\n\n` +
          `*${getTranslation('label_citizen', session.language)}:* ${session.data.citizenName}\n` +
          `*${getTranslation('label_department', session.language)}:* CEO - Zilla Parishad Amravati\n` +
          `*${getTranslation('label_purpose', session.language)}:* ${session.data.purpose}\n` +
          `*${getTranslation('label_date', session.language)}:* ${dateDisplay}\n` +
          `*${getTranslation('label_time', session.language)}:* ${timeDisplay}\n\n` +
          `*${getTranslation('grievanceConfirm', session.language).split('\n').pop()}*`;
        
        await sendWhatsAppButtons(
          company,
          message.from,
          confirmMessage,
          [
            { id: 'appt_confirm_yes', title: getTranslation('btn_confirm_book', session.language) },
            { id: 'appt_confirm_no', title: getTranslation('btn_cancel', session.language) }
          ]
        );
      }
      break;

    default:
      await sendWhatsAppMessage(
        company,
        message.from,
        getTranslation('msg_apt_enhanced', session.language)
      );
      await showMainMenu(session, message, company);
  }
}

// Create appointment and save to database
async function createAppointment(
  session: UserSession,
  message: ChatbotMessage,
  company: any
) {
  try {
    console.log('💾 Creating appointment request:', { 
      citizenName: session.data.citizenName,
      date: session.data.appointmentDate,
      time: session.data.appointmentTime
    });
    
    // Parse date and time
    const appointmentDate = new Date(session.data.appointmentDate);
    const appointmentTime = session.data.appointmentTime;
    
    // Appointment is for CEO only - no department
    const appointmentData = {
      // Don't set appointmentId here - let the pre-save hook generate it automatically
      companyId: company._id,
      departmentId: null, // No department for CEO appointments - explicitly set to null
      citizenName: session.data.citizenName,
      citizenPhone: message.from,
      citizenWhatsApp: message.from,
      purpose: session.data.purpose,
      appointmentDate: appointmentDate,
      appointmentTime: appointmentTime,
      status: AppointmentStatus.SCHEDULED
    };

    console.log('📝 Appointment data:', JSON.stringify(appointmentData, null, 2));

    // Use new + save instead of create to trigger pre-save hook for appointmentId generation
    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    console.log('✅ Appointment request created:', { appointmentId: appointment.appointmentId, _id: appointment._id });
    
    // Notify company admin about new appointment request (for CEO)
    await notifyDepartmentAdminOnCreation({
      type: 'appointment',
      action: 'created',
      appointmentId: appointment.appointmentId,
      citizenName: session.data.citizenName,
      citizenPhone: message.from,
      citizenWhatsApp: message.from,
      departmentId: undefined, // No department for CEO
      companyId: company._id,
      purpose: session.data.purpose,
      location: `${new Date(appointmentDate).toLocaleDateString('en-IN')} at ${appointmentTime}`,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      createdAt: appointment.createdAt,
      timeline: appointment.timeline
    });
    
    const dateDisplay = appointmentDate.toLocaleDateString(session.language === 'en' ? 'en-IN' : session.language === 'hi' ? 'hi-IN' : 'mr-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Format time for display in 12-hour format
    const formatTime12HrDisplay = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
    };
    const timeDisplay = formatTime12HrDisplay(appointmentTime);

    // Send scheduled confirmation (default status is SCHEDULED)
    const scheduledMessage = getTranslation('aptScheduled', session.language)
      .replace('{id}', appointment.appointmentId)
      .replace('{name}', session.data.citizenName)
      .replace('{date}', dateDisplay)
      .replace('{time}', timeDisplay)
      .replace('{purpose}', session.data.purpose)
      .replace('{remarks}', getTranslation('label_no_remarks', session.language) || '—');

    await sendWhatsAppMessage(company, message.from, scheduledMessage);

    // End chat after successful submission
    await sendWhatsAppMessage(company, message.from, getTranslation('goodbye', session.language));
    await clearSession(message.from, company._id.toString());


  } catch (error: any) {
    console.error('❌ Error creating appointment:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    await sendWhatsAppMessage(
      company, 
      message.from, 
      getTranslation('aptError', session.language)
    );
    await clearSession(message.from, company._id.toString());
  }
}

// Handle status tracking with professional formatting and navigation
async function handleStatusTracking(
  session: UserSession,
  userInput: string,
  message: ChatbotMessage,
  company: any
) {
  const refNumber = userInput.trim().toUpperCase();
  console.log(`🔍 Tracking request for: ${refNumber} from ${message.from}`);
  
  let grievance = null;
  let appointment = null;
  let foundRecord = false;

  // SECURITY FIX: Require exact reference number match
  // Only allow phone number lookup if:
  // 1. User provided a valid reference number format (GRV... or APT...), OR
  // 2. User provided phone number and exactly ONE record exists for that phone
  
  const isGrievanceRef = refNumber.startsWith('GRV') && /^GRV\d{8}$/.test(refNumber);
  const isAppointmentRef = refNumber.startsWith('APT') && /^APT\d{8}$/.test(refNumber);

  if (isGrievanceRef) {
    // Exact reference number match for grievance
    grievance = await Grievance.findOne({
      companyId: company._id,
      grievanceId: refNumber
    });
  } else if (isAppointmentRef) {
    // Exact reference number match for appointment
    appointment = await Appointment.findOne({
      companyId: company._id,
      appointmentId: refNumber
    });
  } else {
    // Phone number lookup - only if exactly ONE record exists (privacy protection)
    const grievanceCount = await Grievance.countDocuments({
      companyId: company._id,
      citizenPhone: message.from
    });
    
    const appointmentCount = await Appointment.countDocuments({
      companyId: company._id,
      citizenPhone: message.from
    });

    // Only allow phone lookup if exactly one record exists
    if (grievanceCount === 1 && appointmentCount === 0) {
      grievance = await Grievance.findOne({
        companyId: company._id,
        citizenPhone: message.from
      });
    } else if (appointmentCount === 1 && grievanceCount === 0) {
      appointment = await Appointment.findOne({
        companyId: company._id,
        citizenPhone: message.from
      });
    } else if (grievanceCount > 1 || appointmentCount > 1 || (grievanceCount > 0 && appointmentCount > 0)) {
      // Multiple records found - require reference number
      await sendWhatsAppMessage(
        company,
        message.from,
        getTranslation('err_multiple_records', session.language) || 
        '⚠️ *Multiple Records Found*\n\nWe found multiple records for your phone number. Please provide your exact Reference Number (GRV... or APT...) to track a specific record.\n\nExample: GRV00000001'
      );
      session.step = 'track_status';
      await updateSession(session);
      return;
    }
  }

  // Professional formatting for Grievance
  if (grievance && (refNumber.startsWith('GRV') || !appointment)) {
    foundRecord = true;
    const statusEmoji: Record<string, string> = {
      'PENDING': '⏳',
      'ASSIGNED': '📋',
      'RESOLVED': '✅'
    };
    
    const dept = grievance.departmentId ? await Department.findById(grievance.departmentId) : null;
    const translatedDept = dept ? getTranslation(`dept_${dept.name}`, session.language) : null;
    const deptName = translatedDept && translatedDept !== `dept_${dept?.name}` ? translatedDept : (dept?.name || getTranslation('label_placeholder_dept', session.language));

    const translatedCategory = grievance.category ? (getTranslation(`dept_${grievance.category}`, session.language) !== `dept_${grievance.category}` ? getTranslation(`dept_${grievance.category}`, session.language) : grievance.category) : 'General';

    await sendWhatsAppMessage(
      company,
      message.from,
      `📌 *${getTranslation('header_grv_status', session.language)}*\n\n` +
      `*${getTranslation('label_date', session.language)}:* ${new Date(grievance.createdAt).toLocaleDateString('en-IN')}\n` +
      `*${getTranslation('label_ref_no', session.language)}:* \`${grievance.grievanceId}\`\n\n` +
      `*${getTranslation('label_department', session.language)}:* ${deptName}\n` +
      `*${getTranslation('label_category', session.language)}:* ${translatedCategory}\n` +
      `*${getTranslation('label_status', session.language)}:* ${statusEmoji[grievance.status] || '📌'} *${getTranslation(`status_${grievance.status}`, session.language)}*\n\n` +
      `*${getTranslation('label_description', session.language)}:* ${grievance.description.substring(0, 100)}${grievance.description.length > 100 ? '...' : ''}\n\n` +
      `_${getTranslation('footer_grv_guidance', session.language)}_`
    );
  } 
  
  // Professional formatting for Appointment (else if because we searched both but might want to prioritize specific ID match)
  else if (appointment) {
    foundRecord = true;
    const statusEmoji: Record<string, string> = {
      'REQUESTED': '⏳',
      'SCHEDULED': '📅',
      'COMPLETED': '✅',
      'CANCELLED': '❌'
    };

    // Appointment is for official - use company name or specific official title
    const deptName = `Office of the Collector, ${company.name || 'Jharsuguda'}`;

    await sendWhatsAppMessage(
      company,
      message.from,
      `🗓️ *${getTranslation('header_apt_status', session.language)}*\n\n` +
      `*${getTranslation('label_date', session.language)}:* ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN')}\n` +
      `*${getTranslation('label_time', session.language)}:* ${appointment.appointmentTime}\n` +
      `*${getTranslation('label_ref_no', session.language)}:* \`${appointment.appointmentId}\`\n\n` +
      `*${getTranslation('label_department', session.language)}:* ${deptName}\n` +
      `*${getTranslation('label_citizen', session.language)}:* ${appointment.citizenName}\n` +
      `*${getTranslation('label_status', session.language)}:* ${statusEmoji[appointment.status] || '📌'} *${getTranslation(`status_${appointment.status}`, session.language)}*\n\n` +
      `*${getTranslation('label_purpose', session.language)}:* ${appointment.purpose}\n\n` +
      `_${getTranslation('footer_apt_guidance', session.language)}_`
    );
  }

  if (foundRecord) {
    // Show Navigation Options
    await sendWhatsAppButtons(
      company,
      message.from,
      getTranslation('mainMenu', session.language),
      [
        { id: 'track', title: getTranslation('nav_track_another', session.language) },
        { id: 'menu_back', title: getTranslation('nav_main_menu', session.language) }
      ]
    );
    session.step = 'awaiting_menu';
    await updateSession(session);
  } else {
    // Professional Error Handling
    await sendWhatsAppButtons(
      company,
      message.from,
      getTranslation('err_no_record_found', session.language) + 
      `\n\n${getTranslation('err_no_record_guidance', session.language).replace('{ref}', refNumber)}`,
      [
        { id: 'track', title: getTranslation('nav_track_another', session.language) },
        { id: 'menu_back', title: getTranslation('nav_main_menu', session.language) }
      ]
    );
    session.step = 'awaiting_menu';
    await updateSession(session);
  }
}




