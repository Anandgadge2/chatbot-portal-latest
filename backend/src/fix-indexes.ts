import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix for esm/commonjs issues
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI;
console.log('MONGODB_URI:', MONGODB_URI ? 'FOUND (MASKED)' : 'NOT FOUND IN ENV');

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file!');
  process.exit(1);
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

async function fixUserIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    if (!mongoose.connection.db) {
      throw new Error('❌ Failed to initialize database connection object');
    }
    const db = mongoose.connection.db;
    const UserCollection = db.collection('users');

    // 1. DROP INDEXES FIRST
    console.log('Listing existing indexes...');
    const indexes = await UserCollection.indexes();
    const problematicIndexes = ['email_1_companyId_1', 'phone_1_companyId_1'];
    
    for (const name of problematicIndexes) {
      if (indexes.some(idx => idx.name === name)) {
        console.log(`Dropping index: ${name}...`);
        await UserCollection.dropIndex(name);
        console.log(`✅ Dropped ${name}`);
      }
    }

    // 2. CLEAN DATA
    console.log('Cleaning empty email/phone fields...');
    await UserCollection.updateMany({ email: "" }, { $unset: { email: "" } });
    await UserCollection.updateMany({ phone: "" }, { $unset: { phone: "" } });
    console.log('✅ Data cleaned');

    // 3. RECREATE AS PARTIAL INDEXES (This is the real fix)
    console.log('Creating partial unique indexes...');
    
    // Email index only for users that have a non-empty email string
    await UserCollection.createIndex(
      { email: 1, companyId: 1 }, 
      { 
        unique: true, 
        partialFilterExpression: { email: { $type: "string" } },
        name: 'email_1_companyId_1' 
      }
    );
    console.log('✅ Created PARTIAL unique email_1_companyId_1');

    // Phone index (Phone is usually required, but we make it partial to be safe)
    await UserCollection.createIndex(
      { phone: 1, companyId: 1 }, 
      { 
        unique: true, 
        partialFilterExpression: { phone: { $type: "string" } },
        name: 'phone_1_companyId_1' 
      }
    );
    console.log('✅ Created PARTIAL unique phone_1_companyId_1');

    console.log('\n🚀 DATABASE REPAIR COMPLETED SUCCESSFULLY');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ ERROR DURING EXECUTION:', error);
    process.exit(1);
  }
}

console.log('Starting migration script...');
fixUserIndexes();
