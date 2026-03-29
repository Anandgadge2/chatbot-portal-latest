import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoUri = process.env.MONGODB_URI;

const run = async () => {
    if (!mongoUri) {
        console.error('MONGODB_URI not found');
        process.exit(1);
    }
    await mongoose.connect(mongoUri);
    const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }), 'roles');
    
    const adminId = new mongoose.Types.ObjectId('698ce48d24f173ba8d99f6d8');
    
    console.log('Fixing roles missing createdBy field...');
    const result = await Role.updateMany(
        { createdBy: { $exists: false } },
        { $set: { createdBy: adminId } }
    );
    
    console.log(`✅ Fixed ${result.modifiedCount} roles.`);
    process.exit(0);
};

run();
