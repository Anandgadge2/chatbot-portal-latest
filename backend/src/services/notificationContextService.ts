import { IGrievance } from '../models/Grievance';
import { IUser } from '../models/User';
import { IDepartment } from '../models/Department';
import moment from 'moment-timezone';

/**
 * Standard data dictionary for PugArch Connect Portal.
 * These keys are stable and can be used in any template variableMap.
 */
export interface INotificationContext {
  id: string;
  citizen_name: string;
  citizen_phone: string;
  status: string;
  department: string;
  office: string;
  description: string;
  created_at: string;
  admin_name: string;
  remarks: string;
  company_name: string;
  current_date: string;
  priority: string;
  previous_dept?: string;
  new_dept?: string;
  [key: string]: any;
}

/**
 * Service to build a flat, stable data dictionary from complex models.
 */
export class NotificationContextService {
  private static DEFAULT_PORTAL_NAME = 'PugArch Connect Portal';

  /**
   * Builds a context object for Grievance-related events.
   */
  static async buildGrievanceContext(
    grievance: any, 
    options: {
      admin?: any;
      department?: any;
      subDept?: any;
      remarks?: string;
      companyName?: string;
      language?: string;
      previousDept?: string;
      newDept?: string;
    } = {}
  ): Promise<INotificationContext> {
    const lang = options.language || 'en';
    const timezone = 'Asia/Kolkata';

    return {
      id: grievance.grievanceId || 'N/A',
      citizen_name: grievance.citizenName || 'Citizen',
      citizen_phone: grievance.citizenPhone || 'N/A',
      status: this.formatStatus(grievance.status, lang),
      department: options.department?.name || 'General',
      office: options.subDept?.name || 'N/A',
      description: this.sanitizeText(grievance.description || '', 400),
      created_at: moment(grievance.createdAt).tz(timezone).format('DD MMM YYYY, hh:mm A'),
      admin_name: options.admin?.fullName || options.admin?.firstName ? `${options.admin.firstName} ${options.admin.lastName || ''}` : 'Administrator',
      remarks: this.sanitizeText(options.remarks || grievance.remarks || '', 200),
      company_name: options.companyName || this.DEFAULT_PORTAL_NAME,
      current_date: moment().tz(timezone).format('DD MMM YYYY'),
      priority: grievance.priority || 'NORMAL',
      previous_dept: options.previousDept || 'N/A',
      new_dept: options.newDept || 'N/A'
    };
  }

  /**
   * Helper to format technical status into human-readable labels.
   */
  private static formatStatus(status: string, lang: string): string {
    const statusMap: Record<string, Record<string, string>> = {
      PENDING: { en: 'Pending', hi: 'लंबित' },
      IN_PROGRESS: { en: 'In Progress', hi: 'प्रगति पर है' },
      RESOLVED: { en: 'Resolved', hi: 'समाधान हो गया' },
      REJECTED: { en: 'Rejected', hi: 'अस्वीकार कर दिया' },
      REVERTED: { en: 'Reverted', hi: 'वापस भेज दिया' },
      ASSIGNED: { en: 'Assigned', hi: 'सौंपा गया' }
    };

    return statusMap[status]?.[lang] || statusMap[status]?.['en'] || status;
  }

  /**
   * Sanitizes text for WhatsApp (removes dangerous chars and limits length).
   */
  private static sanitizeText(text: string, maxLength: number): string {
    if (!text) return '';
    // Replace pipe chars as they break some template parsing
    const cleaned = text.replace(/\|/g, '-').replace(/\n/g, ' ');
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength - 3) + '...' : cleaned;
  }
}
