import mongoose from 'mongoose';
import CompanyWhatsAppTemplate from '../models/CompanyWhatsAppTemplate';
import CompanyEmailTemplate from '../models/CompanyEmailTemplate';
import { logger } from '../config/logger';

/**
 * Seeds default notification templates for a new company.
 * This ensures that a company has working notifications immediately after creation.
 */
export async function seedDefaultTemplates(company: any): Promise<void> {
  const companyId = company._id;
  const companyName = company.name;

  try {
    // 1. Email Templates (Keep these as they are still used for admin alerts)
    const emailTemplates = [
      {
        templateKey: 'grievance_created',
        subject: `New Grievance Received - {grievanceId} | ${companyName}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0f4c81;">New Grievance Received</h2>
            <p>Respected {recipientName},</p>
            <p>A new grievance has been submitted to <strong>${companyName}</strong>.</p>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Grievance ID:</strong> {grievanceId}</p>
              <p><strong>Citizen Name:</strong> {citizenName}</p>
              <p><strong>Department:</strong> {departmentName}</p>
              <p><strong>Description:</strong> {description}</p>
            </div>
            <p>Please log in to the portal to take action.</p>
            <hr>
            <p style="font-size: 12px; color: #777;">This is an automated notification from ${companyName}.</p>
          </div>
        `
      },
      {
        templateKey: 'grievance_assigned',
        subject: `Grievance Assigned to You - {grievanceId} | ${companyName}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0f4c81;">Grievance Assigned</h2>
            <p>Respected {recipientName},</p>
            <p>The following grievance has been assigned to you for resolution:</p>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Grievance ID:</strong> {grievanceId}</p>
              <p><strong>Citizen Name:</strong> {citizenName}</p>
              <p><strong>Description:</strong> {description}</p>
              <p><strong>Assigned By:</strong> {assignedByName}</p>
            </div>
            <p>Kindly investigate and resolve the issue as per SLA.</p>
            <hr>
            <p style="font-size: 12px; color: #777;">Digital System of ${companyName}</p>
          </div>
        `
      }
    ];

    for (const t of emailTemplates) {
      await CompanyEmailTemplate.findOneAndUpdate(
        { companyId, templateKey: t.templateKey },
        { ...t, companyId, isActive: true },
        { upsert: true, new: true }
      );
    }

    logger.info(`✅ Default templates seeded for company: ${companyName} (${companyId})`);
  } catch (error) {
    logger.error(`❌ Template seeding failed for company ${companyName}:`, error);
  }
}
