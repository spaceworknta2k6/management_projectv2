process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();
const { assertSafeTestDatabase } = require('./test-db-guard');
assertSafeTestDatabase();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { app } = require('../app');
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Student = require('../models/Student');
const ProjectPeriod = require('../models/ProjectPeriod');
const ProjectGroup = require('../models/ProjectGroup');
const ProjectTopic = require('../models/ProjectTopic');
const Project = require('../models/Project');
const ScoreSheet = require('../models/ScoreSheet');
const FinalGrade = require('../models/FinalGrade');
const AppealRequest = require('../models/AppealRequest');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5013;
const API_BASE = `http://localhost:${TEST_PORT}/api/v1`;
const TEST_PERIOD_NAME = 'Appeals Recheck Integration Test Period';
const RECHECK_EMAIL = 'recheck.e2e@hust.edu.vn';

const loginActor = async (email) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const result = await res.json();
  if (!result.success || !result.data?.accessToken) {
    throw new Error(`Login failed for ${email}: ${result.message}`);
  }
  return result.data.accessToken;
};

const apiRequest = async (path, token, { method = 'GET', body } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json().catch(() => ({}));
  return { res, result };
};

const expectSuccess = async (label, responsePromise, expectedStatus = 200) => {
  const { res, result } = await responsePromise;
  if (res.status !== expectedStatus || !result.success) {
    throw new Error(`${label} failed. HTTP ${res.status}. Msg: ${result.message}`);
  }
  return result;
};

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\nTemporary appeals integration test server listening on port ${TEST_PORT}...`);

    try {
      console.log('\n--- Test 0: Preparing actors and clean project state ---');
      const [studentUser, supervisorUser, reviewerUser, staffUser] = await Promise.all([
        User.findOne({ email: 'hoanganh@hust.edu.vn' }),
        User.findOne({ email: 'haikt@hust.edu.vn' }),
        User.findOne({ email: 'hongnt@hust.edu.vn' }),
        User.findOne({ email: 'huonglt@hust.edu.vn' }),
      ]);
      if (!studentUser || !supervisorUser || !reviewerUser || !staffUser) {
        throw new Error('Required seeded actors were not found.');
      }

      const [student, supervisor, reviewer, staffLecturer] = await Promise.all([
        Student.findOne({ userId: studentUser._id }),
        Lecturer.findOne({ userId: supervisorUser._id }),
        Lecturer.findOne({ userId: reviewerUser._id }),
        Lecturer.findOne({ userId: staffUser._id }),
      ]);
      if (!student || !supervisor || !reviewer || !staffLecturer) {
        throw new Error('Required seeded profiles were not found.');
      }

      await Lecturer.deleteMany({ lecturerCode: /^RC-APPEAL-/ });
      await User.deleteMany({ email: RECHECK_EMAIL });

      const passwordHash = await bcrypt.hash('password123', 10);
      const recheckUser = await User.create({
        fullName: 'Recheck Lecturer E2E',
        email: RECHECK_EMAIL,
        passwordHash,
        roles: ['LECTURER'],
        status: 'active',
      });
      const recheckLecturer = await Lecturer.create({
        userId: recheckUser._id,
        lecturerCode: `RC-APPEAL-${Date.now()}`,
        facultyId: staffLecturer.facultyId,
        departmentId: staffLecturer.departmentId,
        academicDegree: 'master',
        expertise: ['Recheck grading'],
        maxProjects: 10,
      });

      const oldPeriods = await ProjectPeriod.find({ name: TEST_PERIOD_NAME }).setOptions({ includeDeleted: true });
      const oldPeriodIds = oldPeriods.map((period) => period._id);
      await Promise.all([
        AppealRequest.deleteMany({ periodId: { $in: oldPeriodIds } }),
        FinalGrade.deleteMany({ periodId: { $in: oldPeriodIds } }),
        ScoreSheet.deleteMany({ periodId: { $in: oldPeriodIds } }),
        Project.deleteMany({ periodId: { $in: oldPeriodIds } }),
        ProjectTopic.deleteMany({ periodId: { $in: oldPeriodIds } }),
        ProjectGroup.deleteMany({ periodId: { $in: oldPeriodIds } }),
        WorkflowEvent.deleteMany({ entityType: 'AppealRequest' }),
        ProjectPeriod.deleteMany({ _id: { $in: oldPeriodIds } }),
      ]);

      const period = await ProjectPeriod.create({
        name: TEST_PERIOD_NAME,
        schoolYear: '2025-2026',
        semester: '2',
        type: 'foundation_project',
        facultyId: supervisor.facultyId,
        departmentId: supervisor.departmentId,
        registrationStart: new Date('2026-06-01'),
        registrationEnd: new Date('2026-06-15'),
        topicChangeDeadline: new Date('2026-06-20'),
        projectStart: new Date('2026-06-25'),
        projectEnd: new Date('2026-09-15'),
        finalSubmissionDeadline: new Date('2026-09-01'),
        gradingStart: new Date('2026-09-05'),
        gradingEnd: new Date('2026-09-10'),
        revisionDeadline: new Date('2026-09-20'),
        archiveDeadline: new Date('2026-10-01'),
        minGroupSize: 1,
        maxGroupSize: 2,
        rubricVersion: 'appeal-test-v1',
        scoringFormula: { supervisor: 0.5, reviewer: 0.5, recheck: 0.5 },
        status: 'in_progress',
      });

      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'Appeal Test Group',
        leaderStudentId: student._id,
        members: [{ studentId: student._id, role: 'LEADER', status: 'accepted', contributionWeight: 1 }],
        status: 'locked',
      });

      const topic = await ProjectTopic.create({
        periodId: period._id,
        groupId: group._id,
        proposedByStudentId: student._id,
        title: 'Appeal workflow topic',
        summary: 'Appeal workflow test summary',
        objectives: 'Verify appeal workflow',
        scope: 'Backend integration',
        expectedResult: 'Appeal completed',
        plan: 'Automated test',
        proposedSupervisorId: supervisor._id,
        supervisorId: supervisor._id,
        departmentId: period.departmentId,
        status: 'assigned',
      });

      const project = await Project.create({
        periodId: period._id,
        ownerType: 'group',
        groupId: group._id,
        topicId: topic._id,
        supervisorId: supervisor._id,
        reviewerId: reviewer._id,
        status: 'ready_for_grading',
      });

      const [studentToken, supervisorToken, reviewerToken, staffToken, recheckToken] = await Promise.all([
        loginActor('hoanganh@hust.edu.vn'),
        loginActor('haikt@hust.edu.vn'),
        loginActor('hongnt@hust.edu.vn'),
        loginActor('huonglt@hust.edu.vn'),
        loginActor(RECHECK_EMAIL),
      ]);

      console.log('\n--- Test 1: Create and lock original supervisor/reviewer score sheets ---');
      const supervisorSheet = await expectSuccess(
        'Supervisor score sheet',
        apiRequest('/scores/score-sheets', supervisorToken, {
          method: 'POST',
          body: {
            projectId: project._id.toString(),
            groupId: group._id.toString(),
            periodId: period._id.toString(),
            rubricRole: 'SUPERVISOR',
            targetType: 'SUPERVISOR',
            targetId: project._id.toString(),
            criteriaScores: [{ criteriaCode: 'C1', criteriaName: 'Supervisor score', maxScore: 10, score: 8, weight: 1 }],
            comment: 'Original supervisor score',
          },
        }),
        201
      );
      await expectSuccess('Lock supervisor sheet', apiRequest(`/scores/score-sheets/${supervisorSheet.data._id}/lock`, supervisorToken, { method: 'POST', body: {} }));

      const reviewerSheet = await expectSuccess(
        'Reviewer score sheet',
        apiRequest('/scores/score-sheets', reviewerToken, {
          method: 'POST',
          body: {
            projectId: project._id.toString(),
            groupId: group._id.toString(),
            periodId: period._id.toString(),
            rubricRole: 'REVIEWER',
            targetType: 'REVIEWER',
            targetId: project._id.toString(),
            criteriaScores: [{ criteriaCode: 'C1', criteriaName: 'Reviewer score', maxScore: 10, score: 8, weight: 1 }],
            comment: 'Original reviewer score',
          },
        }),
        201
      );
      await expectSuccess('Lock reviewer sheet', apiRequest(`/scores/score-sheets/${reviewerSheet.data._id}/lock`, reviewerToken, { method: 'POST', body: {} }));

      console.log('\n--- Test 2: Aggregate and publish final grades by period ---');
      const aggregateResult = await expectSuccess(
        'Aggregate final grade',
        apiRequest(`/scores/final-grades/aggregate/${project._id}`, staffToken, { method: 'POST', body: {} })
      );
      if (aggregateResult.data.finalScore !== 8) {
        throw new Error(`Expected original final score 8, got ${aggregateResult.data.finalScore}`);
      }

      const publishResult = await expectSuccess(
        'Publish final grades by period',
        apiRequest(`/scores/final-grades/publish-by-period/${period._id}`, staffToken, { method: 'POST', body: {} })
      );
      if (publishResult.data.publishedCount !== 1 || publishResult.data.totalCount !== 1) {
        throw new Error(`Publish-by-period counts were wrong: ${JSON.stringify(publishResult.data)}`);
      }

      const publishedGrade = await FinalGrade.findOne({ projectId: project._id });
      const publishedPeriod = await ProjectPeriod.findById(period._id);
      if (!publishedGrade?.publishedAt || publishedPeriod.status !== 'results_published') {
        throw new Error('Publish-by-period did not publish the grade and period correctly.');
      }
      console.log('Publish-by-period endpoint verified successfully.');

      console.log('\n--- Test 3: Submit appeal after opening appeal window ---');
      publishedPeriod.status = 'appeal_open';
      await publishedPeriod.save();

      const appealResult = await expectSuccess(
        'Submit appeal',
        apiRequest('/appeals', studentToken, {
          method: 'POST',
          body: {
            projectId: project._id.toString(),
            reason: 'Em xin phúc khảo vì muốn kiểm tra lại điểm phản biện của đồ án.',
          },
        }),
        201
      );
      const appealId = appealResult.data._id;
      if (appealResult.data.status !== 'pending') {
        throw new Error(`Expected appeal status pending, got ${appealResult.data.status}`);
      }

      console.log('\n--- Test 4: Staff assigns recheck lecturer ---');
      const assignResult = await expectSuccess(
        'Assign recheck lecturer',
        apiRequest(`/appeals/${appealId}/assign`, staffToken, {
          method: 'PATCH',
          body: {
            recheckGraderId: recheckLecturer._id.toString(),
            adminNote: 'Assigning independent recheck lecturer.',
            feePaidAt: new Date().toISOString(),
          },
        })
      );
      if (assignResult.data.status !== 'grading') {
        throw new Error(`Expected appeal status grading, got ${assignResult.data.status}`);
      }

      console.log('\n--- Test 5: Recheck lecturer submits and locks recheck score sheet ---');
      const recheckSheet = await expectSuccess(
        'Recheck score sheet',
        apiRequest('/scores/score-sheets', recheckToken, {
          method: 'POST',
          body: {
            projectId: project._id.toString(),
            groupId: group._id.toString(),
            periodId: period._id.toString(),
            rubricRole: 'RECHECK',
            targetType: 'RECHECK',
            targetId: project._id.toString(),
            criteriaScores: [{ criteriaCode: 'C1', criteriaName: 'Recheck score', maxScore: 10, score: 9, weight: 1 }],
            comment: 'Recheck score after appeal.',
          },
        }),
        201
      );
      await expectSuccess('Lock recheck sheet', apiRequest(`/scores/score-sheets/${recheckSheet.data._id}/lock`, recheckToken, { method: 'POST', body: {} }));

      const linkedAppeal = await AppealRequest.findById(appealId);
      if (linkedAppeal.recheckScoreSheetId?.toString() !== recheckSheet.data._id) {
        throw new Error('Recheck score sheet was not linked to the appeal.');
      }

      console.log('\n--- Test 6: Staff completes appeal and republishes final grade ---');
      const completeResult = await expectSuccess(
        'Complete appeal',
        apiRequest(`/appeals/${appealId}/complete`, staffToken, { method: 'POST', body: {} })
      );
      if (completeResult.data.appeal.status !== 'completed') {
        throw new Error(`Expected appeal status completed, got ${completeResult.data.appeal.status}`);
      }

      const recheckedGrade = await FinalGrade.findOne({ projectId: project._id });
      if (recheckedGrade.evaluationMode !== 'recheck' || recheckedGrade.finalScore !== 8.5 || !recheckedGrade.publishedAt) {
        throw new Error(`Rechecked final grade was not updated correctly: ${JSON.stringify(recheckedGrade.toObject())}`);
      }

      const events = await WorkflowEvent.find({ entityType: 'AppealRequest', entityId: appealId }).sort({ createdAt: 1 });
      const actions = events.map((event) => event.action);
      for (const action of ['SUBMIT_APPEAL', 'ASSIGN_RECHECK_GRADER', 'COMPLETE_APPEAL']) {
        if (!actions.includes(action)) {
          throw new Error(`Missing appeal workflow event: ${action}`);
        }
      }

      console.log('All appeal and publish integration checks passed.');
    } catch (error) {
      console.error('\nAppeals integration test failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(async () => {
        const recheckUsers = await User.find({ email: RECHECK_EMAIL }).setOptions({ includeDeleted: true });
        await Lecturer.deleteMany({
          $or: [
            { lecturerCode: /^RC-APPEAL-/ },
            { userId: { $in: recheckUsers.map((user) => user._id) } },
          ],
        });
        await User.deleteMany({ email: RECHECK_EMAIL });
        await mongoose.disconnect();
        console.log('MongoDB connection closed.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
