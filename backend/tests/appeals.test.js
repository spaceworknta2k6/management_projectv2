process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();

const bcrypt = require('bcryptjs');
const { app } = require('../app');
const {
  db,
  newObjectId,
  User,
  Lecturer,
  Student,
  ProjectPeriod,
  ProjectGroup,
  ProjectTopic,
  Project,
  ScoreSheet,
  FinalGrade,
  AppealRequest,
  WorkflowEvent
} = require('./db-compat');

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
      const prisma = require('../config/prisma');
      await prisma.user.deleteMany({ where: { email: RECHECK_EMAIL } });

      const passwordHash = await bcrypt.hash('password123', 10);
      const recheckUser = await User.create({
        fullName: 'Recheck Lecturer E2E',
        email: RECHECK_EMAIL,
        passwordHash,
        roles: ['LECTURER'],
        status: 'active',
      });
      await prisma.user.create({
        data: {
          id: recheckUser._id.toString(),
          mongoId: recheckUser._id.toString(),
          fullName: recheckUser.fullName,
          email: recheckUser.email,
          passwordHash: recheckUser.passwordHash,
          roles: ['LECTURER'],
          status: 'active',
        }
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
      await prisma.lecturer.create({
        data: {
          id: recheckLecturer._id.toString(),
          mongoId: recheckLecturer._id.toString(),
          userId: recheckLecturer.userId.toString(),
          lecturerCode: recheckLecturer.lecturerCode,
          facultyId: recheckLecturer.facultyId ? recheckLecturer.facultyId.toString() : '',
          departmentId: recheckLecturer.departmentId ? recheckLecturer.departmentId.toString() : '',
          academicDegree: 'master',
          expertise: ['Recheck grading'],
          maxProjects: 10,
        }
      });

      const oldPeriods = await ProjectPeriod.find({ name: TEST_PERIOD_NAME }).setOptions({ includeDeleted: true });
      const oldPrismaPeriods = await prisma.projectPeriod.findMany({
        where: { name: TEST_PERIOD_NAME },
        select: { id: true },
      });
      const oldPeriodIds = oldPeriods.map((period) => period._id);
      const oldPeriodIdStrings = Array.from(new Set([
        ...oldPeriodIds.map(id => id.toString()),
        ...oldPrismaPeriods.map((period) => period.id),
      ]));
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
      await prisma.appealRequest.deleteMany({ where: { periodId: { in: oldPeriodIdStrings } } });
      await prisma.finalGrade.deleteMany({ where: { periodId: { in: oldPeriodIdStrings } } });
      await prisma.scoreSheet.deleteMany({ where: { periodId: { in: oldPeriodIdStrings } } });
      await prisma.project.deleteMany({ where: { periodId: { in: oldPeriodIdStrings } } });
      await prisma.projectTopic.deleteMany({ where: { periodId: { in: oldPeriodIdStrings } } });
      await prisma.projectGroup.deleteMany({ where: { periodId: { in: oldPeriodIdStrings } } });
      await prisma.projectPeriod.deleteMany({ where: { id: { in: oldPeriodIdStrings } } });

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
      await prisma.projectPeriod.create({
        data: {
          id: period._id.toString(),
          mongoId: period._id.toString(),
          name: period.name,
          schoolYear: period.schoolYear,
          semester: period.semester,
          type: period.type,
          facultyId: period.facultyId.toString(),
          departmentId: period.departmentId.toString(),
          registrationStart: period.registrationStart,
          registrationEnd: period.registrationEnd,
          projectStart: period.projectStart,
          projectEnd: period.projectEnd,
          topicChangeDeadline: period.topicChangeDeadline,
          finalSubmissionDeadline: period.finalSubmissionDeadline,
          gradingStart: period.gradingStart,
          gradingEnd: period.gradingEnd,
          revisionDeadline: period.revisionDeadline,
          archiveDeadline: period.archiveDeadline,
          minGroupSize: period.minGroupSize,
          maxGroupSize: period.maxGroupSize,
          rubricVersion: period.rubricVersion,
          scoringFormula: JSON.parse(JSON.stringify(period.scoringFormula || {})),
          status: 'in_progress',
        }
      });

      const group = await ProjectGroup.create({
        periodId: period._id,
        name: 'Appeal Test Group',
        leaderStudentId: student._id,
        members: [{ studentId: student._id, role: 'LEADER', status: 'accepted', contributionWeight: 1 }],
        status: 'locked',
      });
      await prisma.projectGroup.create({
        data: {
          id: group._id.toString(),
          mongoId: group._id.toString(),
          periodId: group.periodId.toString(),
          name: group.name,
          leaderStudentId: group.leaderStudentId.toString(),
          members: JSON.parse(JSON.stringify(group.members)),
          status: group.status,
        }
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
      await prisma.projectTopic.create({
        data: {
          id: topic._id.toString(),
          mongoId: topic._id.toString(),
          periodId: topic.periodId.toString(),
          groupId: topic.groupId.toString(),
          proposedByStudentId: topic.proposedByStudentId.toString(),
          title: topic.title,
          summary: topic.summary,
          objectives: topic.objectives,
          scope: topic.scope,
          expectedResult: topic.expectedResult,
          plan: topic.plan,
          proposedSupervisorId: topic.proposedSupervisorId.toString(),
          supervisorId: topic.supervisorId.toString(),
          departmentId: topic.departmentId.toString(),
          status: topic.status,
        }
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
      await prisma.project.create({
        data: {
          id: project._id.toString(),
          mongoId: project._id.toString(),
          periodId: project.periodId.toString(),
          ownerType: project.ownerType,
          ownerId: project.groupId.toString(),
          groupId: project.groupId.toString(),
          topicId: project.topicId.toString(),
          supervisorId: project.supervisorId.toString(),
          reviewerId: project.reviewerId.toString(),
          status: project.status,
        }
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

      const blockedPublishWithoutReviewer = await apiRequest(`/scores/final-grades/publish-by-period/${period._id}`, staffToken, { method: 'POST', body: {} });
      if (blockedPublishWithoutReviewer.res.status !== 400 || blockedPublishWithoutReviewer.result.success) {
        throw new Error(`Publish should fail while reviewer has not graded: ${JSON.stringify(blockedPublishWithoutReviewer.result)}`);
      }

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

      const prematureGradeId = newObjectId().toString();
      await prisma.finalGrade.create({
        data: {
          id: prematureGradeId,
          mongoId: prematureGradeId,
          projectId: project._id.toString(),
          ownerType: 'group',
          ownerId: group._id.toString(),
          groupId: group._id.toString(),
          periodId: period._id.toString(),
          evaluationMode: 'standard',
          componentScores: { supervisor: 8, reviewer: 8 },
          finalScore: 8,
          letterGrade: 'B+',
          passStatus: 'passed',
          varianceFlags: [],
          formulaVersion: period.rubricVersion,
        }
      });

      const blockedPublish = await apiRequest(`/scores/final-grades/publish-by-period/${period._id}`, staffToken, { method: 'POST', body: {} });
      if (blockedPublish.res.status !== 400 || blockedPublish.result.success) {
        throw new Error(`Publish should fail while reviewer sheet is unlocked: ${JSON.stringify(blockedPublish.result)}`);
      }

      await expectSuccess('Lock reviewer sheet', apiRequest(`/scores/score-sheets/${reviewerSheet.data._id}/lock`, reviewerToken, { method: 'POST', body: {} }));
      await prisma.finalGrade.deleteMany({ where: { projectId: project._id.toString() } });

      const blockedPublishWithoutFinalGrade = await apiRequest(`/scores/final-grades/publish-by-period/${period._id}`, staffToken, { method: 'POST', body: {} });
      if (blockedPublishWithoutFinalGrade.res.status !== 400 || blockedPublishWithoutFinalGrade.result.success) {
        throw new Error(`Publish should fail before final grade aggregation: ${JSON.stringify(blockedPublishWithoutFinalGrade.result)}`);
      }

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
      if (publishResult.data.publishedCount !== 1 || publishResult.data.newlyPublishedCount !== 1 || publishResult.data.totalCount !== 1) {
        throw new Error(`Publish-by-period counts were wrong: ${JSON.stringify(publishResult.data)}`);
      }

      const republishResult = await expectSuccess(
        'Republish final grades by period',
        apiRequest(`/scores/final-grades/publish-by-period/${period._id}`, staffToken, { method: 'POST', body: {} })
      );
      if (republishResult.data.publishedCount !== 1 || republishResult.data.newlyPublishedCount !== 0 || republishResult.data.totalCount !== 1) {
        throw new Error(`Republish counts were wrong: ${JSON.stringify(republishResult.data)}`);
      }

      const publishedGrade = await FinalGrade.findOne({ projectId: project._id });
      const publishedPeriod = await ProjectPeriod.findById(period._id);
      if (!publishedGrade?.publishedAt || publishedPeriod.status !== 'results_published') {
        throw new Error('Publish-by-period did not publish the grade and period correctly.');
      }
      console.log('Publish-by-period endpoint verified successfully.');

      console.log('\n--- Test 3: Submit appeal after opening appeal window ---');
      await prisma.projectPeriod.update({
        where: { id: period._id.toString() },
        data: { status: 'appeal_open' }
      });

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

        const prisma = require('../config/prisma');
        const recheckUserIds = recheckUsers.map(user => user._id.toString());
        await prisma.lecturer.deleteMany({
          where: {
            OR: [
              { lecturerCode: { startsWith: 'RC-APPEAL-' } },
              { userId: { in: recheckUserIds } }
            ]
          }
        });
        await prisma.user.deleteMany({
          where: {
            email: RECHECK_EMAIL
          }
        });

        const testPeriods = await ProjectPeriod.find({ name: TEST_PERIOD_NAME }).setOptions({ includeDeleted: true });
        const prismaTestPeriods = await prisma.projectPeriod.findMany({
          where: { name: TEST_PERIOD_NAME },
          select: { id: true },
        });
        const testPeriodIds = testPeriods.map((period) => period._id);
        const testPeriodIdStrings = Array.from(new Set([
          ...testPeriodIds.map((id) => id.toString()),
          ...prismaTestPeriods.map((period) => period.id),
        ]));

        await Promise.all([
          AppealRequest.deleteMany({ periodId: { $in: testPeriodIds } }),
          FinalGrade.deleteMany({ periodId: { $in: testPeriodIds } }),
          ScoreSheet.deleteMany({ periodId: { $in: testPeriodIds } }),
          Project.deleteMany({ periodId: { $in: testPeriodIds } }),
          ProjectTopic.deleteMany({ periodId: { $in: testPeriodIds } }),
          ProjectGroup.deleteMany({ periodId: { $in: testPeriodIds } }),
          ProjectPeriod.deleteMany({ _id: { $in: testPeriodIds } }),
        ]);

        await prisma.appealRequest.deleteMany({ where: { periodId: { in: testPeriodIdStrings } } });
        await prisma.finalGrade.deleteMany({ where: { periodId: { in: testPeriodIdStrings } } });
        await prisma.scoreSheet.deleteMany({ where: { periodId: { in: testPeriodIdStrings } } });
        await prisma.project.deleteMany({ where: { periodId: { in: testPeriodIdStrings } } });
        await prisma.projectTopic.deleteMany({ where: { periodId: { in: testPeriodIdStrings } } });
        await prisma.projectGroup.deleteMany({ where: { periodId: { in: testPeriodIdStrings } } });
        await prisma.projectPeriod.deleteMany({ where: { id: { in: testPeriodIdStrings } } });

        await db.disconnect();
        console.log('Compatibility DB connection closed.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
