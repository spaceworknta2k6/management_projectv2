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
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5006;

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Resolve and prepare mock state
      console.log('\n--- Test 0: Resolving database dependencies and preparing mock data ---');

      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student Hoàng Anh not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');

      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) throw new Error('❌ Supervisor Kiều Tuấn Hải not found.');

      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) throw new Error('❌ Staff Lê Thị Hương not found.');

      // Clean up previous runs
      await Notification.deleteMany({});
      await WorkflowEvent.deleteMany({ entityType: 'TestProject' });
      console.log('✅ Cleaned up old database mock alerts.');

      // Create a mock entity
      const mockProjectId = new mongoose.Types.ObjectId();

      // Create a notification for Student Hoàng Anh
      const mockAlert = await Notification.create({
        recipientId: studentUser._id,
        type: 'TOPIC_APPROVED',
        title: 'Đề tài được duyệt',
        body: 'Đề cương nghiên cứu đề xuất "Quản lý đồ án" đã được phê duyệt.',
        entityType: 'Project',
        entityId: mockProjectId,
        actionUrl: `/projects/${mockProjectId}/workspace`,
      });
      const alertId = mockAlert._id;
      console.log(`✅ Created mock notification for Hoàng Anh with ID: ${alertId}`);

      // Create some mock workflow events
      await WorkflowEvent.create([
        {
          entityType: 'TestProject',
          entityId: mockProjectId,
          fromStatus: 'draft',
          toStatus: 'assigned',
          actorId: staffUser._id,
          actorRoles: ['FACULTY_STAFF'],
          action: 'APPROVE_TOPIC',
          reason: 'Đề tài xuất sắc, giáo viên hướng dẫn đủ tải.',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows)'
        },
        {
          entityType: 'TestProject',
          entityId: mockProjectId,
          fromStatus: 'assigned',
          toStatus: 'in_progress',
          actorId: studentUser._id,
          actorRoles: ['STUDENT'],
          action: 'START_PROJECT',
          reason: 'Bắt đầu triển khai phân tích thiết kế.',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows)'
        }
      ]);
      console.log('✅ Seeded 2 mock audit events for TestProject.');

      // Logins
      const loginActor = async (email, password) => {
        const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const result = await res.json();
        if (!result.success) throw new Error(`Failed login for ${email}`);
        return result.data.accessToken;
      };

      const tokenStudent = await loginActor('hoanganh@hust.edu.vn', 'password123');
      const tokenSupervisor = await loginActor('haikt@hust.edu.vn', 'password123');
      const tokenStaff = await loginActor('huonglt@hust.edu.vn', 'password123');
      console.log('✅ Access tokens retrieved successfully.');

      // 2. Fetch notifications as Student
      console.log('\n--- Test 1: GET /api/v1/notifications (Fetch alerts as Student) ---');
      const fetchRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/notifications`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const fetchResult = await fetchRes.json();
      console.log('HTTP Status:', fetchRes.status);
      if (!fetchResult.success || fetchResult.data.length === 0) {
        throw new Error('❌ Test 1 Failed: Cannot fetch student alerts.');
      }
      console.log(`✅ Test 1 Passed: Found ${fetchResult.data.length} notifications. Unread: ${!fetchResult.data[0].readAt}`);

      // 3. Privacy boundary check
      console.log('\n--- Test 2: Privacy boundary enforcement check ---');
      // Lecturer haikt tries to read student hoanganh's notification
      const badReadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/notifications/${alertId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenSupervisor}` }
      });
      const badReadResult = await badReadRes.json();
      console.log('HTTP Status (Should be 403):', badReadRes.status);
      console.log('Message:', badReadResult.message);
      if (badReadRes.status !== 403) {
        throw new Error('❌ Test 2 Failed: Unauthorized user was allowed to read another user\'s notification.');
      }
      console.log('✅ Test 2 Passed: Privacy check successfully blocked illegal notification access!');

      // 4. Mark as Read as Owner
      console.log('\n--- Test 3: Mark notification as read (By Owner) ---');
      const readRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/notifications/${alertId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const readResult = await readRes.json();
      console.log('HTTP Status:', readRes.status);
      if (!readResult.success || !readResult.data.readAt) {
        throw new Error('❌ Test 3 Failed: Owner mark as read failed.');
      }
      console.log('✅ Test 3 Passed: Mark as read succeeded. readAt timestamp:', readResult.data.readAt);

      // Mark All As Read
      const readAllRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const readAllResult = await readAllRes.json();
      console.log('Read all HTTP Status:', readAllRes.status);
      if (!readAllResult.success) {
        throw new Error('❌ Read all failed.');
      }
      console.log('✅ Test 3b Passed: Successfully marked all alerts as read.');

      // 5. Audit Access Controls (RBAC Blocks)
      console.log('\n--- Test 4: Audit RBAC Block checking ---');
      const badAuditRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/audit/events`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStudent}` }
      });
      const badAuditResult = await badAuditRes.json();
      console.log('HTTP Status (Should be 403):', badAuditRes.status);
      console.log('Message:', badAuditResult.message);
      if (badAuditRes.status !== 403) {
        throw new Error('❌ Test 4 Failed: Student was allowed to fetch audit logs.');
      }
      console.log('✅ Test 4 Passed: Audit log access successfully blocked for unauthorized roles!');

      // 6. View system events as Staff
      console.log('\n--- Test 5: GET /api/v1/audit/events (View system events as Staff) ---');
      const auditRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/audit/events?entityType=TestProject`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      const auditResult = await auditRes.json();
      console.log('HTTP Status:', auditRes.status);
      if (!auditResult.success || auditResult.data.length !== 2) {
        throw new Error(`❌ Test 5 Failed: View system events failed. Length: ${auditResult.data?.length}`);
      }
      console.log(`✅ Test 5 Passed: Successfully retrieved ${auditResult.data.length} global audit events.`);

      // 7. View entity history as Staff
      console.log(`\n--- Test 6: GET /api/v1/audit/entities/TestProject/:id (View entity history as Staff) ---`);
      const historyRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/audit/entities/TestProject/${mockProjectId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenStaff}` }
      });
      const historyResult = await historyRes.json();
      console.log('HTTP Status:', historyRes.status);
      if (!historyResult.success || historyResult.data.length !== 2) {
        throw new Error(`❌ Test 6 Failed: View entity history failed. Length: ${historyResult.data?.length}`);
      }
      console.log('Chronological Entity History Timeline (Audit Trail):');
      historyResult.data.forEach((evt, idx) => {
        console.log(`[Event ${idx + 1}] Action: ${evt.action}, Transition: ${evt.fromStatus || 'N/A'} -> ${evt.toStatus}, Reason: "${evt.reason}"`);
      });
      console.log('✅ Test 6 Passed: Historical audit trail correctly retrieved!');

      console.log('\n🎉 ALL PHASE 10 NOTIFICATIONS & AUDIT LOG INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
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
