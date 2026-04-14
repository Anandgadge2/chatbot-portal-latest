# WhatsApp 24-Hour Window Template Approval Guide

This guide documents **all template-based WhatsApp messages currently used by this portal backend** and exactly how to create them in Meta WhatsApp Manager so they are approved and can be sent outside the 24-hour customer care window.

---

## 1) Templates currently used in this portal

The code currently sends these template names:

1. `password_reset_otp_v1`  
   - Used in password reset OTP flow (`auth.routes.ts`), with 1 body variable for OTP.
2. `grievance_created_admin_v1`  
   - Used for grievance-created admin notification (`notificationService.ts`), with:
     - Header variable `{{1}}` (company name)
     - Body variables `{{1}}..{{7}}` (recipient/admin details + grievance details)

> Note: `password_reset_otp_v1` can be overridden by env var `WHATSAPP_PASSWORD_RESET_OTP_TEMPLATE`, so if your env points to another template name, create/approve that exact name too.

---

## 2) Global rules for approval (important)

When creating templates in Meta:

- Choose the **right category**:
  - OTP/Auth use-case → `Authentication`
  - Service notifications (grievance updates) → `Utility`
- Variable placeholders must be sequential (`{{1}}`, `{{2}}`, ...).
- Do not use promotional/marketing language in utility/auth templates.
- Keep content clear, transactional, and user-expected.
- Add compliance footer where applicable:
  - `This is an official government assistance chatbot.`
  - `Type STOP to unsubscribe`
- Language in Meta template must match the language code your backend sends.

---

## 3) Meta UI: exact create + submit flow

1. Open **Meta Business Suite → WhatsApp Manager → Message templates**.
2. Click **Create template**.
3. Fill:
   - **Template name** (must exactly match backend usage)
   - **Category**
   - **Language**
4. Add **Header** (if needed), **Body**, **Footer**, and **Buttons**.
5. Use **Add variable** for all placeholders used by backend.
6. Use realistic sample values in all variable sample fields.
7. Click **Submit for review**.
8. Wait for status: **Approved**.
9. Repeat for each language variant required.

---

## 4) Template-by-template field values

## A) `password_reset_otp_v1`

### Recommended category
- `Authentication` (preferred), or `Utility` if your account doesn’t support auth template type.

### Language
- `English` (required by default code path)
- Also create Hindi/Marathi/Odia variants if you send those language codes.

### Header
- Optional. Keep empty unless required.

### Body (exact safe draft)
```text
Your password reset OTP is {{1}}. It expires in 10 minutes. Do not share this code with anyone.
```

### Footer (recommended)
```text
This is an official government assistance chatbot.
```

### Buttons
- None required for current backend usage.

### Variable mapping used by backend
- `{{1}}` = OTP code (`sendWhatsAppTemplate(..., [otp], ...)`)

### Sample values for Meta review form
- `{{1}}` sample: `482913`

---

## B) `grievance_created_admin_v1`

### Category
- `Utility`

### Language
- `English` (current code sends `'en'`)

### Header
- Type: `Text`
- Header text:
```text
{{1}}
```
- Variable mapping:
  - `{{1}}` = company name

### Body (exact draft with seven placeholders)
```text
Hello {{1}},

A new grievance has been created.
Grievance ID: {{2}}
Citizen: {{3}}
Department: {{4}}
Sub-Department: {{5}}
Description: {{6}}
Created On: {{7}}

This is an official government assistance chatbot.
Type STOP to unsubscribe
```

### Footer
- Optional. If added, keep short and non-promotional.

### Buttons
- Not required for current backend template call.

### Variable mapping used by backend
- Body `{{1}}` = recipient/admin name
- Body `{{2}}` = grievance ID
- Body `{{3}}` = citizen name
- Body `{{4}}` = department name
- Body `{{5}}` = sub-department name
- Body `{{6}}` = grievance description
- Body `{{7}}` = formatted created date

### Sample values for Meta review form
- Header `{{1}}`: `District Support Office`
- Body `{{1}}`: `Officer Sharma`
- Body `{{2}}`: `GRV-2026-004512`
- Body `{{3}}`: `Ravi Kumar`
- Body `{{4}}`: `Water Supply`
- Body `{{5}}`: `Pipeline Maintenance`
- Body `{{6}}`: `No water supply for 2 days in Ward 9`
- Body `{{7}}`: `14 Apr 2026, 10:30 AM`

---

## 5) Post-approval backend checklist

1. In Meta, confirm status = **Approved** for every template/language pair.
2. Ensure template name in backend env/code exactly matches Meta name.
3. Ensure backend language code matches approved language.
4. Send a live test:
   - user outside 24h window
   - template send succeeds
   - free-form send is blocked (as expected by policy)
5. Store screenshot evidence of:
   - template approved page
   - successful message delivery
   - blocked free-form outside 24h

---

## 6) Rejection troubleshooting (quick map)

- **Reason: Variable mismatch**  
  Ensure count/order of `{{n}}` placeholders exactly matches backend parameters.

- **Reason: Marketing language in utility template**  
  Remove offers/promotions/CTA sales content.

- **Reason: Ambiguous content**  
  Make message transactional and event-specific (OTP, grievance, status update).

- **Reason: Unsupported category**  
  Move OTP template to Authentication category or keep strictly Utility transactional style.

---

## 7) Operational recommendation

Maintain a single source-of-truth sheet:

- Template Name
- Category
- Language
- Header variables
- Body variables
- Backend source file and line owner
- Meta status (Pending/Approved/Rejected)
- Last review date

This prevents drift between code and Meta configuration during audits.

