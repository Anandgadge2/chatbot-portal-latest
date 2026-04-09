import { connectDatabase, closeDatabase } from '../config/database';
import CompanyWhatsAppTemplate from '../models/CompanyWhatsAppTemplate';

const TEMPLATE_FOOTER_BY_LANG = {
  grievance: {
    en: 'Digital Grievance Redressal System',
    hi: 'डिजिटल शिकायत निवारण प्रणाली',
    or: 'ଡିଜିଟାଲ ଅଭିଯୋଗ ନିବାରଣ ପ୍ରଣାଳୀ',
  },
  appointment: {
    en: 'Digital Appointment System',
    hi: 'डिजिटल नियुक्ति प्रबंधन प्रणाली',
    or: 'ଡିଜିଟାଲ ନିଯୁକ୍ତି ପରିଚାଳନା ପ୍ରଣାଳୀ',
  },
  generic: {
    en: 'Digital Notification System',
    hi: 'डिजिटल सूचना प्रणाली',
    or: 'ଡିଜିଟାଲ ସୂଚନା ପ୍ରଣାଳୀ',
  },
} as const;

const STATUS_UPDATE_NOTICE_BY_LANG = {
  en: 'You will receive further updates via WhatsApp.',
  hi: 'आपको आगे की जानकारी व्हाट्सएप के माध्यम से प्राप्त होगी।',
  or: 'ଆପଣ ହ୍ୱାଟସଅ୍ୟାପ୍ ମାଧ୍ୟମରେ ପରବର୍ତ୍ତୀ ଅଦ୍ୟତନ ପାଇବେ।',
} as const;

const getBaseKeyAndLang = (templateKey: string): { baseKey: string; lang: 'en' | 'hi' | 'or' } => {
  const match = String(templateKey || '').match(/^(.*)_(en|hi|or)$/i);
  if (!match) {
    return { baseKey: templateKey, lang: 'en' };
  }

  return {
    baseKey: match[1],
    lang: match[2].toLowerCase() as 'en' | 'hi' | 'or',
  };
};

const getFooterType = (baseKey: string) => {
  if (baseKey.startsWith('appointment')) return 'appointment';
  if (baseKey.startsWith('grievance')) return 'grievance';
  return 'generic';
};

const normalizeTemplateMessage = (baseKey: string, lang: 'en' | 'hi' | 'or', message: string) => {
  if (baseKey.startsWith('cmd_')) {
    return String(message || '').trim();
  }

  const normalized = String(message || '').trim();
  if (!normalized) {
    return normalized;
  }

  const footerType = getFooterType(baseKey);
  const systemLine = TEMPLATE_FOOTER_BY_LANG[footerType][lang];
  const statusNotice =
    baseKey === 'grievance_status_update' ? STATUS_UPDATE_NOTICE_BY_LANG[lang] : '';

  const hasNotice = !statusNotice || normalized.includes(statusNotice);
  const hasSystem = normalized.includes(systemLine);

  if (hasNotice && hasSystem) {
    return normalized;
  }

  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const appendedParts = [
    !hasNotice ? statusNotice : '',
    divider,
    '*{localizedCompanyBrand}*',
    !hasSystem ? systemLine : '',
  ].filter(Boolean);

  return `${normalized}\n\n${appendedParts.join('\n')}`.trim();
};

const run = async () => {
  await connectDatabase();

  try {
    const templates = await CompanyWhatsAppTemplate.find({});
    let updatedCount = 0;

    for (const template of templates) {
      const { baseKey, lang } = getBaseKeyAndLang(template.templateKey);
      const nextMessage = normalizeTemplateMessage(baseKey, lang, template.message);

      if (nextMessage !== template.message) {
        template.message = nextMessage;
        await template.save();
        updatedCount += 1;
      }
    }

    console.log(`Normalized WhatsApp template footers for ${updatedCount} database records.`);
  } finally {
    await closeDatabase();
  }
};

run().catch((error) => {
  console.error('Failed to normalize WhatsApp template footers:', error);
  process.exitCode = 1;
});
