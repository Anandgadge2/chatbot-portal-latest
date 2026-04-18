export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED";
export type TemplateCategory = "UTILITY" | "AUTHENTICATION" | "MARKETING";

export interface WhatsAppTemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE";
  text: string;
  value: string;
}

export interface WhatsAppTemplate {
  _id: string;
  companyId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  body: {
    text: string;
    variables: number;
    sampleValues?: string[];
  };
  buttons: WhatsAppTemplateButton[];
  lastSyncedAt?: string;
  updatedAt?: string;
  mapping?: Record<string, string>;
}

export interface TemplateListResponse {
  success: boolean;
  data: WhatsAppTemplate[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type TemplateValidationState = "READY" | "MISSING_MAPPING" | "NOT_APPROVED";

export interface SendTemplatePayload {
  companyId: string;
  to: string;
  templateName: string;
  parameters: string[];
  language: string;
}
