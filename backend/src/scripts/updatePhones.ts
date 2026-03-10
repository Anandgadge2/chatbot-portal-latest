import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import Lead from '../models/Lead';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Company from '../models/Company';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function updatePhones() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    let totalUpdated = 0;

    // Update Users
    const users = await User.find({ phone: { $not: /^91/ }, $expr: { $eq: [{ $strLenCP: "$phone" }, 10] } });
    console.log(`Found ${users.length} users with 10-digit phone numbers starting without 91`);
    for (const user of users) {
      if (user.phone && user.phone.length === 10) {
        user.phone = '91' + user.phone;
        await user.save({ validateBeforeSave: false });
        totalUpdated++;
      }
    }

    // Update Leads
    const leads = await Lead.find({ phone: { $not: /^91/ }, $expr: { $eq: [{ $strLenCP: "$phone" }, 10] } });
    console.log(`Found ${leads.length} leads with 10-digit phone numbers starting without 91`);
    for (const lead of leads) {
      if (lead.phone && lead.phone.length === 10) {
        lead.phone = '91' + lead.phone;
        await lead.save({ validateBeforeSave: false });
        totalUpdated++;
      }
    }

    console.log(`Successfully updated ${totalUpdated} records.`);
    mongoose.disconnect();
  } catch (error) {
    console.error('Error updating phones:', error);
    process.exit(1);
  }
}

updatePhones();
