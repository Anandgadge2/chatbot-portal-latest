import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function testLogin() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const email = 'subcoljsg@gmail.com';
    const password = '111111';

    const user = await User.findOne({ email }).select('+password').populate('companyId');
    console.log('User found:', user ? user.email : 'No');

    if (user) {
        console.log('User isActive:', user.isActive);
        const isValid = await user.comparePassword(password);
        console.log('Password valid:', isValid);
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testLogin();
