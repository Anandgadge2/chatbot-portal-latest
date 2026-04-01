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
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
    
    const companyIdStr = '69ad4c6eb1ad8e405e6c0858';
    const companyId = new mongoose.Types.ObjectId(companyIdStr);

    console.log('🚀 Starting Precision Migration for Jharsuguda...');

    const roleMapping = {
        '69c77d65329f83df62b2f1a3': new mongoose.Types.ObjectId('69cca2412b9320ae1e4737e5'),
        '69c77d65329f83df62b2f1a4': new mongoose.Types.ObjectId('69cca2412b9320ae1e4737e6'),
        '69c77d65329f83df62b2f1a5': new mongoose.Types.ObjectId('69cca2412b9320ae1e4737e7'),
        '69c77d65329f83df62b2f1a6': new mongoose.Types.ObjectId('69cca2412b9320ae1e4737e8')
    };

    // 1. Update Company
    console.log('🏢 Updating Company Settings...');
    await Company.updateOne(
        { _id: companyId },
        { 
            $set: {
                "notificationSettings.roles.Company Administrator._id": roleMapping['69c77d65329f83df62b2f1a3'],
                "notificationSettings.roles.Department Administrator._id": roleMapping['69c77d65329f83df62b2f1a4'],
                "notificationSettings.roles.Sub Department Administrator._id": roleMapping['69c77d65329f83df62b2f1a5'],
                "notificationSettings.roles.Operator._id": roleMapping['69c77d65329f83df62b2f1a6']
            }
        }
    );

    // 2. Update Users
    console.log('👥 Batch Updating Users...');
    for (const [oldId, newId] of Object.entries(roleMapping)) {
        const result = await User.updateMany(
            { companyId: companyId, customRoleId: new mongoose.Types.ObjectId(oldId) },
            { $set: { customRoleId: newId } }
        );
        console.log(`   - Migrated ${result.modifiedCount} users from ${oldId} to ${newId.toString()}`);
    }

    console.log('✨ Migration Complete!');
    process.exit(0);
};

run();
