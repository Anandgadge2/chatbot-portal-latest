import mongoose from 'mongoose';
import WhatsAppTemplate from '../models/WhatsAppTemplate';

export async function upsertNormalizedTemplate(
  companyId: mongoose.Types.ObjectId,
  template: any
): Promise<void> {
  await WhatsAppTemplate.findOneAndUpdate(
    { companyId, name: template.name, language: template.language },
    { $set: template },
    { upsert: true, new: true }
  );
}

export async function deactivateMissingTemplates(
  companyId: mongoose.Types.ObjectId,
  activeTemplateKeys: Set<string>
): Promise<number> {
  const activeTemplates = await WhatsAppTemplate.find({ companyId, isActive: true }).select('_id name language');
  const outdatedIds = activeTemplates
    .filter((template) => !activeTemplateKeys.has(`${template.name}::${template.language}`))
    .map((template) => template._id);

  if (!outdatedIds.length) {
    return 0;
  }

  const result = await WhatsAppTemplate.updateMany(
    { _id: { $in: outdatedIds } },
    { $set: { isActive: false, lastSyncedAt: new Date() } }
  );

  return result.modifiedCount || 0;
}
