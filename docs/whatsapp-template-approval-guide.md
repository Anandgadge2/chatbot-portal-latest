# Collectorate Jharsuguda – WhatsApp Template Verification & Meta Setup Guide

This guide is tailored for **Collectorate Jharsuguda** and covers:

> For copy-paste ready EN/HI/OR template content, use `docs/jharsuguda-meta-template-content.md`.

1. How to audit every WhatsApp template used by this portal (DB + WhatsApp config page).
2. Exactly what to enter in Meta templates (header/body/footer/buttons).
3. Required language setup in **English, Hindi, Odia**.
4. Admin vs citizen footer behavior.

---

## 1) Mandatory content standards you requested

Use these values in Meta template drafts:

- **Header (all templates):**
  `SAHAJ-Swift Access & Help by Administration, Jharsuguda`
- **Footer for admin notification templates:**
  `Digital Grievance Redressal System`
- **Footer for citizen notification templates:**
  `District Administration, Jharsuguda`
- **Admin templates must include CTA button:**
  - Label: `Access Dashboard`
  - URL: `https://connect.pugarch.in/`

> Recommendation: Keep the above header/footer exactly identical across EN/HI/OR versions for faster approval consistency.

---

## 2) Templates used in this portal

There are two groups to verify:

### A) Meta API template names used directly in backend sends

These names are used by backend code while calling `sendWhatsAppTemplate`:

- `password_reset_otp_v1`
- `grievance_created_admin_v1`
- `grievance_confirmation_v1`
- `grievance_status_update_v1`
- `grievance_resolved_v1`

### B) Company template keys editable in WhatsApp Configuration page

These keys are surfaced/managed via WhatsApp config APIs and DB collection `companywhatsapptemplates`:

- Grievance admin: `grievance_created_admin`, `grievance_assigned_admin`, `grievance_reassigned_admin`, `grievance_reverted_admin`, `grievance_resolved_admin`, `grievance_rejected_admin`
- Grievance citizen: `grievance_confirmation`, `grievance_status_update`, `grievance_resolved`, `grievance_rejected`
- Command templates: `cmd_stop`, `cmd_restart`, `cmd_menu`, `cmd_back`

---

## 3) Where to put what (Meta UI fields)

For each template (EN/HI/OR), fill Meta fields like this:

1. **Category**
   - `Authentication`: only OTP template.
   - `Utility`: all grievance notification templates.
2. **Language**
   - Create separate variants: English (`en`), Hindi (`hi`), Odia (`or`).
3. **Header**
   - Header type: `Text`
   - Header text: `SAHAJ-Swift Access & Help by Administration, Jharsuguda`
4. **Body**
   - Transactional content only (no marketing).
   - Keep variables sequential (`{{1}}`, `{{2}}`, ...).
5. **Footer**
   - Admin template → `Digital Grievance Redressal System`
   - Citizen template → `District Administration, Jharsuguda`
6. **Buttons**
   - Admin template: add URL button
     - Button text: `Access Dashboard`
     - URL: `https://connect.pugarch.in/`
   - Citizen template: optional/no button unless policy requires.

---

## 4) Language-ready sample footer lines

If reviewers ask translated variants, use these aligned equivalents:

- English
  - Admin footer: `Digital Grievance Redressal System`
  - Citizen footer: `District Administration, Jharsuguda`
- Hindi
  - Admin footer: `डिजिटल शिकायत निवारण प्रणाली`
  - Citizen footer: `जिला प्रशासन, झारसुगुड़ा`
- Odia
  - Admin footer: `ଡିଜିଟାଲ ଅଭିଯୋଗ ନିବାରଣ ପ୍ରଣାଳୀ`
  - Citizen footer: `ଜିଲ୍ଲା ପ୍ରଶାସନ, ଝାରସୁଗୁଡା`

> If you need strict uniform brand style, keep the exact English footer text for all languages.

---

## 5) Full verification steps (DB + portal + Meta)

## Step 1: Verify DB records for Collectorate Jharsuguda

Run:

```bash
cd backend
npx ts-node src/scripts/auditJharsugudaWhatsAppTemplates.ts
```

What this checks:

- Finds company by Jharsuguda/Collectorate name in `companies`.
- Reads all templates from `companywhatsapptemplates`.
- Shows missing/active templates.
- Verifies expected admin/citizen footer presence.
- Shows WhatsApp config languages from `companywhatsappconfigs`.

> Pre-requisite: `MONGODB_URI` must be exported.

## Step 2: Verify in WhatsApp Config page

Portal path:

- Superadmin → Company → **WhatsApp Configuration**
- Confirm every template key in section 2(B) exists and is active.
- Ensure language variants are present (`_en`, `_hi`, `_or`) where your workflow needs per-language messages.

## Step 3: Create/verify Meta templates

Meta path:

- Meta Business Suite → WhatsApp Manager → Message templates

For each required template:

1. Create EN + HI + OR variants.
2. Use required header/footer/button standards from section 1.
3. Add realistic sample values for variables.
4. Submit and wait for **Approved** status.

## Step 4: Map names and language in backend env

Set or verify:

- `WHATSAPP_GRIEVANCE_CREATED_ADMIN_TEMPLATE`
- `WHATSAPP_GRIEVANCE_CONFIRMATION_TEMPLATE`
- `WHATSAPP_GRIEVANCE_STATUS_UPDATE_TEMPLATE`
- `WHATSAPP_GRIEVANCE_RESOLVED_TEMPLATE`
- `WHATSAPP_PASSWORD_RESET_OTP_TEMPLATE`
- `WHATSAPP_GRIEVANCE_TEMPLATE_LANGUAGE` (`en`/`hi`/`or`)

Template names in env must exactly match Meta names.

## Step 5: Live test outside 24-hour window

Run one admin + one citizen flow and confirm:

- Template gets delivered.
- Admin messages show `Access Dashboard` URL button.
- Footer changes by recipient type (admin vs citizen).

---

## 6) Suggested template naming convention in Meta

To keep versioning clear:

- `grievance_created_admin_v1_en`
- `grievance_created_admin_v1_hi`
- `grievance_created_admin_v1_or`

Use similar naming for all required templates.

---

## 7) Quick policy notes to avoid rejection

- Keep grievance utility templates strictly service-oriented.
- No promotional words/offers.
- No skipped variable numbers.
- Keep recipient intent obvious (status/update/confirmation).
- For admin templates, URL must be official and working HTTPS.

