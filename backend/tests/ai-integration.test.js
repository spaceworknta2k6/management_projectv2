const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const Project = require('../models/Project');
const ProjectGroup = require('../models/ProjectGroup');
const ProjectTopic = require('../models/ProjectTopic');
const Committee = require('../models/Committee');
const DefenseSession = require('../models/DefenseSession');
const SubmissionPackage = require('../models/SubmissionPackage');
const AiJob = require('../models/AiJob');
const TopicEmbedding = require('../models/TopicEmbedding');

const TEST_PORT = 5008;

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Resolve actors
      console.log('\n--- Test 0: Resolving database dependencies ---');
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      if (!studentUser) throw new Error('❌ Student not found.');
      const studentProfile = await Student.findOne({ userId: studentUser._id });
      if (!studentProfile) throw new Error('❌ Student profile not found.');

      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) throw new Error('❌ Supervisor not found.');
      const supervisorLecturer = await Lecturer.findOne({ userId: supervisorUser._id });
      if (!supervisorLecturer) throw new Error('❌ Supervisor Lecturer profile not found.');

      const reviewerUser = await User.findOne({ email: 'hongnt@hust.edu.vn' });
      if (!reviewerUser) throw new Error('❌ Reviewer not found.');
      const reviewerLecturer = await Lecturer.findOne({ userId: reviewerUser._id });
      if (!reviewerLecturer) throw new Error('❌ Reviewer Lecturer profile not found.');

      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });
      if (!staffUser) throw new Error('❌ Staff not found.');

      // Clean up previous runs
      await AiJob.deleteMany({});
      await TopicEmbedding.deleteMany({});
      await Committee.deleteMany({});
      await DefenseSession.deleteMany({});
      await ProjectGroup.deleteMany({});
      await ProjectTopic.deleteMany({});
      await Project.deleteMany({});
      await SubmissionPackage.deleteMany({});
      console.log('✅ Cleaned up old database collections.');

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

      class QuotaError extends Error {
        constructor(msg) { super(msg); this.name = 'QuotaError'; }
      }

      const validateAiJob = (resResult, testName) => {
        if (!resResult.success) {
          throw new Error(`❌ ${testName} Failed: Request unsuccessful. Msg: ${resResult.message}`);
        }
        if (resResult.data && resResult.data.status === 'failed') {
          const errMsg = resResult.data.error || '';
          // HTTP 429 = free-tier quota exhausted — external limit, not a code bug
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            throw new QuotaError(`⚠️ ${testName} Skipped: Gemini API free-tier quota exhausted (HTTP 429).`);
          }
          throw new Error(`❌ ${testName} Failed: AI Job execution failed. Internal Error: ${errMsg}`);
        }
        if (!resResult.data || !resResult.data.result) {
          throw new Error(`❌ ${testName} Failed: AI Job succeeded but returned no result field.`);
        }
        return resResult.data.result;
      };

      const tokenStudent = await loginActor('hoanganh@hust.edu.vn', 'password123');
      const tokenSupervisor = await loginActor('haikt@hust.edu.vn', 'password123');
      const tokenStaff = await loginActor('huonglt@hust.edu.vn', 'password123');
      console.log('✅ Access tokens retrieved successfully.');

      // Mock Project Period
      const period = await ProjectPeriod.create({
        name: 'Đợt Đồ Án K67',
        schoolYear: '2025-2026',
        semester: 'Học kỳ II',
        type: 'foundation_project',
        facultyId: supervisorLecturer.facultyId,
        departmentId: supervisorLecturer.departmentId,
        registrationStart: new Date('2026-06-01'),
        registrationEnd: new Date('2026-06-15'),
        projectStart: new Date('2026-06-25'),
        projectEnd: new Date('2026-10-31'),
        preDefenseSubmissionDeadline: new Date('2026-10-15'),
        defenseStart: new Date('2026-11-05'),
        defenseEnd: new Date('2026-11-15'),
        postDefenseRevisionDeadline: new Date('2026-11-20'),
        archiveDeadline: new Date('2026-11-30'),
        minGroupSize: 1,
        maxGroupSize: 3,
        topicChangeDeadline: new Date('2026-06-20'),
        rubricVersion: 'v1.0',
        scoringFormula: { supervisor: 0.3, reviewer: 0.2, committee: 0.5 },
        status: 'in_progress',
      });

      // Mock Group
      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'IT-Alpha',
        leaderStudentId: studentProfile._id,
        members: [{ studentId: studentProfile._id, role: 'LEADER', status: 'accepted' }],
        status: 'locked'
      });

      // Mock Group 2 for duplicate check reference topic
      const group2 = await ProjectGroup.create({
        periodId: period._id,
        name: 'IT-Beta',
        leaderStudentId: new mongoose.Types.ObjectId(),
        members: [{ studentId: new mongoose.Types.ObjectId(), role: 'LEADER', status: 'accepted' }],
        status: 'locked'
      });

      // Mock a Topic to test duplicate checker
      const oldTopic = await ProjectTopic.create({
        periodId: period._id,
        groupId: group2._id,
        proposedByStudentId: studentProfile._id,
        title: 'Xây dựng website bán hàng trực tuyến tích hợp cổng thanh toán MoMo',
        summary: 'Website thương mại điện tử viết bằng React và Node.js.',
        objectives: 'Mục tiêu...',
        scope: 'Đại học Bách Khoa',
        expectedResult: 'Website...',
        plan: 'Kế hoạch...',
        status: 'approved',
        departmentId: period.departmentId
      });

      const newTopic = await ProjectTopic.create({
        periodId: period._id,
        groupId: group._id,
        proposedByStudentId: studentProfile._id,
        title: 'Phát triển hệ thống thương mại điện tử tích hợp cổng thanh toán trực tuyến MoMo và VNPay',
        summary: 'Website bán hàng viết bằng ReactJS, backend NodeJS, kết nối cổng thanh toán.',
        objectives: 'Mục tiêu...',
        scope: 'Đại học Bách Khoa',
        expectedResult: 'Hệ thống...',
        plan: 'Kế hoạch...',
        status: 'submitted',
        departmentId: period.departmentId
      });
      const topicId = newTopic._id;
      console.log(`✅ Created mock topics. Target topic ID: ${topicId}`);

      // Mock Project Workspace
      const project = await Project.create({
        periodId: period._id,
        groupId: group._id,
        topicId: topicId,
        supervisorId: supervisorLecturer._id,
        reviewerId: reviewerLecturer._id,
        status: 'in_progress'
      });
      const projectId = project._id;
      console.log(`✅ Created mock project: ${projectId}`);

      // Mock Committee & Defense Session for Defense questions check
      const committee = await Committee.create({
        periodId: period._id,
        name: 'Hội đồng chấm HĐ-01',
        facultyId: period.facultyId,
        members: [
          { lecturerId: supervisorLecturer._id, role: 'COMMITTEE_MEMBER' },
          { lecturerId: reviewerLecturer._id, role: 'COMMITTEE_SECRETARY' },
          { lecturerId: new mongoose.Types.ObjectId(), role: 'COMMITTEE_CHAIR' }
        ],
        status: 'active'
      });

      await DefenseSession.create({
        projectId,
        groupId: group._id,
        committeeId: committee._id,
        mode: 'online',
        defenseDate: new Date('2026-06-15'),
        startTime: '09:00',
        endTime: '09:45',
        orderNumber: 1,
        status: 'scheduled'
      });
      console.log('✅ Created mock committee & defense session.');

      // 2. AI Duplicate Topic Check
      console.log('\n--- Test 1: POST /api/v1/ai/topics/:id/check-duplicate (AI duplicate check) ---');
      const dupRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/topics/${topicId}/check-duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        }
      });
      const dupResult = await dupRes.json();
      console.log('HTTP Status:', dupRes.status);
      const dupResultData = validateAiJob(dupResult, 'Test 1');
      const jobId = dupResult.data._id;
      console.log('AI Duplicate Analysis Outcome:');
      console.log('- hasRisk:', dupResultData.hasRisk);
      console.log('- riskScore:', dupResultData.riskScore, '%');
      console.log('- matches count:', dupResultData.matches?.length);
      console.log('✅ Test 1 Passed: AI duplicate check completed successfully!');

      // 3. AI Topic Suggestions
      console.log('\n--- Test 2: POST /api/v1/ai/students/:id/topic-suggestions ---');
      const sugRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/students/${studentProfile._id}/topic-suggestions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        }
      });
      const sugResult = await sugRes.json();
      console.log('HTTP Status:', sugRes.status);
      const sugResultData = validateAiJob(sugResult, 'Test 2');
      console.log(`✅ Test 2 Passed: Found ${sugResultData.suggestions.length} recommendations based on student's skills!`);

      // 4. AI Report Feedback
      console.log('\n--- Test 3: POST /api/v1/ai/submissions/:id/report-feedback ---');
      const mockPkg = await SubmissionPackage.create({
        ownerType: 'project',
        ownerId: projectId,
        groupId: group._id,
        periodId: period._id,
        deadline: new Date('2026-06-30'),
        phase: 'proposal',
        items: [{ type: 'report_pdf', fileId: new mongoose.Types.ObjectId(), status: 'submitted' }],
        status: 'submitted'
      });

      const feedRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/submissions/${mockPkg._id}/report-feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        }
      });
      const feedResult = await feedRes.json();
      console.log('HTTP Status:', feedRes.status);
      const feedResultData = validateAiJob(feedResult, 'Test 3');
      console.log('AI Report Feedback Analysis Outcomes:');
      console.log('- structureOk:', feedResultData.structureOk);
      console.log('- missingSections:', feedResultData.missingSections);
      console.log('- weaknesses:', feedResultData.weaknesses);
      console.log('- suggestions:', feedResultData.suggestions);
      console.log('✅ Test 3 Passed: AI report feedback completed successfully!');

      // 5. AI Defense Questions & Security check
      console.log('\n--- Test 4: AI Defense Questions and Security scoping ---');
      // Student tries to view defense questions
      const badQuesRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/projects/${projectId}/defense-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStudent}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Student Request HTTP Status (Should be 403):', badQuesRes.status);
      if (badQuesRes.status !== 403) {
        throw new Error('❌ Test 4 Failed: Student was allowed to fetch committee defense questions.');
      }
      console.log('✅ Test 4a Passed: Student blocked from viewing exam questions!');

      // Committee Member Nguyễn Thị Hồng views questions
      const goodQuesRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/projects/${projectId}/defense-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`, // haikt (Supervisor is in committee)
          'Content-Type': 'application/json'
        }
      });
      const goodQuesResult = await goodQuesRes.json();
      console.log('Committee Request HTTP Status:', goodQuesRes.status);
      const goodQuesResultData = validateAiJob(goodQuesResult, 'Test 4');
      console.log(`✅ Test 4 Passed: Committee successfully retrieved ${goodQuesResultData.questions.length} deep defense questions!`);

      // 6. Cache Hit Hit Check & Manual Override
      console.log('\n--- Test 5: Cache Hit hit check and Manual Override ---');
      const startTimer = Date.now();
      
      // Request duplicate check again with same input
      const cacheRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/topics/${topicId}/check-duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        }
      });
      const cacheResult = await cacheRes.json();
      const duration = Date.now() - startTimer;
      console.log('Cache Request HTTP Status:', cacheRes.status);
      console.log('Cache Hit Response duration:', duration, 'ms');
      console.log('Is same Job ID (Cache Hit):', cacheResult.data._id === jobId);
      if (duration > 500 || cacheResult.data._id !== jobId) {
        throw new Error('❌ Test 5 Failed: Cache hit was not resolved locally or returned a different job.');
      }
      console.log('✅ Test 5a Passed: Cache hit resolved in millisecond timescale without redundant Gemini API calls!');

      // Manual Override
      const overridePayload = {
        result: {
          hasRisk: false,
          riskScore: 10,
          matches: [],
          comment: 'Mặc dù AI báo trùng lặp cao, Giáo vụ đã rà soát thủ công và thấy hai hệ thống thanh toán VNPay và MoMo có các mô hình dữ liệu khác nhau nên chấp nhận đề tài.'
        }
      };

      const overRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/ai/jobs/${jobId}/manual-override`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenStaff}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(overridePayload)
      });
      const overResult = await overRes.json();
      console.log('Override HTTP Status:', overRes.status);
      if (!overResult.success || !overResult.data.manualOverride) {
        throw new Error('❌ Test 5 Failed: Manual override failed.');
      }
      console.log('Manual Override saved in DB:');
      console.log('- comment:', overResult.data.manualOverride.comment);
      console.log('✅ Test 5 Passed: Manual override applied successfully!');

      // Clean up Period
      await ProjectPeriod.findByIdAndDelete(period._id);

      console.log('\n🎉 ALL PHASE 12 AI INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    } catch (error) {
      if (error.name === 'QuotaError') {
        console.warn('\n⚠️  AI QUOTA WARNING:', error.message);
        console.warn('   Lỗi này do giới hạn free-tier Gemini API (20 req/ngày), KHÔNG phải lỗi code.');
        console.warn('   Chạy lại sau 24h hoặc nâng cấp API key để kiểm thử đầy đủ.');
        process.exitCode = 2; // Quota sentinel — treated as warning by run-all.js
      } else {
        console.error('\n❌ Integration Test Suite Failed:', error.message);
        if (error.stack) console.error(error.stack);
        process.exitCode = 1;
      }
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
