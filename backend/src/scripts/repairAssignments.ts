import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../config/database';
import Grievance from '../models/Grievance';
import { getHierarchicalDepartmentAdmins } from '../services/notificationService';
import { logger } from '../config/logger';

// Load env
dotenv.config();

async function repair() {
  try {
    await connectDatabase();
    console.log('🚀 Starting Assignment Repair Process...');

    // Find unassigned grievances that are pending
    const unassigned = await Grievance.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: null }
      ],
      status: 'PENDING'
    });

    console.log(`🔍 Found ${unassigned.length} unassigned pending grievances.`);

    let successCount = 0;
    let failCount = 0;

    for (const grievance of unassigned) {
      console.log(`\n---------------------------------------------------`);
      console.log(`📄 Processing ${grievance.grievanceId}...`);
      
      // Prioritize sub-department if available
      const deptId = grievance.subDepartmentId || grievance.departmentId;
      
      if (!deptId) {
        console.log(`❌ ERROR: No department info found for ${grievance.grievanceId}.`);
        failCount++;
        continue;
      }

      console.log(`🔍 Looking for admins for Dept ID: ${deptId}`);
      const admins = await getHierarchicalDepartmentAdmins(deptId);
      
      if (admins && admins.length > 0) {
        const primaryAdmin = admins[0];
        const adminName = typeof primaryAdmin.getFullName === 'function' 
          ? primaryAdmin.getFullName() 
          : `${primaryAdmin.firstName} ${primaryAdmin.lastName}`;
          
        console.log(`✅ Match Found: ${adminName}`);
        console.log(`🏢 Designation: ${primaryAdmin.designation || primaryAdmin.role}`);
        
        // Update Grievance
        grievance.assignedTo = primaryAdmin._id;
        grievance.status = 'ASSIGNED' as any;
        grievance.assignedAt = new Date();
        
        // Add to timeline
        grievance.timeline.push({
          action: 'ASSIGNED',
          details: {
            assignedTo: adminName,
            designation: primaryAdmin.designation,
            reason: 'Auto-repair for legacy unassigned item'
          },
          performedBy: undefined, // System
          timestamp: new Date()
        } as any);

        // Add to status history
        grievance.statusHistory.push({
          status: 'ASSIGNED' as any,
          changedAt: new Date(),
          remarks: `Auto-assigned to ${adminName} via repair script.`
        });

        await grievance.save();
        console.log(`✨ SUCCESS: ${grievance.grievanceId} is now assigned.`);
        successCount++;
      } else {
        console.log(`⚠️ WARNING: No suitable admin found in hierarchy for ${grievance.grievanceId}.`);
        failCount++;
      }
    }

    console.log(`\n===================================================`);
    console.log(`📊 REPAIR SUMMARY:`);
    console.log(`✅ Successfully Assigned: ${successCount}`);
    console.log(`❌ Failed / No Admin Found: ${failCount}`);
    console.log(`===================================================`);

    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ CRITICAL ERROR during repair:', error);
    process.exit(1);
  }
}

repair();
