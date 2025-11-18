const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testProductionAPI() {
  const productionURL = 'https://wealthplus-ofpk3qloyq-el.a.run.app';
  
  try {
    console.log('🔍 Testing Production API...');
    
    // Test 1: Basic health check
    console.log('📊 Test 1: Health check');
    const healthResponse = await axios.get(`${productionURL}/api/ping`);
    console.log('✅ Health:', healthResponse.data);
    
    // Test 2: Test root endpoint
    console.log('\n📊 Test 2: Root endpoint');
    const rootResponse = await axios.get(`${productionURL}/`);
    console.log('✅ Root:', rootResponse.data);
    
    // Test 3: Test poster generation endpoint (with minimal data)
    console.log('\n📊 Test 3: Poster generation endpoint (minimal test)');
    const form = new FormData();
    form.append('designation', 'test');
    
    try {
      const posterResponse = await axios.post(`${productionURL}/api/send-posters`, form, {
        headers: form.getHeaders(),
        timeout: 10000
      });
      console.log('✅ Poster endpoint response:', posterResponse.data);
    } catch (error) {
      console.log('⚠️ Poster endpoint error (expected due to missing template):', 
        error.response?.data || error.message);
    }
    
    // Test 4: Check font files availability
    console.log('\n📊 Test 4: Check font files');
    const fontFiles = [
      'fonts/NotoSans-Regular.ttf',
      'utils/fonts/NotoSans-Regular.ttf',
      'assets/fonts/NotoSans-Regular.ttf'
    ];
    
    for (const fontFile of fontFiles) {
      try {
        const fontResponse = await axios.get(`${productionURL}/${fontFile}`);
        console.log(`✅ Font file ${fontFile}: ${fontResponse.status} (${fontResponse.data?.length || 'unknown'} bytes)`);
      } catch (error) {
        console.log(`❌ Font file ${fontFile}: ${error.response?.status || 'error'}`);
      }
    }
    
    console.log('\n✅ Production API Test Complete');
    
  } catch (error) {
    console.error('❌ Production API Test Failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testProductionAPI();