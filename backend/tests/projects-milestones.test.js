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
const ProjectGroup = require('../models/ProjectGroup');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5003;

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
      console.log(`Resolved Supervisor: ${supervisorUser.fullName} (ID: ${supervisorLecturer._id})`);

      // Resolve Reviewer: Nguyễn Thị Hồng
      const reviewerUser = await User.findOne({ email: 'hongnt@hust.edu.vn' });
      if (!reviewerUser) throw new Error('❌ Reviewer Nguyễn Thị Hồng not found.');
      const reviewerLecturer = await Lecturer.findOne({ userId: reviewerUser._id });
      if (!reviewerLecturer) throw new Error('❌ Reviewer Lecturer profile not found.');
      console.log(`Resolved Reviewer: ${reviewerUser.fullName} (ID: ${reviewerLecturer._id})`);

      // Resolve Student: Hoàng Anh
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student Hoàng Anh not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');
      console.log(`Resolved Student: ${studentUser.fullName} (ID: ${studentProfile._id})`);

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
      console.log(`Resolved ProjectPeriod: ${period._id}`);

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
      console.log('✅ Cleaned up collections for this period.');

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
      console.log(`Created Project Group ID: ${group._id}`);

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
      console.log(`Created Project Topic ID: ${topic._id}`);

      // Create official Project Workspace
      const project = await Project.create({
        periodId: period._id,
        groupId: group._id,
        topicId: topic._id,
        supervisorId: supervisorLecturer._id,
        status: 'assigned'
      });
      const projectId = project._id;
      console.log(`Created Project Workspace ID: ${projectId} in assigned status.`);

      // Clean up milestones for this project
      await Milestone.deleteMany({ projectId });

      // 2. Authentication tokens
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
      const tokenReviewer = await loginActor('hongnt@hust.edu.vn', 'password123');
      const tokenStaff = await loginActor('huonglt@hust.edu.vn', 'password123');
      console.log('✅ Access tokens acquired successfully.');

      console.log('\n--- Test 1b: GET /api/v1/projects/:id rejects unassigned lecturer ---');
      const unauthorizedProjectRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      console.log('HTTP Status:', unauthorizedProjectRes.status);
      if (unauthorizedProjectRes.status !== 403) {
        throw new Error(`❌ Test 1b Failed: Unassigned lecturer should not access project detail. Status: ${unauthorizedProjectRes.status}`);
      }
      console.log('✅ Test 1b Passed: Unassigned lecturer cannot access project detail.');

      // 3. Mark Project in progress
      console.log('\n--- Test 2: POST /api/v1/projects/:id/mark-in-progress ---');
      const inProgressRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/mark-in-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        }
      });

      const inProgressResult = await inProgressRes.json();
      console.log('HTTP Status:', inProgressRes.status);
      if (!inProgressResult.success || inProgressResult.data.status !== 'in_progress') {
        throw new Error(`❌ Test 2 Failed: Status is not in_progress. Msg: ${inProgressResult.message}`);
      }
      console.log('✅ Test 2 Passed: Project workspace set to in_progress status.');

      // 4. Create Milestone (Supervisor only)
      console.log('\n--- Test 3: POST /api/v1/projects/:projectId/milestones (Supervisor creates milestone) ---');
      const milestonePayload = {
        title: 'Nộp Đề Cương Chi Tiết',
        description: 'Sinh viên nộp tài liệu đề cương chi tiết định dạng PDF bao gồm sơ đồ phân tích thiết kế.',
        deadline: new Date('2026-06-10').toISOString(),
      };

      const createMilestoneRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(milestonePayload)
      });

      const createMilestoneResult = await createMilestoneRes.json();
      console.log('HTTP Status:', createMilestoneRes.status);
      if (!createMilestoneResult.success || !createMilestoneResult.data._id) {
        throw new Error(`❌ Test 3 Failed: Milestone creation failed. Msg: ${createMilestoneResult.message}`);
      }
      const milestoneId = createMilestoneResult.data._id;
      console.log(`✅ Test 3 Passed: Milestone "${milestonePayload.title}" created successfully with ID: ${milestoneId} and status open.`);

      console.log('\n--- Test 3b: GET /api/v1/projects/:projectId/milestones rejects unassigned lecturer ---');
      const unauthorizedMilestonesRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones`, {
        headers: { 'Authorization': `Bearer ${tokenReviewer}` }
      });
      console.log('HTTP Status:', unauthorizedMilestonesRes.status);
      if (unauthorizedMilestonesRes.status !== 403) {
        throw new Error(`❌ Test 3b Failed: Unassigned lecturer should not access milestone list. Status: ${unauthorizedMilestonesRes.status}`);
      }
      console.log('✅ Test 3b Passed: Unassigned lecturer cannot access milestone list.');

      // 5. Submit Milestone homework (Student only)
      console.log('\n--- Test 4: POST /api/v1/projects/:projectId/milestones/:id/submit (Student submits work) ---');
      const submitPayload = {
        note: 'Em gửi thầy bản đề cương chi tiết và tài liệu vẽ sơ đồ UML ạ.',
        fileIds: [new mongoose.Types.ObjectId().toString()] // Mocked file asset ID
      };

      const submitRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones/${milestoneId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitPayload)
      });

      const submitResult = await submitRes.json();
      console.log('HTTP Status:', submitRes.status);
      if (!submitResult.success || submitResult.data.status !== 'submitted') {
        throw new Error(`❌ Test 4 Failed: Homework submission failed. Msg: ${submitResult.message}`);
      }
      console.log('✅ Test 4 Passed: Student submitted homework. Milestone status changed to submitted.');

      // 6. Supervisor feedback (Supervisor only)
      console.log('\n--- Test 5: POST /api/v1/projects/:projectId/milestones/:id/feedback (Supervisor evaluates) ---');
      const feedbackPayload = {
        comment: 'Đề cương rất tốt, sơ đồ thiết kế UML chính xác. Chấp nhận duyệt mốc.',
        status: 'accepted'
      };

      const feedbackRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones/${milestoneId}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedbackPayload)
      });

      const feedbackResult = await feedbackRes.json();
      console.log('HTTP Status:', feedbackRes.status);
      if (!feedbackResult.success || feedbackResult.data.status !== 'accepted') {
        throw new Error(`❌ Test 5 Failed: Supervisor review failed. Msg: ${feedbackResult.message}`);
      }
      console.log('✅ Test 5 Passed: Supervisor evaluated and approved the milestone (status: accepted).');

      // 6. Supervisor locks and unlocks milestone
      console.log('\n--- Test 6: POST /api/v1/projects/:projectId/milestones/:id/lock and /unlock ---');
      const lockRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones/${milestoneId}/lock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        }
      });

      const lockResult = await lockRes.json();
      console.log('Lock HTTP Status:', lockRes.status);
      if (!lockResult.success || lockResult.data.status !== 'locked') {
        throw new Error(`❌ Test 6 Failed: Milestone lock failed. Msg: ${lockResult.message}`);
      }

      const unlockRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones/${milestoneId}/unlock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        }
      });

      const unlockResult = await unlockRes.json();
      console.log('Unlock HTTP Status:', unlockRes.status);
      if (!unlockResult.success || unlockResult.data.status !== 'accepted') {
        throw new Error(`❌ Test 6 Failed: Milestone unlock did not restore accepted status. Msg: ${unlockResult.message}`);
      }
      console.log('✅ Test 6 Passed: Supervisor locked milestone and unlocked it back to accepted status.');

      // 7. Supervisor can reject a milestone without schema enum errors
      console.log('\n--- Test 7: POST /api/v1/projects/:projectId/milestones/:id/feedback (Supervisor rejects) ---');
      const rejectRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/milestones/${milestoneId}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: 'Cần làm lại báo cáo theo yêu cầu.',
          status: 'rejected'
        })
      });

      const rejectResult = await rejectRes.json();
      console.log('HTTP Status:', rejectRes.status);
      if (!rejectResult.success || rejectResult.data.status !== 'rejected') {
        throw new Error(`❌ Test 7 Failed: Milestone rejection failed. Msg: ${rejectResult.message}`);
      }
      console.log('✅ Test 7 Passed: Supervisor rejected milestone and status was saved as rejected.');

      // 8. Assign Reviewer (Staff only)
      console.log('\n--- Test 8: POST /api/v1/projects/:id/assign-reviewer (Faculty Staff assigns reviewer) ---');
      const reviewerPayload = {
        reviewerId: reviewerLecturer._id.toString()
      };

      const assignReviewerRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/assign-reviewer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewerPayload)
      });

      const assignReviewerResult = await assignReviewerRes.json();
      console.log('HTTP Status:', assignReviewerRes.status);
      if (!assignReviewerResult.success) {
        throw new Error(`❌ Test 8 Failed: Reviewer assignment failed. Msg: ${assignReviewerResult.message}`);
      }
      console.log('✅ Test 8 Passed: Faculty Staff successfully assigned Lecturer Nguyễn Thị Hồng as Reviewer.');

      // 9. Mark Defense Eligible (Staff only)
      console.log('\n--- Test 9: POST /api/v1/projects/:id/mark-defense-eligible ---');
      const eligibleRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/mark-defense-eligible`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        }
      });

      const eligibleResult = await eligibleRes.json();
      console.log('HTTP Status:', eligibleRes.status);
      if (!eligibleResult.success || eligibleResult.data.status !== 'defense_eligible') {
        throw new Error(`❌ Test 9 Failed: Marking defense eligible failed. Msg: ${eligibleResult.message}`);
      }
      console.log('✅ Test 9 Passed: Project workspace successfully marked as defense_eligible.');

      // 10. Finalize Project (Staff only)
      console.log('\n--- Test 10: POST /api/v1/projects/:id/finalize ---');
      const finalizeRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/projects/${projectId}/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        }
      });

      const finalizeResult = await finalizeRes.json();
      console.log('HTTP Status:', finalizeRes.status);
      if (!finalizeResult.success || finalizeResult.data.status !== 'finalized') {
        throw new Error(`❌ Test 10 Failed: Project finalization failed. Msg: ${finalizeResult.message}`);
      }
      console.log('✅ Test 10 Passed: Project successfully finalized and archived.');

      console.log('\n🎉 ALL PHASE 5 WORKSPACE & PROGRESS MILESTONES INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
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
