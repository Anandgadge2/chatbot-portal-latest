import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import CompanyEmailConfig from '../models/CompanyEmailConfig';
import CompanyEmailTemplate from '../models/CompanyEmailTemplate';
import CompanyWhatsAppTemplate from '../models/CompanyWhatsAppTemplate';

/**
 * Reusable SMTP transporter from env (singleton, fallback)
 */
let envTransporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

const createEnvTransporter = (): Transporter<SMTPTransport.SentMessageInfo> | null => {
  if (envTransporter) return envTransporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const options: SMTPTransport.Options = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: true }
  };
  envTransporter = nodemailer.createTransport(options);
  return envTransporter;
};

/**
 * Get transporter for a company from DB (CompanyEmailConfig). Prefer DB over env.
 */
export async function getTransporterForCompany(companyId: string | mongoose.Types.ObjectId): Promise<Transporter<SMTPTransport.SentMessageInfo> | null> {
  try {
    const id = typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId)
      ? new mongoose.Types.ObjectId(companyId)
      : companyId;
    const config = await CompanyEmailConfig.findOne({ companyId: id, isActive: true });
    if (!config) return null;
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.port === 587,
      auth: config.auth,
      tls: { rejectUnauthorized: true }
    } as SMTPTransport.Options);
  } catch (e) {
    logger.warn('getTransporterForCompany failed:', e);
    return null;
  }
}

export interface SendEmailOptions {
  companyId?: string | mongoose.Types.ObjectId;
}

/**
 * Send email notification. Uses company SMTP from DB when options.companyId is set; otherwise env.
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
  options?: SendEmailOptions
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const recipients = Array.isArray(to) ? to : [to];
    const invalidEmails = recipients.filter(email => !email || !email.includes('@'));
    if (invalidEmails.length > 0) {
      const errorMsg = `Invalid email address(es): ${invalidEmails.join(', ')}`;
      logger.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    let transport: Transporter<SMTPTransport.SentMessageInfo> | null = null;
    let fromLine: string;

    if (options?.companyId) {
      transport = await getTransporterForCompany(options.companyId);
      if (transport) {
        const config = await CompanyEmailConfig.findOne({
          companyId: options.companyId,
          isActive: true
        });
        fromLine = config
          ? `"${config.fromName}" <${config.fromEmail}>`
          : `"Dashboard" <noreply@dashboard.local>`;
      }
    }

    if (!transport) {
      transport = createEnvTransporter();
      if (!transport) {
        const errorMsg = 'SMTP not configured. Set company Email Config (DB) or SMTP_* env variables.';
        logger.warn(`⚠️ ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
      fromLine = `"${process.env.SMTP_FROM_NAME || 'Zilla Parishad Amravati'}" <${process.env.SMTP_USER}>`;
    }

    const mailOptions: SendMailOptions = {
      from: fromLine!,
      to: recipients.join(', '),
      subject,
      text: text ?? subject,
      html
    };

    logger.info(`📧 Attempting to send email to: ${recipients.join(', ')}`);
    const info = await transport.sendMail(mailOptions);
    logger.info(`✅ Email sent successfully to ${recipients.join(', ')} - Message ID: ${info.messageId}`);

    return { success: true };
  } catch (err: any) {
    let errorMessage = 'Unknown email error';
    if (err instanceof Error) {
      errorMessage = err.message;
      if (err.message.includes('Invalid login')) errorMessage = 'Invalid SMTP credentials.';
      else if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) errorMessage = 'Cannot connect to SMTP server.';
    }
    logger.error(`❌ Failed to send email:`, { error: errorMessage, details: err });
    return { success: false, error: errorMessage };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(companyId?: string | mongoose.Types.ObjectId): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    if (companyId) {
      const transport = await getTransporterForCompany(companyId);
      if (!transport) {
        return { success: false, error: 'No email config found for this company' };
      }
      await transport.verify();
      const config = await CompanyEmailConfig.findOne({ companyId, isActive: true });
      return {
        success: true,
        details: config
          ? { host: config.host, port: config.port, fromName: config.fromName, fromEmail: config.fromEmail }
          : undefined
      };
    }

    const transport = createEnvTransporter();
    if (!transport) {
      return {
        success: false,
        error: 'SMTP credentials not configured',
        details: {
          SMTP_USER: process.env.SMTP_USER ? 'Set' : 'Missing',
          SMTP_PASS: process.env.SMTP_PASS ? 'Set' : 'Missing',
          SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com (default)',
          SMTP_PORT: process.env.SMTP_PORT || '465 (default)'
        }
      };
    }
    
    // Test connection by verifying credentials
    await transport.verify();
    
    return {
      success: true,
      details: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || '465',
        user: process.env.SMTP_USER,
        fromName: process.env.SMTP_FROM_NAME || 'Zilla Parishad Amravati'
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      details: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || '465',
        user: process.env.SMTP_USER,
        error: err
      }
    };
  }
}

/**
 * Format date and time in a readable format
 */
function formatDateTime(date: Date | string | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date in a readable format
 */
function formatDate(date: Date | string | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format timeline details in a human-readable way
 */
function formatTimelineDetails(details: any, action: string): string {
  if (!details) return '';
  
  if (typeof details === 'string') {
    return details;
  }
  
  if (typeof details !== 'object') {
    return String(details);
  }
  
  // Format based on action type
  if (action === 'ASSIGNED') {
    const parts: string[] = [];
    if (details.fromUserId && details.toUserId) {
      parts.push(`Reassigned from previous officer to ${details.toUserName || 'new officer'}`);
    } else if (details.toUserId) {
      parts.push(`Assigned to ${details.toUserName || 'officer'}`);
    }
    if (details.reason) {
      parts.push(`Reason: ${details.reason}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'Assignment updated';
  }
  
  if (action === 'STATUS_UPDATED') {
    const parts: string[] = [];
    if (details.fromStatus && details.toStatus) {
      parts.push(`Status changed from ${details.fromStatus} to ${details.toStatus}`);
    }
    if (details.remarks) {
      parts.push(`Remarks: ${details.remarks}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'Status updated';
  }
  
  if (action === 'DEPARTMENT_TRANSFER') {
    const parts: string[] = [];
    if (details.toDepartmentId) {
      parts.push('Transferred to different department');
    }
    if (details.reason) {
      parts.push(`Reason: ${details.reason}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'Department transfer';
  }
  
  if (action === 'CREATED') {
    const parts: string[] = [];
    if (details.purpose) {
      parts.push(`Purpose: ${details.purpose}`);
    }
    if (details.date) {
      parts.push(`Scheduled: ${formatDate(details.date)}`);
    }
    if (details.time) {
      parts.push(`Time: ${details.time}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'Created by citizen';
  }
  
  // Fallback: format object keys nicely
  const formatted: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (value !== null && value !== undefined) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      formatted.push(`${formattedKey}: ${value}`);
    }
  }
  return formatted.length > 0 ? formatted.join(', ') : '';
}

/**
 * Generate timeline HTML
 */
function generateTimelineHTML(timeline: any[] | undefined, resolvedBy: any, resolvedAt: Date | string | undefined, createdAt: Date | string | undefined, assignedAt: Date | string | undefined): string {
  if (!timeline || timeline.length === 0) {
    // Generate basic timeline from available data
    let timelineItems = [];
    
    if (createdAt) {
      timelineItems.push({
        action: 'CREATED',
        timestamp: createdAt,
        performedBy: null,
        details: 'Grievance/Appointment was created by the citizen'
      });
    }
    
    if (assignedAt) {
      timelineItems.push({
        action: 'ASSIGNED',
        timestamp: assignedAt,
        performedBy: null,
        details: 'Assigned to an officer for resolution'
      });
    }
    
    if (resolvedAt && resolvedBy) {
      timelineItems.push({
        action: 'RESOLVED',
        timestamp: resolvedAt,
        performedBy: resolvedBy,
        details: 'Resolved by assigned officer'
      });
    }
    
    if (timelineItems.length === 0) return '';
    
    let html = '<div class="timeline-section"><h3 style="color: #0f4c81; margin-top: 20px; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #0f4c81; padding-bottom: 8px;">📋 Processing Timeline</h3><div class="timeline">';
    
    timelineItems.forEach((item, index) => {
      const isLast = index === timelineItems.length - 1;
      const performerName = item.performedBy 
        ? (typeof item.performedBy === 'object' 
          ? `${item.performedBy.firstName || ''} ${item.performedBy.lastName || ''}`.trim() 
          : 'Officer')
        : 'System';
      
      html += `
        <div class="timeline-item">
          <div class="timeline-marker ${isLast ? 'active' : ''}"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <strong>${item.action === 'CREATED' ? '📝 Created' : item.action === 'ASSIGNED' ? '👤 Assigned' : '✅ Resolved'}</strong>
              <span class="timeline-date">${formatDateTime(item.timestamp)}</span>
            </div>
            <div class="timeline-details">${item.details}</div>
            ${item.performedBy ? `<div class="timeline-officer">👨‍💼 Officer: ${performerName}</div>` : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
    return html;
  }
  
  // Use provided timeline
  let html = '<div class="timeline-section"><h3 style="color: #0f4c81; margin-top: 20px; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #0f4c81; padding-bottom: 8px;">📋 Processing Timeline</h3><div class="timeline">';
  
  timeline.forEach((item, index) => {
    const isLast = index === timeline.length - 1;
    const performerName = item.performedBy 
      ? (typeof item.performedBy === 'object' 
        ? `${item.performedBy.firstName || ''} ${item.performedBy.lastName || ''}`.trim() 
        : typeof item.performedBy === 'string' 
          ? 'Officer'
          : 'Officer')
      : 'System';
    
    const actionLabel = item.action === 'CREATED' ? '📝 Created' 
      : item.action === 'ASSIGNED' ? '👤 Assigned'
      : item.action === 'STATUS_UPDATED' ? '🔄 Status Updated'
      : item.action === 'RESOLVED' ? '✅ Resolved'
      : item.action;
    
    html += `
      <div class="timeline-item">
        <div class="timeline-marker ${isLast ? 'active' : ''}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <strong>${actionLabel}</strong>
            <span class="timeline-date">${formatDateTime(item.timestamp)}</span>
          </div>
          ${item.details ? `<div class="timeline-details">${formatTimelineDetails(item.details, item.action)}</div>` : ''}
          ${item.performedBy ? `<div class="timeline-officer">👨‍💼 Officer: ${performerName}</div>` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div></div>';
  return html;
}

/**
 * Replace placeholders in a string with data values. E.g. {citizenName} -> data.citizenName
 */
export function replacePlaceholders(str: string, data: Record<string, any>): string {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    const v = data[key];
    return v != null ? String(v) : `{${key}}`;
  });
}

/**
 * Get email content for a notification: use company custom template if set, else built-in.
 */
export async function getNotificationEmailContent(
  companyId: string | mongoose.Types.ObjectId,
  type: 'grievance' | 'appointment',
  action: 'created' | 'assigned' | 'resolved',
  data: any
): Promise<{ subject: string; html: string; text: string }> {
  const key = `${type}_${action}` as 'grievance_created' | 'grievance_assigned' | 'grievance_resolved' | 'appointment_created' | 'appointment_assigned' | 'appointment_resolved';
  const cid = typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId)
    ? new mongoose.Types.ObjectId(companyId)
    : companyId;
  const template = await CompanyEmailTemplate.findOne({ companyId: cid, templateKey: key, isActive: true });
  if (template && template.subject && template.htmlBody) {
    const subject = replacePlaceholders(template.subject, data);
    const html = replacePlaceholders(template.htmlBody, data);
    const text = template.textBody ? replacePlaceholders(template.textBody, data) : subject;
    return { subject, html, text };
  }
  return generateNotificationEmail(type, action, data);
}

/**
 * Get WhatsApp message for a notification: use company custom template if set, else return null (caller uses default).
 */
export async function getNotificationWhatsAppMessage(
  companyId: string | mongoose.Types.ObjectId,
  type: 'grievance' | 'appointment',
  action: 'created' | 'assigned' | 'resolved',
  data: Record<string, any>
): Promise<string | null> {
  const key = `${type}_${action}`;
  const cid = typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId)
    ? new mongoose.Types.ObjectId(companyId)
    : companyId;
  const template = await CompanyWhatsAppTemplate.findOne({ companyId: cid, templateKey: key as any, isActive: true });
  if (template && template.message && template.message.trim()) {
    return replacePlaceholders(template.message.trim(), data);
  }
  return null;
}

/**
 * Generate HTML email template for grievance/appointment notifications
 */
export function generateNotificationEmail(
  type: 'grievance' | 'appointment',
  action: 'created' | 'assigned' | 'resolved',
  data: any
): { subject: string; html: string; text: string } {
  const companyName = data.companyName || 'Zilla Parishad Amravati';
  const recipientName = data.recipientName || 'Sir/Madam';

  // Common styles
  const commonStyles = `
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.8; 
      color: #2c3e50; 
      background-color: #f5f7fa;
      margin: 0;
      padding: 0;
    }
    .email-container { 
      max-width: 650px; 
      margin: 20px auto; 
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #0f4c81 0%, #1a5f9f 100%); 
      color: white; 
      padding: 30px 20px; 
      text-align: center;
    }
    .header h2 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { 
      padding: 30px; 
      background: #ffffff;
    }
    .greeting {
      font-size: 16px;
      color: #2c3e50;
      margin-bottom: 20px;
    }
    .intro-text {
      font-size: 15px;
      color: #34495e;
      margin-bottom: 25px;
      line-height: 1.8;
    }
    .detail-box {
      background: #f8f9fa;
      border-left: 4px solid #0f4c81;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .detail-row { 
      margin: 12px 0; 
      display: flex;
      align-items: flex-start;
    }
    .detail-label { 
      font-weight: 600; 
      color: #0f4c81; 
      min-width: 140px;
      font-size: 14px;
    }
    .detail-value { 
      color: #2c3e50; 
      flex: 1;
      font-size: 14px;
    }
    .priority-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .priority-urgent { background: #fee; color: #c00; }
    .priority-high { background: #ffeaa7; color: #d63031; }
    .priority-medium { background: #dfe6e9; color: #2d3436; }
    .priority-low { background: #e8f5e9; color: #27ae60; }
    .remarks-box { 
      background: #e8f5e9; 
      padding: 18px; 
      border-left: 4px solid #28a745; 
      margin: 20px 0; 
      border-radius: 4px;
    }
    .remarks-title {
      font-weight: 600;
      color: #155724;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .remarks-text {
      color: #2c3e50;
      font-size: 14px;
      line-height: 1.7;
    }
    .timeline-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
    }
    .timeline {
      position: relative;
      padding-left: 30px;
      margin-top: 15px;
    }
    .timeline-item {
      position: relative;
      margin-bottom: 25px;
    }
    .timeline-marker {
      position: absolute;
      left: -37px;
      top: 5px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #bdc3c7;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 2px #bdc3c7;
    }
    .timeline-marker.active {
      background: #28a745;
      box-shadow: 0 0 0 2px #28a745;
    }
    .timeline-item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: -31px;
      top: 17px;
      width: 2px;
      height: calc(100% + 8px);
      background: #e0e0e0;
    }
    .timeline-content {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .timeline-header strong {
      color: #0f4c81;
      font-size: 14px;
    }
    .timeline-date {
      color: #7f8c8d;
      font-size: 12px;
    }
    .timeline-details {
      color: #2c3e50;
      font-size: 13px;
      margin-bottom: 5px;
    }
    .timeline-officer {
      color: #27ae60;
      font-size: 12px;
      font-weight: 500;
      margin-top: 5px;
    }
    .footer { 
      background: #f8f9fa;
      text-align: center; 
      color: #7f8c8d; 
      font-size: 12px; 
      padding: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .footer-text {
      margin: 5px 0;
    }
    .action-button {
      display: inline-block;
      background: #0f4c81;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 20px;
      font-weight: 500;
    }
  `;

  if (action === 'created' && type === 'grievance') {
    const priorityClass = data.priority 
      ? `priority-${data.priority.toLowerCase()}` 
      : 'priority-medium';
    
    return {
      subject: `New Grievance Received - ${data.grievanceId} | ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${commonStyles}</style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h2>📋 New Grievance Received</h2>
            </div>
            <div class="content">
              <div class="greeting">
                <strong>Respected ${recipientName},</strong>
              </div>
              <div class="intro-text">
                This is to inform you that a new grievance has been received through our digital portal and has been assigned to your department for immediate attention and necessary action.
              </div>
              
              <div class="detail-box">
                <div class="detail-row">
                  <span class="detail-label">Grievance ID:</span>
                  <span class="detail-value"><strong style="color: #0f4c81;">${data.grievanceId}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Citizen Name:</span>
                  <span class="detail-value">${data.citizenName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Number:</span>
                  <span class="detail-value">${data.citizenPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span class="detail-value"><strong>${data.departmentName}</strong></span>
                </div>
                ${data.category ? `
                <div class="detail-row">
                  <span class="detail-label">Category:</span>
                  <span class="detail-value">${data.category}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Priority Level:</span>
                  <span class="detail-value">
                    <span class="priority-badge ${priorityClass}">${data.priority || 'MEDIUM'}</span>
                  </span>
                </div>
                ${data.location ? `
                <div class="detail-row">
                  <span class="detail-label">Location:</span>
                  <span class="detail-value">${data.location}</span>
                </div>
                ` : ''}
                <div class="detail-row" style="align-items: flex-start;">
                  <span class="detail-label">Description:</span>
                  <span class="detail-value" style="white-space: pre-wrap;">${data.description || 'No description provided'}</span>
                </div>
                ${data.createdAt ? `
                <div class="detail-row">
                  <span class="detail-label">Received On:</span>
                  <span class="detail-value">${formatDateTime(data.createdAt)}</span>
                </div>
                ` : ''}
              </div>

              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #856404;">⚠️ Action Required:</strong>
                <p style="margin: 8px 0 0 0; color: #856404; font-size: 14px;">
                  Please review this grievance at your earliest convenience and take appropriate action. Kindly ensure timely resolution as per the service level agreement (SLA) guidelines.
                </p>
              </div>

              ${generateTimelineHTML(data.timeline, undefined, undefined, data.createdAt, undefined)}
            </div>
            <div class="footer">
              <div class="footer-text"><strong>${companyName}</strong></div>
              <div class="footer-text">Digital Grievance Redressal System</div>
              <div class="footer-text" style="margin-top: 10px; font-size: 11px;">
                This is an automated notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `NEW GRIEVANCE RECEIVED\n\nRespected ${recipientName},\n\nA new grievance has been received and assigned to your department.\n\nGrievance ID: ${data.grievanceId}\nCitizen Name: ${data.citizenName}\nContact: ${data.citizenPhone}\nDepartment: ${data.departmentName}\nCategory: ${data.category || 'N/A'}\nPriority: ${data.priority || 'MEDIUM'}\nDescription: ${data.description}\n${data.location ? `Location: ${data.location}\n` : ''}${data.createdAt ? `Received On: ${formatDateTime(data.createdAt)}\n` : ''}\n\nPlease review and take necessary action.\n\n${companyName} - Digital Portal`
    };
  }

  if (action === 'created' && type === 'appointment') {
    return {
      subject: `New Appointment Booking Received - ${data.appointmentId} | ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${commonStyles}</style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h2>📅 New Appointment Booking Received</h2>
            </div>
            <div class="content">
              <div class="greeting">
                <strong>Respected ${recipientName},</strong>
              </div>
              <div class="intro-text">
                This is to inform you that a new appointment has been booked through our digital portal and has been assigned to your department for scheduling and management.
              </div>
              
              <div class="detail-box">
                <div class="detail-row">
                  <span class="detail-label">Appointment ID:</span>
                  <span class="detail-value"><strong style="color: #0f4c81;">${data.appointmentId}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Citizen Name:</span>
                  <span class="detail-value">${data.citizenName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Number:</span>
                  <span class="detail-value">${data.citizenPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span class="detail-value"><strong>${data.departmentName}</strong></span>
                </div>
                <div class="detail-row" style="align-items: flex-start;">
                  <span class="detail-label">Purpose:</span>
                  <span class="detail-value" style="white-space: pre-wrap;">${data.purpose || 'No purpose specified'}</span>
                </div>
                ${data.appointmentDate ? `
                <div class="detail-row">
                  <span class="detail-label">Scheduled Date:</span>
                  <span class="detail-value"><strong>${formatDate(data.appointmentDate)}</strong></span>
                </div>
                ` : ''}
                ${data.appointmentTime ? `
                <div class="detail-row">
                  <span class="detail-label">Scheduled Time:</span>
                  <span class="detail-value"><strong>${data.appointmentTime}</strong></span>
                </div>
                ` : ''}
                ${data.createdAt ? `
                <div class="detail-row">
                  <span class="detail-label">Booked On:</span>
                  <span class="detail-value">${formatDateTime(data.createdAt)}</span>
                </div>
                ` : ''}
              </div>

              <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #0c5460;">ℹ️ Information:</strong>
                <p style="margin: 8px 0 0 0; color: #0c5460; font-size: 14px;">
                  Please review this appointment booking and ensure proper scheduling. Kindly confirm the appointment with the citizen and make necessary arrangements.
                </p>
              </div>

              ${generateTimelineHTML(data.timeline, undefined, undefined, data.createdAt, undefined)}
            </div>
            <div class="footer">
              <div class="footer-text"><strong>${companyName}</strong></div>
              <div class="footer-text">Digital Appointment Booking System</div>
              <div class="footer-text" style="margin-top: 10px; font-size: 11px;">
                This is an automated notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `NEW APPOINTMENT BOOKING RECEIVED\n\nRespected ${recipientName},\n\nA new appointment has been booked and assigned to your department.\n\nAppointment ID: ${data.appointmentId}\nCitizen Name: ${data.citizenName}\nContact: ${data.citizenPhone}\nDepartment: ${data.departmentName}\nPurpose: ${data.purpose}\n${data.appointmentDate ? `Scheduled Date: ${formatDate(data.appointmentDate)}\n` : ''}${data.appointmentTime ? `Scheduled Time: ${data.appointmentTime}\n` : ''}${data.createdAt ? `Booked On: ${formatDateTime(data.createdAt)}\n` : ''}\n\nPlease review and confirm the appointment.\n\n${companyName} - Digital Portal`
    };
  }

  if (action === 'assigned' && type === 'grievance') {
    const priorityClass = data.priority 
      ? `priority-${data.priority.toLowerCase()}` 
      : 'priority-medium';
    
    const assignedByName = data.assignedByName || 'Administrator';
    
    return {
      subject: `Grievance Assigned to You - ${data.grievanceId} | ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${commonStyles}</style>
        </head>
        <body>
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);">
              <h2>👤 Grievance Assigned to You</h2>
            </div>
            <div class="content">
              <div class="greeting">
                <strong>Respected ${recipientName},</strong>
              </div>
              <div class="intro-text">
                This is to inform you that a grievance has been assigned to you for resolution. You are requested to review the details and take necessary action at the earliest.
              </div>
              
              <div class="detail-box">
                <div class="detail-row">
                  <span class="detail-label">Grievance ID:</span>
                  <span class="detail-value"><strong style="color: #1a73e8;">${data.grievanceId}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Citizen Name:</span>
                  <span class="detail-value">${data.citizenName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Number:</span>
                  <span class="detail-value">${data.citizenPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span class="detail-value"><strong>${data.departmentName}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Priority Level:</span>
                  <span class="detail-value">
                    <span class="priority-badge ${priorityClass}">${data.priority || 'MEDIUM'}</span>
                  </span>
                </div>
                <div class="detail-row" style="align-items: flex-start;">
                  <span class="detail-label">Description:</span>
                  <span class="detail-value" style="white-space: pre-wrap;">${data.description || 'No description provided'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Assigned By:</span>
                  <span class="detail-value">${assignedByName}</span>
                </div>
                ${data.assignedAt ? `
                <div class="detail-row">
                  <span class="detail-label">Assigned On:</span>
                  <span class="detail-value">${formatDateTime(data.assignedAt)}</span>
                </div>
                ` : ''}
              </div>

              <div style="background: #e3f2fd; border-left: 4px solid #1a73e8; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #1565c0;">📌 Your Action Required:</strong>
                <p style="margin: 8px 0 0 0; color: #1565c0; font-size: 14px;">
                  Please contact the citizen, investigate the matter, and provide a resolution. Kindly update the status and add remarks as you progress with the resolution process.
                </p>
              </div>

              ${generateTimelineHTML(data.timeline, undefined, undefined, data.createdAt, data.assignedAt)}
            </div>
            <div class="footer">
              <div class="footer-text"><strong>${companyName}</strong></div>
              <div class="footer-text">Digital Grievance Redressal System</div>
              <div class="footer-text" style="margin-top: 10px; font-size: 11px;">
                This is an automated notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `GRIEVANCE ASSIGNED TO YOU\n\nRespected ${recipientName},\n\nA grievance has been assigned to you for resolution.\n\nGrievance ID: ${data.grievanceId}\nCitizen Name: ${data.citizenName}\nContact: ${data.citizenPhone}\nDepartment: ${data.departmentName}\nPriority: ${data.priority || 'MEDIUM'}\nDescription: ${data.description}\nAssigned By: ${assignedByName}\n${data.assignedAt ? `Assigned On: ${formatDateTime(data.assignedAt)}\n` : ''}\n\nPlease review and take necessary action.\n\n${companyName} - Digital Portal`
    };
  }

  if (action === 'assigned' && type === 'appointment') {
    const assignedByName = data.assignedByName || 'Administrator';
    
    return {
      subject: `Appointment Assigned to You - ${data.appointmentId} | ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${commonStyles}</style>
        </head>
        <body>
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);">
              <h2>📅 Appointment Assigned to You</h2>
            </div>
            <div class="content">
              <div class="greeting">
                <strong>Respected ${recipientName},</strong>
              </div>
              <div class="intro-text">
                This is to inform you that an appointment has been assigned to you for management. You are requested to review the details and ensure proper scheduling and coordination.
              </div>
              
              <div class="detail-box">
                <div class="detail-row">
                  <span class="detail-label">Appointment ID:</span>
                  <span class="detail-value"><strong style="color: #1a73e8;">${data.appointmentId}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Citizen Name:</span>
                  <span class="detail-value">${data.citizenName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Number:</span>
                  <span class="detail-value">${data.citizenPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span class="detail-value"><strong>${data.departmentName}</strong></span>
                </div>
                <div class="detail-row" style="align-items: flex-start;">
                  <span class="detail-label">Purpose:</span>
                  <span class="detail-value" style="white-space: pre-wrap;">${data.purpose || 'No purpose specified'}</span>
                </div>
                ${data.appointmentDate ? `
                <div class="detail-row">
                  <span class="detail-label">Scheduled Date:</span>
                  <span class="detail-value"><strong>${formatDate(data.appointmentDate)}</strong></span>
                </div>
                ` : ''}
                ${data.appointmentTime ? `
                <div class="detail-row">
                  <span class="detail-label">Scheduled Time:</span>
                  <span class="detail-value"><strong>${data.appointmentTime}</strong></span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Assigned By:</span>
                  <span class="detail-value">${assignedByName}</span>
                </div>
                ${data.assignedAt ? `
                <div class="detail-row">
                  <span class="detail-label">Assigned On:</span>
                  <span class="detail-value">${formatDateTime(data.assignedAt)}</span>
                </div>
                ` : ''}
              </div>

              <div style="background: #e3f2fd; border-left: 4px solid #1a73e8; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #1565c0;">📌 Your Action Required:</strong>
                <p style="margin: 8px 0 0 0; color: #1565c0; font-size: 14px;">
                  Please confirm the appointment with the citizen, ensure all necessary arrangements are made, and update the status accordingly.
                </p>
              </div>

              ${generateTimelineHTML(data.timeline, undefined, undefined, data.createdAt, data.assignedAt)}
            </div>
            <div class="footer">
              <div class="footer-text"><strong>${companyName}</strong></div>
              <div class="footer-text">Digital Appointment Booking System</div>
              <div class="footer-text" style="margin-top: 10px; font-size: 11px;">
                This is an automated notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `APPOINTMENT ASSIGNED TO YOU\n\nRespected ${recipientName},\n\nAn appointment has been assigned to you for management.\n\nAppointment ID: ${data.appointmentId}\nCitizen Name: ${data.citizenName}\nContact: ${data.citizenPhone}\nDepartment: ${data.departmentName}\nPurpose: ${data.purpose}\n${data.appointmentDate ? `Scheduled Date: ${formatDate(data.appointmentDate)}\n` : ''}${data.appointmentTime ? `Scheduled Time: ${data.appointmentTime}\n` : ''}Assigned By: ${assignedByName}\n${data.assignedAt ? `Assigned On: ${formatDateTime(data.assignedAt)}\n` : ''}\n\nPlease review and confirm the appointment.\n\n${companyName} - Digital Portal`
    };
  }

  if (action === 'resolved' && type === 'grievance') {
    const resolvedByName = data.resolvedBy 
      ? (typeof data.resolvedBy === 'object' 
        ? `${data.resolvedBy.firstName || ''} ${data.resolvedBy.lastName || ''}`.trim() 
        : 'Officer')
      : 'Assigned Officer';
    
    const resolvedAtFormatted = data.resolvedAt ? formatDateTime(data.resolvedAt) : 'N/A';
    const createdAtFormatted = data.createdAt ? formatDateTime(data.createdAt) : 'N/A';
    
    // Calculate resolution time
    let resolutionTime = '';
    if (data.createdAt && data.resolvedAt) {
      const created = typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt;
      const resolved = typeof data.resolvedAt === 'string' ? new Date(data.resolvedAt) : data.resolvedAt;
      const diffMs = resolved.getTime() - created.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (diffDays > 0) {
        resolutionTime = `${diffDays} day${diffDays > 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else {
        resolutionTime = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      }
    }
    
    return {
      subject: `Grievance Resolved - ${data.grievanceId} | ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${commonStyles}</style>
        </head>
        <body>
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
              <h2>✅ Grievance Successfully Resolved</h2>
            </div>
            <div class="content">
              <div class="greeting">
                <strong>Respected ${recipientName},</strong>
              </div>
              <div class="intro-text">
                This is to inform you that the following grievance has been successfully resolved by the assigned officer. The details of the resolution are provided below for your reference.
              </div>
              
              <div class="detail-box">
                <div class="detail-row">
                  <span class="detail-label">Grievance ID:</span>
                  <span class="detail-value"><strong style="color: #28a745;">${data.grievanceId}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Citizen Name:</span>
                  <span class="detail-value">${data.citizenName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Number:</span>
                  <span class="detail-value">${data.citizenPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span class="detail-value"><strong>${data.departmentName || 'N/A'}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value"><strong style="color: #28a745;">RESOLVED</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Resolved By:</span>
                  <span class="detail-value"><strong>${resolvedByName}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Resolved On:</span>
                  <span class="detail-value">${resolvedAtFormatted}</span>
                </div>
                ${resolutionTime ? `
                <div class="detail-row">
                  <span class="detail-label">Resolution Time:</span>
                  <span class="detail-value"><strong>${resolutionTime}</strong></span>
                </div>
                ` : ''}
                ${data.createdAt ? `
                <div class="detail-row">
                  <span class="detail-label">Received On:</span>
                  <span class="detail-value">${createdAtFormatted}</span>
                </div>
                ` : ''}
              </div>

              ${data.remarks ? `
              <div class="remarks-box">
                <div class="remarks-title">📝 Officer's Resolution Remarks:</div>
                <div class="remarks-text">${data.remarks}</div>
              </div>
              ` : ''}

              ${generateTimelineHTML(data.timeline, data.resolvedBy, data.resolvedAt, data.createdAt, data.assignedAt)}

              <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #155724;">✓ Resolution Confirmed:</strong>
                <p style="margin: 8px 0 0 0; color: #155724; font-size: 14px;">
                  This grievance has been marked as resolved. The citizen has been notified of the resolution. If you have any concerns or require further information, please contact the assigned officer.
                </p>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text"><strong>${companyName}</strong></div>
              <div class="footer-text">Digital Grievance Redressal System</div>
              <div class="footer-text" style="margin-top: 10px; font-size: 11px;">
                This is an automated notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `GRIEVANCE RESOLVED\n\nRespected ${recipientName},\n\nThe following grievance has been successfully resolved.\n\nGrievance ID: ${data.grievanceId}\nCitizen Name: ${data.citizenName}\nContact: ${data.citizenPhone}\nDepartment: ${data.departmentName || 'N/A'}\nStatus: RESOLVED\nResolved By: ${resolvedByName}\nResolved On: ${resolvedAtFormatted}\n${resolutionTime ? `Resolution Time: ${resolutionTime}\n` : ''}${data.createdAt ? `Received On: ${createdAtFormatted}\n` : ''}\n${data.remarks ? `\nOfficer Remarks:\n${data.remarks}\n` : ''}\n\n${companyName} - Digital Portal`
    };
  }

  if (action === 'resolved' && type === 'appointment') {
    const resolvedByName = data.resolvedBy 
      ? (typeof data.resolvedBy === 'object' 
        ? `${data.resolvedBy.firstName || ''} ${data.resolvedBy.lastName || ''}`.trim() 
        : 'Officer')
      : 'Assigned Officer';
    
    const resolvedAtFormatted = data.resolvedAt ? formatDateTime(data.resolvedAt) : 'N/A';
    
    return {
      subject: `Appointment Completed - ${data.appointmentId} | ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${commonStyles}</style>
        </head>
        <body>
          <div class="email-container">
            <div class="header" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
              <h2>✅ Appointment Successfully Completed</h2>
            </div>
            <div class="content">
              <div class="greeting">
                <strong>Respected ${recipientName},</strong>
              </div>
              <div class="intro-text">
                This is to inform you that the following appointment has been successfully completed. The details of the completion are provided below for your reference.
              </div>
              
              <div class="detail-box">
                <div class="detail-row">
                  <span class="detail-label">Appointment ID:</span>
                  <span class="detail-value"><strong style="color: #28a745;">${data.appointmentId}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Citizen Name:</span>
                  <span class="detail-value">${data.citizenName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Number:</span>
                  <span class="detail-value">${data.citizenPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Department:</span>
                  <span class="detail-value"><strong>${data.departmentName || 'N/A'}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value"><strong style="color: #28a745;">COMPLETED</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Completed By:</span>
                  <span class="detail-value"><strong>${resolvedByName}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Completed On:</span>
                  <span class="detail-value">${resolvedAtFormatted}</span>
                </div>
                ${data.appointmentDate ? `
                <div class="detail-row">
                  <span class="detail-label">Scheduled Date:</span>
                  <span class="detail-value">${formatDate(data.appointmentDate)}</span>
                </div>
                ` : ''}
                ${data.appointmentTime ? `
                <div class="detail-row">
                  <span class="detail-label">Scheduled Time:</span>
                  <span class="detail-value">${data.appointmentTime}</span>
                </div>
                ` : ''}
              </div>

              ${data.remarks ? `
              <div class="remarks-box">
                <div class="remarks-title">📝 Officer's Completion Remarks:</div>
                <div class="remarks-text">${data.remarks}</div>
              </div>
              ` : ''}

              ${generateTimelineHTML(data.timeline, data.resolvedBy, data.resolvedAt, data.createdAt, data.assignedAt)}

              <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #155724;">✓ Completion Confirmed:</strong>
                <p style="margin: 8px 0 0 0; color: #155724; font-size: 14px;">
                  This appointment has been marked as completed. The citizen has been notified. Thank you for your service.
                </p>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text"><strong>${companyName}</strong></div>
              <div class="footer-text">Digital Appointment Booking System</div>
              <div class="footer-text" style="margin-top: 10px; font-size: 11px;">
                This is an automated notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `APPOINTMENT COMPLETED\n\nRespected ${recipientName},\n\nThe following appointment has been successfully completed.\n\nAppointment ID: ${data.appointmentId}\nCitizen Name: ${data.citizenName}\nContact: ${data.citizenPhone}\nDepartment: ${data.departmentName || 'N/A'}\nStatus: COMPLETED\nCompleted By: ${resolvedByName}\nCompleted On: ${resolvedAtFormatted}\n${data.appointmentDate ? `Scheduled Date: ${formatDate(data.appointmentDate)}\n` : ''}${data.appointmentTime ? `Scheduled Time: ${data.appointmentTime}\n` : ''}\n${data.remarks ? `\nOfficer Remarks:\n${data.remarks}\n` : ''}\n\n${companyName} - Digital Portal`
    };
  }

  // Default template
  return {
    subject: `Notification from ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>${commonStyles}</style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h2>Notification</h2>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            <p>You have received a notification from ${companyName}.</p>
            <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
          </div>
          <div class="footer">
            <div class="footer-text"><strong>${companyName}</strong></div>
            <div class="footer-text">Digital Portal</div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Notification from ${companyName}\n\nDear ${recipientName},\n\nYou have received a notification.\n\n${JSON.stringify(data, null, 2)}\n\n${companyName} - Digital Portal`
  };
}
