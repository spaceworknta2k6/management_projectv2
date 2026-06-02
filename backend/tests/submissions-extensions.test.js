const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectRoster = require('../models/ProjectRoster');
const ProjectGroup = require('../models/ProjectGroup');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const SubmissionPackage = require('../models/SubmissionPackage');
const ExtensionRequest = require('../models/ExtensionRequest');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5004;

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Resolve and prepare mock state
      console.log('\n--- Test 0: Resolving database dependencies and preparing project workspace ---');

      // Resolve Supervisor: Kiều Tuấn Hải
      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) throw new Error('❌ Supervisor Kiều Tuấn Hải not found.');
      const supervisorLecturer = await Lecturer.findOne({ userId: supervisorUser._id });
      if (!supervisorLecturer) throw new Error('❌ Supervisor Lecturer profile not found.');

      // Resolve Student: Hoàng Anh
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student Hoàng Anh not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');

      // Resolve Staff: Lê Thị Hương
      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) throw new Error('❌ Staff Lê Thị Hương not found.');

      // Find or create Project Period
      let period = await ProjectPeriod.findOne({ name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2' });
      if (!period) {
        period = await ProjectPeriod.create({
          name: 'Đợt Đồ Án Tốt Nghiệp Kỳ 2025.2',
          schoolYear: '2025-2026',
          semester: 'Học kỳ II',
          type: 'foundation_project',
          facultyId: supervisorLecturer.facultyId,
          departmentId: supervisorLecturer.departmentId,
          registrationStart: new Date('2026-06-01'),
          registrationEnd: new Date('2026-06-15'),
          topicChangeDeadline: new Date('2026-06-20'),
          projectStart: new Date('2026-06-25'),
          projectEnd: new Date('2026-10-31'),
          preDefenseSubmissionDeadline: new Date('2026-10-15'),
          defenseStart: new Date('2026-11-05'),
          defenseEnd: new Date('2026-11-15'),
          postDefenseRevisionDeadline: new Date('2026-11-20'),
          archiveDeadline: new Date('2026-11-30'),
          minGroupSize: 1,
          maxGroupSize: 3,
          rubricVersion: 'v1.0-IT-HUST',
          scoringFormula: {
            supervisor: 0.3,
            reviewer: 0.2,
            committee: 0.5
          },
          status: 'in_progress',
        });
      }

      // Register student in roster
      await ProjectRoster.findOneAndUpdate(
        { periodId: period._id, studentId: studentProfile._id },
        { classSection: 'IT4911', status: 'active', importedBy: staffUser._id },
        { upsert: true }
      );

      // Clean up previous runs
      await ProjectGroup.deleteMany({ periodId: period._id });
      await ProjectTopic.deleteMany({ periodId: period._id });
      await Project.deleteMany({ periodId: period._id });
      console.log('✅ Cleaned up old database mock collections.');

      // Create valid Project Group
      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'IT-Group-Alpha',
        leaderStudentId: studentProfile._id,
        members: [{
          studentId: studentProfile._id,
          role: 'LEADER',
          status: 'accepted',
          contributionWeight: 1.0
        }],
        status: 'locked'
      });

      // Create valid Topic
      const topic = await ProjectTopic.create({
        periodId: period._id,
        groupId: group._id,
        proposedByStudentId: studentProfile._id,
        title: 'Xây dựng hệ thống quản lý đồ án tốt nghiệp hỗ trợ bởi AI',
        summary: 'Tóm tắt...',
        objectives: 'Mục tiêu...',
        scope: 'Khoa CNTT',
        expectedResult: 'Hệ thống...',
        plan: 'Kế hoạch...',
        proposedSupervisorId: supervisorLecturer._id,
        supervisorId: supervisorLecturer._id,
        departmentId: period.departmentId,
        status: 'assigned'
      });

      // Create official Project Workspace in in_progress
      const project = await Project.create({
        periodId: period._id,
        groupId: group._id,
        topicId: topic._id,
        supervisorId: supervisorLecturer._id,
        status: 'in_progress'
      });
      const projectId = project._id;
      console.log(`Prepared Project Workspace ID: ${projectId} (Status: ${project.status})`);

      // Clean up packages and extensions
      await SubmissionPackage.deleteMany({ ownerId: projectId });
      await ExtensionRequest.deleteMany({ projectId });

      // Create active Milestone (which we will extend later!)
      const milestone = await Milestone.create({
        projectId,
        title: 'Nộp Đề Cương Chi Tiết',
        description: 'Tài liệu báo cáo...',
        deadline: new Date('2026-06-10'),
        status: 'open'
      });
      const milestoneId = milestone._id;
      console.log(`Prepared Milestone ID: ${milestoneId} (Deadline: ${milestone.deadline.toISOString()})`);

      // 2. Authentication
      console.log('\n--- Test 1: Logging in test actors ---');
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
      console.log('✅ Access tokens acquired successfully.');

      // 3. Initialize Submission Package
      console.log('\n--- Test 2: POST /api/v1/submissions/packages (Initialize proposal package) ---');
      const initRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/submissions/packages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: projectId.toString(),
          phase: 'proposal'
        })
      });

      const initResult = await initRes.json();
      console.log('HTTP Status:', initRes.status);
      if (!initResult.success || !initResult.data._id) {
        throw new Error(`❌ Test 2 Failed: Package initialization failed. Msg: ${initResult.message}`);
      }
      const packageId = initResult.data._id;
      console.log(`✅ Test 2 Passed: Gói hồ sơ nộp ${initResult.data.phase} initialized in draft.`);

      // 4. Upload Package Item
      console.log('\n--- Test 3: POST /api/v1/submissions/packages/:id/items (Student uploads report_pdf) ---');
      const uploadPayload = {
        type: 'report_pdf',
        fileId: new mongoose.Types.ObjectId().toString()
      };

      const uploadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/submissions/packages/${packageId}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadPayload)
      });

      const uploadResult = await uploadRes.json();
      console.log('HTTP Status:', uploadRes.status);
      if (!uploadResult.success) {
        throw new Error(`❌ Test 3 Failed: Item upload failed. Msg: ${uploadResult.message}`);
      }
      console.log('✅ Test 3 Passed: Successfully uploaded report_pdf. Item status: submitted.');

      // 5. Submit Package Formally
      console.log('\n--- Test 4: POST /api/v1/submissions/packages/:id/submit ---');
      const submitRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/submissions/packages/${packageId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        }
      });

      const submitResult = await submitRes.json();
      console.log('HTTP Status:', submitRes.status);
      if (!submitResult.success || submitResult.data.status !== 'submitted') {
        throw new Error(`❌ Test 4 Failed: Package submit failed. Msg: ${submitResult.message}`);
      }
      console.log('✅ Test 4 Passed: Package submitted formally. Status: submitted.');

      // 6. Supervisor Review Item
      console.log('\n--- Test 5: POST /api/v1/submissions/packages/:id/review (Supervisor accepts report_pdf) ---');
      const reviewPayload = {
        type: 'report_pdf',
        status: 'accepted'
      };

      const reviewRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/submissions/packages/${packageId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewPayload)
      });

      const reviewResult = await reviewRes.json();
      console.log('HTTP Status:', reviewRes.status);
      if (!reviewResult.success || reviewResult.data.status !== 'accepted') {
        throw new Error(`❌ Test 5 Failed: Item review failed. Msg: ${reviewResult.message}`);
      }
      console.log('✅ Test 5 Passed: Supervisor accepted report_pdf. Package overall status changed to accepted.');

      // 7. File Extension Request
      console.log('\n--- Test 6: POST /api/v1/extensions (Student requests milestone extension) ---');
      const extensionPayload = {
        targetType: 'milestone',
        targetId: milestoneId.toString(),
        projectId: projectId.toString(),
        reason: 'Do em gặp sự cố về thiết bị phần cứng nên xin phép thầy lùi mốc nộp đề cương chi tiết.',
        requestedTo: new Date('2026-06-25T00:00:00.000Z').toISOString()
      };

      const extRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/extensions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(extensionPayload)
      });

      const extResult = await extRes.json();
      console.log('HTTP Status:', extRes.status);
      if (!extResult.success || !extResult.data._id) {
        throw new Error(`❌ Test 6 Failed: Extension request filing failed. Msg: ${extResult.message}`);
      }
      const requestId = extResult.data._id;
      console.log(`✅ Test 6 Passed: Extension filed successfully with ID: ${requestId} in status pending.`);

      // 8. Supervisor Recommendation (Step 1 of double approval)
      console.log('\n--- Test 7: POST /api/v1/extensions/:id/supervisor-approve (Supervisor recommends approval) ---');
      const recommendPayload = {
        status: 'approved',
        note: 'Đồng ý khuyến nghị khoa duyệt gia hạn cho nhóm.'
      };

      const recRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/extensions/${requestId}/supervisor-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recommendPayload)
      });

      const recResult = await recRes.json();
      console.log('HTTP Status:', recRes.status);
      if (!recResult.success || recResult.data.supervisorApproval.status !== 'approved') {
        throw new Error(`❌ Test 7 Failed: Supervisor recommendation failed. Msg: ${recResult.message}`);
      }
      console.log('✅ Test 7 Passed: Step 1 complete. Supervisor recommended extension.');

      // 9. Faculty Decision (Step 2 of double approval)
      console.log('\n--- Test 8: POST /api/v1/extensions/:id/faculty-approve (Faculty Staff final approval) ---');
      const decisionPayload = {
        status: 'approved',
        note: 'Khoa nhất trí duyệt gia hạn mốc báo cáo theo ý kiến của GVHD.'
      };

      const decRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/extensions/${requestId}/faculty-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(decisionPayload)
      });

      const decResult = await decRes.json();
      console.log('HTTP Status:', decRes.status);
      if (!decResult.success || decResult.data.status !== 'approved') {
        throw new Error(`❌ Test 8 Failed: Faculty final approval failed. Msg: ${decResult.message}`);
      }
      console.log('✅ Test 8 Passed: Step 2 complete. Faculty Staff officially approved the request.');

      // 10. Database verification (Verify milestone deadline was auto-updated)
      console.log('\n--- Test 9: Verify target Milestone deadline was updated in Database ---');
      const updatedMilestone = await Milestone.findById(milestoneId);
      console.log('Original Milestone Deadline: 2026-06-10T00:00:00.000Z');
      console.log('New Milestone Deadline in DB:', updatedMilestone.deadline.toISOString());
      
      if (updatedMilestone.deadline.getTime() !== new Date('2026-06-25T00:00:00.000Z').getTime()) {
        throw new Error('❌ Test 9 Failed: The target Milestone deadline was NOT updated correctly.');
      }
      console.log('✅ Test 9 Passed: Database verified! Target milestone deadline was successfully and automatically updated to 2026-06-25!');

      console.log('\n🎉 ALL PHASE 6 SUBMISSIONS & EXTENSIONS INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
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
