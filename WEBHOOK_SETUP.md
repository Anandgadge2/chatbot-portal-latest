# ✅ WhatsApp Webhook Setup Checklist

## 🎯 Issue: Sending "hi" but nothing happens

### ✅ What We Fixed:

Added `/api/whatsapp` route to server.ts for Meta WhatsApp compatibility

---

## 📋 Complete Setup Checklist

### 1. Backend Configuration ✅

**File**: `backend/src/server.ts`

Webhook routes are now configured at:

- ✅ `/webhook`
- ✅ `/api/webhook/whatsapp`
- ✅ `/api/whatsapp` ← **Meta WhatsApp endpoint**

**Action**: Restart your backend server

```bash
cd backend
npm run dev
```

---

### 2. Meta Business Manager Setup

**Go to**: [Meta Business Manager](https://business.facebook.com/) → WhatsApp → Configuration

#### A. Webhook URL Configuration

**Set Webhook URL to ONE of these:**

```
https://your-backend-url.com/api/whatsapp
```

**Example URLs:**

- Production: `https://api.yourdomain.com/api/whatsapp`
- Vercel: `https://your-backend.vercel.app/api/whatsapp`
- ngrok (testing): `https://abc123.ngrok.io/api/whatsapp`

#### B. Verify Token

**Important**: The verify token in Meta MUST match your database config

**To check your verify token:**

1. Go to WhatsApp Config page in your app
2. Copy the "Webhook Verify Token" value
3. Paste it in Meta Business Manager webhook settings

#### C. Webhook Subscriptions

**Subscribe to these fields:**

- ✅ `messages` (required)
- ✅ `message_status` (optional)

#### D. Test Webhook

Click "Test" button in Meta → Should see "Success"

**If you see 403 Forbidden:**

- Verify token doesn't match
- Check backend logs

---

### 3. Database Configuration ✅

**Check**: WhatsApp Config in your app

Required fields:

- ✅ Phone Number (auto-formatted)
- ✅ Phone Number ID (from Meta)
- ✅ Business Account ID (from Meta)
- ✅ Access Token (from Meta)
- ✅ Verify Token (must match Meta webhook)
- ✅ Is Active = ON
- ✅ Chatbot Enabled = ON

---

### 4. Chatbot Flow Configuration ✅

**Check**: Chatbot Flows page

Your flow shows:

- ✅ Flow is Active
- ✅ Trigger: keyword "hi" (1 trigger)
- ✅ 28 steps defined

**Perfect!** ✅

---

### 5. Testing Steps

#### Step 1: Test Webhook Verification (GET)

**From your terminal:**

```bash
curl "https://your-backend-url.com/api/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

**Expected response:** `test123`

**If 403:** Verify token mismatch

---

#### Step 2: Check Backend Logs

**Start backend with logs:**

```bash
cd backend
npm run dev
```

**When you send "hi", you should see:**

```
🌐 Incoming Request: POST /api/whatsapp
📥 Webhook POST received
🔍 Looking up company by phone number ID: XXXXX
✅ Company resolved: Pugarch Technology
📨 Message from 919503850561 → Company: Pugarch Technology
🔄 Global reset triggered by greeting: hi
✅ Custom flow found: Pugarch flow 1
🚀 Executing flow step: start_node
```

**If you see nothing:** Webhook not reaching backend (Meta issue)

---

#### Step 3: Send Test Message

1. Send "hi" to your WhatsApp number
2. Watch backend logs immediately
3. Should receive response within 2-3 seconds

---

## 🔧 Common Issues & Solutions

### Issue 1: "403 Forbidden" on webhook verification

**Cause:** Verify token mismatch

**Solution:**

1. Check verify token in database:
   ```javascript
   db.companywhatsappconfigs.findOne({}, { verifyToken: 1 });
   ```
2. Update Meta webhook with exact same token
3. Click "Verify and Save"

---

### Issue 2: Webhook verified but no response to "hi"

**Cause:** Phone Number ID mismatch

**Solution:**

1. Go to Meta Business Manager → WhatsApp → Phone Numbers
2. Copy the exact Phone Number ID
3. Update in WhatsApp Config page
4. Save changes

---

### Issue 3: Backend not receiving webhook

**Cause:** Webhook URL not accessible from internet

**Solutions:**

**For local testing:**

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 5001

# Use the https URL in Meta webhook
# Example: https://abc123.ngrok.io/api/whatsapp
```

**For production:**

- Deploy backend to Vercel/Heroku/AWS
- Use the production URL in Meta webhook

---

### Issue 4: "No flow found" error

**Cause:** Flow not assigned to company

**Solution:**

1. Go to Chatbot Flows page
2. Ensure flow is Active
3. Check triggers include "hi"
4. Verify flow is assigned to correct company

---

## 🧪 Quick Test Commands

### Test 1: Webhook Endpoint Exists

```bash
curl http://localhost:5001/api/whatsapp
```

**Expected:** Some response (not 404)

### Test 2: Webhook Verification

```bash
curl "http://localhost:5001/api/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
```

**Expected:** `test` (the challenge value)

### Test 3: Backend Health

```bash
curl http://localhost:5001/health
```

**Expected:** `{"status":"OK",...}`

---

## 📝 Meta Webhook Configuration

**Exact steps in Meta Business Manager:**

1. Go to **WhatsApp** → **Configuration**
2. Click **Edit** next to Webhook
3. **Callback URL**: `https://your-backend.com/api/whatsapp`
4. **Verify Token**: Copy from your WhatsApp Config page
5. Click **Verify and Save**
6. **Subscribe to fields**: Check `messages`
7. Click **Save**

---

## ✅ Final Checklist

Before sending "hi":

- [ ] Backend server is running
- [ ] `/api/whatsapp` route exists (✅ just added)
- [ ] Webhook URL configured in Meta
- [ ] Verify token matches database
- [ ] Phone Number ID matches Meta
- [ ] Access token is valid
- [ ] WhatsApp config is Active
- [ ] Chatbot flow is Active
- [ ] Flow has "hi" trigger
- [ ] Backend logs are visible

---

## 🚀 Next Steps

1. **Restart backend server** (to load new route)
2. **Update Meta webhook URL** to use `/api/whatsapp`
3. **Verify webhook** in Meta (click Test button)
4. **Send "hi"** to your WhatsApp number
5. **Check backend logs** for webhook activity

---

**Status**: ✅ Route added - Ready to test!
