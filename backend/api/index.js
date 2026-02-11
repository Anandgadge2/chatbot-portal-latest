// Vercel serverless function wrapper for Express app
// The compiled server.js exports the app as default (exports.default = app)
const app = require('../dist/server.js').default;

// Export as serverless function for Vercel
module.exports = app;
