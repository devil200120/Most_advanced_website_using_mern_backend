const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api';

// Test configuration
const testConfig = {
  baseURL: BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Test endpoints
const endpoints = [
  { path: '/health', method: 'GET', protected: false },
  { path: '/test', method: 'GET', protected: false },
  { path: '/users/stats', method: 'GET', protected: true },
  { path: '/users/achievements', method: 'GET', protected: true },
  { path: '/users/profile', method: 'GET', protected: true },
  { path: '/dashboard/student', method: 'GET', protected: true },
  { path: '/dashboard/teacher', method: 'GET', protected: true },
  { path: '/dashboard/admin', method: 'GET', protected: true },
  { path: '/parent/dashboard', method: 'GET', protected: true },
  { path: '/notifications', method: 'GET', protected: true },
  { path: '/exams', method: 'GET', protected: true },
  { path: '/submissions', method: 'GET', protected: true },
  { path: '/payments', method: 'GET', protected: true },
  { path: '/reports', method: 'GET', protected: true },
  { path: '/settings', method: 'GET', protected: true }
];

async function testEndpoint(endpoint) {
  try {
    const config = { ...testConfig };
    
    // Add mock token for protected routes
    if (endpoint.protected) {
      config.headers.Authorization = 'Bearer mock-token';
    }
    
    const response = await axios({
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      ...config
    });
    
    return {
      endpoint: endpoint.path,
      status: response.status,
      success: true,
      message: 'OK'
    };
    
  } catch (error) {
    const status = error.response?.status || 'NO_RESPONSE';
    const message = error.response?.data?.message || error.message;
    
    return {
      endpoint: endpoint.path,
      status: status,
      success: endpoint.protected ? status === 401 : false,
      message: message
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting endpoint tests...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    const statusIcon = result.success ? '✅' : '❌';
    const protectedTag = endpoint.protected ? '[PROTECTED]' : '[PUBLIC]';
    
    console.log(`${statusIcon} ${endpoint.method} ${result.endpoint} ${protectedTag}`);
    console.log(`   Status: ${result.status} - ${result.message}`);
    console.log('');
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`📊 Test Summary: ${successful}/${total} endpoints working correctly`);
  
  if (successful === total) {
    console.log('🎉 All endpoints are working correctly!');
  } else {
    console.log('⚠️  Some endpoints need attention.');
  }
  
  return results;
}

// Run tests
runAllTests().catch(console.error);