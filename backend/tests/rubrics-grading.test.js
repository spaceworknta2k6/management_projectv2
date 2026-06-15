process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();
const { assertSafeTestDatabase } = require('./test-db-guard');
assertSafeTestDatabase();

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectGroup = require('../models/ProjectGroup');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');
const EvaluationRubric = require('../models/EvaluationRubric');
const ScoreSheet = require('../models/ScoreSheet');

const TEST_PORT = 5006;

const runTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n🚀 Temporary integration test server listening on port ${TEST_PORT}...`);

    try {
      // 1. Resolve actors
      const supervisorUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      if (!supervisorUser) throw new Error('Supervisor haikt not found.');
      const supervisorLecturer = await Lecturer.findOne({ userId: supervisorUser._id });
      
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      const studentProfile = await Student.findOne({ userId: studentUser._id });

      const staffUser = await User.findOne({ email: 'huonglt@hust.edu.vn' });

      // Clean up previous runs
      await ProjectPeriod.deleteMany({ name: 'Đợt Đồ Án Chấm Rubric Test' });
      await EvaluationRubric.deleteMany({ name: 'Rubric Đồ Án CNTT Test' });
      console.log('✅ Cleaned up previous test collections.');

      // 2. Create Rubric
      console.log('\n--- Test 1: Creating Evaluation Rubric via Service / API ---');
      const rubric = await EvaluationRubric.create({
        name: 'Rubric Đồ Án CNTT Test',
        version: '1.0',
        criteria: {
          SUPERVISOR: [
            { criteriaCode: 'C1', criteriaName: 'Chuyên cần', maxScore: 5, weight: 0.5 },
            { criteriaCode: 'C2', criteriaName: 'Báo cáo', maxScore: 5, weight: 1.5 },
          ],
          REVIEWER: [
            { criteriaCode: 'C1', criteriaName: 'Phản biện', maxScore: 10, weight: 1.0 }
          ],
          COMMITTEE_MEMBER: [
            { criteriaCode: 'C1', criteriaName: 'Hội đồng', maxScore: 10, weight: 1.0 }
          ]
        },
        createdBy: staffUser._id,
        updatedBy: staffUser._id
      });
      console.log(`✅ Rubric created successfully: ID = ${rubric._id}`);

      // 3. Create Project Period linking the Rubric
      const period = await ProjectPeriod.create({
        name: 'Đợt Đồ Án Chấm Rubric Test',
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
        rubricVersion: '1.0',
        rubricId: rubric._id,
        scoringFormula: {
          supervisor: 0.3,
          reviewer: 0.2,
          committee: 0.5
        },
        status: 'in_progress',
      });
      console.log(`✅ ProjectPeriod created with Rubric link. Rubric ID = ${period.rubricId}`);

      // Create valid Project Group
      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'Group-Test-Rubric',
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
        title: 'Đề tài test rubric',
        summary: '...',
        objectives: '...',
        scope: '...',
        expectedResult: '...',
        plan: '...',
        proposedSupervisorId: supervisorLecturer._id,
        supervisorId: supervisorLecturer._id,
        departmentId: period.departmentId,
        status: 'assigned'
      });

      // Create Project
      const project = await Project.create({
        periodId: period._id,
        groupId: group._id,
        topicId: topic._id,
        supervisorId: supervisorLecturer._id,
        status: 'in_progress'
      });
      console.log(`✅ Project workspace created: ID = ${project._id}`);

      // Login supervisor to get token
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
      const tokenSupervisor = await loginActor('haikt@hust.edu.vn', 'password123');

      // 4. Submit scorecard with invalid score values (exceeds maxScore)
      console.log('\n--- Test 2: Submitting Scorecard with values exceeding maxScore ---');
      const invalidPayload = {
        projectId: project._id.toString(),
        groupId: group._id.toString(),
        periodId: period._id.toString(),
        rubricRole: 'SUPERVISOR',
        targetType: 'SUPERVISOR',
        targetId: project._id.toString(),
        criteriaScores: [
          { criteriaCode: 'C1', criteriaName: 'Chuyên cần', maxScore: 5, score: 6.0, weight: 0.5 }, // Exceeds maxScore 5
          { criteriaCode: 'C2', criteriaName: 'Báo cáo', maxScore: 5, score: 4.5, weight: 1.5 }
        ],
        comment: 'Test comment'
      };

      const resInvalid = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidPayload)
      });
      const resultInvalid = await resInvalid.json();
      console.log('HTTP Status:', resInvalid.status);
      console.log('Error Message:', resultInvalid.message);
      if (resInvalid.status !== 400 && resInvalid.status !== 422) {
        throw new Error('❌ Test 2 Failed: Server accepted score that exceeds maxScore!');
      }
      console.log('✅ Test 2 Passed: Server successfully blocked score that exceeds maxScore.');

      // 5. Submit scorecard with valid values, verify automatic total calculation
      console.log('\n--- Test 3: Submitting Valid Scorecard and verifying automatic weight calculation ---');
      const validPayload = {
        projectId: project._id.toString(),
        groupId: group._id.toString(),
        periodId: period._id.toString(),
        rubricRole: 'SUPERVISOR',
        targetType: 'SUPERVISOR',
        targetId: project._id.toString(),
        criteriaScores: [
          { criteriaCode: 'C1', criteriaName: 'Chuyên cần', maxScore: 5, score: 4.0 }, // weight 0.5 -> 4.0 * 0.5 = 2.0
          { criteriaCode: 'C2', criteriaName: 'Báo cáo', maxScore: 5, score: 4.0 }    // weight 1.5 -> 4.0 * 1.5 = 6.0
        ], // Total should be 2.0 + 6.0 = 8.0
        comment: 'Sinh viên làm việc tích cực'
      };

      const resValid = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenSupervisor}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validPayload)
      });
      const resultValid = await resValid.json();
      if (!resultValid.success) {
        throw new Error(`❌ Test 3 Failed: Valid submission failed. Msg: ${resultValid.message}`);
      }
      console.log('HTTP Status:', resValid.status);
      console.log('Raw Total calculated by Backend:', resultValid.data.rawTotal);
      console.log('Rounded Total calculated by Backend:', resultValid.data.roundedTotal);
      if (resultValid.data.roundedTotal !== 8.0) {
        throw new Error(`❌ Test 3 Failed: Weight math calculation is incorrect. Expected 8.0, got: ${resultValid.data.roundedTotal}`);
      }
      console.log('✅ Test 3 Passed: Scorecard weight calculation verified successfully!');

      // 6. Test public scorecard lookup and integrity signature verification
      console.log('\n--- Test 4: Testing Public Scorecard Verification API (No Login) ---');
      const sheetId = resultValid.data._id;
      const resVerify = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${sheetId}/public-verify`);
      const resultVerify = await resVerify.json();
      if (!resultVerify.success) {
        throw new Error(`❌ Test 4 Failed: Public verify API request failed. Msg: ${resultVerify.message}`);
      }
      console.log('Verification Outcomes:');
      console.log('- Owner:', resultVerify.data.verificationSubject?.displayName);
      console.log('- Primary Student:', resultVerify.data.verificationSubject?.primaryStudent?.fullName);
      console.log('- Grader Name:', resultVerify.data.sheet?.graderId?.userId?.fullName);
      console.log('- Checked Score:', resultVerify.data.sheet?.roundedTotal);
      console.log('- Integrity Hash:', resultVerify.data.integrityHash);
      if (resultVerify.data.verificationSubject?.ownerType !== 'group') {
        throw new Error('❌ Test 4 Failed: Group-owned scorecard was not identified as a group.');
      }
      if (!resultVerify.data.verificationSubject?.primaryStudent?.fullName) {
        throw new Error('❌ Test 4 Failed: Public verify response did not include the group leader/student display data.');
      }
      if (!resultVerify.data.integrityHash || resultVerify.data.integrityHash.length !== 64) {
        throw new Error('❌ Test 4 Failed: Integrity signature/hash was not returned properly.');
      }
      const originalHash = resultVerify.data.integrityHash;
      await ScoreSheet.findByIdAndUpdate(sheetId, { $set: { 'criteriaScores.0.score': 4.5 } });
      const resVerifyAfterScoreEdit = await fetch(`http://localhost:${TEST_PORT}/api/v1/scores/score-sheets/${sheetId}/public-verify`);
      const resultVerifyAfterScoreEdit = await resVerifyAfterScoreEdit.json();
      if (resultVerifyAfterScoreEdit.data.integrityHash === originalHash) {
        throw new Error('❌ Test 4 Failed: Integrity hash did not change after criteria score tampering.');
      }
      console.log('✅ Test 4 Passed: Public verify lookup successfully verified!');

      console.log('\n🎉 ALL DYNAMIC RUBRICS INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    } catch (err) {
      console.error('\n❌ Dynamic Rubrics Test Suite Failed:', err.message);
      if (err.stack) console.error(err.stack);
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

runTests();
