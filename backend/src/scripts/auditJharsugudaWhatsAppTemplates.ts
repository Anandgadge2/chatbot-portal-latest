import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_FOOTER = 'Digital Grievance Redressal System';
const CITIZEN_FOOTER = 'District Administration, Jharsuguda';
const HEADER = 'SAHAJ-Swift Access & Help by Administration, Jharsuguda';
const DASHBOARD_URL = 'https://connect.pugarch.in/';

const BUILTIN_BASE_KEYS = [
  // Grievance - Admin
  'grievance_created_admin',
  'grievance_assigned_admin',
  'grievance_reassigned_admin',
  'grievance_reverted_admin',
  'grievance_resolved_admin',
  'grievance_rejected_admin',

  // Grievance - Citizen
  'grievance_confirmation',
  'grievance_status_update',
  'grievance_resolved',
  'grievance_rejected',
  'grievance_assigned_citizen',

  // Commands
  'cmd_stop',
  'cmd_restart',
  'cmd_menu',
  'cmd_back',

  // Appointment templates intentionally commented out for current rollout scope.
  // 'appointment_created_admin',
  // 'appointment_confirmed_admin',
  // 'appointment_cancelled_admin',
  // 'appointment_completed_admin',
  // 'appointment_confirmation',
  // 'appointment_scheduled_update',
  // 'appointment_cancelled_update',
  // 'appointment_completed_update',
] as const;

const isAdminTemplate = (key: string) => key.includes('_admin');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Export it before running this script.');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database handle is not available after connect.');
  }

  const company = await db.collection('companies').findOne({
    name: /collectorate.*jharsuguda|jharsuguda.*collectorate/i,
  });

  if (!company) {
    throw new Error('Collectorate Jharsuguda company not found in companies collection.');
  }

  const templates = await db
    .collection('companywhatsapptemplates')
    .find({ companyId: company._id })
    .project({ templateKey: 1, label: 1, message: 1, isActive: 1 })
    .toArray();

  const byKey = new Map<string, any>(templates.map((t) => [String(t.templateKey), t]));

  console.log(`Company: ${company.name} (${company.companyId ?? company._id})`);
  console.log(`Found templates in DB: ${templates.length}`);
  console.log('');
  console.log('=== Template audit checklist ===');

  for (const key of BUILTIN_BASE_KEYS) {
    const existing = byKey.get(key);
    const admin = isAdminTemplate(key);
    const expectedFooter = admin ? ADMIN_FOOTER : CITIZEN_FOOTER;
    const hasFooter = existing?.message?.includes(expectedFooter) ?? false;

    console.log(`\n- ${key}`);
    console.log(`  exists_in_db: ${Boolean(existing)}`);
    console.log(`  active: ${existing?.isActive ?? false}`);
    console.log(`  expected_header: ${HEADER}`);
    console.log(`  expected_footer: ${expectedFooter}`);
    console.log(`  footer_present: ${hasFooter}`);

    if (admin) {
      console.log(`  button_needed: Access Dashboard -> ${DASHBOARD_URL}`);
    }
  }

  const whatsappConfig = await db.collection('companywhatsappconfigs').findOne({ companyId: company._id });
  console.log('\n=== WhatsApp config ===');
  if (!whatsappConfig) {
    console.log('No whatsapp config found for this company');
  } else {
    console.log(
      JSON.stringify(
        {
          phoneNumber: whatsappConfig.phoneNumber,
          defaultLanguage: whatsappConfig.chatbotSettings?.defaultLanguage,
          supportedLanguages: whatsappConfig.chatbotSettings?.supportedLanguages,
          isVerified: whatsappConfig.isVerified,
        },
        null,
        2,
      ),
    );
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Template audit failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
