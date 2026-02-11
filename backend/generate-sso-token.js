require("dotenv").config();
const jwt = require("jsonwebtoken");

const SSO_SECRET = process.env.SSO_SECRET || "my-super-secret-sso-key-2026";

// This is what the MAIN DASHBOARD will send in the JWT token
const ssoPayload = {
  phone: "9356150561", // Replace with actual user phone
};

// Generate the SSO token
const ssoToken = jwt.sign(ssoPayload, SSO_SECRET);

// Decode to show what's inside
const decoded = jwt.decode(ssoToken);

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║          SSO TOKEN GENERATOR - MAIN DASHBOARD             ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("📋 Token Payload (what the main dashboard encodes):");
console.log(JSON.stringify(ssoPayload, null, 2));

console.log("\n🔐 Generated SSO Token:");
console.log(ssoToken);

console.log("\n🔍 Decoded Token (for verification):");
console.log(JSON.stringify(decoded, null, 2));

console.log("\n🌐 Test URL for Auto-Login:");
console.log(`http://localhost:3000/auth/sso?token=${ssoToken}`);

console.log("\n📝 How it works:");
console.log("1. Main dashboard generates JWT token with user phone");
console.log(
  "2. Main dashboard redirects to: http://localhost:3000/auth/sso?token=JWT_TOKEN"
);
console.log("3. This dashboard receives the token");
console.log("4. Backend decodes the token using SSO_SECRET");
console.log("5. Backend finds user by phone number");
console.log("6. Backend generates new access/refresh tokens");
console.log("7. User is automatically logged in!");

console.log("\n✅ Both dashboards must share the same SSO_SECRET!\n");
