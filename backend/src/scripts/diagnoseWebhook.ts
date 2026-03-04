/**
 * WhatsApp Webhook Diagnostic Script
 * 
 * Run this to diagnose why webhook is not working
 * Usage: ts-node src/scripts/diagnoseWebhook.ts
 */

import mongoose from 'mongoose';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import ChatbotFlow from '../models/ChatbotFlow';

async function diagnoseWebhook() {
  try {
    console.log('🔍 WhatsApp Webhook Diagnostic Tool\n');
    console.log('=' .repeat(60));

    // Connect to database
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment variables. Please check your .env file.');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Check Companies
    console.log('📊 STEP 1: Checking Companies');
    console.log('-'.repeat(60));
    const companies = await Company.find({}).select('name companyId enabledModules');
    console.log(`Found ${companies.length} companies:`);
    companies.forEach((company, index) => {
      console.log(`  ${index + 1}. ${company.name} (ID: ${company.companyId})`);
      console.log(`     Enabled Modules: ${company.enabledModules?.join(', ') || 'None'}`);
    });
    console.log('');

    // 2. Check WhatsApp Configurations
    console.log('📱 STEP 2: Checking WhatsApp Configurations');
    console.log('-'.repeat(60));
    const configs = await CompanyWhatsAppConfig.find({}).populate('companyId', 'name companyId');
    console.log(`Found ${configs.length} WhatsApp configurations:`);
    
    for (const config of configs) {
      const company = config.companyId as any;
      console.log(`\n  Company: ${company?.name || 'Unknown'}`);
      console.log(`  Phone Number: ${config.phoneNumber}`);
      console.log(`  Display Phone: ${config.displayPhoneNumber}`);
      console.log(`  Phone Number ID: ${config.phoneNumberId}`);
      console.log(`  Business Account ID: ${config.businessAccountId}`);
      console.log(`  Verify Token: ${config.verifyToken ? '✅ Set' : '❌ Not Set'}`);
      console.log(`  Access Token: ${config.accessToken ? '✅ Set (length: ' + config.accessToken.length + ')' : '❌ Not Set'}`);
      console.log(`  Is Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`  Chatbot Enabled: ${config.chatbotSettings?.isEnabled ? '✅ Yes' : '❌ No'}`);
      console.log(`  Welcome Message: ${config.chatbotSettings?.welcomeMessage || 'Not set'}`);
    }
    console.log('');

    // 3. Check Chatbot Flows
    console.log('🔄 STEP 3: Checking Chatbot Flows');
    console.log('-'.repeat(60));
    const flows = await ChatbotFlow.find({}).populate('companyId', 'name companyId');
    console.log(`Found ${flows.length} chatbot flows:`);
    
    for (const flow of flows) {
      const company = flow.companyId as any;
      console.log(`\n  Flow: ${flow.flowName}`);
      console.log(`  Company: ${company?.name || 'Unknown'}`);
      console.log(`  Flow ID: ${flow.flowId}`);
      console.log(`  Is Active: ${flow.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`  Start Step ID: ${flow.startStepId || 'Not set'}`);
      console.log(`  Total Steps: ${flow.steps?.length || 0}`);
      
      // Check triggers
      if (flow.triggers && flow.triggers.length > 0) {
        console.log(`  Triggers:`);
        flow.triggers.forEach((trigger: any) => {
          console.log(`    - "${trigger.keyword}" → Step: ${trigger.startStepId || flow.startStepId}`);
        });
      } else {
        console.log(`  Triggers: ❌ None configured`);
      }
      
      // Check if flow has steps
      if (flow.steps && flow.steps.length > 0) {
        console.log(`  Steps:`);
        flow.steps.slice(0, 5).forEach((step: any) => {
          console.log(`    - ${step.stepId} (${step.stepType})`);
        });
        if (flow.steps.length > 5) {
          console.log(`    ... and ${flow.steps.length - 5} more steps`);
        }
      } else {
        console.log(`  Steps: ❌ No steps defined`);
      }
    }
    console.log('');

    // 4. Diagnostic Summary
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    
    const issues: string[] = [];
    
    // Check for companies without WhatsApp config
    for (const company of companies) {
      const hasConfig = configs.find((c: any) => c.companyId?._id?.toString() === company._id.toString());
      if (!hasConfig) {
        issues.push(`❌ Company "${company.name}" has no WhatsApp configuration`);
      }
    }
    
    // Check for inactive configs
    const inactiveConfigs = configs.filter(c => !c.isActive);
    if (inactiveConfigs.length > 0) {
      issues.push(`⚠️ ${inactiveConfigs.length} WhatsApp config(s) are inactive`);
    }
    
    // Check for configs without tokens
    const configsWithoutTokens = configs.filter(c => !c.accessToken || !c.verifyToken);
    if (configsWithoutTokens.length > 0) {
      issues.push(`❌ ${configsWithoutTokens.length} WhatsApp config(s) missing access/verify tokens`);
    }
    
    // Check for companies without flows
    for (const company of companies) {
      const hasFlow = flows.find((f: any) => f.companyId?._id?.toString() === company._id.toString());
      if (!hasFlow) {
        issues.push(`⚠️ Company "${company.name}" has no chatbot flow configured`);
      }
    }
    
    // Check for inactive flows
    const inactiveFlows = flows.filter(f => !f.isActive);
    if (inactiveFlows.length > 0) {
      issues.push(`⚠️ ${inactiveFlows.length} chatbot flow(s) are inactive`);
    }
    
    // Check for flows without triggers
    const flowsWithoutTriggers = flows.filter(f => !f.triggers || f.triggers.length === 0);
    if (flowsWithoutTriggers.length > 0) {
      issues.push(`❌ ${flowsWithoutTriggers.length} flow(s) have no triggers configured (won't respond to "hi")`);
    }
    
    if (issues.length === 0) {
      console.log('✅ No issues found! Webhook should be working.');
      console.log('\n📝 Next Steps:');
      console.log('1. Verify webhook URL is configured in Meta Business Manager');
      console.log('2. Check that verify token matches the one in your WhatsApp config');
      console.log('3. Test by sending "hi" to your WhatsApp number');
      console.log('4. Check backend logs for incoming webhook requests');
    } else {
      console.log('❌ Issues Found:\n');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
      
      console.log('\n🔧 Recommended Actions:');
      if (flowsWithoutTriggers.length > 0) {
        console.log('• Add triggers to your chatbot flows (e.g., "hi", "hello", "start")');
      }
      if (configsWithoutTokens.length > 0) {
        console.log('• Configure access tokens and verify tokens in WhatsApp settings');
      }
      if (inactiveConfigs.length > 0 || inactiveFlows.length > 0) {
        console.log('• Activate your WhatsApp configurations and chatbot flows');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete!\n');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run diagnostic
diagnoseWebhook().catch(console.error);
