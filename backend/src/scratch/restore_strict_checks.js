const fs = require('fs');
const path = 'd:\\Multitenant_chatbot\\chatbot_portal-chatbot_flow_features\\backend\\src\\services\\whatsappService.ts';
let content = fs.readFileSync(path, 'utf8');

// We are reverting the bypass as requested by the user.
// They want strict adherence to DB-approved templates.

const newBlock = `      let resolvedTemplate: any;
      resolvedTemplate = await resolveTemplateRecord({
        companyId,
        templateName,
        requestedLanguage: 'en',
        companyDefaultLanguage: company?.whatsappConfig?.chatbotSettings?.defaultLanguage
      });

      if (!resolvedTemplate) {
        throw new Error(\`Failed to resolve template \${templateName} for media send.\`);
      }

      // Ensure the template is approved in the database (No bypass allowed)
      await assertTemplateApproved({
        companyId,
        templateName,
        language: resolvedTemplate.resolvedLanguage
      });

      // Use definition-based header type for the payload if available, else fallback to detected type
      const definition = TEMPLATE_DEFINITIONS[templateName];
      const headerTypeForPayload = definition?.header?.type?.toLowerCase() || detectedType;`;

// The old block was what I patched in the previous turn
const regex = /let resolvedTemplate: any;\s+try \{\s+resolvedTemplate = await resolveTemplateRecord\(\{[\s\S]+?\}\);\s+\} catch \(resolveErr: any\) \{[\s\S]+?\}\s+if \(!resolvedTemplate\) \{[\s\S]+?\}\s+\/\/ If no DB record exists[\s\S]+?const headerTypeForPayload = definition\?.header\?.type\?.toLowerCase\(\) \|\| detectedType;\s+try \{\s+await assertTemplateApproved\(\{[\s\S]+?\}\);\s+\} catch \(approvalErr: any\) \{[\s\S]+?\}/;

const updated = content.replace(regex, newBlock);

if (updated !== content) {
    fs.writeFileSync(path, updated);
    console.log('Successfully restored strict checks in whatsappService.ts');
} else {
    console.log('Regex match failed - checking current state');
    // Maybe the previous turn's patch didn't look exactly as I thought or I'm matching wrong range
    // I'll try a simpler match for the whole try/catch resolution block
}
