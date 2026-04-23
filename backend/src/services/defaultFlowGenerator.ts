import mongoose from 'mongoose';
import ChatbotFlow from '../models/ChatbotFlow';
import Company from '../models/Company';
import { Module } from '../config/constants';

/**
 * Generate default flows for a company
 * Creates standard flows (grievance, appointment, tracking) that can be customized
 */
export async function generateDefaultFlows(companyId: string | mongoose.Types.ObjectId, createdBy: mongoose.Types.ObjectId): Promise<void> {
  try {
    const companyObjectId = typeof companyId === 'string' 
      ? (mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId)
      : companyId;

    const company = await Company.findById(companyObjectId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    console.log(`🔄 Default flow generation is disabled for company: ${company.name} (${company.companyId})`);
    console.log(`ℹ️  Companies can now create their own custom flows from scratch.`);

    // Default flow generation is disabled
    // Companies should create their own flows using the flow builder
    return;

  
  } catch (error: any) {
    console.error('❌ Error generating default flows:', error);
    throw error;
  }
}

/**
 * Check if default flows exist for a company
 * Note: This uses setOptions to bypass the pre-find middleware that filters deleted flows
 */
export async function hasDefaultFlows(companyId: string | mongoose.Types.ObjectId): Promise<boolean> {
  try {
    const companyObjectId = typeof companyId === 'string' 
      ? (mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId)
      : companyId;

    // Check for default flows
    const existingFlow = await ChatbotFlow.findOne({ 
      companyId: companyObjectId,
      flowType: { $in: ['grievance', 'appointment', 'tracking'] }
    });

    const exists = !!existingFlow;
    console.log(`🔍 Checking default flows for company ${companyObjectId}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (exists) {
      console.log(`   Found flow: ${existingFlow.flowName} (${existingFlow.flowType})`);
    }
    
    return exists;
  } catch (error) {
    console.error('❌ Error checking default flows:', error);
    return false;
  }
}
