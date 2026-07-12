const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const { authHeaders, closeAuthHelper } = require('./auth-helper');

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api/v1';

test.setTimeout(60000);

test.beforeAll(() => {
  execSync('node clean-e2e.js', { cwd: '..' });
});

test.afterAll(async () => {
  await closeAuthHelper();
});

async function api(request, method, path, token, data) {
  const response = await request[method](`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: '',
    },
    data,
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function periodPayload(name) {
  return {
    name,
    schoolYear: '2025-2026',
    semester: '2',
    type: 'foundation_project',
    registrationStart: '2026-06-01T00:00:00.000Z',
    registrationEnd: '2026-06-15T00:00:00.000Z',
    topicChangeDeadline: '2026-06-20T00:00:00.000Z',
    projectStart: '2026-06-25T00:00:00.000Z',
    projectEnd: '2026-09-15T00:00:00.000Z',
    finalSubmissionDeadline: '2026-09-01T00:00:00.000Z',
    gradingStart: '2026-09-05T00:00:00.000Z',
    gradingEnd: '2026-09-10T00:00:00.000Z',
    revisionDeadline: '2026-09-20T00:00:00.000Z',
    archiveDeadline: '2026-10-01T00:00:00.000Z',
    minGroupSize: 1,
    maxGroupSize: 1,
    rubricVersion: 'HUST-SET-2026',
    scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
  };
}

test('single student topic workflow', async ({ request }) => {
  const runId = Date.now();
  const periodName = `Single Student E2E ${runId}`;
  const topicTitle = `Single Student Topic E2E ${runId}`;
  const milestoneTitle = `Single Student Milestone E2E ${runId}`;

  const staffToken = (await authHeaders('huonglt@hust.edu.vn')).token;
  const studentToken = (await authHeaders('hoanganh@hust.edu.vn')).token;
  const lecturerToken = (await authHeaders('haikt@hust.edu.vn')).token;

  const lecturersRes = await api(request, 'get', '/auth/lecturers', staffToken);
  expect(lecturersRes.response.status()).toBe(200);
  const supervisor = lecturersRes.body.data.find(
    (lecturer) => lecturer.userId?.email === 'haikt@hust.edu.vn' || lecturer.email === 'haikt@hust.edu.vn'
  );
  expect(supervisor?._id).toBeTruthy();

  const createPeriodRes = await api(request, 'post', '/periods', staffToken, periodPayload(periodName));
  expect(createPeriodRes.response.status()).toBe(201);
  const periodId = createPeriodRes.body.data._id;

  const openRegistrationRes = await api(request, 'post', `/periods/${periodId}/open-registration`, staffToken);
  expect(openRegistrationRes.response.status()).toBe(200);

  const rosterRes = await api(request, 'post', `/periods/${periodId}/rosters/import`, staffToken, {
    roster: [
      {
        studentCode: '22021435',
        classSection: 'IT4911',
        fullName: 'Hoang Anh',
        email: 'hoanganh@hust.edu.vn',
      },
    ],
  });
  expect(rosterRes.response.status()).toBe(200);

  const topicRes = await api(request, 'post', '/topics', studentToken, {
    periodId,
    ownerType: 'student',
    proposedSupervisorId: supervisor._id,
    title: topicTitle,
    summary: 'Automated single student topic proposal.',
    objectives: 'Verify that a single student can propose and manage an individual project topic.',
    scope: 'Single-student project workflow covered by automated E2E checks.',
    expectedResult: 'A project workspace is created from an approved individual topic.',
    plan: 'Create period, roster student, propose topic, approve topic, assign supervisor, and create milestone.',
  });
  expect(topicRes.response.status()).toBe(201);
  expect(topicRes.body.data.ownerType).toBe('student');
  expect(topicRes.body.data.groupId || null).toBeNull();
  const topicId = topicRes.body.data._id;

  const approveRes = await api(request, 'post', `/topics/${topicId}/approve`, staffToken, {});
  expect(approveRes.response.status()).toBe(200);

  const assignRes = await api(request, 'post', `/topics/${topicId}/assign-supervisor`, staffToken, {
    supervisorId: supervisor._id,
  });
  expect(assignRes.response.status()).toBe(200);
  const supervisorProjectsRes = await api(request, 'get', '/projects', lecturerToken);
  expect(supervisorProjectsRes.response.status()).toBe(200);
  const project = supervisorProjectsRes.body.data.find((item) => {
    const itemTopicId = item.topicId?._id || item.topicId;
    return itemTopicId === topicId;
  });
  const projectId = project?._id;
  expect(projectId).toBeTruthy();

  const milestoneRes = await api(request, 'post', `/projects/${projectId}/milestones`, lecturerToken, {
    title: milestoneTitle,
    description: 'Automated milestone for single student project.',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  expect(milestoneRes.response.status()).toBe(201);

  const studentProjectsRes = await api(request, 'get', '/projects', studentToken);
  expect(studentProjectsRes.response.status()).toBe(200);
  expect(studentProjectsRes.body.data.some((project) => project._id === projectId)).toBe(true);

  const studentMilestonesRes = await api(request, 'get', `/projects/${projectId}/milestones`, studentToken);
  expect(studentMilestonesRes.response.status()).toBe(200);
  expect(studentMilestonesRes.body.data.some((milestone) => milestone.title === milestoneTitle)).toBe(true);
});
