import mongoose from 'mongoose';
import WhatsAppTemplate from '../models/WhatsAppTemplate';
import CompanyTemplateMapping from '../models/CompanyTemplateMapping';
import { TEMPLATE_DEFINITIONS } from './whatsapp/payload.builder';

export async function upsertNormalizedTemplate(
  companyId: mongoose.Types.ObjectId,
  template: any
): Promise<void> {
  await WhatsAppTemplate.findOneAndUpdate(
    { 
      companyId, 
      name: template.name, 
      language: template.language
    },
    { $set: template },
    { upsert: true, new: true }
  );
}

export async function deactivateMissingTemplates(
  companyId: mongoose.Types.ObjectId,
  businessAccountId: string,
  activeTemplateKeys: Set<string>
): Promise<number> {
  const activeTemplates = await WhatsAppTemplate.find({ 
    companyId, 
    businessAccountId,
    isActive: true 
  }).select('_id name language');
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

export async function ensureAutoTemplateMappings(
  companyId: mongoose.Types.ObjectId,
  templateNames: Iterable<string>
): Promise<number> {
  let updatedCount = 0;
  const uniqueTemplateNames = Array.from(new Set(Array.from(templateNames).filter(Boolean)));

  for (const templateName of uniqueTemplateNames) {
    const definition = TEMPLATE_DEFINITIONS[templateName];
    if (!definition || !Array.isArray(definition.body) || definition.body.length === 0) {
      continue;
    }

    const autoMappings = definition.body.reduce<Record<string, string>>((accumulator, spec, index) => {
      accumulator[String(index + 1)] = spec.key;
      return accumulator;
    }, {});

    const existing = await CompanyTemplateMapping.findOne({
      companyId,
      templateName
    });

    if (!existing) {
      await CompanyTemplateMapping.create({
        companyId,
        templateName,
        mappings: autoMappings
      });
      updatedCount += 1;
      continue;
    }

    const currentMappings = existing.mappings instanceof Map
      ? Object.fromEntries(existing.mappings.entries())
      : Object(existing.mappings || {});

    let hasChanges = false;
    for (const [position, mappedKey] of Object.entries(autoMappings)) {
      if (!String(currentMappings[position] || '').trim()) {
        currentMappings[position] = mappedKey;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      existing.mappings = currentMappings;
      await existing.save();
      updatedCount += 1;
    }
  }

  return updatedCount;
}
