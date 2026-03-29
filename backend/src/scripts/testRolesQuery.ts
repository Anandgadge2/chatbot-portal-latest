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
    const companyId = '69ad4c6eb1ad8e405e6c0858';
    
    console.log('Testing query for companyId:', companyId);
    const roles: any[] = await Role.find({ 
      $or: [
        { companyId: new mongoose.Types.ObjectId(companyId) },
        { companyId: null }
      ]
    });
    
    console.log('Result length:', roles.length);
    roles.forEach(r => console.log(`- ${r.name} (companyId: ${r.companyId})`));
    process.exit(0);
};

run();
