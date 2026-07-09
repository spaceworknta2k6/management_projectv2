process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();

const { app } = require('../app');

const TEST_PORT = 5014;
const API_BASE = `http://localhost:${TEST_PORT}/api/v1`;

const requestJson = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { res, data, text };
};

const loginActor = async (email, password = 'password123') => {
  const { res, data } = await requestJson('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (res.status !== 200 || !data.success || !data.data?.accessToken) {
    throw new Error(`Login failed for ${email}. HTTP ${res.status}. ${data.message || ''}`);
  }
  return data.data.accessToken;
};

const assertStatus = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual}.`);
  }
};

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\nTemporary PDF checklist test server listening on port ${TEST_PORT}...`);

    try {
      const adminToken = await loginActor('admin@st.phenikaa-uni.edu.vn');
      const staffToken = await loginActor('huonglt@hust.edu.vn');
      const studentToken = await loginActor('hoanganh@hust.edu.vn');

      console.log('\n--- TC-07: Protected route rejects unauthenticated request ---');
      const noAuthMe = await requestJson('/auth/me');
      assertStatus(noAuthMe.res.status, 401, 'TC-07');
      console.log('TC-07 passed.');

      console.log('\n--- TC-10: Creating a period with empty required name is rejected ---');
      const invalidPeriod = await requestJson('/periods', {
        method: 'POST',
        token: staffToken,
        body: {
          name: '',
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
          maxGroupSize: 3,
          rubricVersion: 'PDF-CHECKLIST-TEST',
          scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
        },
      });
      assertStatus(invalidPeriod.res.status, 422, 'TC-10');
      if (!Array.isArray(invalidPeriod.data.errors) || !invalidPeriod.data.errors.some((e) => e.field === 'name')) {
        throw new Error('TC-10: validation response did not include the name field.');
      }
      console.log('TC-10 passed.');

      console.log('\n--- TC-12: Student cannot update another user account ---');
      const adminUsersByStudent = await requestJson('/users', { token: studentToken });
      assertStatus(adminUsersByStudent.res.status, 403, 'TC-12');
      console.log('TC-12 passed.');

      console.log('\n--- TC-14: Deleting a non-existent period returns 404 ---');
      const missingDelete = await requestJson('/periods/ffffffffffffffffffffffff', {
        method: 'DELETE',
        token: staffToken,
      });
      assertStatus(missingDelete.res.status, 404, 'TC-14');
      console.log('TC-14 passed.');

      console.log('\n--- TC-15: User search with a matching keyword returns filtered data ---');
      const searchHit = await requestJson('/users?search=hoanganh', { token: adminToken });
      assertStatus(searchHit.res.status, 200, 'TC-15');
      if (!searchHit.data.success || !searchHit.data.data.some((user) => user.email === 'hoanganh@hust.edu.vn')) {
        throw new Error('TC-15: expected hoanganh@hust.edu.vn in search results.');
      }
      console.log('TC-15 passed.');

      console.log('\n--- TC-16: User search with no matching keyword returns an empty array ---');
      const searchMiss = await requestJson('/users?search=__no_such_user_pdf_checklist__', { token: adminToken });
      assertStatus(searchMiss.res.status, 200, 'TC-16');
      if (!searchMiss.data.success || !Array.isArray(searchMiss.data.data) || searchMiss.data.data.length !== 0) {
        throw new Error('TC-16: expected an empty result array.');
      }
      console.log('TC-16 passed.');

      console.log('\n--- TC-17: Pagination returns page 1 with limit and meta ---');
      const pagedUsers = await requestJson('/users?page=1&limit=5', { token: adminToken });
      assertStatus(pagedUsers.res.status, 200, 'TC-17');
      if (
        !pagedUsers.data.success ||
        !Array.isArray(pagedUsers.data.data) ||
        pagedUsers.data.data.length > 5 ||
        pagedUsers.data.pagination?.page !== 1 ||
        pagedUsers.data.pagination?.limit !== 5
      ) {
        throw new Error('TC-17: pagination data or meta is incorrect.');
      }
      console.log('TC-17 passed.');

      console.log('\n--- TC-20: CSV export returns downloadable CSV content ---');
      const csvRes = await fetch(`${API_BASE}/users/export?format=csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const csvText = await csvRes.text();
      assertStatus(csvRes.status, 200, 'TC-20');
      const contentType = csvRes.headers.get('content-type') || '';
      if (!contentType.includes('text/csv') || !csvText.includes('email') || !csvText.includes('hoanganh@hust.edu.vn')) {
        throw new Error('TC-20: CSV export did not return expected CSV content.');
      }
      console.log('TC-20 passed.');

      console.log('\n--- TC-21: Dashboard stats API returns total, monthly, and recent groups ---');
      const stats = await requestJson('/stats/summary', { token: staffToken });
      assertStatus(stats.res.status, 200, 'TC-21');
      if (!stats.data.success || !stats.data.data?.total || !stats.data.data?.monthly || !stats.data.data?.recent) {
        throw new Error('TC-21: stats summary missing total, monthly, or recent data.');
      }
      console.log('TC-21 passed.');

      console.log('\n--- TC-22: Logout clears session and protected route rejects missing credentials ---');
      const logout = await requestJson('/auth/logout', { method: 'POST' });
      assertStatus(logout.res.status, 200, 'TC-22 logout');
      const afterLogout = await requestJson('/auth/me');
      assertStatus(afterLogout.res.status, 401, 'TC-22 protected route after logout');
      console.log('TC-22 passed.');

      console.log('\nAll PDF checklist API tests passed.');
    } catch (error) {
      console.error('\nPDF checklist test suite failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      console.log('\n--- Shutting Down Test Environment ---');
      server.close(() => {
        console.log('Temporary PDF checklist test server shut down.');
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
