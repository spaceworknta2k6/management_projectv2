process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();
const { assertSafeTestDatabase } = require('./test-db-guard');
assertSafeTestDatabase();

const { app } = require('../app');
const mongoose = require('mongoose');

const TEST_PORT = 5009;

const maskAuthPayload = (payload) => {
  const clone = JSON.parse(JSON.stringify(payload));
  if (clone.data?.accessToken) clone.data.accessToken = '[redacted]';
  if (clone.data?.refreshToken) clone.data.refreshToken = '[redacted]';
  return clone;
};

const runIntegrationTests = async () => {
  // Start server on temporary port 5009 to avoid port clashes
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);
    
    try {
      console.log('\n--- Test 1: POST /api/v1/auth/login (Hoàng Anh) ---');
      const loginResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hoanganh@hust.edu.vn',
          password: 'password123'
        })
      });

      const loginResult = await loginResponse.json();
      console.log('HTTP Status:', loginResponse.status);
      console.log('Login JSON Result:', JSON.stringify(maskAuthPayload(loginResult), null, 2));

      if (!loginResult.success || !loginResult.data.accessToken) {
        throw new Error('❌ Test 1 Failed: Login request returned unsuccessful status or no access token.');
      }
      console.log('✅ Test 1 Passed: Login succeeded and signed JWT token returned.');

      const token = loginResult.data.accessToken;

      console.log('\n--- Test 2: GET /api/v1/auth/me (Hoàng Anh - Protected Route) ---');
      const profileResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const profileResult = await profileResponse.json();
      console.log('HTTP Status:', profileResponse.status);
      console.log('Profile JSON Result:', JSON.stringify(profileResult, null, 2));

      if (!profileResult.success || profileResult.data.email !== 'hoanganh@hust.edu.vn') {
        throw new Error('❌ Test 2 Failed: Profile retrieval returned unsuccessful status or incorrect email.');
      }
      if (!profileResult.data.studentId) {
        throw new Error('❌ Test 2 Failed: Student profile was not linked correctly (studentId is undefined).');
      }
      console.log('✅ Test 2 Passed: Protected profile retrieved successfully and verified studentId linkage.');

      console.log('\n--- Test 3: POST /api/v1/auth/login (Invalid Password Error Test) ---');
      const failResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hoanganh@hust.edu.vn',
          password: 'wrongpassword'
        })
      });

      const failResult = await failResponse.json();
      console.log('HTTP Status:', failResponse.status);
      console.log('Error JSON Result:', JSON.stringify(failResult, null, 2));

      if (failResponse.status !== 400 || failResult.success !== false) {
        throw new Error('❌ Test 3 Failed: Invalid login did not return expected error status.');
      }
      console.log('✅ Test 3 Passed: Invalid login rejected with correct status code.');

      console.log('\n--- Test 4: POST /api/v1/auth/refresh (Làm mới token qua cookie) ---');
      const refreshResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Cookie': `karl_refresh_token=${encodeURIComponent(loginResult.data.refreshToken)}`,
          'Content-Type': 'application/json'
        }
      });

      const refreshResult = await refreshResponse.json();
      console.log('HTTP Status:', refreshResponse.status);
      console.log('Refresh JSON Result:', JSON.stringify(maskAuthPayload(refreshResult), null, 2));

      if (refreshResponse.status !== 200 || !refreshResult.success || !refreshResult.data.accessToken) {
        throw new Error('❌ Test 4 Failed: Token refresh request failed.');
      }
      console.log('✅ Test 4 Passed: Token refreshed successfully, new access token returned.');

      console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    } catch (error) {
      console.error('\n❌ Integration Test Suite Failed:', error.message);
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(async () => {
        console.log('✅ Temporary test server shut down.');
        await mongoose.disconnect();
        console.log('✅ MongoDB connection closed.');
        process.exit(0);
      });
    }
  });
};

runIntegrationTests();
