const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { assertSafeTestDatabase } = require('./test-db-guard');
assertSafeTestDatabase();

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectRoster = require('../models/ProjectRoster');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5001;

const runIntegrationTests = async () => {
  // Start server on temporary port 5001 to avoid port clashes
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);
    
    try {
      // 1. Fetch the facultyId and departmentId of the Faculty Staff (Lê Thị Hương)
      console.log('\n--- Test 0: Fetching Lê Thị Hương profile for operational context ---');
      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) {
        throw new Error('❌ Test 0 Failed: Could not find Faculty Staff user (huonglt@hust.edu.vn) in database.');
      }
      
      const staffLecturer = await Lecturer.findOne({ userId: staffUser._id });
      if (!staffLecturer) {
        throw new Error('❌ Test 0 Failed: Could not find Lecturer profile for Lê Thị Hương.');
      }
      
      const { facultyId, departmentId } = staffLecturer;
      console.log(`✅ Test 0 Passed: facultyId = ${facultyId}, departmentId = ${departmentId}`);

      // 2. Login as Lê Thị Hương (Faculty Staff)
      console.log('\n--- Test 1: POST /api/v1/auth/login (Lê Thị Hương) ---');
      const loginResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'huonglt@hust.edu.vn',
          password: 'password123'
        })
      });

      const loginResult = await loginResponse.json();
      console.log('HTTP Status:', loginResponse.status);
      if (!loginResult.success || !loginResult.data.accessToken) {
        throw new Error('❌ Test 1 Failed: Login failed.');
      }
      const token = loginResult.data.accessToken;
      console.log('✅ Test 1 Passed: Login succeeded as FACULTY_STAFF.');

      // Clean up any existing periods created in previous runs to prevent pollution
      await ProjectPeriod.deleteMany({ name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2' });

      // 3. Create a Project Period
      console.log('\n--- Test 2: POST /api/v1/periods (Create Project Period in draft) ---');
      const periodPayload = {
        name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2',
        schoolYear: '2025-2026',
        semester: 'Học kỳ II',
        type: 'foundation_project',
        facultyId: facultyId.toString(),
        departmentId: departmentId.toString(),
        registrationStart: '2026-06-01T00:00:00.000Z',
        registrationEnd: '2026-06-15T00:00:00.000Z',
        topicChangeDeadline: '2026-06-20T00:00:00.000Z',
        projectStart: '2026-06-25T00:00:00.000Z',
        projectEnd: '2026-10-31T00:00:00.000Z',
        preDefenseSubmissionDeadline: '2026-10-15T00:00:00.000Z',
        defenseStart: '2026-11-05T00:00:00.000Z',
        defenseEnd: '2026-11-15T00:00:00.000Z',
        postDefenseRevisionDeadline: '2026-11-20T00:00:00.000Z',
        archiveDeadline: '2026-11-30T00:00:00.000Z',
        minGroupSize: 1,
        maxGroupSize: 3,
        rubricVersion: 'v1.0-IT-HUST',
        scoringFormula: {
          supervisor: 0.3,
          reviewer: 0.2,
          committee: 0.5
        }
      };

      const createResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(periodPayload)
      });

      const createResult = await createResponse.json();
      console.log('HTTP Status:', createResponse.status);
      if (!createResult.success || !createResult.data._id) {
        console.error('Validation Errors:', JSON.stringify(createResult.errors, null, 2));
        throw new Error('❌ Test 2 Failed: Could not create ProjectPeriod.');
      }
      const periodId = createResult.data._id;
      console.log(`✅ Test 2 Passed: Project Period created with ID ${periodId} and status draft.`);

      // 4. Batch Import Student Roster
      console.log('\n--- Test 3: POST /api/v1/periods/:periodId/rosters/import (Import student roster) ---');
      const rosterPayload = {
        roster: [
          {
            studentCode: '22021435', // Hoàng Anh (already exists in student db)
            classSection: 'IT4911',
            fullName: 'Hoàng Anh',
            email: 'hoanganh@hust.edu.vn'
          },
          {
            studentCode: '22021499', // New student
            classSection: 'IT4911',
            fullName: 'Nguyễn Văn Nam',
            email: 'namnv@hust.edu.vn'
          }
        ]
      };

      const importResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rosterPayload)
      });

      const importResult = await importResponse.json();
      console.log('HTTP Status:', importResponse.status);
      console.log('Import JSON Result:', JSON.stringify(importResult, null, 2));
      if (!importResult.success || importResult.data.length !== 2) {
        throw new Error('❌ Test 3 Failed: Batch import did not import 2 students.');
      }
      console.log('✅ Test 3 Passed: Successfully imported roster containing 2 students (1 existing, 1 new).');

      // 5. Get Student Roster for Period
      console.log('\n--- Test 4: GET /api/v1/periods/:periodId/rosters (Retrieve student roster) ---');
      const getRosterResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const getRosterResult = await getRosterResponse.json();
      console.log('HTTP Status:', getRosterResponse.status);
      if (!getRosterResult.success || getRosterResult.data.length !== 2) {
        throw new Error('❌ Test 4 Failed: Retrieve roster did not return 2 active entries.');
      }
      console.log('✅ Test 4 Passed: Roster retrieved successfully containing exactly 2 student profiles.');

      // 6. Manual single student addition
      console.log('\n--- Test 5: POST /api/v1/periods/:periodId/rosters (Add a single student manually) ---');
      const singleStudentPayload = {
        studentCode: '22021500',
        classSection: 'IT4912',
        fullName: 'Trần Đức Việt',
        email: 'viettd@hust.edu.vn'
      };

      const addSingleResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(singleStudentPayload)
      });

      const addSingleResult = await addSingleResponse.json();
      console.log('HTTP Status:', addSingleResponse.status);
      console.log('Add Single Student Result:', JSON.stringify(addSingleResult, null, 2));
      if (!addSingleResult.success || !addSingleResult.data._id) {
        throw new Error('❌ Test 5 Failed: Single student registration failed.');
      }
      const singleStudentId = addSingleResult.data._id;
      console.log(`✅ Test 5 Passed: Single student Trần Đức Việt successfully registered with Student ID ${singleStudentId}.`);

      // 7. Check total roster entries now (should be 3)
      console.log('\n--- Test 6: Verify roster count is 3 ---');
      const rosterCheckResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const rosterCheckResult = await rosterCheckResponse.json();
      console.log('Roster Entry Count:', rosterCheckResult.data.length);
      if (rosterCheckResult.data.length !== 3) {
        throw new Error('❌ Test 6 Failed: Roster count is not 3.');
      }
      console.log('✅ Test 6 Passed: Roster count matches 3 entries.');

      // 8. Delete student from roster
      console.log('\n--- Test 7: DELETE /api/v1/periods/:periodId/rosters/:studentId (Remove student from roster) ---');
      const deleteResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters/${singleStudentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const deleteResult = await deleteResponse.json();
      console.log('HTTP Status:', deleteResponse.status);
      console.log('Delete Response:', JSON.stringify(deleteResult, null, 2));
      if (!deleteResult.success) {
        throw new Error('❌ Test 7 Failed: Student removal from roster failed.');
      }

      // Verify the roster count is back to 2
      const rosterVerifyResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const rosterVerifyResult = await rosterVerifyResponse.json();
      console.log('Roster Entry Count after deletion:', rosterVerifyResult.data.length);
      if (rosterVerifyResult.data.length !== 2) {
        throw new Error('❌ Test 7 Verification Failed: Roster count is not 2 after deletion.');
      }
      console.log('✅ Test 7 Passed: Successfully soft-deleted student Trần Đức Việt. Roster entries count reverted to 2.');

      // 9. Status Lifecycle Transition: Open Registration
      console.log('\n--- Test 8: POST /api/v1/periods/:periodId/open-registration ---');
      const openRegResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/open-registration`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const openRegResult = await openRegResponse.json();
      console.log('HTTP Status:', openRegResponse.status);
      if (!openRegResult.success || openRegResult.data.status !== 'registration_open') {
        throw new Error('❌ Test 8 Failed: Failed to transition status to registration_open.');
      }
      console.log('✅ Test 8 Passed: Successfully transitioned Project Period to registration_open.');

      // 10. Status Lifecycle Transition: Start Period (In Progress)
      console.log('\n--- Test 9: POST /api/v1/periods/:periodId/start ---');
      const startPeriodResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const startPeriodResult = await startPeriodResponse.json();
      console.log('HTTP Status:', startPeriodResponse.status);
      if (!startPeriodResult.success || startPeriodResult.data.status !== 'in_progress') {
        throw new Error('❌ Test 9 Failed: Failed to transition status to in_progress.');
      }
      console.log('✅ Test 9 Passed: Successfully transitioned Project Period to in_progress.');

      console.log('\n🎉 ALL PHASE 3 PROJECT PERIOD & ROSTER IMPORT INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    } catch (error) {
      console.error('\n❌ Integration Test Suite Failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(async () => {
        console.log('✅ Temporary test server shut down.');
        await mongoose.disconnect();
        console.log('✅ MongoDB connection closed.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
