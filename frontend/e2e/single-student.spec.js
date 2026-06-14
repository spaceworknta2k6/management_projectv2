const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const apiBaseUrl = 'http://localhost:5000/api/v1';

test.setTimeout(60000);

test.beforeAll(() => {
  execSync('node clean-e2e.js', { cwd: '..' });
});

async function login(request, email) {
  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { email, password: 'password123' },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.data.accessToken;
}

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
    preDefenseSubmissionDeadline: '2026-09-01T00:00:00.000Z',
    defenseStart: '2026-09-05T00:00:00.000Z',
    defenseEnd: '2026-09-10T00:00:00.000Z',
    postDefenseRevisionDeadline: '2026-09-20T00:00:00.000Z',
    archiveDeadline: '2026-10-01T00:00:00.000Z',
    minGroupSize: 1,
    maxGroupSize: 1,
    rubricVersion: 'HUST-SET-2026',
    scoringFormula: { supervisor: 0.3, reviewer: 0.2, committee: 0.5 },
  };
}

test('single student topic workflow', async ({ request }) => {
  const runId = Date.now();
  const periodName = `Single Student E2E ${runId}`;
  const topicTitle = `Single Student Topic E2E ${runId}`;
  const milestoneTitle = `Single Student Milestone E2E ${runId}`;

  const staffToken = await login(request, 'huonglt@hust.edu.vn');
  const studentToken = await login(request, 'hoanganh@hust.edu.vn');
  const lecturerToken = await login(request, 'haikt@hust.edu.vn');

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
  const projectId = assignRes.body.data._id;
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
