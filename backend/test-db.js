const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;
console.log('Testing connection to:', mongoUri.replace(/:([^:@]+)@/, ':****@'));

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 10000
})
.then(() => {
  console.log('✅ Connection successful!');
  process.exit(0);
})
.catch(err => {
  console.error('❌ Connection failed:');
  console.error(err);
  process.exit(1);
});
