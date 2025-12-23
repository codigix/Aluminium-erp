#!/usr/bin/env node

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const API_TOKEN = 'test-token'; // You might need to update this with a real token

const client = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`
  }
});

async function testBOMAPI() {
  console.log('🧪 BOM API Test Suite\n');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Check if backend is running
  console.log('\n📡 Test 1: Backend Health Check');
  try {
    const response = await client.get('/health', { baseURL: 'http://localhost:3000/api' });
    console.log('✅ Backend is running');
    passedTests++;
  } catch (error) {
    console.log('❌ Backend not responding');
    console.log('   Make sure to run: cd backend && npm start');
    failedTests++;
    return; // Exit if backend not available
  }

  // Test 2: Get All BOMs
  console.log('\n📋 Test 2: Get All BOMs');
  try {
    const response = await client.get('/production/boms');
    if (response.data.success && Array.isArray(response.data.data)) {
      console.log(`✅ Retrieved ${response.data.data.length} BOMs`);
      
      if (response.data.data.length > 0) {
        console.log('   Sample BOM:');
        const bom = response.data.data[0];
        console.log(`   - ID: ${bom.bom_id}`);
        console.log(`   - Item: ${bom.item_code}`);
        console.log(`   - Status: ${bom.status}`);
        console.log(`   - Cost: ₹${bom.total_cost}`);
      }
      passedTests++;
    } else {
      console.log('❌ Unexpected response format');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed to get BOMs');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    failedTests++;
  }

  // Test 3: Get BOMs with Filter
  console.log('\n🔍 Test 3: Filter BOMs by Status');
  try {
    const response = await client.get('/production/boms?status=Active');
    if (response.data.success && Array.isArray(response.data.data)) {
      console.log(`✅ Retrieved ${response.data.data.length} Active BOMs`);
      passedTests++;
    } else {
      console.log('❌ Unexpected response format');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed to filter BOMs');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    failedTests++;
  }

  // Test 4: Get Single BOM Details
  console.log('\n📝 Test 4: Get BOM Details');
  try {
    // First get a BOM ID
    const listResponse = await client.get('/production/boms');
    if (listResponse.data.data.length > 0) {
      const bomId = listResponse.data.data[0].bom_id;
      const detailResponse = await client.get(`/production/boms/${bomId}`);
      
      if (detailResponse.data.success && detailResponse.data.data) {
        const bom = detailResponse.data.data;
        console.log(`✅ Retrieved BOM details for ${bomId}`);
        console.log(`   - Product: ${bom.product_name || 'N/A'}`);
        console.log(`   - Lines: ${bom.lines?.length || 0}`);
        console.log(`   - Operations: ${bom.operations?.length || 0}`);
        console.log(`   - Scrap Items: ${bom.scrapItems?.length || 0}`);
        passedTests++;
      } else {
        console.log('❌ Unexpected response format');
        failedTests++;
      }
    }
  } catch (error) {
    console.log('❌ Failed to get BOM details');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    failedTests++;
  }

  // Test 5: Search BOMs
  console.log('\n🔎 Test 5: Search BOMs');
  try {
    const response = await client.get('/production/boms?search=Frame');
    if (response.data.success && Array.isArray(response.data.data)) {
      console.log(`✅ Search returned ${response.data.data.length} results for "Frame"`);
      passedTests++;
    } else {
      console.log('❌ Unexpected response format');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed to search BOMs');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    failedTests++;
  }

  // Test 6: Get Database Stats
  console.log('\n📊 Test 6: Database Statistics');
  try {
    const response = await client.get('/production/boms');
    const boms = response.data.data || [];
    
    const activeBOMs = boms.filter(b => b.status === 'Active').length;
    const draftBOMs = boms.filter(b => b.status === 'Draft').length;
    const totalCost = boms.reduce((sum, b) => sum + (parseFloat(b.total_cost) || 0), 0);
    
    console.log('✅ Database Statistics:');
    console.log(`   - Total BOMs: ${boms.length}`);
    console.log(`   - Active: ${activeBOMs}`);
    console.log(`   - Draft: ${draftBOMs}`);
    console.log(`   - Total Cost: ₹${totalCost.toFixed(2)}`);
    passedTests++;
  } catch (error) {
    console.log('❌ Failed to get statistics');
    console.log(`   Error: ${error.message}`);
    failedTests++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📈 Test Summary');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${passedTests + failedTests}`);

  const successRate = ((passedTests / (passedTests + failedTests)) * 100).toFixed(1);
  console.log(`\n🎯 Success Rate: ${successRate}%`);

  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! BOM API is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }

  console.log('\n📱 Next Steps:');
  console.log('1. Open browser and navigate to: http://localhost:5173/production/boms');
  console.log('2. Verify all BOMs are displayed');
  console.log('3. Test filtering by status');
  console.log('4. Test search functionality');
  console.log('5. Test create/edit/delete operations');

  process.exit(failedTests > 0 ? 1 : 0);
}

testBOMAPI().catch(error => {
  console.error('Test suite error:', error.message);
  process.exit(1);
});
