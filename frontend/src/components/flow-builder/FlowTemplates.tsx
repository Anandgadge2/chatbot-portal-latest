'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Languages, User, Camera, MapPin, FileText, MessageSquare, CalendarDays, Search } from 'lucide-react';

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  steps: any[];
  triggers: any[];
}

/**
 * Dynamic placeholders (replaced from session/backend when the step runs):
 * - Grievance: {citizenName}, {category}, {description}, {grievanceId}, {department}, {date}
 * - Appointment: {citizenName}, {purpose}, {appointmentDate}, {appointmentTime}, {appointmentId}, {status}
 * - Track: {refNumber}, {status}, {assignedTo}, {remarks}, {recordType}
 */
export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'Jharsugda-full-flow',
    name: 'Collectorate Jharsugda– Full Citizen Services Flow (All-in-One)',
    description: 'Complete flow (Meta limits: max 3 buttons, 20 chars each): language selection (EN/Hi/Mr), main menu (Grievance, Appointment, Track), grievance, appointment, track status. Dynamic values from backend/session.',
    icon: <MessageSquare className="w-5 h-5" />,
    triggers: [
      { type: 'keyword', value: 'hi', startStepId: 'language_selection' },
    ],
    steps: [
      // Meta: max 3 buttons per message, 20 chars per button title
      {
        stepId: 'language_selection',
        type: 'interactive_buttons',
        content: {
          text: {
            en: '🇮🇳 *Collectorate Jharsugda - Official Digital Portal*\n\nNamaskar! Welcome to the official WhatsApp service of Collectorate Jharsugda Sahaj.\n\nWe are dedicated to providing transparent and efficient services to all citizens.\n\n👇 *Please select your preferred language:*'
          },
          buttons: [
            { id: 'lang_en', text: { en: '🇬🇧 English' }, nextStep: 'main_menu_en' },
            { id: 'lang_hi', text: { en: '🇮🇳 हिंदी' }, nextStep: 'main_menu_hi' },
            { id: 'lang_or', text: { en: '🇮🇳 ଓଡ଼ିଆ' }, nextStep: 'main_menu_or' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'lang_en', nextStepId: 'main_menu_en' },
          { type: 'button_click', value: 'lang_hi', nextStepId: 'main_menu_hi' },
          { type: 'button_click', value: 'lang_or', nextStepId: 'main_menu_or' }
        ],
        nextStep: null
      },
      {
        stepId: 'main_menu_en',
        type: 'interactive_buttons',
        content: {
          text: {
            en: '🏛️ *Citizen Services Menu*\n\nWelcome to the Collectorate Jharsugda Sahaj Digital Helpdesk.\n\n👇 *Please select a service:*'
          },
          buttons: [
            { id: 'grievance_en', text: { en: '📝 File Grievance' }, nextStep: 'grievance_start' },
            { id: 'appointment_en', text: { en: '📅 Book Appointment' }, nextStep: 'appointment_start' },
            { id: 'track_en', text: { en: '🔍 Track Status' }, nextStep: 'track_status' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'grievance_en', nextStepId: 'grievance_start' },
          { type: 'button_click', value: 'appointment_en', nextStepId: 'appointment_start' },
          { type: 'button_click', value: 'track_en', nextStepId: 'track_status' }
        ],
        nextStep: null
      },
      {
        stepId: 'main_menu_hi',
        type: 'interactive_buttons',
        content: {
          text: {
            en: '🏛️ *नागरिक सेवा मेनू*\n\nजिल्हाधिकारी कार्यालय झारसुगुडा सहज डिजिटल हेल्पडेस्क में आपका स्वागत है।\n\n👇 *कृपया एक सेवा चुनें:*'
          },
          buttons: [
            { id: 'grievance_hi', text: { en: '📝 शिकायत दर्ज करें' }, nextStep: 'grievance_start' },
            { id: 'appointment_hi', text: { en: '📅 अपॉइंटमेंट बुक' }, nextStep: 'appointment_start' },
            { id: 'track_hi', text: { en: '🔍 स्थिति ट्रैक करें' }, nextStep: 'track_status' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'grievance_hi', nextStepId: 'grievance_start' },
          { type: 'button_click', value: 'appointment_hi', nextStepId: 'appointment_start' },
          { type: 'button_click', value: 'track_hi', nextStepId: 'track_status' }
        ],
        nextStep: null
      },
      {
        stepId: 'main_menu_or',
        type: 'interactive_buttons',
        content: {
          text: {
            en: '🏛️ *ନାଗରିକ ସେବା ମେନୁ*\n\nଜିଲ୍ଲାପାଳ କାର୍ଯ୍ୟାଳୟ ଝାରସୁଗୁଡା ସହଜ ଡିଜିଟାଲ୍ ହେଲ୍ପଡେସ୍କରେ ଆପଣଙ୍କୁ ସ୍ବାଗତ କରୁଛି।\n\n👇 *ଦୟାକରି ଏକ ସେବା ଚୟନ କରନ୍ତୁ:*'
          },
          buttons: [
            { id: 'grievance_or', text: { en: '📝 ଫାଇଲ୍ ଅଭିଯୋଗ' }, nextStep: 'grievance_start' },
            { id: 'appointment_or', text: { en: '📅 ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍' }, nextStep: 'appointment_start' },
            { id: 'track_or', text: { en: '🔍 ଟ୍ରାକ୍ ସ୍ଥିତି' }, nextStep: 'track_status' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'grievance_or', nextStepId: 'grievance_start' },
          { type: 'button_click', value: 'appointment_or', nextStepId: 'appointment_start' },
          { type: 'button_click', value: 'track_or', nextStepId: 'track_status' }
        ],
        nextStep: null
      },
      { stepId: 'grievance_start', type: 'message', content: { text: { en: '📝 *Register a Grievance*\n\nYou can file a formal complaint regarding any department.\n\nTo begin, please provide the details as requested.' } }, nextStep: 'grievance_name' },
      {
        stepId: 'grievance_name',
        type: 'collect_input',
        content: {
          text: { en: '👤 *Citizen Identification*\n\nPlease enter your Full Name as per official documents:' },
          inputConfig: { inputType: 'text', saveToField: 'citizenName', validation: { required: true, minLength: 2, maxLength: 100 }, placeholder: 'Full name' }
        },
        expectedResponses: [{ type: 'any', value: '*', nextStepId: 'grievance_category' }],
        nextStep: 'grievance_category'
      },
      {
        stepId: 'grievance_category',
        type: 'message',
        content: { text: { en: '🏢 *Department Selection*\n\nPlease select the relevant department:' } },
        nextStep: 'grievance_description'
      },
      {
        stepId: 'grievance_description',
        type: 'collect_input',
        content: {
          text: { en: '✍️ *Grievance Details*\n\nPlease describe your issue in detail. Include date, location, and specific information for faster resolution.' },
          inputConfig: { inputType: 'text', saveToField: 'description', validation: { required: true, minLength: 10, maxLength: 1000 }, placeholder: 'Describe your grievance' }
        },
        nextStep: 'grievance_photo'
      },
      {
        stepId: 'grievance_photo',
        type: 'interactive_buttons',
        content: {
          text: { en: '📎 *Supporting Evidence (Optional)*\n\nUpload a photo or document to support your grievance. Supported: JPG, PNG, WEBP, PDF.' },
          buttons: [
            { id: 'photo_skip', text: { en: '⏭ Skip' }, nextStep: 'grievance_confirm' },
            { id: 'photo_upload', text: { en: '📤 Upload Photo' }, nextStep: 'grievance_photo_upload' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'photo_skip', nextStepId: 'grievance_confirm' },
          { type: 'button_click', value: 'photo_upload', nextStepId: 'grievance_photo_upload' }
        ],
        nextStep: null
      },
      { stepId: 'grievance_photo_upload', type: 'message', content: { text: { en: '📤 Please send a photo or document. You can skip by typing *back*.' } }, nextStep: 'grievance_confirm' },
      {
        stepId: 'grievance_confirm',
        type: 'interactive_buttons',
        content: {
          text: {
            en: '📋 *Confirm Submission*\n\n👤 Name: {citizenName}\n🏢 *Dept:* {department}\n📝 Issue: {description}\n\nIs the above information correct?'
          },
          buttons: [
            { id: 'confirm_yes', text: { en: '✅ Submit Grievance' }, nextStep: 'grievance_success' },
            { id: 'confirm_no', text: { en: '❌ Cancel' }, nextStep: 'main_menu_en' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'confirm_yes', nextStepId: 'grievance_success' },
          { type: 'button_click', value: 'confirm_no', nextStepId: 'main_menu_en' }
        ],
        nextStep: null
      },
      {
        stepId: 'grievance_success',
        type: 'message',
        content: {
          text: {
            en: '✅ *Grievance Registered Successfully*\n\nYour complaint has been logged in our system.\n\n🎫 *Ref No:* `{grievanceId}`\n🏢 *Dept:* {department}\n📅 *Date:* {date}\n\nYou will receive updates via WhatsApp.'
          }
        },
        nextStep: null
      },
      { stepId: 'appointment_start', type: 'message', content: { text: { en: '📅 *Book an Official Appointment*\n\nSchedule a meeting with the CEO, Zilla Parishad. Please provide the required details.' } }, nextStep: 'appointment_name' },
      {
        stepId: 'appointment_name',
        type: 'collect_input',
        content: {
          text: { en: '👤 *Your Name*\n\nPlease enter your Full Name (as per official records):' },
          inputConfig: { inputType: 'text', saveToField: 'citizenName', validation: { required: true, minLength: 2, maxLength: 100 } }
        },
        nextStep: 'appointment_purpose'
      },
      {
        stepId: 'appointment_purpose',
        type: 'collect_input',
        content: {
          text: { en: '🎯 *Purpose of Meeting*\n\nPlease briefly describe the purpose of your meeting:' },
          inputConfig: { inputType: 'text', saveToField: 'purpose', validation: { required: true, minLength: 5, maxLength: 500 } }
        },
        nextStep: 'appointment_date'
      },
      {
        stepId: 'appointment_date',
        type: 'dynamic_availability',
        content: {
          text: { en: '📅 *Preferred Date*\n\nSelect a date from the company&apos;s available slots:' },
          availabilityConfig: {
            type: 'date',
            saveToField: 'appointmentDate',
            dateRange: { startDays: 0, endDays: 30 },
            departmentId: null
          }
        },
        nextStep: 'appointment_time'
      },
      {
        stepId: 'appointment_time',
        type: 'dynamic_availability',
        content: {
          text: { en: '⏰ *Preferred Time*\n\nSelect a time slot from the available options:' },
          availabilityConfig: {
            type: 'time',
            saveToField: 'appointmentTime',
            departmentId: null
          }
        },
        nextStep: 'appointment_confirm'
      },
      {
        stepId: 'appointment_confirm',
        type: 'interactive_buttons',
        content: {
          text: {
            en: '📋 *Verify Appointment Details*\n\n👤 Name: {citizenName}\n🎯 Purpose: {purpose}\n📅 Date: {appointmentDate}\n⏰ Time: {appointmentTime}\n\nIs the above information correct?'
          },
          buttons: [
            { id: 'appt_confirm_yes', text: { en: '✅ Confirm Booking' }, nextStep: 'appointment_submitted' },
            { id: 'appt_confirm_no', text: { en: '❌ Cancel' }, nextStep: 'main_menu_en' }
          ]
        },
        expectedResponses: [
          { type: 'button_click', value: 'appt_confirm_yes', nextStepId: 'appointment_submitted' },
          { type: 'button_click', value: 'appt_confirm_no', nextStepId: 'main_menu_en' }
        ],
        nextStep: null
      },
      {
        stepId: 'appointment_submitted',
        type: 'message',
        content: {
          text: {
            en: '✅ *Appointment Request Submitted*\n\nYour appointment request has been received.\n\n📄 *Ref No:* `{appointmentId}`\n👤 *Name:* {citizenName}\n📅 *Requested Date:* {appointmentDate}\n⏰ *Requested Time:* {appointmentTime}\n🎯 *Purpose:* {purpose}\n\n⏳ *Status:* {status}\n\nYou will be notified once the appointment is scheduled.'
          }
        },
        nextStep: null
      },
      {
        stepId: 'track_status',
        type: 'collect_input',
        content: {
          text: { en: '🔍 *Track Status*\n\nPlease enter your Reference Number (e.g., GRV00000001 or APT00000001):' },
          inputConfig: { inputType: 'text', saveToField: 'refNumber', validation: { required: true, minLength: 5, maxLength: 30 }, placeholder: 'Reference number' }
        },
        nextStep: 'track_result'
      },
      {
        stepId: 'track_result',
        type: 'message',
        content: {
          text: {
            en: '📄 *Status for Ref: {refNumber}*\n\n*Type:* {recordType}\n*Status:* {status}\n*Assigned to:* {assignedTo}\n\n📝 *Remarks:* {remarks}\n\n_Values are filled from backend when you add an API step to fetch grievance/appointment by ref number._'
          }
        },
        nextStep: null
      },
      {
        stepId: 'rts_service_selection',
        type: 'message',
        content: {
          text: { en: '📋 *Right to Service (RTS)*\n\nRTS services are being configured. Please contact the office or type *Hi* to return to the main menu.' }
        },
        nextStep: null
      }
    ]
  },

];

interface FlowTemplatesProps {
  onSelectTemplate: (template: FlowTemplate) => void;
}

export function FlowTemplates({ onSelectTemplate }: FlowTemplatesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📋 Flow Templates</h3>
        <p className="text-sm text-gray-500">Quick start with pre-built flows</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FLOW_TEMPLATES.map((template) => (
          <Card 
            key={template.id} 
            className="cursor-pointer hover:border-purple-400 transition-all"
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                  {template.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {template.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{template.steps.length} steps</span>
                <Button size="sm" variant="outline" className="text-xs">
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
