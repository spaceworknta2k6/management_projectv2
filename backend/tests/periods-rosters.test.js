process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();

const { app } = require('../app');
const prisma = require('../config/prisma');

const TEST_PORT = 5001;
const RUN_ID = Date.now().toString().slice(-8);
const LEGACY_PERIOD_NAME = `TEST_LEGACY_PERIOD_${RUN_ID}`;
const MULTI_CLASS_COURSE_CODE = 'TST101';
const MULTI_CLASS_COURSE_NAME = 'Test Multi Class';
const IMPORTED_STUDENT_CODE = `88${RUN_ID.slice(-6)}`;
const SINGLE_STUDENT_CODE = `89${RUN_ID.slice(-6)}`;

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const cleanupTestData = async ({ periodIds = [], batchIds = [], studentCodes = [] } = {}) => {
  const periods = await prisma.projectPeriod.findMany({
    where: {
      OR: [
        { name: { startsWith: 'TEST_LEGACY_PERIOD_' } },
        { courseCode: MULTI_CLASS_COURSE_CODE, courseName: MULTI_CLASS_COURSE_NAME, cohort: 'K99' },
        ...(periodIds.length ? [{ id: { in: periodIds } }] : []),
        ...(batchIds.length ? [{ batchId: { in: batchIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const cleanupPeriodIds = periods.map((period) => period.id);

  const rosters = cleanupPeriodIds.length
    ? await prisma.projectRoster.findMany({
        where: { periodId: { in: cleanupPeriodIds } },
        select: { id: true },
      })
    : [];
  const rosterIds = rosters.map((entry) => entry.id);
  const workflowEntityIds = [...cleanupPeriodIds, ...rosterIds];

  if (workflowEntityIds.length) {
    await prisma.workflowEvent.deleteMany({ where: { entityId: { in: workflowEntityIds } } });
  }
  if (cleanupPeriodIds.length) {
    await prisma.projectRoster.deleteMany({ where: { periodId: { in: cleanupPeriodIds } } });
    await prisma.projectPeriod.deleteMany({ where: { id: { in: cleanupPeriodIds } } });
  }

  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: 'test-import-' } },
        { email: { startsWith: 'test-single-' } },
      ],
    },
    select: { id: true },
  });
  const testUserIds = testUsers.map((user) => user.id);

  const students = await prisma.student.findMany({
    where: {
      OR: [
        ...(studentCodes.length ? [{ studentCode: { in: studentCodes } }] : []),
        ...(testUserIds.length ? [{ userId: { in: testUserIds } }] : []),
      ],
    },
    select: { id: true, userId: true },
  });
  const studentIds = students.map((student) => student.id);
  const userIds = students.map((student) => student.userId);

  if (studentIds.length) {
    const studentRosters = await prisma.projectRoster.findMany({
      where: { studentId: { in: studentIds } },
      select: { id: true },
    });
    const studentRosterIds = studentRosters.map((entry) => entry.id);
    if (studentRosterIds.length) {
      await prisma.workflowEvent.deleteMany({ where: { entityId: { in: studentRosterIds } } });
    }
    await prisma.projectRoster.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
};

const runIntegrationTests = async () => {
  const createdPeriodIds = [];
  const createdBatchIds = [];
  const createdStudentCodes = [IMPORTED_STUDENT_CODE, SINGLE_STUDENT_CODE];

  const server = app.listen(TEST_PORT, async () => {
    console.log(`\nTemporary integration test server listening on port ${TEST_PORT}...`);

    try {
      await cleanupTestData({ studentCodes: createdStudentCodes });

      console.log('\n--- Test 0: Fetch staff operational context ---');
      const staffUser = await prisma.user.findFirst({ where: { email: 'huonglt@hust.edu.vn', isDeleted: false } });
      if (!staffUser) throw new Error('Test 0 Failed: Could not find faculty staff user.');

      const staffLecturer = await prisma.lecturer.findFirst({ where: { userId: staffUser.id, isDeleted: false } });
      if (!staffLecturer) throw new Error('Test 0 Failed: Could not find lecturer profile for staff user.');

      const { facultyId, departmentId } = staffLecturer;
      console.log(`Test 0 Passed: facultyId = ${facultyId}, departmentId = ${departmentId}`);

      console.log('\n--- Test 1: POST /api/v1/auth/login ---');
      const { response: loginResponse, body: loginResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'huonglt@hust.edu.vn',
          password: 'password123',
        }),
      });

      console.log('HTTP Status:', loginResponse.status);
      if (!loginResult.success || !loginResult.data.accessToken) {
        throw new Error('Test 1 Failed: Login failed.');
      }
      const token = loginResult.data.accessToken;
      console.log('Test 1 Passed: Login succeeded as FACULTY_STAFF.');

      const basePeriodPayload = {
        name: LEGACY_PERIOD_NAME,
        schoolYear: '2025-2026',
        semester: 'Hoc ky II',
        type: 'foundation_project',
        facultyId: facultyId.toString(),
        departmentId: departmentId.toString(),
        registrationStart: '2026-06-01T00:00:00.000Z',
        registrationEnd: '2026-06-15T00:00:00.000Z',
        topicChangeDeadline: '2026-06-20T00:00:00.000Z',
        projectStart: '2026-06-25T00:00:00.000Z',
        projectEnd: '2026-10-31T00:00:00.000Z',
        finalSubmissionDeadline: '2026-10-15T00:00:00.000Z',
        gradingStart: '2026-11-05T00:00:00.000Z',
        gradingEnd: '2026-11-15T00:00:00.000Z',
        revisionDeadline: '2026-11-20T00:00:00.000Z',
        archiveDeadline: '2026-11-30T00:00:00.000Z',
        minGroupSize: 1,
        maxGroupSize: 3,
        rubricVersion: 'v1.0-test',
        scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
      };

      console.log('\n--- Test 2: POST /api/v1/periods (legacy single period) ---');
      const { response: createResponse, body: createResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(basePeriodPayload),
      });

      console.log('HTTP Status:', createResponse.status);
      if (!createResult.success || !createResult.data._id || Array.isArray(createResult.data)) {
        console.error('Create Result:', JSON.stringify(createResult, null, 2));
        throw new Error('Test 2 Failed: Could not create legacy ProjectPeriod.');
      }
      const periodId = createResult.data._id;
      createdPeriodIds.push(periodId);
      console.log(`Test 2 Passed: Legacy ProjectPeriod created with ID ${periodId}.`);

      console.log('\n--- Test 3: POST /api/v1/periods (multi-class course offering) ---');
      const multiClassPayload = {
        ...basePeriodPayload,
        name: MULTI_CLASS_COURSE_NAME,
        courseCode: MULTI_CLASS_COURSE_CODE,
        courseName: MULTI_CLASS_COURSE_NAME,
        cohort: 'K99',
        classCount: 3,
        projectType: 'foundation',
        academicUnit: 'computer_science',
        groupMinSize: 2,
        groupMaxSize: 5,
        minGroupSize: 2,
        maxGroupSize: 5,
        scoringFormula: { supervisor: 0.5, secondMarker: 0.5 },
      };

      const { response: multiCreateResponse, body: multiCreateResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(multiClassPayload),
      });

      console.log('HTTP Status:', multiCreateResponse.status);
      if (!multiCreateResult.success || !Array.isArray(multiCreateResult.data) || multiCreateResult.data.length !== 3) {
        console.error('Multi-Class Result:', JSON.stringify(multiCreateResult, null, 2));
        throw new Error('Test 3 Failed: Multi-class period creation did not return 3 class periods.');
      }

      const batchId = multiCreateResult.data[0].batchId;
      const sections = multiCreateResult.data.map((period) => period.classSection).sort();
      const classCodes = multiCreateResult.data.map((period) => period.classCode);
      createdBatchIds.push(batchId);
      createdPeriodIds.push(...multiCreateResult.data.map((period) => period._id));

      if (!batchId || sections.join(',') !== 'N01,N02,N03') {
        throw new Error(`Test 3 Failed: Expected N01,N02,N03 in one batch, got ${sections.join(',')}.`);
      }
      if (!classCodes.every((code) => code.startsWith(`${MULTI_CLASS_COURSE_CODE}-K99-2025-HK2(`))) {
        throw new Error(`Test 3 Failed: Class codes were not generated from course offering code: ${classCodes.join(', ')}`);
      }
      console.log(`Test 3 Passed: Created 3 class periods in batch ${batchId}.`);

      console.log('\n--- Test 4: POST /api/v1/periods/:periodId/rosters/import ---');
      const rosterPayload = {
        roster: [
          {
            studentCode: '22021435',
            classSection: 'IT4911',
            fullName: 'Hoang Anh',
            email: 'hoanganh@hust.edu.vn',
          },
          {
            studentCode: IMPORTED_STUDENT_CODE,
            classSection: 'IT4911',
            fullName: 'Test Import Student',
            email: `test-import-${RUN_ID}@example.edu.vn`,
          },
        ],
      };

      const { response: importResponse, body: importResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters/import`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(rosterPayload),
      });

      console.log('HTTP Status:', importResponse.status);
      if (!importResult.success || importResult.data.length !== 2) {
        console.error('Import Result:', JSON.stringify(importResult, null, 2));
        throw new Error('Test 4 Failed: Batch import did not import 2 students.');
      }
      console.log('Test 4 Passed: Imported roster containing 2 students.');

      console.log('\n--- Test 5: GET /api/v1/periods/:periodId/rosters ---');
      const { response: getRosterResponse, body: getRosterResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'GET',
        headers: authHeaders(token),
      });

      console.log('HTTP Status:', getRosterResponse.status);
      if (!getRosterResult.success || getRosterResult.data.length !== 2) {
        throw new Error('Test 5 Failed: Retrieve roster did not return 2 active entries.');
      }
      console.log('Test 5 Passed: Roster retrieved with exactly 2 active entries.');

      console.log('\n--- Test 6: POST /api/v1/periods/:periodId/rosters ---');
      const singleStudentPayload = {
        studentCode: SINGLE_STUDENT_CODE,
        classSection: 'IT4912',
        fullName: 'Test Single Student',
        email: `test-single-${RUN_ID}@example.edu.vn`,
      };

      const { response: addSingleResponse, body: addSingleResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(singleStudentPayload),
      });

      console.log('HTTP Status:', addSingleResponse.status);
      if (!addSingleResult.success || !addSingleResult.data._id) {
        console.error('Add Single Result:', JSON.stringify(addSingleResult, null, 2));
        throw new Error('Test 6 Failed: Single student registration failed.');
      }
      const singleStudentId = addSingleResult.data.studentId._id || addSingleResult.data.studentId.id || addSingleResult.data.studentId;
      console.log(`Test 6 Passed: Single test student registered with Student ID ${singleStudentId}.`);

      console.log('\n--- Test 7: Verify roster count is 3 ---');
      const { body: rosterCheckResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'GET',
        headers: authHeaders(token),
      });
      console.log('Roster Entry Count:', rosterCheckResult.data.length);
      if (rosterCheckResult.data.length !== 3) {
        throw new Error('Test 7 Failed: Roster count is not 3.');
      }
      console.log('Test 7 Passed: Roster count matches 3 entries.');

      console.log('\n--- Test 8: DELETE /api/v1/periods/:periodId/rosters/:studentId ---');
      const { response: deleteResponse, body: deleteResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters/${singleStudentId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });

      console.log('HTTP Status:', deleteResponse.status);
      if (!deleteResult.success) {
        console.error('Delete Result:', JSON.stringify(deleteResult, null, 2));
        throw new Error('Test 8 Failed: Student removal from roster failed.');
      }

      const { body: rosterVerifyResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/rosters`, {
        method: 'GET',
        headers: authHeaders(token),
      });
      console.log('Roster Entry Count after deletion:', rosterVerifyResult.data.length);
      if (rosterVerifyResult.data.length !== 2) {
        throw new Error('Test 8 Verification Failed: Roster count is not 2 after deletion.');
      }
      console.log('Test 8 Passed: Single test student was soft-deleted from roster.');

      console.log('\n--- Test 9: POST /api/v1/periods/:periodId/open-registration ---');
      const { response: openRegResponse, body: openRegResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/open-registration`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });

      console.log('HTTP Status:', openRegResponse.status);
      if (!openRegResult.success || openRegResult.data.status !== 'registration_open') {
        throw new Error('Test 9 Failed: Failed to transition status to registration_open.');
      }
      console.log('Test 9 Passed: Transitioned ProjectPeriod to registration_open.');

      console.log('\n--- Test 10: POST /api/v1/periods/:periodId/start ---');
      const { response: startPeriodResponse, body: startPeriodResult } = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/periods/${periodId}/start`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });

      console.log('HTTP Status:', startPeriodResponse.status);
      if (!startPeriodResult.success || startPeriodResult.data.status !== 'in_progress') {
        throw new Error('Test 10 Failed: Failed to transition status to in_progress.');
      }
      console.log('Test 10 Passed: Transitioned ProjectPeriod to in_progress.');

      console.log('\nALL PROJECT PERIOD & ROSTER INTEGRATION TESTS PASSED SUCCESSFULLY!');
    } catch (error) {
      console.error('\nIntegration Test Suite Failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      try {
        await cleanupTestData({
          periodIds: createdPeriodIds,
          batchIds: createdBatchIds,
          studentCodes: createdStudentCodes,
        });
        console.log('\nCleaned up test-created periods, rosters, workflow events, and students.');
      } catch (cleanupError) {
        console.error('\nTest cleanup failed:', cleanupError.message);
        process.exitCode = 1;
      }

      console.log('\n--- Shutting Down Test Environment ---');
      server.close(async () => {
        console.log('Temporary test server shut down.');
        await prisma.$disconnect();
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
